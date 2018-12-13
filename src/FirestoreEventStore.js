'use strict'

const IEventStore = require('./IEventStore')
const ITracer = require('./ITracer')
const Aggregate = require('./Aggregate')
const Err = require('./Err')
const Padder = require('./Padder')

function aggregatesPath (tenant, aggregateType) {
  return '/tenants/'.concat(tenant, aggregateType.path)
}

function streamPath (tenant, aggregateType) {
  return '/tenants/'.concat(tenant, '/streams/', aggregateType.stream)
}

class FirestoreSnapshooter {
  constructor (db) {
    this._db_ = db
  }

  async load (tenant, aggregateType, aggregateId) {
    const doc = await this._db_.collection(aggregatesPath(tenant, aggregateType)).doc(aggregateId).get()
    return doc.exists ? Aggregate.create(this, aggregateType, doc.data()) : null
  }

  async save (tenant, aggregate) {
    const aggregateType = Object.getPrototypeOf(aggregate).constructor
    const aggRef = this._db_.collection(aggregatesPath(tenant, aggregateType)).doc(aggregate.aggregateId)
    await aggRef.set(Object.assign({}, aggregate))
  }
}

module.exports = class FirestoreEventStore extends IEventStore {
  constructor (db, snapshots = true, tracer = null) {
    super()
    this._db_ = db
    if (snapshots) this._snapshooter_ = new FirestoreSnapshooter(db)
    this._tracer_ = tracer || new ITracer()
  }

  async loadAggregate (tenant, aggregateType, aggregateId) {
    if (aggregateId) {
      const aggregate = (this._snapshooter_ ? await this._snapshooter_.load(tenant, aggregateType, aggregateId) : null) || Aggregate.create(this, aggregateType, { _aggregate_id_: aggregateId })
      
      // load events that ocurred after snapshot was taken
      const aggregateVersionPadder = new Padder(aggregateType.maxEvents)
      const versionPadded = aggregateVersionPadder.pad(aggregate.aggregateVersion + 1)
      const eventsRef = this._db_.collection(streamPath(tenant, aggregateType).concat('/events'))
      const events = await eventsRef.where('_a', '==', aggregate.aggregateId).where('_v', '>=', versionPadded).get()
      events.forEach(doc => {
        const event = Object.freeze(doc.data())
        aggregate.loadEvent(event)
        this._tracer_.trace({ stat: 'loadEvent', aggregateType, event })
      })
      return aggregate
    }
    // return new aggregate with generated id
    const newAggRef = this._db_.collection(aggregatesPath(tenant, aggregateType)).doc()
    return Aggregate.create(this, aggregateType, { _aggregate_id_: newAggRef.id })
  }

  async commitEvents (actor, command, aggregate, expectedVersion) {
    if (aggregate.aggregateVersion !== expectedVersion) throw Err.concurrencyError()
    const aggregateType = Object.getPrototypeOf(aggregate).constructor
    if (expectedVersion + 1 >= aggregateType.maxEvents - 1) throw Err.preconditionError('max events reached')

    const eventsVersionPadder = new Padder(1e6)
    const aggregateVersionPadder = new Padder(aggregateType.maxEvents)
    const streamRef = this._db_.doc(streamPath(actor.tenant, aggregateType))
    const streamDoc = await streamRef.get()
    let eventVersion = 0
    const batch = this._db_.batch()
    if (!streamDoc.exists) batch.create(streamRef, {})
    else eventVersion = streamDoc.data()._version_
    const eventsRef = streamRef.collection('events')
    const events = []
    aggregate._uncommitted_events_.forEach(event => {
      const eventId = eventsVersionPadder.pad(eventVersion++)
      const eventObject = Object.assign({
        _u: actor.id,
        _c: command,
        _a: aggregate._aggregate_id_,
        _v: aggregateVersionPadder.pad(++expectedVersion)
      }, event)
      batch.create(eventsRef.doc(eventId), eventObject)
      events.push(eventObject)
    })
    batch.update(streamRef, { _version_: eventVersion })

    // commit batch
    try {
      await batch.commit()
      aggregate._aggregate_version_ = expectedVersion

      // save snapshot
      if (this._snapshooter_) await this._snapshooter_.save(actor.tenant, aggregate)

      return events
    }
    catch(error) {
      throw Err.concurrencyError() 
    }
  }
}
