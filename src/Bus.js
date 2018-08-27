'use strict'

const IEventHandler = require('./IEventHandler')
const IEventStore = require('./IEventStore')
const ERRORS = require('./errors')

/**
 * Event bus - TODO: make it more reliable
 */
module.exports = class Bus {
  constructor (store, name) {
    if (!(store instanceof IEventStore)) throw ERRORS.INVALID_ARGUMENTS_ERROR('store')
    this._store_ = store
    this._handlers_ = []
    this._name_ = name
  }

  /**
   * Registers event handler with bus
   * @param {Object} handler Event handler
   */
  addEventHandler (handler) {
    if (!(handler instanceof IEventHandler)) throw ERRORS.INVALID_ARGUMENTS_ERROR('handler')
    this._handlers_.push(handler)
  }

  /**
   * Sends command to bus, persisting events and latest version of aggregate in store
   * @param {Object} actor User/Process sending command - must contain tenant and roles
   * @param {Command} command Command subclass
   * @param {Aggregate} aggregateType Aggregate subclass
   * @param {String} aggregateId Optional aggregate id (will create one if not provided)
   * @param {Number} expectedVersion Expected aggregate version or -1 when creating first event
   */
  async sendCommand (actor, command, aggregateType, aggregateId = null, expectedVersion = -1) {
    let aggregate = await this._store_.loadAggregateFromSnapshot(actor.tenant, aggregateType, aggregateId)
    if (this._name_) console.log(`${this._name_}: after load with expected version = ${expectedVersion} - `, JSON.stringify(aggregate))
    aggregate.handleCommand(actor, command)
    aggregate = await this._store_.commitAggregate(actor.tenant, aggregate, expectedVersion)
    if (this._name_) console.log(`${this._name_}: after commit - `, JSON.stringify(aggregate))
    // handle uncommited events
    for(let handler of this._handlers_) {
      for(let event of aggregate._uncommitted_events_) {
        await handler.applyEvent(actor, event, aggregate)
      }
    }
    aggregate._uncommitted_events_ = []
    return aggregate
  }
}
