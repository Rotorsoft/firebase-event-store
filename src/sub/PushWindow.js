'use strict'

function logCursors (cursors) {
  return '['.concat(Object.keys(cursors).reduce((p, c) => p.concat(p.length ? ',' : '', c.concat('=', cursors[c])), ''), ']')
}

module.exports = class PushWindow {
  constructor (name, size) {
    this._name_ = name
    this._size_ = size
    this._events_ = []
    this._version_ = -1
  }

  _subscribe (...handlers) {
    this._handlers_ = this._handlers_ || {}
    for (let handler of handlers) {
      if (this._version_ < 0 || handler._version_ < this._version_) this._version_ = handler._version_
      this._handlers_[handler._handler_.name] = handler
    }
  }

  get _handlers () {
    return this._handlers_ || {}
  }

  _toString () {
    return '['.concat(this._events_.reduce((p, c) => p.concat(p.length ? ',' : '', c._version_), ''), ']')
  }

  async _push (reader, events = null, load = false) {
    if (!this._handlers_) return

    // load
    if (!this._events_.length && (this._version_ < reader._version_ || load)) {
      this._events_ = await reader._store_.loadEvents(reader._tenant_, reader._name_, this._version_ + 1, this._size_)
      if (this._events_.length) {
        this._version_ = this._events_[this._events_.length - 1]._version_
        reader._store_._tracer_.trace(() => ({ level: 1, stat: 'push window loaded', window: this, msg: `${this._name_} window loaded from ${this._events_[0]._version_} to ${this._version_}` }))
      }
    }

    // append real time events
    if (events && events.length) {
      if (events[0]._version_ === this._version_ + 1) {
        this._events_.push(...events)
        this._version_ = this._events_[this._events_.length - 1]._version_
        reader._store_._tracer_.trace(() => ({ level: 1, stat: 'push window appended', window: this, msg: `events appended to ${this._name_} window ${this._toString()}` }))
      }
    }

    // push
    if (this._events_.length) {
      while (this._events_.length) {
        const event = this._events_[0]
        for (let key of Object.keys(this._handlers_)) {
          const handler = this._handlers_[key]
          if (handler._version_ === event._version_ - 1) {
            await handler._handler_.handle(reader._tenant_, event)
            handler._version_ = event._version_
          }
        }
        this._events_.shift()
      }
      const cursors = await reader._store_.commitCursors(reader._tenant_, reader._name_, this._handlers_)
      reader._store_._tracer_.trace(() => ({ level: 1, stat: 'push window committed', window: this, msg: `${this._name_} window committed cursors ${logCursors(cursors)}` }))
    }
  }
}