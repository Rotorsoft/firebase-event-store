'use strict'

const Err = require('./Err')

/**
 * Message bus interface
 */
module.exports = class IBus {
  /**
   * Registers event handler with bus
   * @param {IEventHandler} handler Event handler
   */
  addEventHandler (handler) { throw Err.notImplemented('addEventHandler') }

  /**
   * Pumps all registered handlers
   */
  async pump (actor, payload) {}

  /**
   * Handles command message. Since most of the time there is only one command handler in the system, we can 
   * use the Bus to deal with this. Will define command handler interface in pub/sub style once we find the need for 
   * more handlers
   * 
   * @param {Object} actor User/Process sending command - must contain { id, name, tenant, and roles }
   * @param {String} command Command name
   * @param {Object} payload
   */
  async command (actor, command, { aggregateId = '', expectedVersion = -1, ...payload } = {}) { throw Err.notImplemented('command') }
}
