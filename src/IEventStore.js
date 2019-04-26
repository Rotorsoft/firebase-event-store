'use strict'

const Err = require('./Err')

module.exports = class IEventStore {
  /**
   * Loads aggregate from store (can use snapshots and/or events)
   * 
   * @param {Object} context Command context including { actor, command, aggregateType, aggregateId }
   * @returns {Aggregate} Loaded aggregate
   */
  async loadAggregate (context) { throw Err.notImplemented('loadAggregate') }

  /**
   * Commits pending events to store
   * 
   * @param {Object} context Command context including { actor, command, aggregate, expectedVersion }
   * @returns {Array} Array of committed events
   */
  async commitEvents (context) { throw Err.notImplemented('commitEvents') }

  /**
   * Poll stream for new events covering handlers
   * 
   * @param {String} tenant tenant id
   * @param {String} stream stream name
   * @param {Array} handlers Array of event handlers
   * @param {Integer} limit Max number of events to poll
   * @param {Integer} timeout Timeout in milliseconds to expire lease
   * @returns {Object} Lease object with events
   */
  async pollStream (tenant, stream, handlers, limit, timeout) { throw Err.notImplemented('pollStream') }

  /**
   * Commits stream cursors after successfull handling of events
   * 
   * @param {Object} lease Lease object with updated cursors
   * @returns {Boolean} True if any of the handlers is still behind
   */
  async commitCursors(lease) { throw Err.notImplemented('commitCursors') }
}
