'use strict'

/**
 * Event class
 */
module.exports = class Event {
  /**
   * Event factory method
   * 
   * @param {String} _event_name_ optional event name
   * @param {Integer} _event_version_ optional event version
   * @param {Object} payload event payload
   * @returns {Event} frozen instance of Event
   */
  static create ({ _event_name_ = '', _event_version_ = 0, ...payload }) {
    const event = new Event()
    Object.assign(event, payload)
    if (_event_name_) event._e = _event_name_
    if (_event_version_) event._x = _event_version_
    return Object.freeze(event)
  }

  /**
   * Creates a stamped copy of the event (with metadata)
   * 
   * @param {String} actorId 
   * @param {String} commandName 
   * @param {String} aggregateTypeName 
   * @param {String} aggregateId 
   * @param {Integer} aggregateVersion 
   * @param {Integer} streamVersion 
   * @returns {Event} Stamped frozen copy of the event
   */
  _stamp (actorId, commandName, aggregateTypeName, aggregateId, aggregateVersion, streamVersion) {
    const event = new Event()
    Object.assign(event, this, {
      _u: actorId,
      _c: commandName,
      _t: aggregateTypeName,
      _a: aggregateId,
      _v: aggregateVersion,
      _s: streamVersion
    })
    return Object.freeze(event)
  }

  get eventName () { return this._e }
  get eventVersion () { return this._x || 0 }
  get actorId () { return this._u }
  get commandName () { return this._c }
  get aggregateTypeName () { return this._t }
  get aggregateId () { return this._a }
  get aggregateVersion () { return this._v }
  get streamVersion () { return this._s }
}