'use strict'

const Evento = require('./Evento')
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
    let aggregate = new aggregateType.prototype.constructor()
    Object.defineProperty(aggregate, '_aggregate_id_', { value: aggregateId, writable: !aggregateId, enumerable: true }) 
    Object.defineProperty(aggregate, '_aggregate_version_', { value: -1, writable: true, enumerable: true })
    Object.defineProperty(aggregate, '_uncommitted_events_', { value: [], writable: true, enumerable: false })
    return aggregate
  }

  get aggregateId() { return this._aggregate_id_ }
  get aggregateVersion() { return this._aggregate_version_ }

  handleCommand (command) { throw ERRORS.NOT_IMPLEMENTED_ERROR('handleCommand') }
  applyEvent (event) { throw ERRORS.NOT_IMPLEMENTED_ERROR('applyEvent') }

  loadEvent (event) {
    // console.log(`Loading event ${JSON.stringify(event)}`)
    this.applyEvent(event)
    this._aggregate_version_++
  }

  /**
   * Event factory method
   * @param {Object} eventType subclass of Evento
   * @param {String} uid user id creating event
   * @param {Object} payload event payload
   */
  addEvent (eventType, uid, payload) {
    if (!(eventType.prototype instanceof Evento)) throw ERRORS.INVALID_ARGUMENTS_ERROR('eventType')
    let event = new eventType.prototype.constructor()
    Object.defineProperty(event, '_event_name_', { value: eventType.name, enumerable: true, writable: false })
    Object.defineProperty(event, '_event_creator_', { value: uid, enumerable: true, writable: false })
    Object.keys(payload).forEach(p => {
      Object.defineProperty(event, p, { value: payload[p], enumerable: true, writable: false })
    })
    // console.log(`Adding event ${JSON.stringify(event)}`)
    this.applyEvent(event)
    this._uncommitted_events_.push(event)
  }
}
