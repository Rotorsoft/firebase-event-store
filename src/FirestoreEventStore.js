'use strict'

const IEventStore = require('./IEventStore')
const IEventHandler = require('./IEventHandler')
const Aggregate = require('./Aggregate')
const Err = require('./Err')
const Padder = require('./Padder')

function aggregatesPath (tenant, aggregateType) {
  return '/tenants/'.concat(tenant, aggregateType.path)
}

function streamPath (tenant, aggregateType) {
  return '/tenants/'.concat(tenant, '/streams/', aggregateType.stream)
}

class FirestoreSnapshooter extends IEventHandler {
  constructor (db) {
    super()
    this._db_ = db
  }

  async load (tenant, aggregateType, aggregateId) {
    const doc = await this._db_.collection(aggregatesPath(tenant, aggregateType)).doc(aggregateId).get()
    return doc.exists ? Aggregate.create(this, aggregateType, doc.data()) : null
  }

  async handle (actor, aggregate) {
    const aggregateType = Object.getPrototypeOf(aggregate).constructor
    const aggRef = this._db_.collection(aggregatesPath(actor.tenant, aggregateType)).doc(aggregate.aggregateId)
    await aggRef.set(Object.assign({}, aggregate))
  }
}

class FirestoreEventStore extends IEventStore {
  constructor (db, snapshooter = null) {
    super()
    this._db_ = db
    this.snapshooter = snapshooter
  }

  async loadAggregate (tenant, aggregateType, aggregateId) {
    if (aggregateId) {
      const aggregate = (this.snapshooter ? await this.snapshooter.load(tenant, aggregateType, aggregateId) : null) || Aggregate.create(this, aggregateType, { _aggregate_id_: aggregateId })
      
      // load events that ocurred after snapshot was taken
      const aggregateVersionPadder = new Padder(aggregateType.maxEvents)
      const versionPadded = aggregateVersionPadder.pad(aggregate.aggregateVersion + 1)
      // console.log('loading ' + aggregateId + ' from v' + versionPadded)
      const eventsRef = this._db_.collection(streamPath(tenant, aggregateType).concat('/events'))
      const events = await eventsRef.where('_aid', '==', aggregate.aggregateId).where('_v', '>=', versionPadded).get()
      events.forEach(doc => {
        const event = Object.freeze(doc.data())
        // console.log(doc.id + ' : ' + JSON.stringify(event))
        aggregate.loadEvent(event)
      })
      return aggregate
    }
    // return new aggregate with generated id
    const newAggRef = this._db_.collection(aggregatesPath(tenant, aggregateType)).doc()
    return Aggregate.create(this, aggregateType, { _aggregate_id_: newAggRef.id })
  }

  async commitEvents (tenant, aggregate, expectedVersion) {
    if (aggregate.aggregateVersion !== expectedVersion) throw Err.concurrencyError()
    const aggregateType = Object.getPrototypeOf(aggregate).constructor
    if (expectedVersion + 1 >= aggregateType.maxEvents - 1) throw Err.preconditionError('max events reached')

    const eventsVersionPadder = new Padder(1e6)
    const aggregateVersionPadder = new Padder(aggregateType.maxEvents)
    const streamRef = this._db_.doc(streamPath(tenant, aggregateType))
    const streamDoc = await streamRef.get()
    let eventVersion = 0
    const batch = this._db_.batch()
    if (!streamDoc.exists) batch.create(streamRef, {})
    else eventVersion = streamDoc.data()._version_
    const eventsRef = streamRef.collection('events')
    aggregate._uncommitted_events_.forEach(event => {
      const eventId = eventsVersionPadder.pad(eventVersion++)
      const eventObject = Object.assign({ _aid: aggregate._aggregate_id_, _v: aggregateVersionPadder.pad(++expectedVersion) }, event)
      batch.create(eventsRef.doc(eventId), eventObject)
      // console.log('creating ' + eventId + ' : ' + JSON.stringify(eventObject))
    })
    batch.update(streamRef, { _version_: eventVersion })

    // commit batch
    try {
      await batch.commit()
      aggregate._aggregate_version_ = expectedVersion
      return aggregate
    }
    catch(error) {
      throw Err.concurrencyError() 
    }
  }
}

module.exports = {
  FirestoreEventStore,
  FirestoreSnapshooter
}
