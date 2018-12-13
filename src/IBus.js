'use strict'

const IEventHandler = require('./IEventHandler')
const Err = require('./Err')

/**
 * Message bus interface
 */
module.exports = class IBus {
  constructor () {
    this._eventHandlers_ = []
  }

  /**
   * Registers event handler with bus
   * 
   * @param {IEventHandler} handler Event handler
   */
  addEventHandler (handler) {
    if (!(handler instanceof IEventHandler)) throw Err.invalidArguments('handler')
    this._eventHandlers_.push(handler)
  }
  
  /**
   * Publishes event to handlers
   * 
   * @param {Object} event 
   */
  async publish(event) {
    for(let handler of this._eventHandlers_) {
      await handler.handle(event)
    }
  }

  /**
   * Pumps all registered handlers
   */
  async pump (actor, payload) {
    for(let handler of this._eventHandlers_) {
      await handler.pump(actor, payload)
    }
  }

  /**
   * Handles command
   * 
   * @param {Object} actor User/Process sending command - must contain { id, name, tenant, and roles }
   * @param {String} command name
   * @param {Object} payload
   * @returns {Aggregate}
   */
  async command (actor, command, { aggregateId = '', expectedVersion = -1, ...payload } = {}) {}
}
