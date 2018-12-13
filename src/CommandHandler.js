'use strict'

const IBus = require('./IBus')
const ITracer = require('./ITracer')
const CommandMapper = require('./CommandMapper')
const Err = require('./Err')

module.exports = class CommandHandler extends IBus {
  /**
   * Command handler implements in-memory bus
   * 
   * @param {IEventStore} store 
   * @param {Aggregate[]} aggregates
   * @param {ITracer} tracer
   */
  constructor (store, aggregates, tracer = null) {
    super()
    this._store_ = store
    this._tracer_ = tracer || new ITracer()
    this._mapper_ = new CommandMapper(aggregates)
  }

  async command (actor, command, { aggregateId = '', expectedVersion = -1, ...payload } = {}) {
    // validate arguments
    if (!actor) throw Err.missingArguments('actor')
    if (!actor.id) throw Err.missingArguments('actor.id')
    if (!actor.name) throw Err.missingArguments('actor.name')
    if (!actor.tenant) throw Err.missingArguments('actor.tenant')
    if (!actor.roles) throw Err.missingArguments('actor.roles')
    if (!command) throw Err.missingArguments('command')
    
    // handle pumps
    if (command === 'pump') return await this.pump(actor, payload)

    // get aggregate type from commands map
    if (expectedVersion >= 0 && !aggregateId) throw Err.missingArguments('aggregateId')
    const aggregateType = this._mapper_.map(command)

    // load latest aggregate snapshot
    this._tracer_.trace({ msg: `actor ${JSON.stringify(actor)} sent ${command} to ${aggregateType.name} ${aggregateId} (v${expectedVersion}) with`, payload })
    let aggregate = await this._store_.loadAggregate(actor.tenant, aggregateType, aggregateId)
    this._tracer_.trace({ msg: `after loading ${aggregateType.name}`, aggregate })
  
    // handle command
    await aggregate.commands[command](actor, payload)

    // assume user wants to act on latest version when not provided
    if (expectedVersion === -1) expectedVersion = aggregate._aggregate_version_

    // commit events
    const events = await this._store_.commitEvents(actor, command, aggregate, expectedVersion)
    this._tracer_.trace({ msg: 'after committing', events })

    // publish committed events
    for(let event of events) {
      await this.publish(event)
    }

    return aggregate
  }
}