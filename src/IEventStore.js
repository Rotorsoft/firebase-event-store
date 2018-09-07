'use strict'

const Errors = require('./Errors')

/**
 * EventStore interface
 */
module.exports = class IEventStore {
  /**
   * Loads aggregate from stored snapshot
   * @param {String} tenant tenant id
   * @param {Aggregate} aggregateType aggregate subtype
   * @param {String} aggregateId optional aggregate id - if not provided new aggregate is created and nothing is loaded
   * @returns Promise with loaded aggregate
   */
  async loadAggregateFromSnapshot (tenant, aggregateType, aggregateId = '') { throw Errors.notImplemented('loadAggregateFromSnapshot') }

    /**
   * Loads aggregate from stored events history
   * @param {String} tenant tenant id
   * @param {Aggregate} aggregateType aggregate subtype
   * @param {String} aggregateId aggregate id
   * @returns Promise with loaded aggregate
   */
  async loadAggregateFromEvents (tenant, aggregateType, aggregateId) { throw Errors.notImplemented('loadAggregateFromEvents') }

  /**
   * Commits pending events to store
   * @param {String} tenant tenant id
   * @param {Aggregate} aggregate aggregate with new events
   * @param {int} expectedVersion expected version in store for concurrency check
   * @returns Promise with updated aggregate
   */
  async commitAggregate (tenant, aggregate, expectedVersion = -1) { throw Errors.notImplemented('commitAggregate') }
}
