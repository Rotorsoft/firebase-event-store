'use strict'

const IBus = require('./src/IBus')
const IEventHandler = require('./src/IEventHandler')
const IEventStore = require('./src/IEventStore')
const Aggregate = require('./src/Aggregate')
const CommandHandler = require('./src/CommandHandler')
const { ConsoleTracer, NullTracer } = require('./src/ITracer')
const Bus = require('./src/Bus')
const FirestoreEventStore = require('./src/FirestoreEventStore')
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
  setup: (firebase, aggregates, { snapshots = true, debug = false } = {}) => {
    if (!firebase) throw Err.missingArguments('firebase')
    if (!firebase.apps) throw Err.invalidArguments('firebase.apps')
    if (!aggregates) throw Err.missingArguments('aggregates')
    if (!(aggregates instanceof Array)) throw Err.invalidArguments('aggregates')

    if (!firebase.apps.length) {
      firebase.initializeApp()
      const firestore = firebase.firestore()
      if (firestore.settings) firestore.settings({ timestampsInSnapshots: true })

      const store = new FirestoreEventStore(firestore, { snapshots: snapshots })
      const handler = new CommandHandler(store, aggregates, debug ? new ConsoleTracer() : new NullTracer())
      _bus_ = new Bus(handler)
    }
    return _bus_
  }
}
