'use strict'

const ERRORS = require('./errors')

/**
 * EventStore interface
 */
module.exports = class IEventStore {
  /**
   * Loads aggregate from stored snapshot
   * @param {String} aggregatePath path to aggregate store
   * @param {Aggregate} aggregateType aggregate subtype
   * @param {String} aggregateId optional aggregate id - if not provided new aggregate is created and nothing is loaded
   * @returns Promise with loaded aggregate
   */
  async loadAggregateFromSnapshot (aggregatePath, aggregateType, aggregateId = null) { throw ERRORS.NOT_IMPLEMENTED_ERROR('loadAggregateFromSnapshot') }

    /**
   * Loads aggregate from stored events history
   * @param {String} aggregatePath path to aggregate store
   * @param {Aggregate} aggregateType aggregate subtype
   * @param {String} aggregateId aggregate id
   * @param {Object} eventTypes dictionary of event types used to re-create the events
   * @returns Promise with loaded aggregate
   */
  async loadAggregateFromEvents (aggregatePath, aggregateType, aggregateId, eventTypes) { throw ERRORS.NOT_IMPLEMENTED_ERROR('loadAggregateFromEvents') }

  /**
   * Commits pending events to store
   * @param {String} aggregatePath path to aggregate
   * @param {Aggregate} aggregate aggregate with new events
   * @param {int} expectedVersion expected version in store for concurrency check
   * @returns Promise with updated aggregate
   */
  async commitAggregate (aggregatePath, aggregate, expectedVersion = -1) { throw ERRORS.NOT_IMPLEMENTED_ERROR('commitAggregate') }
}
