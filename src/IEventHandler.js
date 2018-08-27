'use strict'

const ERRORS = require('./errors')

/**
 * EventHandler interface to be implemented by manager processes subscribed to event bus
 */
module.exports = class IEventHandler {
  /**
   * Applies event 
   * @param {Object} actor User/Process sending command - must include tenant and roles
   * @param {Evento} event Event object
   * @param {Aggregate} aggregate Aggregate object
   */
  async applyEvent (actor, event, aggregate) { throw ERRORS.NOT_IMPLEMENTED_ERROR('applyEvent') }
}