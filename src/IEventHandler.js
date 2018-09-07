'use strict'

const Errors = require('./Errors')

/**
 * EventHandler interface to be implemented by manager processes subscribed to event bus
 */
module.exports = class IEventHandler {
  /**
   * Object map of async event handlers receiving actor and aggregate arguments 
   */
  get events () { throw Errors.notImplemented('events') }
}