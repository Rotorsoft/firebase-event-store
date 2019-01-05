'use strict'

const Err = require('./Err')

module.exports = class IEventStore {
  /**
   * Loads aggregate from store (can use snapshots and/or events)
   * @param {String} tenant tenant id
   * @param {Aggregate} aggregateType aggregate subtype
   * @param {String} aggregateId optional aggregate id - if not provided new aggregate is created and nothing is loaded
   * @returns Promise with loaded aggregate
   */
  async loadAggregate (tenant, aggregateType, aggregateId) { throw Err.notImplemented('loadAggregate') }

  /**
   * Loads events from stream starting from given version
   * @param {String} tenant tenant id
   * @param {String} stream stream name
   * @param {Integer} fromVersion starting from version
   * @param {Integer} limit max numbers of events to load
   * @returns Promise with array of loaded events
   */
  async loadEvents (tenant, stream, fromVersion, limit) { throw Err.notImplemented('loadEvents') }

  /**
   * Commits pending events to store
   * @param {Object} actor with tenant id
   * @param {String} command command name
   * @param {Aggregate} aggregate aggregate with uncommitted events
   * @param {Integer} expectedVersion expected version in store
   * @returns Promise with array of committed events
   */
  async commitEvents (actor, command, aggregate, expectedVersion) { throw Err.notImplemented('commitEvents') }

  /**
   * Gets stored stream data
   * @param {String} tenant Tenant id
   * @param {String} stream Stream name
   * @returns {StreamReader} Promise with the stream data
   */
  async getStreamData (tenant, stream) { throw Err.notImplemented('getStreamData') }

  /**
   * Commits event handler cursors after events are handled succesfully
   * @param {String} tenant Tenant id
   * @param {String} stream Stream name
   * @param {Object} handlers Object map of registered event handlers with confirmed _version_ field
   * @returns {Array} Promise with array of committed cursors
   */
  async commitCursors (tenant, stream, handlers) { throw Err.notImplemented('commitCursors') }
}
