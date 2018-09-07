'use strict'

const Errors = require('./Errors')

/**
 * Aggregate base abstract class
 */
module.exports = class Aggregate {
  /**
   * Aggregate factory method
   * @param {Object} store Store where aggregate is created
   * @param {Object} aggregateType subclass of Aggregate
   * @param {Object} object with optional payload attributes including _aggregate_id_ and _aggregate_version_
   * @returns {Aggregate} instance of aggregateType
   */
  static create (store, aggregateType, { _aggregate_id_ = '', _aggregate_version_ = -1, ...payload } = {}) {
    if (!(aggregateType.prototype instanceof Aggregate)) throw Errors.invalidArguments('aggregateType')
    const aggregate = new aggregateType.prototype.constructor()
    Object.assign(aggregate, payload)
    Object.defineProperty(aggregate, '_aggregate_id_', { value: _aggregate_id_, writable: !_aggregate_id_, enumerable: true }) 
    Object.defineProperty(aggregate, '_aggregate_version_', { value: _aggregate_version_, writable: true, enumerable: true })
    Object.defineProperty(aggregate, '_uncommitted_events_', { value: [], writable: true, enumerable: false })
    Object.defineProperty(aggregate, '_store_', { value: store, writable: false, enumerable: false })
    return aggregate
  }

  get aggregateId () { return this._aggregate_id_ }
  get aggregateVersion () { return this._aggregate_version_ }

  /**
   * Path to collection storing this type of aggregate
   */
  static get path () { throw Errors.notImplemented('path') }

  /**
   * Object map of async command handlers receiving actor and payload arguments
   */
  get commands () { throw Errors.notImplemented('commands') }

  /**
   * Object map of event handlers receiving event argument
   */
  get events () { throw Errors.notImplemented('events') }

  /**
   * Loads event object when replaying aggregate
   * @param {Object} event object including _event_creator_ and _event_name_
   */
  loadEvent (event) {
    this.events[event._event_name_](event)
    this._aggregate_version_++
  }

  /**
   * Event factory method used by command handlers
   * @param {String} creator actor id creating the event
   * @param {String} name event name
   * @param {Object} payload event payload
   */
  addEvent (creator, name, payload) {
    let event = Object.assign({}, payload)
    event._event_creator_ = creator
    event._event_name_ = name
    event = Object.freeze(event)
    this.events[name](event)
    this._uncommitted_events_.push(event)
  }
}
