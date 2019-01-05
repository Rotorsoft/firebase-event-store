'use strict'

const IEventHandler = require('./src/IEventHandler')
const IEventStore = require('./src/IEventStore')
const ITracer = require('./src/ITracer')
const Bus = require('./src/Bus')
const Aggregate = require('./src/Aggregate')
const FirestoreEventStore = require('./src/firestore/FirestoreEventStore')
const Err = require('./src/Err')

let _bus_

module.exports = {
  Aggregate,
  Bus,
  IEventHandler,
  IEventStore,
  ITracer,
  Err,
  /**
   * Initializes firebase store and creates the bus
   */
  setup: (firebase, aggregates, { snapshots = true, tracer = null } = {}) => {
    if (!firebase) throw Err.missingArguments('firebase')
    if (!firebase.apps) throw Err.invalidArguments('firebase.apps')
    if (!aggregates) throw Err.missingArguments('aggregates')
    if (!(aggregates instanceof Array)) throw Err.invalidArguments('aggregates')
    if (tracer && !(tracer instanceof ITracer)) throw Err.invalidArguments('tracer')

    if (!firebase.apps.length) {
      firebase.initializeApp()
      const firestore = firebase.firestore()
      if (firestore.settings) firestore.settings({ timestampsInSnapshots: true })
      _bus_ = new Bus(new FirestoreEventStore(firestore, snapshots, tracer), aggregates, tracer)
    }
    return _bus_
  }
}
