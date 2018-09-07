'use strict'

const FirestoreEventStore = require('./src/FirestoreEventStore')
const IEventHandler = require('./src/IEventHandler')
const Aggregate = require('./src/Aggregate')
const Bus = require('./src/Bus')
const Errors = require('./src/errors')

let _bus_

module.exports = {
  Aggregate,
  IEventHandler,
  Errors,
  /**
   * Initializes firebase store and creates a bus that can handle all commands in aggregates
   */
  setup: (firebase, aggregates, debug = false) => {
    console.log('setup')
    if (!firebase) throw Errors.missingArguments('firebase')
    if (!firebase.apps) throw Errors.invalidArguments('firebase.apps')
    if (!aggregates) throw Errors.missingArguments('aggregates')
    if (!(aggregates instanceof Array)) throw Errors.invalidArguments('aggregates')

    if (!firebase.apps.length) {
      firebase.initializeApp()
      const firestore = firebase.firestore()
      if (firestore.settings) firestore.settings({ timestampsInSnapshots: true })

      // build commands map
      const commands = {}
      aggregates.forEach(aggregateType => {
        if (!(aggregateType.prototype instanceof Aggregate)) throw Errors.preconditionError(`${aggregateType.name} is not a subclass of Aggregate`)
        const aggregate = Aggregate.create(null, aggregateType)
        for(let command of Object.keys(aggregate.commands)) {
          commands[command] = aggregateType
        }
      })
      _bus_ = new Bus(new FirestoreEventStore(firestore), commands, debug)
    }
    return _bus_
  }
}
