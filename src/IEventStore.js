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
   * Commits pending events to store
   * @param {Object} actor with tenant id
   * @param {String} command command name
   * @param {Aggregate} aggregate aggregate with uncommitted events
   * @param {Integer} expectedVersion expected version in store
   * @returns Promise with array of committed events
   */
  async commitEvents (actor, command, aggregate, expectedVersion) { throw Err.notImplemented('commitEvents') }
}
