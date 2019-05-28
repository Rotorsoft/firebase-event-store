'use strict'

const IEventStore = require('../IEventStore')
const ITracer = require('../ITracer')
const Aggregate = require('../Aggregate')
const Event = require('../Event')
const Err = require('../Err')

function snapshotPath (tenant, path) {
  return '/tenants/'.concat(tenant, path || '/snapshots')
}

function streamPath (tenant, stream) {
  return '/tenants/'.concat(tenant, '/streams/', stream)
}

class Padder {
  constructor (max = 1e6) {
    this.padLen = (max - 1).toString().length
    if (this.padLen > 6) throw Err.precondition('max events is higher than 1000000')
    this.padStr = '000000'.substr(0, this.padLen)
  }

  pad (number) {
    const s = number.toString()
    return this.padStr.substr(0, this.padLen - s.length).concat(s)
  }
}

module.exports = class FirestoreEventStore extends IEventStore {
  constructor (db, tracer = null) {
    super()
    this._db_ = db
    this._tracer_ = tracer || new ITracer()
  }

  async loadAggregate (context) {
    const { actor, aggregateType, aggregateId, expectedVersion } = context
    const collRef = this._db_.collection(snapshotPath(actor.tenant, aggregateType.path))
    if (aggregateId) {
      const doc = aggregateType.path ? await collRef.doc(aggregateId).get() : null
      const aggregate = Aggregate.create(aggregateType, doc && doc.exists ? doc.data() : { _aggregate_id_: aggregateId, _aggregate_version_: -1 })
      
      // load events that ocurred after snapshot was taken
      if (expectedVersion === -1 || aggregate.aggregateVersion < expectedVersion) {
        const eventsRef = this._db_.collection(streamPath(actor.tenant, aggregateType.stream).concat('/events'))
        const events = await eventsRef.where('_t', '==', aggregateType.name).where('_a', '==', aggregate.aggregateId).where('_v', '>=', aggregate.aggregateVersion + 1).get()
        events.forEach(doc => {
          const event = Event.create(doc.data())
          aggregate._loadEvent(event)
        })
      }
      return aggregate
    }
    // return new aggregate with auto generated id
    context.aggregateId = collRef.doc().id
    return Aggregate.create(aggregateType, { _aggregate_id_: context.aggregateId })
  }

  async commitEvents (context) {
    const { actor, command, aggregateType, aggregate } = context
    let { expectedVersion } = context
    if (aggregate.aggregateVersion !== expectedVersion) throw Err.concurrency()

    const eventsVersionPadder = new Padder()
    const streamRef = this._db_.doc(streamPath(actor.tenant, aggregateType.stream))
    const eventsRef = streamRef.collection('events')
    
    return await this._db_.runTransaction(async transaction => {
      const events = []

      // get stream version
      const streamDoc = await transaction.get(streamRef)
      const streamData = streamDoc.data()
      let version = (streamData && typeof streamData._version_ !== 'undefined') ? streamData._version_ : -1
      
      // check aggregate version
      const check = await eventsRef.where('_t', '==', aggregateType.name).where('_a', '==', aggregate.aggregateId).where('_v', '>', expectedVersion).limit(1).get()
      if (!check.empty) throw Err.concurrency()

      for(let event of aggregate._uncommitted_events_) {
        const eventId = eventsVersionPadder.pad(++version)
        const stampedEvent = event._stamp(actor.id, command, aggregateType.name, aggregate._aggregate_id_, ++expectedVersion, version)
        await transaction.set(eventsRef.doc(eventId), Object.assign({}, stampedEvent))
        events.push(stampedEvent)
      }
      await transaction.set(streamRef, { _version_: version }, { merge: true })
      aggregate._aggregate_version_ = expectedVersion

      if (aggregateType.path) {
        const aggregateRef = this._db_.collection(snapshotPath(actor.tenant, aggregateType.path)).doc(aggregate.aggregateId)
        await transaction.set(aggregateRef, aggregate.clone())
      }
      return events
    })
  }

  async pollStream (tenant, stream, handlers, limit = 10, timeout = 10000) {
    return await this._db_.runTransaction(async transaction => {
      const path = streamPath(tenant, stream)
      const ref = this._db_.doc(path)
      const now = Date.now()
      const doc = await transaction.get(ref)
      const data = doc.data() || {}

      // skip if stream is currently leased
      if (data._lease_ && data._lease_.expiresAt > now) return null

      const lease = {
        path,
        token: now,
        cursors: data._cursors_ || {},
        version: typeof data._version_ !== 'undefined' ? data._version_ : -1,
        handlers,
        events: []
      }

      // get min version to poll and init cursors
      let v = handlers.reduce((p, c) => {
        const cursor = lease.cursors[c.name]
        if (typeof cursor === 'undefined') {
          lease.cursors[c.name] = -1
          return -1
        }
        return (p < 0 || cursor < p) ? cursor : p
      }, -1) + 1

      // load events
      const eventsRef = this._db_.collection(path.concat('/events'))
      const query = await eventsRef.where('_s', '>=', v).limit(limit).get()
      query.forEach(doc => {
        const event = Event.create(doc.data())
        lease.events.push(event) 
      })
      lease.expiresAt = Date.now() + timeout

      // save lease
      if (lease.events.length) await transaction.set(ref, { _lease_: { token: lease.token, version: lease.version, expiresAt: lease.expiresAt } }, { merge: true })

      return lease
    })
  }

  async commitCursors(lease) {
    if (!lease.events.length) return false
    return await this._db_.runTransaction(async transaction => {
      const ref = this._db_.doc(lease.path)
      const doc = await transaction.get(ref)
      const data = doc.data() || {}

      // commit when lease matches
      if (!(data._lease_ && data._lease_.token === lease.token)) Err.concurrency()
      await transaction.set(ref, { _cursors_: lease.cursors, _lease_: { token: 0, version: 0, expiresAt: 0 } }, { merge: true })
      return lease.handlers.filter(h => lease.cursors[h.name] < lease.version).length > 0
    })
  }
}
