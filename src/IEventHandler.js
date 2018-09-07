'use strict'

const Err = require('./Err')

/**
 * EventHandler interface to be implemented by manager processes subscribed to event bus
 */
module.exports = class IEventHandler {
  /**
   * Object map of async event handlers receiving actor and aggregate arguments 
   */
  get events () { throw Err.notImplemented('events') }
}