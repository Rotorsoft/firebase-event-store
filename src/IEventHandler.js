'use strict'

const Err = require('./Err')

/**
 * EventHandler interface to be implemented by manager processes subscribed to event bus
 */
module.exports = class IEventHandler {
  /**
   * Unique name in stream (used to store cursors)
   */
  get name () { throw Err.notImplemented('name') }

  /**
   * Stream name where events are published
   */
  get stream() { return 'main' }

  /**
   * Object map of async event handlers
   * 
   * Example:
   *    get events () {
   *      return {
   *        ['Event1']: async (event) => {
   *          ...
   *        },
   *        ['Event2']: async (event) => {
   *          ...
   *        }
   *      }
   *    }
   */
  get events () { return {} }

  /**
   * Handles event
   * 
   * @param {Object} event
   */
  async handle (event) {
    const eh = this.events[event._n]
    if (eh) await eh(event)
  }
}
