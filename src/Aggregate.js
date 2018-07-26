'use strict'

const ERRORS = require('./errors')

/**
 * Aggregate base abstract class
 */
module.exports = class Aggregate {
  /**
   * Aggregate factory method
   * @param {Object} aggregateType subclass of Aggregate
   * @param {String} aggregateId
   * @returns {Aggregate} Aggregate instance of aggregateType
   */
  static create (aggregateType, aggregateId = '') {
    if (!(aggregateType.prototype instanceof Aggregate)) throw ERRORS.INVALID_ARGUMENTS_ERROR('aggregateType')
    let aggregate = Object.create(aggregateType.prototype)
    aggregate._aggregate_id_ = aggregateId
    aggregate._aggregate_version_ = -1
    Object.defineProperty(aggregate, '_uncommitted_events_', { writable: true, value: [] })
    return aggregate
  }

  get aggregateId() { return this._aggregate_id_ }
  get aggregateVersion() { return this._aggregate_version_ }

  handleCommand (command) { throw ERRORS.NOT_IMPLEMENTED_ERROR() }
  applyEvent (event) { throw ERRORS.NOT_IMPLEMENTED_ERROR() }

  loadEvent (event) {
    // console.log(`Loading event ${JSON.stringify(event)}`)
    this.applyEvent(event)
    this._aggregate_version_++
  }

  addEvent (event) {
    // console.log(`Adding event ${JSON.stringify(event)}`)
    this.applyEvent(event)
    this._uncommitted_events_.push(event)
  }
}
