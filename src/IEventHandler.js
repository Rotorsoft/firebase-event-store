'use strict'

const Err = require('./Err')

/**
 * EventHandler interface to be implemented by manager processes subscribed to event bus
 */
module.exports = class IEventHandler {
  /**
   * Object map of async event handlers
   * 
   * Example:
   *    get events () {
   *      return {
   *        ['Event1']: async (actor, aggregate, event) => {
   *          ...
   *        },
   *        ['Event2']: async (actor, aggregate, event) => {
   *          ...
   *        }
   *      }
   *    }
   */
  get events () { throw Err.notImplemented('events') }
}