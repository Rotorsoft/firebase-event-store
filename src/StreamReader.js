'use strict'

async function _push (reader, handlers, events = null, load = false) {
  let e = []
  let v = -1
  for (let handler of Object.values(handlers)) {
    if (v < 0 || handler._version_ < v) v = handler._version_
  }

  // load
  if (v < reader._version_ || load) {
    e = await reader._store_.loadEvents(reader._tenant_, reader._name_, v + 1, reader._size_)
    if (e.length) {
      v = e[e.length - 1]._version_
      reader._store_._tracer_.trace(() => ({ method: 'loadEvents', events: e }))
    }
  }

  // append real time events
  if (events && events.length) {
    if (events[0]._version_ === v + 1) {
      e.push(...events)
      v = e[e.length - 1]._version_
      reader._store_._tracer_.trace(() => ({ stat: 'pushEvents', events }))
    }
  }

  // push
  if (e.length) {
    while (e.length) {
      const event = e[0]
      for (let handler of Object.values(handlers)) {
        if (handler._version_ === event._version_ - 1) {
          try {
            reader._store_._tracer_.trace(() => ({ method: 'handle', handler, reader, event }))
            await handler._handler_.handle(reader._tenant_, event)
            handler._version_ = event._version_
          }
          catch (e) {
            reader._store_._tracer_.trace(() => ({ error: e }))
          }
        }
      }
      e.shift()
    }
    const cursors = await reader._store_.commitCursors(reader._tenant_, reader._name_, handlers)
    reader._store_._tracer_.trace(() => ({ method: 'commitCursors', cursors }))
    return v
  }
}

module.exports = class StreamReader {
  constructor (store, tenant, name, size, version, cursors) {
    this._store_ = store
    this._tenant_ = tenant
    this._name_ = name
    this._size_ = size
    this._version_ = version
    this._cursors_ = cursors
    this._handlers_ = {}
    this._catchup_ = {}
  }

  _subscribe (handler) {
    const ver = this._cursors_[handler.name] || -1
    const han = { _handler_: handler, _version_: ver }
    if (ver + this._size_ < this._version_) this._catchup_[handler.name] = han
    else this._handlers_[handler.name] = han
  }

  /**
   * Pushes current window of events to handlers and commits cursors after sync
   * 
   * @param {Array} events (Optional) real time events to be appended at the end of current window
   * @param {Boolean} load (Optional) flag to force loading window when empty (poll for new events)
   */
  async _push (events, load = false) {
    const v = await _push(this, this._handlers_, events, load)
    if (v > this._version_) this._version_ = v
  }

  /**
   * Pushes catchup window of events to handlers and commits cursors after sync
   */
  async _catchup () {
    if (Object.keys(this._catchup_).length) {
      let v = await _push(this, this._catchup_)
      if (v < this._version_) return true // keep going
      
      // done, move handlers to current window and make final push
      Object.assign(this._handlers_, this._catchup_)
      this._catchup_ = {}
      await this._push(null, true)
    }
    return false
  }
}
