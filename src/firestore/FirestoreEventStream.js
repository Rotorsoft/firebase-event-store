'use strict'

const IEventStream = require('../IEventStream')

module.exports = class FirestoreEventStream extends IEventStream {
  constructor (db, tenant, name, size) {
    super(tenant, name, size)
    this._db_ = db
    this._ref_ = this._db_.doc(this.path)
    this._data_ = { _version_: -1, _cursors_: {} }
  }

  get path () { return '/tenants/'.concat(this._tenant_, '/streams/', this._name_) }
  get version () { return this._data_._version_ }
  get cursors () { return this._data_._cursors_ }

  async load () {
    const doc = await this._ref_.get()
    this._data_ = doc.data() || { _version_: -1, _cursors_: {} }
  }

  async loadEvents (fromVersion, limit) {
    const eventsRef = this._db_.collection(this.path.concat('/events'))
    const query = await eventsRef.where('_version_', '>=', fromVersion).limit(limit).get()
    const events = []
    query.forEach(doc => { events.push(Object.freeze(doc.data())) })
    return events
  }

  async commitCursors (handlers) {
    const cursors = {}
    await this._db_.runTransaction(async transaction => {
      // const doc = await transaction.get(this._ref_)
      // const data = doc.data() || {}
      // if (!data._cursors_) data._cursors_ = {}
      for (let key of Object.keys(handlers)) {
        const handler = handlers[key]
        const oldVersion = this._data_._cursors_[key] || 0
        const newVersion = handler._version_
        cursors[key] = newVersion > oldVersion ? newVersion : oldVersion
      }
      await transaction.set(this._ref_, { _cursors_: cursors }, { merge: true })
    })
    this._data_._cursors_ = cursors
  }
}
