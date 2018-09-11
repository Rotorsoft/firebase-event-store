'use strict'

const IEventHandler = require('./IEventHandler')
const IEventStore = require('./IEventStore')
const Err = require('./Err')

module.exports = class Bus {
  /**
   * Bus constructor
   * 
   * @param {IEventStore} store 
   * @param {Object} commands object mapping command names to aggregate types
   * @param {Boolean} debug flag to debug the bus 
   */
  constructor (store, commands, debug = false) {
    if (!(store instanceof IEventStore)) throw Err.invalidArguments('store')
    this._store_ = store
    this._handlers_ = []
    this._debug_ = debug
    this._commands_ = commands
  }

  get eventStore () { return this._store_ }

  /**
   * Registers event handler with bus
   * @param {IEventHandler} handler Event handler
   */
  addEventHandler (handler) {
    if (!(handler instanceof IEventHandler)) throw Err.invalidArguments('handler')
    this._handlers_.push(handler)
  }

  /**
   * Pumps all handlers
   */
  async pump (actor, payload) {
    for(let handler of this._handlers_) {
      await handler.pump(actor, payload)
    }
  }

  /**
   * Executes command
   * 
   * @param {Object} actor User/Process sending command - must contain { id, name, tenant, and roles }
   * @param {String} command Command name - must be registered in commands map
   * @param {Object} payload
   */
  async command (actor, command, { aggregateId = '', expectedVersion = -1, ...payload } = {}) {
    if (this._debug_) console.log(`DEBUG: actor ${JSON.stringify(actor)} sent ${command}(${aggregateId}.${expectedVersion})`, JSON.stringify(payload))

    // validate arguments
    if (!actor) throw Err.missingArguments('actor')
    if (!actor.id) throw Err.missingArguments('actor.id')
    if (!actor.name) throw Err.missingArguments('actor.name')
    if (!actor.tenant) throw Err.missingArguments('actor.tenant')
    if (!actor.roles) throw Err.missingArguments('actor.roles')
    if (!command) throw Err.missingArguments('command')
    if (expectedVersion >= 0 && !aggregateId) throw Err.missingArguments('aggregateId')
    
    // handle pumps
    if (command === 'pump') return await this.pump(actor, payload)

    // get aggregate type from commands map
    const aggregateType = this._commands_[command]
    if (!aggregateType) throw Err.invalidArguments(`command ${command} not found`)

    // load latest aggregate snapshot
    let aggregate = await this._store_.loadAggregateFromSnapshot(actor.tenant, aggregateType, aggregateId)
    if (this._debug_) console.log('DEBUG: after load', JSON.stringify(aggregate))
  
    // handle command
    await aggregate.commands[command](actor, payload)

    // assume user wants to act on latest version when not provided
    if (expectedVersion === -1) expectedVersion = aggregate._aggregate_version_

    // commit events
    aggregate = await this._store_.commitAggregate(actor.tenant, aggregate, expectedVersion)
    if (this._debug_) console.log('DEBUG: after commit - ', JSON.stringify(aggregate))

    // handle uncommited events
    for(let handler of this._handlers_) {
      for(let event of aggregate._uncommitted_events_) {
        const eh = handler.events[event._event_name_]
        if (eh) await eh(actor, aggregate, event)
      }
    }
    aggregate._uncommitted_events_ = []
    return aggregate
  }
}
