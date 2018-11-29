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
   * Handles all events. Gets called when no specific event handler is found in map
   * 
   * @param {Object} actor 
   * @param {Object} aggregate
   * @param {Object} event
   */
  async handle (actor, aggregate, event) {}

  /**
   * Handles pump command
   * 
   * @param {Object} actor 
   * @param {Object} payload 
   */
  async pump (actor, payload) {}
}
