'use strict'

const IBus = require('./IBus')
const IEventHandler = require('./IEventHandler')
const Err = require('./Err')

module.exports = class Bus extends IBus {
  /**
   * In-Memory Bus constructor
   * 
   * @param {CommandHandler} commandHandler Command handler
   */
  constructor (commandHandler) {
    super()
    this._commandHandler_ = commandHandler
    this._eventHandlers_ = []
  }

  addEventHandler (handler) {
    if (!(handler instanceof IEventHandler)) throw Err.invalidArguments('handler')
    this._eventHandlers_.push(handler)
  }

  async pump (actor, payload) {
    for(let handler of this._eventHandlers_) {
      await handler.pump(actor, payload)
    }
  }

  async command (actor, command, payload) {
    // validate arguments
    if (!actor) throw Err.missingArguments('actor')
    if (!actor.id) throw Err.missingArguments('actor.id')
    if (!actor.name) throw Err.missingArguments('actor.name')
    if (!actor.tenant) throw Err.missingArguments('actor.tenant')
    if (!actor.roles) throw Err.missingArguments('actor.roles')
    if (!command) throw Err.missingArguments('command')
    
    // handle pumps
    if (command === 'pump') return await this.pump(actor, payload)

    // handle commands
    const aggregate = await this._commandHandler_.handle(actor, command, payload)

    // in-memory pub/sub - to be replaced with serverless messaging platform for scalability
    // publish commited events
    for(let handler of this._eventHandlers_) {
      for(let event of aggregate._uncommitted_events_) {
        await handler.handle(actor, aggregate, event)
      }
    }

    // clear aggregate before return
    aggregate._uncommitted_events_ = []
    return aggregate
  }
}
