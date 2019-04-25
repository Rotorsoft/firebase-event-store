'use strict'

/**
 * Event class
 */
module.exports = class Event {
  /**
   * Event factory method
   * 
   * @param {String} name Event name
   * @param {Object} payload Event payload
   * @returns {Event} frozen instance of Event
   */
  static create ({ name = '', ...payload } = {}) {
    const event = new Event()
    Object.assign(event, payload)
    if (name) event._e = name
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
  get actorId () { return this._u }
  get commandName () { return this._c }
  get aggregateTypeName () { return this._t }
  get aggregateId () { return this._a }
  get aggregateVersion () { return this._v }
  get streamVersion () { return this._s }
}