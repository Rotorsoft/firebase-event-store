'use strict'

const Aggregate = require('./Aggregate')
const Err = require('./Err')

module.exports = class CommandMapper {
  constructor (aggregates) {
    this._map_ = {}
    aggregates.forEach(aggregateType => {
      if (!(aggregateType.prototype instanceof Aggregate)) throw Err.preconditionError(`${aggregateType.name} is not a subclass of Aggregate`)
      const aggregate = Aggregate.create(null, aggregateType)
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