'use strict'

const IEventStore = require('./IEventStore')
const Aggregate = require('./Aggregate')
const ERRORS = require('./errors')

/**
 * Basic in-memory implementation of EventStore
 */
module.exports = class InMemoryEventStore extends IEventStore {
  constructor () {
    super()
    this._store_ = {}
    this._lastId_ = 0
  }

  getStore (path) {
    return this._store_[path] || (this._store_[path] = {})
  }

  loadAggregate (aggregatePath, aggregateType, aggregateId = null) {
    return new Promise(resolve => {
      if (!aggregateId) {
        resolve(Aggregate.create(aggregateType))
      } else {
        let aggregate = Aggregate.create(aggregateType, aggregateId)
        let store = this.getStore(aggregatePath)
        let events = store[aggregateId]
        if (events) events.forEach(e => aggregate.loadEvent(e))
        resolve(aggregate)
      }
    })
  }

  commitAggregate (aggregatePath, aggregate, expectedVersion = -1) {
    return new Promise(resolve => {
      let store = this.getStore(aggregatePath)
      let events = []
      if (expectedVersion === -1) {
        if (!aggregate._aggregate_id_) aggregate._aggregate_id_ = (++this._lastId_).toString()
        store[aggregate._aggregate_id_] = events
      } else {
        events = store[aggregate._aggregate_id_]
        if ((events.length - 1) !== expectedVersion) throw ERRORS.CONCURRENCY_ERROR()
      }
      // commit pending events
      aggregate._uncommitted_events_.forEach(e => {
        events.push(e)
        expectedVersion++
      })
      aggregate._aggregate_version_ = expectedVersion
      resolve(aggregate)
    })
  }
}
