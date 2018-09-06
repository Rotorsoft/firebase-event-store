'use strict'

const IEventHandler = require('./IEventHandler')
const IEventStore = require('./IEventStore')
const Aggregate = require('./Aggregate')
const Command = require('./Command')
const ERRORS = require('./errors')

/**
 * Event bus - TODO: make it more reliable
 */
module.exports = class Bus {
  constructor (store, debug = false) {
    if (!(store instanceof IEventStore)) throw ERRORS.INVALID_ARGUMENTS_ERROR('store')
    this._store_ = store
    this._handlers_ = []
    this._debug_ = debug
    this._commands_ = {}
  }

  get eventStore () { return this._store_ }

  /**
   * Registers aggregate commands with bus
   * @param {Aggregate} aggregateType
   */
  register (aggregateType) {
    if (!(aggregateType.prototype instanceof Aggregate)) throw ERRORS.INVALID_ARGUMENTS_ERROR('aggregateType')
    Object.keys(aggregateType.COMMANDS).forEach(key => {
      this._commands_[key] = { commandType: aggregateType.COMMANDS[key], aggregateType: aggregateType }
    })
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
   * Executes command, persisting events and latest version of aggregate in store
   * @param {Object} actor User/Process sending command - must contain tenant and roles
   * @param {String} command Command name - must be registered
   * @param {Object} payload Command payload
   */
  async command (actor, command, payload) {
    if (this._debug_) console.log('DEBUG: command', JSON.stringify(payload))
    const map = this._commands_[command]
    if (!map) throw ERRORS.INVALID_ARGUMENTS_ERROR(`command ${command} not found`)

    const cmd = Command.create(map.commandType, payload)
    let aggregate = await this._store_.loadAggregateFromSnapshot(actor.tenant, map.aggregateType, payload.aggregateId)
    if (this._debug_) console.log('DEBUG: after load', JSON.stringify(aggregate))

    let expectedVersion = payload.expectedVersion
    if (typeof expectedVersion === 'undefined') {
      // adjust expectedVersion - when aggregate found, assume latest version
      if (aggregate._aggregate_version_ >= 0) expectedVersion = aggregate._aggregate_version_
      else expectedVersion = -1
    }

    await aggregate.handleCommand(actor, cmd)
    aggregate = await this._store_.commitAggregate(actor.tenant, aggregate, expectedVersion)
    if (this._debug_) console.log('DEBUG: after commit - ', JSON.stringify(aggregate))

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
