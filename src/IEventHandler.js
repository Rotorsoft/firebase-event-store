'use strict'

const ERRORS = require('./errors')

/**
 * EventHandler interface to be implemented by manager processes subscribed to event bus
 */
module.exports = class IEventHandler {
  /**
   * Applies event 
   * @param {String} tenantPath Path to tenant document
   * @param {Evento} event Event object
   * @param {Aggregate} aggregate Aggregate object
   */
  applyEvent (tenantPath, event, aggregate) { throw ERRORS.NOT_IMPLEMENTED_ERROR('applyEvent') }
}