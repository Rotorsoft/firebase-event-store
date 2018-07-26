'use strict'

const IEventHandler = require('./IEventHandler')
const IEventStore = require('./IEventStore')
const ERRORS = require('./errors')

/**
 * Event bus - TODO: make it more reliable
 */
module.exports = class Bus {
  constructor (store) {
    if (!(store instanceof IEventStore)) throw ERRORS.INVALID_ARGUMENTS_ERROR('store')
    this._store_ = store
    this._handlers_ = []
  }

  addEventHandler (handler) {
    if (!(handler instanceof IEventHandler)) throw ERRORS.INVALID_ARGUMENTS_ERROR('handler')
    this._handlers_.push(handler)
  }

  sendCommand (command, tenantPath, storePath, aggregateType, aggregateId = null, expectedVersion = -1) {
    let aggregatePath = tenantPath.concat(storePath)
    return this._store_.loadAggregate(aggregatePath, aggregateType, aggregateId)
      .then(aggregate => {
        // console.log(JSON.stringify(aggregate))
        aggregate.handleCommand(command)
        return this._store_.commitAggregate(aggregatePath, aggregate, expectedVersion)
          .catch(error => { throw ERRORS.CONCURRENCY_ERROR() })
      })
      .then(aggregate => {
        // handle uncommited events
        let promises = []
        this._handlers_.forEach(h => {
          aggregate._uncommitted_events_.forEach(e => {
            promises.push(h.applyEvent(tenantPath, e, aggregate))
          })
        })
        return Promise.all(promises).then(() => {
          aggregate._uncommitted_events_ = []
          // console.log(JSON.stringify(aggregate))
          return aggregate
        })
      })
  }
}
