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

  /**
   * Path to collection storing this type of aggregate
   */
  get path () { throw ERRORS.NOT_IMPLEMENTED_ERROR('path') }

  /**
   * Gets object map of command types this aggregate can handle
   */
  static get COMMANDS () { throw ERRORS.NOT_IMPLEMENTED_ERROR('COMMANDS') }

  /**
   * Gets object map of event types this aggregate can apply
   */
  get EVENTS () { throw ERRORS.NOT_IMPLEMENTED_ERROR('EVENTS') }

  /**
   * Abstract async method that must be implemented by aggregates to handle commands
   * @param {Object} actor User/Process sending command
   * @param {Command} command 
   */
  async handleCommand (actor, command) { throw ERRORS.NOT_IMPLEMENTED_ERROR('handleCommand') }

  /**
   * Abstract method that must be implemented by aggregates to apply events
   * @param {Evento} event 
   */
  applyEvent (event) { throw ERRORS.NOT_IMPLEMENTED_ERROR('applyEvent') }

  /**
   * Loads stored event object when loading aggregate from events history
   * @param {Object} eventObject Stored event object
   */
  loadEvent (eventObject) {
    const eventType = this.EVENTS[eventObject._event_name_]
    if (!eventType) throw ERRORS.PRECONDITION_ERROR('Invalid event type: '.concat(eventObject._event_name_))
    const event = Evento.create(eventObject._event_creator_, eventType, eventObject)
    this.applyEvent(event)
    this._aggregate_version_++
  }

  /**
   * Event factory method used by command handlers
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
}
