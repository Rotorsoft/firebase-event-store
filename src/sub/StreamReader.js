'use strict'

const PushWindow = require('./PushWindow')

module.exports = class StreamReader {
  constructor (store, tenant, name, size, version, cursors) {
    this._store_ = store
    this._tenant_ = tenant
    this._name_ = name
    this._size_ = size
    this._version_ = version
    this._cursors_ = cursors
    this._current_ = new PushWindow('current', size)
  }

  _subscribe (handler) {
    const ver = this._cursors_[handler.name] || -1
    const han = { _handler_: handler, _version_: ver }
    if (ver + this._size_ < this._version_) {
      this._catchup_ = this._catchup_ || new PushWindow('catchup', this._size_)
      this._catchup_._subscribe(han)
    }
    else this._current_._subscribe(han)
  }

  /**
   * Pushes current window of events to handlers and commits cursors after sync
   * 
   * @param {Array} events (Optional) real time events to be appended at the end of current window
   * @param {Boolean} load (Optional) flag to force loading window when empty (poll for new events)
   */
  async _push (events, load = false) {
    await this._current_._push(this, events, load)
    if (this._current_._version_ > this._version_) this._version_ = this._current_._version_
  }

  /**
   * Pushes catchup window of events to handlers and commits cursors after sync
   */
  async _catchup () {
    if (this._catchup_) {
      await this._catchup_._push(this)
      if (this._catchup_._version_ < this._version_) return true // keep going
      
      // done, move handlers to current window and make final push
      this._current_._subscribe(...Object.values(this._catchup_._handlers))
      this._catchup_ = null
      await this._current_._push(this, null, true)
      if (this._current_._version_ > this._version_) this._version_ = this._current_._version_
    }
    return false
  }
}
