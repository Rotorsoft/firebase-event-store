'use strict'

const ERRORS = require('./errors')

/**
 * EventStore interface
 */
module.exports = class IEventStore {
  // returns promise with loaded aggregate (or created with new id when id is null or when no events found)
  loadAggregate (aggregatePath, aggregateType, aggregateId = null) { return Promise.reject(ERRORS.NOT_IMPLEMENTED_ERROR('loadAggregate')) }
  // returns promise with committed aggregate
  commitAggregate (aggregatePath, aggregate, expectedVersion = -1) { return Promise.reject(ERRORS.NOT_IMPLEMENTED_ERROR('commitAggregate')) }
}
