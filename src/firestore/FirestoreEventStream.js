'use strict'

const IEventStream = require('../IEventStream')

module.exports = class FirestoreEventStream extends IEventStream {
  constructor (db, tenant, name) {
    super(tenant, name)
    this._db_ = db
    this._ref_ = this._db_.doc(this.path)
  }

  get path () { return '/tenants/'.concat(this._tenant_, '/streams/', this._name_) }

  async poll (handlers, limit = 10) {
    const validHandlers = handlers.filter(h => h.name && h.stream === this._name_)
    let cursors = {}, version = -1
    await this._db_.runTransaction(async transaction => {
      // get cursors
      const doc = await transaction.get(this._ref_)
      const data = doc.data() || {}
      cursors = data._cursors_ || {}
      version = data._version_ || -1

      // get min version to poll
      let v = validHandlers.reduce((p, c) => {
        const cursor = cursors[c.name] || -1
        return (p < 0 || cursor < p) ? cursor : p
      }, -1) + 1

      // poll events
      const eventsRef = this._db_.collection(this.path.concat('/events'))
      const query = await eventsRef.where('_version_', '>=', v).limit(limit).get()
      const events = []
      query.forEach(doc => { events.push(Object.freeze(doc.data())) })

      // handle events
      if (events.length) {
        this._tracer_.trace(() => ({ method: 'poll', events }))
        for (let event of events) {
          for (let handler of validHandlers) {
            if (event._version_ > (cursors[handler.name] || -1)) {
              try {
                this._tracer_.trace(() => ({ method: 'handle', handler: handler.name, stream: this._name_, event }))
                await handler.handle(this._tenant_, event)
                cursors[handler.name] = event._version_
              }
              catch (e) {
                this._tracer_.trace(() => ({ error: e }))
              }
            }
          }
        }
        // commit cursors
        await transaction.set(this._ref_, { _cursors_: cursors }, { merge: true })
      }
    })
    return validHandlers.filter(h => cursors[h.name] < version).length > 0
  }
}
