'use strict'

const IEventStore = require('../IEventStore')
const ITracer = require('../ITracer')
const Aggregate = require('../Aggregate')
const PromiseQueue = require('../PromiseQueue')
const Err = require('../Err')

function aggregatesPath (tenant, aggregateType) {
  return '/tenants/'.concat(tenant, aggregateType.path)
}

function streamPath (tenant, stream) {
  return '/tenants/'.concat(tenant, '/streams/', stream)
}

class Padder {
  constructor (max = 1e6) {
    this.padLen = (max - 1).toString().length
    if (this.padLen > 6) throw Err.preconditionError('max events is higher than 1000000')
    this.padStr = '000000'.substr(0, this.padLen)
  }

  pad (number) {
    const s = number.toString()
    return this.padStr.substr(0, this.padLen - s.length).concat(s)
  }
}

class FirestoreSnapshooter {
  constructor (db) {
    this._db_ = db
  }

  async load (tenant, aggregateType, aggregateId) {
    const doc = await this._db_.collection(aggregatesPath(tenant, aggregateType)).doc(aggregateId).get()
    return doc.exists ? Aggregate.create(aggregateType, doc.data()) : null
  }

  async save (tenant, aggregate) {
    try {
      const aggregateType = Object.getPrototypeOf(aggregate).constructor
      const aggRef = this._db_.collection(aggregatesPath(tenant, aggregateType)).doc(aggregate.aggregateId)
      await aggRef.set(aggregate.clone())
    }
    catch (e) {
      console.log(e)
    }
  }
}

module.exports = class FirestoreEventStore extends IEventStore {
  constructor (db, snapshots = true, tracer = null) {
    super()
    this._db_ = db
    if (snapshots) this._snapshooter_ = new FirestoreSnapshooter(db)
    this._tracer_ = tracer || new ITracer()
    this._commitQueue_ = new PromiseQueue()
  }

  async loadAggregate (tenant, aggregateType, aggregateId) {
    if (aggregateId) {
      const aggregate = (this._snapshooter_ ? await this._snapshooter_.load(tenant, aggregateType, aggregateId) : null) || Aggregate.create(aggregateType, { _aggregate_id_: aggregateId })
      
      // load events that ocurred after snapshot was taken
      const aggregateVersionPadder = new Padder(aggregateType.maxEvents)
      const versionPadded = aggregateVersionPadder.pad(aggregate.aggregateVersion + 1)
      const eventsRef = this._db_.collection(streamPath(tenant, aggregateType.stream).concat('/events'))
      const events = await eventsRef.where('_a', '==', aggregate.aggregateId).where('_v', '>=', versionPadded).get()
      events.forEach(doc => {
        const event = Object.freeze(doc.data())
        aggregate._loadEvent(event)
        this._tracer_.trace(() => ({ stat: 'loadEvent', aggregateType, event }))
      })
      return aggregate
    }
    // return new aggregate with generated id
    const newAggRef = this._db_.collection(aggregatesPath(tenant, aggregateType)).doc()
    return Aggregate.create(aggregateType, { _aggregate_id_: newAggRef.id })
  }

  async loadEvents (tenant, stream, fromVersion, limit) {
    const eventsRef = this._db_.collection(streamPath(tenant, stream).concat('/events'))
    const query = await eventsRef.where('_version_', '>=', fromVersion).limit(limit).get()
    const events = []
    query.forEach(doc => { events.push(Object.freeze(doc.data())) })
    return events
  }

  async commitEvents (actor, command, aggregate, expectedVersion) {
    if (aggregate.aggregateVersion !== expectedVersion) throw Err.concurrencyError()
    const commit = async ({ actor, command, aggregate, expectedVersion }) => {
      const aggregateType = Object.getPrototypeOf(aggregate).constructor
      if (expectedVersion + 1 >= aggregateType.maxEvents - 1) throw Err.preconditionError('max events reached')
      
      const eventsVersionPadder = new Padder()
      const aggregateVersionPadder = new Padder(aggregateType.maxEvents)
      const streamRef = this._db_.doc(streamPath(actor.tenant, aggregateType.stream))
      const eventsRef = streamRef.collection('events')
      return await this._db_.runTransaction(async transaction => {
        const events = []

        // get stream version
        const streamDoc = await transaction.get(streamRef)
        const streamData = streamDoc.data()
        let version = (streamData && typeof streamData._version_ !== 'undefined') ? streamData._version_ : -1
        
        // check aggregate version
        const paddedExpectedVersion = aggregateVersionPadder.pad(expectedVersion)
        const check = await eventsRef.where('_a', '==', aggregate.aggregateId).where('_v', '>', paddedExpectedVersion).limit(1).get()
        if (!check.empty) throw Err.concurrencyError()

        for(let event of aggregate._uncommitted_events_) {
          const eventId = eventsVersionPadder.pad(++version)
          const eventObject = Object.assign({
            _u: actor.id,
            _c: command,
            _a: aggregate._aggregate_id_,
            _v: aggregateVersionPadder.pad(++expectedVersion),
            _version_: version
          }, event)
          await transaction.set(eventsRef.doc(eventId), eventObject)
          events.push(eventObject)
        }
        await transaction.set(streamRef, { _version_: version }, { merge: true })
        return { events, version: expectedVersion }
      })
    }
    const { events, version } = await this._commitQueue_.push(commit, { actor, command, aggregate, expectedVersion })
    aggregate._aggregate_version_ = version
    if (this._snapshooter_) await this._snapshooter_.save(actor.tenant, aggregate)
    return events
  }

  async getStreamData (tenant, stream) {
    const streamDoc = await this._db_.doc(streamPath(tenant, stream)).get()
    return streamDoc.data() || { _version_: -1, _cursors_: {} }
  }

  async commitCursors (tenant, stream, handlers) {
    const streamRef = this._db_.doc(streamPath(tenant, stream))
    const cursors = {}
    await this._db_.runTransaction(async transaction => {
      const streamDoc = await transaction.get(streamRef)
      const data = streamDoc.data() || {}
      if (!data._cursors_) data._cursors_ = {}
      for (let key of Object.keys(handlers)) {
        const handler = handlers[key]
        const oldVersion = data._cursors_[key] || 0
        const newVersion = handler._version_
        cursors[key] = newVersion > oldVersion ? newVersion : oldVersion
      }
      await transaction.set(streamRef, { _cursors_: cursors }, { merge: true })
    })
    return cursors
  }
}
