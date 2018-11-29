'use strict'

const IBus = require('./src/IBus')
const IEventHandler = require('./src/IEventHandler')
const IEventStore = require('./src/IEventStore')
const Aggregate = require('./src/Aggregate')
const Bus = require('./src/Bus')
const { FirestoreEventStore, FirestoreSnapshooter } = require('./src/FirestoreEventStore')
const Err = require('./src/Err')

let _bus_

module.exports = {
  Aggregate,
  IBus,
  IEventHandler,
  IEventStore,
  Err,
  /**
   * Initializes firebase store and creates the bus
   */
  setup: (firebase, aggregates, snapshots = true, debug = false) => {
    if (!firebase) throw Err.missingArguments('firebase')
    if (!firebase.apps) throw Err.invalidArguments('firebase.apps')
    if (!aggregates) throw Err.missingArguments('aggregates')
    if (!(aggregates instanceof Array)) throw Err.invalidArguments('aggregates')

    if (!firebase.apps.length) {
      firebase.initializeApp()
      const firestore = firebase.firestore()
      if (firestore.settings) firestore.settings({ timestampsInSnapshots: true })

      // build commands map
      const commands = {}
      aggregates.forEach(aggregateType => {
        if (!(aggregateType.prototype instanceof Aggregate)) throw Err.preconditionError(`${aggregateType.name} is not a subclass of Aggregate`)
        const aggregate = Aggregate.create(null, aggregateType)
        for(let command of Object.keys(aggregate.commands)) {
          commands[command] = aggregateType
        }
      })

      const snapshooter = snapshots ? new FirestoreSnapshooter(firestore) : null
      const store = new FirestoreEventStore(firestore, snapshooter)
      _bus_ = new Bus(store, commands, debug)
      if (snapshooter) _bus_.addEventHandler(snapshooter)
    }
    return _bus_
  }
}
