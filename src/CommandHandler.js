'use strict'

const ITracer = require('./ITracer')
const IEventStore = require('./IEventStore')
const Aggregate = require('./Aggregate')
const SimpleCache = require('./SimpleCache')
const Err = require('./Err')

/**
 * Handles commands
 */
module.exports = class CommandHandler {
  /**
   * Constructor
   * 
   * @param {IEventStore} store The event store
   * @param {Aggregate[]} aggregates Array of aggregates supported by this instance
   * @param {ITracer} tracer Tracer module
   * @param {Integer} CACHE_SIZE Size of aggregates cache
   */
  constructor (store, aggregates, tracer = null, CACHE_SIZE = 10) {
    if (!(store instanceof IEventStore)) throw Err.invalidArgument('store')
    if (tracer && !(tracer instanceof ITracer)) throw Err.invalidArgument('tracer')
    this._store_ = store
    this._tracer_ = tracer || new ITracer()
    this._cache_ = new SimpleCache(CACHE_SIZE)
    this._commands_ = {}
    aggregates.forEach(aggregateType => {
      if (!(aggregateType.prototype instanceof Aggregate)) throw Err.invalidArgument('aggregateType')
      const aggregate = Aggregate.create(aggregateType)
      for(let command of Object.keys(aggregate.commands)) {
        this._commands_[command] = aggregateType
      }
    })
  }

  /**
   * Command Handler
   * 
   * @param {Object} actor User/Process sending command - must contain { id, name, tenant, and roles }
   * @param {String} command Command name
   * @param {Object} payload Command payload including aggregateId and expectedVersion
   * @returns {Object} command context with call arguments, stats, and updated aggregate
   */
  async command (actor, command, { aggregateId = '', expectedVersion = -1, ...payload } = {}) {
    // validate arguments
    if (!actor) throw Err.missingArgument('actor')
    if (!actor.id) throw Err.missingArgument('actor.id')
    if (!actor.name) throw Err.missingArgument('actor.name')
    if (!actor.tenant) throw Err.missingArgument('actor.tenant')
    if (!actor.roles) throw Err.missingArgument('actor.roles')
    if (!command) throw Err.missingArgument('command')
    if (expectedVersion >= 0 && !aggregateId) throw Err.missingArgument('aggregateId')
    
    // get aggregate type from commands map
    const aggregateType = this._commands_[command]
    if (!aggregateType) throw Err.invalidArgument('command')

    // create command context
    const context = { actor, command, aggregateType, aggregateId, expectedVersion, payload }
    this._tracer_.trace(() => ({ method: 'command', context }))

    // try loading aggregate from cache first
    if (aggregateId && expectedVersion >= 0) {
      context.cacheKey = aggregateType.name.concat('.', aggregateId)
      const copy = this._cache_.get(context.cacheKey)
      if (copy) {
        context.aggregate = Aggregate.create(aggregateType, copy)
        context.cached = true
      }
    }

    // load from store if not found in cache or incorrect version
    if (!(context.aggregate && context.aggregate._aggregate_version_ === expectedVersion)) {
      context.aggregate = await this._store_.loadAggregate(context)
      context.cached = false
      this._tracer_.trace(() => ({ method: 'loadAggregate', context }))
    }
  
    // handle command
    await context.aggregate.commands[command](actor, payload, this)

    if (context.aggregate._uncommitted_events_.length) {
      // assume user wants to act on latest version when not provided
      if (expectedVersion === -1) context.expectedVersion = context.aggregate._aggregate_version_

      // commit events
      const events = await this._store_.commitEvents(context)
      this._tracer_.trace(() => ({ method: 'commitEvents', events, context }))

      // cache aggregate
      this._cache_.set(context.cacheKey, context.aggregate.clone())
    }

    return context
  }
}
