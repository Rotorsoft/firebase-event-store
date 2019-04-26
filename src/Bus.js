'use strict'

const Aggregate = require('./Aggregate')
const ITracer = require('./ITracer')
const IEventStore = require('./IEventStore')
const Err = require('./Err')

/**
 * Maps aggregate commands to their types
 */
class CommandMapper {
  constructor (aggregates) {
    this._map_ = {}
    aggregates.forEach(aggregateType => {
      if (!(aggregateType.prototype instanceof Aggregate)) throw Err.invalidArgument('aggregateType')
      const aggregate = Aggregate.create(aggregateType)
      for(let command of Object.keys(aggregate.commands)) {
        this._map_[command] = aggregateType
      }
    })
  }

  map (command) {
    const aggregateType = this._map_[command]
    if (!aggregateType) throw Err.invalidArgument('command')
    return aggregateType
  }
}

/**
 * Simple in-memory object cache
 */
class Cache {
  constructor(size = 10) {
    this._size_ = size
    this._cache_ = new Map()
  }

  get (key) {
    if (!this._size_) return null

    const item = this._cache_.get(key)
    if (item) {
      this._cache_.delete(key)
      this._cache_.set(key, item)
    }
    return item
  }

  set (key, item) {
    if (!this._size_) return

    if (this._cache_.has(key)) this._cache_.delete(key)
    this._cache_.set(key, item)

    while (this._cache_.size > this._size_) {
      const first = this._cache_.keys().next().value
      this._cache_.delete(first)
    }
  }
}

/**
 * Message Bus
 */
module.exports = class Bus {
  /**
   * Bus constructor
   * 
   * @param {IEventStore} store The event store
   * @param {Aggregate[]} aggregates Array of aggregates supported by this instance
   * @param {ITracer} tracer Tracer module
   * @param {Integer} CACHE_SIZE Size of aggregate cache
   */
  constructor (store, aggregates, tracer = null, CACHE_SIZE = 10) {
    if (!(store instanceof IEventStore)) throw Err.invalidArgument('store')
    if (tracer && !(tracer instanceof ITracer)) throw Err.invalidArgument('tracer')
    this._store_ = store
    this._tracer_ = tracer || new ITracer()
    this._mapper_ = new CommandMapper(aggregates)
    this._cache_ = new Cache(CACHE_SIZE)
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
    
    // get aggregate type from commands map
    if (expectedVersion >= 0 && !aggregateId) throw Err.missingArgument('aggregateId')
    const aggregateType = this._mapper_.map(command)

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

  /**
   * Poll stream, handle new events, and commits cursors
   * 
   * @param {String} tenant tenant id
   * @param {String} stream stream name
   * @param {Array} handlers Array of event handlers
   * @param {Integer} limit Max number of events to poll
   * @param {Integer} timeout Timeout in milliseconds to expire lease
   * @returns True if any of the handlers is still behind
   */
  async poll (tenant, stream, handlers, { limit = 10, timeout = 10000 } = {}) {
    // validate handlers
    const validHandlers = handlers.filter(h => h.name && h.stream === stream)
    if (!validHandlers.length) return false

    const lease = await this._store_.pollStream(tenant, stream, validHandlers, limit, timeout)

    // handle events
    if (lease && lease.events.length) {
      for (let event of lease.events) {
        for (let handler of lease.handlers) {
          if (event.streamVersion > lease.cursors[handler.name]) {
            try {
              this._tracer_.trace(() => ({ method: 'handle', handler: handler.name, tenant, stream, event }))
              await handler.handle(tenant, event)
              lease.cursors[handler.name] = event.streamVersion
            }
            catch (e) {
              this._tracer_.trace(() => ({ error: e }))
            }
          }
        }
      }
      return await this._store_.commitCursors(lease)
    }

    return false
  }
}
