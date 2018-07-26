'use strict'

const ERRORS = require('./errors')

/**
 * EventStore interface
 */
module.exports = class IEventStore {
  // returns promise with loaded aggregate (or created with new id when id is null or when no events found)
  loadAggregate (aggregatePath, aggregateType, aggregateId = null) { throw ERRORS.NOT_IMPLEMENTED_ERROR() }
  // returns promise with committed aggregate
  commitAggregate (aggregatePath, aggregate, expectedVersion = -1) { throw ERRORS.NOT_IMPLEMENTED_ERROR() }
}
