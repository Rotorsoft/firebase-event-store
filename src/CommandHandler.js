'use strict'

const Aggregate = require('./Aggregate')
const Err = require('./Err')

module.exports = class CommandHandler {
  /**
   * Command handler
   * 
   * @param {IEventStore} store 
   * @param {Aggregate[]} aggregates
   * @param {ITracer} tracer
   */
  constructor (store, aggregates, tracer) {
    this._store_ = store
    this._tracer_ = tracer

    // build commands map
    this._map_ = {}
    aggregates.forEach(aggregateType => {
      if (!(aggregateType.prototype instanceof Aggregate)) throw Err.preconditionError(`${aggregateType.name} is not a subclass of Aggregate`)
      const aggregate = Aggregate.create(null, aggregateType)
      for(let command of Object.keys(aggregate.commands)) {
        this._map_[command] = aggregateType
      }
    })
  }

  /**
   * Handles command
   * 
   * @param {Object} actor 
   * @param {String} command 
   * @param {Object} payload
   * @returns {Aggregate}
   */
  async handle (actor, command, { aggregateId = '', expectedVersion = -1, ...payload } = {}) {
    this._tracer_.trace(`actor ${JSON.stringify(actor)} sent ${command}(${aggregateId}.${expectedVersion})`, JSON.stringify(payload))
    if (expectedVersion >= 0 && !aggregateId) throw Err.missingArguments('aggregateId')
    
    // get aggregate type from commands map
    const aggregateType = this._map_[command]
    if (!aggregateType) throw Err.invalidArguments(`command ${command} not found`)

    // load latest aggregate snapshot
    let aggregate = await this._store_.loadAggregate(actor.tenant, aggregateType, aggregateId)
    this._tracer_.trace('after load', JSON.stringify(aggregate))
  
    // handle command
    await aggregate.commands[command](actor, payload)

    // assume user wants to act on latest version when not provided
    if (expectedVersion === -1) expectedVersion = aggregate._aggregate_version_

    // commit events
    aggregate = await this._store_.commitEvents(actor.tenant, aggregate, expectedVersion)
    this._tracer_.trace('after commit', JSON.stringify(aggregate))

    return aggregate
  }
}