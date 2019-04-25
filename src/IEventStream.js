'use strict'

const Err = require('./Err')

/**
 * Stream reader interface. Poll stream for new events and commit cursors after succesfull handling
 */
module.exports = class IEventStream {
  /**
   * Constructor
   * 
   * @param {String} tenant Tenant id 
   * @param {String} name Stream name
   */
  constructor (tenant, name) {
    this._tenant_ = tenant
    this._name_ = name
  }

  get tenant () { return this._tenant_ }
  get name () { return this._name_ }

  /**
   * Poll stream, handle new events, and commits cursors
   * 
   * @param {Array} handlers Array of event handlers
   * @param {Integer} limit Max number of events to poll
   * @param {Integer} timeout Timeout in milliseconds to expire lease
   * @returns True if any of the handlers is behind
   */
  async poll (handlers, { limit = 10, timeout = 10000 } = {}) { throw Err.notImplemented('poll') }
}
