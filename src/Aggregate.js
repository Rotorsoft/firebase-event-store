'use strict'

const Err = require('./Err')

module.exports = class Aggregate {
  /**
   * Aggregate factory method
   * @param {Object} store Store where aggregate is created
   * @param {Object} aggregateType subclass of Aggregate
   * @param {Object} object with optional payload attributes including _aggregate_id_ and _aggregate_version_
   * @returns {Aggregate} instance of aggregateType
   */
  static create (store, aggregateType, { _aggregate_id_ = '', _aggregate_version_ = -1, ...payload } = {}) {
    const aggregate = new aggregateType.prototype.constructor()
    Object.assign(aggregate, payload)
    Object.defineProperty(aggregate, '_aggregate_id_', { value: _aggregate_id_, writable: !_aggregate_id_, enumerable: true }) 
    Object.defineProperty(aggregate, '_aggregate_version_', { value: _aggregate_version_, writable: true, enumerable: true })
    Object.defineProperty(aggregate, '_uncommitted_events_', { value: [], writable: false, enumerable: false })
    Object.defineProperty(aggregate, '_store_', { value: store, writable: false, enumerable: false })
    return aggregate
  }

  get aggregateId () { return this._aggregate_id_ }
  get aggregateVersion () { return this._aggregate_version_ }

  /**
   * Path to collection storing snapshots of this aggregate type
   */
  static get path () { throw Err.notImplemented('path') }

  /**
   * Name of event stream persisting the events generated by this aggregate. "main" by default
   */
  static get stream () { return 'main' }

  /**
   * Max number of events supported by this aggregate type
   */
  static get maxEvents () { return 10000 }

  /**
   * Object map of async command handlers receiving actor and payload arguments
   * 
   * Example:
   *    get commands () {
   *      return {
   *        Command1: async (actor, payload) => {
   *          ...
   *        },
   *        Command2: async (actor, payload) => {
   *          ...
   *        }
   *      }
   *    }
   */
  get commands () { throw Err.notImplemented('commands') }

  /**
   * Object map of event handlers receiving event argument
   *
   * Example:
   *    get events () {
   *      return {
   *        ['Event1']: (event) => {
   *          ...
   *        },
   *        ['Event2']: (event) => {
   *          ...
   *        }
   *      }
   *    }
   */
  get events () { throw Err.notImplemented('events') }

  /**
   * Loads event object when replaying aggregate
   * @param {Object} event - must have property _n with event name
   */
  loadEvent (event) {
    this.events[event._n](event)
    this._aggregate_version_++
  }

  /**
   * Event factory method used by command handlers
   * @param {String} name event name
   * @param {Object} payload event payload
   */
  addEvent (name, payload) {
    const event = Object.freeze(Object.assign({_n: name }, payload))
    this.events[name](event)
    this._uncommitted_events_.push(event)
  }
}
