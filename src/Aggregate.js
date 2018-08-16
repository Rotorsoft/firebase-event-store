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

  loadEvent (eventTypes, eventObject) {
    const eventType = eventTypes[eventObject._event_name_]
    if (!eventType) throw ERRORS.PRECONDITION_ERROR('Invalid event type: '.concat(eventObject._event_name_))
    const event = Evento.create(eventType, eventObject)
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
    const event = Evento.create(eventType, payload, uid)
    // console.log(`Adding event ${JSON.stringify(event)}`)
    this.applyEvent(event)
    this._uncommitted_events_.push(event)
  }

  /**
   * Load aggregate from stored snapshot
   * @param {Object} snapshot Aggregate snapshot
   */
  loadSnapshot (snapshot) {
    if (snapshot) {
      Object.keys(snapshot).forEach(k => {
        if (k !== '_aggregate_id_' && k !== '_aggregate_version_') this[k] = snapshot[k]
      })
    }
  }
}
