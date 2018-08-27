'use strict'

const Evento = require('./Evento')
const ERRORS = require('./errors')

/**
 * Aggregate base abstract class
 */
module.exports = class Aggregate {
  /**
   * Aggregate factory method
   * @param {Object} store Store where aggregate is created
   * @param {Object} aggregateType subclass of Aggregate
   * @param {String} aggregateId
   * @returns {Aggregate} Aggregate instance of aggregateType
   */
  static create (store, aggregateType, aggregateId = '') {
    if (!(aggregateType.prototype instanceof Aggregate)) throw ERRORS.INVALID_ARGUMENTS_ERROR('aggregateType')
    let aggregate = new aggregateType.prototype.constructor()
    Object.defineProperty(aggregate, '_aggregate_id_', { value: aggregateId, writable: !aggregateId, enumerable: true }) 
    Object.defineProperty(aggregate, '_aggregate_version_', { value: -1, writable: true, enumerable: true })
    Object.defineProperty(aggregate, '_uncommitted_events_', { value: [], writable: true, enumerable: false })
    Object.defineProperty(aggregate, '_store_', { value: store, writable: false, enumerable: false })
    return aggregate
  }

  get aggregateId () { return this._aggregate_id_ }
  get aggregateVersion () { return this._aggregate_version_ }
  get path () { throw ERRORS.NOT_IMPLEMENTED_ERROR('path') }

  handleCommand (actor, command) { throw ERRORS.NOT_IMPLEMENTED_ERROR('handleCommand') }
  applyEvent (event) { throw ERRORS.NOT_IMPLEMENTED_ERROR('applyEvent') }

  loadEvent (eventTypes, eventObject) {
    const eventType = eventTypes[eventObject._event_name_]
    if (!eventType) throw ERRORS.PRECONDITION_ERROR('Invalid event type: '.concat(eventObject._event_name_))
    const event = Evento.create(eventObject._event_creator_, eventType, eventObject)
    this.applyEvent(event)
    this._aggregate_version_++
  }

  /**
   * Event factory method
   * @param {String} creator actor id creating the event
   * @param {Object} eventType subclass of Evento
   * @param {Object} payload event payload
   */
  addEvent (creator, eventType, payload) {
    const event = Evento.create(creator, eventType, payload)
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
        if (k !== '_aggregate_id_') this[k] = snapshot[k]
      })
    }
  }
}
