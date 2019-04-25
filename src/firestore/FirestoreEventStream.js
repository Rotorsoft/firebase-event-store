'use strict'

const IEventStream = require('../IEventStream')
const ITracer = require('../ITracer')
const Event = require('../Event')

module.exports = class FirestoreEventStream extends IEventStream {
  constructor (db, tenant, name, tracer = null) {
    super(tenant, name)
    this._db_ = db
    this._tracer_ = tracer || new ITracer()
  }

  get path () { return '/tenants/'.concat(this._tenant_, '/streams/', this._name_) }

  async poll (handlers, { limit = 10, timeout = 10000 } = {}) {
    const validHandlers = handlers.filter(h => h.name && h.stream === this._name_)
    if (!validHandlers.length) return false

    // create lease
    const ref = this._db_.doc(this.path)
    const lease = await this._db_.runTransaction(async transaction => {
      const now = Date.now()
      const doc = await transaction.get(ref)
      const data = doc.data() || {}

      // skip if stream is currently leased
      if (data._lease_ && data._lease_.expiresAt > now) return null

      const lease = {
        token: now,
        cursors: data._cursors_ || {},
        version: typeof data._version_ !== 'undefined' ? data._version_ : -1,
        events: []
      }

      // get min version to poll and init cursors
      let v = validHandlers.reduce((p, c) => {
        const cursor = lease.cursors[c.name]
        if (typeof cursor === 'undefined') {
          lease.cursors[c.name] = -1
          return -1
        }
        return (p < 0 || cursor < p) ? cursor : p
      }, -1) + 1

      // load events
      const eventsRef = this._db_.collection(this.path.concat('/events'))
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

    // handle events
    if (lease && lease.events.length) {
      for (let event of lease.events) {
        for (let handler of validHandlers) {
          if (event.streamVersion > lease.cursors[handler.name]) {
            try {
              this._tracer_.trace(() => ({ method: 'handle', handler: handler.name, stream: this._name_, event }))
              await handler.handle(this._tenant_, event)
              lease.cursors[handler.name] = event.streamVersion
            }
            catch (e) {
              this._tracer_.trace(() => ({ error: e }))
            }
          }
        }
      }
      // commit cursors
      await this._db_.runTransaction(async transaction => {
        const doc = await transaction.get(ref)
        const data = doc.data() || {}

        // commit when lease matches
        if (data._lease_ && data._lease_.token === lease.token) {
          await transaction.set(ref, { _cursors_: lease.cursors, _lease_: { token: 0, version: 0, expiresAt: 0 } }, { merge: true })
        }
      })
      return validHandlers.filter(h => lease.cursors[h.name] < lease.version).length > 0
    }
    return false
  }
}
