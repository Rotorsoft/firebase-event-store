'use strict'

const Aggregate = require('./Aggregate')
const StreamReader = require('./StreamReader')
const ITracer = require('./ITracer')
const IEventStore = require('./IEventStore')
const IEventHandler = require('./IEventHandler')
const Err = require('./Err')

class CommandMapper {
  constructor (aggregates) {
    this._map_ = {}
    aggregates.forEach(aggregateType => {
      if (!(aggregateType.prototype instanceof Aggregate)) throw Err.preconditionError(`${aggregateType.name} is not a subclass of Aggregate`)
      const aggregate = Aggregate.create(aggregateType)
      for(let command of Object.keys(aggregate.commands)) {
        this._map_[command] = aggregateType
      }
    })
  }

  map (command) {
    const aggregateType = this._map_[command]
    if (!aggregateType) throw Err.invalidArguments(`command ${command} not found`)
    return aggregateType
  }
}

function _push (bus, tenant, stream, events = null, load = false) {
  const readers = bus._readers_[tenant]
  if (readers) {
    const reader = readers[stream]
    if (reader) reader._push(events, load)
  }
}

/**
 * Message Bus
 */
module.exports = class Bus {
  /**
   * Bus constructor
   * 
   * @param {IEventStore} store
   * @param {Aggregate[]} aggregates
   * @param {ITracer} tracer
   */
  constructor (store, aggregates, tracer = null) {
    if (!(store instanceof IEventStore)) throw Err.invalidArguments('store')
    if (tracer && !(tracer instanceof ITracer)) throw Err.invalidArguments('tracer')
    this._store_ = store
    this._tracer_ = tracer || new ITracer()
    this._mapper_ = new CommandMapper(aggregates)
    this._readers_ = {}
  }

  /**
   * Subscribes event handlers with bus
   * New handlers catch up while current handlers keep receiving new events
   * in real time
   * 
   * @param {String} tenant Tenant id
   * @param {IEventHandler[]} handlers Event handlers
   * @param {Integer} windowSize Stream reader cache window size
   */
  async subscribe (tenant, handlers, windowSize = 100) {
    await this.flush(tenant)
    const readers = {}
    for (let handler of handlers) {
      if (!(handler instanceof IEventHandler)) throw Err.invalidArguments('handlers')
      let reader = readers[handler.stream]
      if (!reader) {
        const data = await this._store_.getStreamData(tenant, handler.stream)
        reader = new StreamReader(this._store_, tenant, handler.stream, windowSize, data._version_, data._cursors_)
        readers[handler.stream] = reader
      }
      reader._subscribe(handler)
    }
    this._readers_[tenant] = readers
    for(let reader of Object.values(readers)) {
      reader._startCatchupLoop()
    }
  }

  /**
   * Polls stream for new events to push
   * 
   * @param {String} tenant Tenant Id
   * @param {String} stream Stream name
   */
  async poll (tenant, stream = 'main') {
    await _push(this, tenant, stream, null, true)
  }

  /**
   * Flushes bus by waiting for pending pushes
   * 
   * @param {String} tenant Tenant Id
   */
  async flush (tenant) {
    const readers = this._readers_[tenant]
    if (readers) {
      for (let reader of Object.values(readers)) {
        await reader._flush()
      }
    }
  }

  /**
   * Command Handler
   * 
   * @param {Object} actor User/Process sending command - must contain { id, name, tenant, and roles }
   * @param {String} command name
   * @param {Object} payload including aggregateId and expectedVersion
   * @returns {Aggregate} aggregate
   */
  async command (actor, command, { aggregateId = '', expectedVersion = -1, ...payload } = {}) {
    // validate arguments
    if (!actor) throw Err.missingArguments('actor')
    if (!actor.id) throw Err.missingArguments('actor.id')
    if (!actor.name) throw Err.missingArguments('actor.name')
    if (!actor.tenant) throw Err.missingArguments('actor.tenant')
    if (!actor.roles) throw Err.missingArguments('actor.roles')
    if (!command) throw Err.missingArguments('command')
    
    // get aggregate type from commands map
    if (expectedVersion >= 0 && !aggregateId) throw Err.missingArguments('aggregateId')
    const aggregateType = this._mapper_.map(command)

    // load latest aggregate snapshot
    this._tracer_.trace(() => ({ method: 'command', actor, command, aggregateId, expectedVersion, payload }))
    const aggregate = await this._store_.loadAggregate(actor.tenant, aggregateType, aggregateId)
    this._tracer_.trace(() => ({ method: 'loadAggregate', aggregate, aggregateType }))
  
    // handle command
    await aggregate.commands[command](actor, payload, this)

    if (aggregate._uncommitted_events_.length) {
      // assume user wants to act on latest version when not provided
      if (expectedVersion === -1) expectedVersion = aggregate._aggregate_version_

      // commit events
      const events = await this._store_.commitEvents(actor, command, aggregate, expectedVersion)
      this._tracer_.trace(() => ({ method: 'commitEvents', events, actor, command, aggregate, aggregateType }))

      // push new events
      _push(this, actor.tenant, aggregateType.stream, events)
    }

    return aggregate
  }
}
