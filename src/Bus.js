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
   * @param {Command} command Command subclass
   * @param {String} tenantPath Path to tenant document
   * @param {String} storePath Path to aggregate collection
   * @param {Aggregate} aggregateType Aggregate subclass
   * @param {String} aggregateId Optional aggregate id (will create one if not provided)
   * @param {Number} expectedVersion Expected aggregate version or -1 when creating first event
   */
  sendCommand (command, tenantPath, storePath, aggregateType, aggregateId = null, expectedVersion = -1) {
    let aggregatePath = tenantPath.concat(storePath)
    let _aggregate
    return this._store_.loadAggregate(aggregatePath, aggregateType, aggregateId)
      .then(aggregate => {
        // if (this._name_) console.log(`${this._name_}: after load with expected version = ${expectedVersion} - `, JSON.stringify(aggregate))
        aggregate.handleCommand(command)
        return this._store_.commitAggregate(aggregatePath, aggregate, expectedVersion)
      })
      .then(aggregate => {
        // if (this._name_) console.log(`${this._name_}: after commit - `, JSON.stringify(aggregate))
        _aggregate = aggregate
        // handle uncommited events
        let promises = []
        this._handlers_.forEach(h => {
          aggregate._uncommitted_events_.forEach(e => {
            promises.push(h.applyEvent(tenantPath, e, aggregate))
          })
        })
        return Promise.all(promises)
      })
      .then(() => {
        _aggregate._uncommitted_events_ = []
        return _aggregate
      })
  }

  /**
   * Sends commands sequentially to bus, persisting events and latest version of aggregate in store
   * @param {Command[]} commands Array of Command subclass
   * @param {String} tenantPath Path to tenant document
   * @param {String} storePath Path to aggregate collection
   * @param {Aggregate} aggregateType Aggregate subclass
   * @param {String} aggregateId Aggregate id
   * @param {Number} expectedVersion Expected aggregate version
   * @returns {Aggregate} Last version of aggregate
   */
  sendCommands (commands, tenantPath, storePath, aggregateType, aggregateId, expectedVersion) {
    let wrappers = []
    for (let i = 0; i < commands.length; i++) {
      wrappers.push(() => this.sendCommand(commands[i], tenantPath, storePath, aggregateType, aggregateId, expectedVersion + i))
    }
    return wrappers.reduce((chain, wrapper, index) => chain.then(wrapper), Promise.resolve())
  }
}
