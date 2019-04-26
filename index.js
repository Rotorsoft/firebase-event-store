'use strict'

const IEventHandler = require('./src/IEventHandler')
const IEventStore = require('./src/IEventStore')
const ITracer = require('./src/ITracer')
const Bus = require('./src/Bus')
const Aggregate = require('./src/Aggregate')
const Event = require('./src/Event')
const FirestoreEventStore = require('./src/firestore/FirestoreEventStore')
const Err = require('./src/Err')

let _bus_

module.exports = {
  Aggregate,
  Event,
  Bus,
  IEventHandler,
  IEventStore,
  ITracer,
  Err,
  /**
   * Initializes firebase store and creates the bus
   */
  setup: (firebase, aggregates, { snapshots = true, tracer = null, CACHE_SIZE = 10 } = {}) => {
    if (!firebase) throw Err.missingArgument('firebase')
    if (!firebase.apps) throw Err.invalidArgument('firebase.apps')
    if (!aggregates) throw Err.missingArgument('aggregates')
    if (!(aggregates instanceof Array)) throw Err.invalidArgument('aggregates')
    if (tracer && !(tracer instanceof ITracer)) throw Err.invalidArgument('tracer')

    if (!firebase.apps.length) {
      firebase.initializeApp()
      const firestore = firebase.firestore()
      if (firestore.settings) firestore.settings({ timestampsInSnapshots: true })
      _bus_ = new Bus(new FirestoreEventStore(firestore, snapshots, tracer), aggregates, tracer, CACHE_SIZE)
    }
    return _bus_
  }
}
