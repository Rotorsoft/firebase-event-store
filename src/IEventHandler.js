'use strict'

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
  get events () { return {} }

  /**
   * Handles events. Invokes specific event handler if found in map
   * 
   * @param {Object} actor 
   * @param {Object} aggregate
   * @param {Object} event
   */
  async handle (actor, aggregate, event) {
    const eh = this.events[event._n]
    if (eh) await eh(actor, aggregate, event)
  }

  /**
   * Handles pump command
   * 
   * @param {Object} actor 
   * @param {Object} payload 
   */
  async pump (actor, payload) {}
}
