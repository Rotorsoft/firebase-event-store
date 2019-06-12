'use strict'

const IEventHandler = require('./src/IEventHandler')
const IEventStore = require('./src/IEventStore')
const ITracer = require('./src/ITracer')
const CommandHandler = require('./src/CommandHandler')
const StreamReader = require('./src/StreamReader')
const Aggregate = require('./src/Aggregate')
const Event = require('./src/Event')
const FirestoreEventStore = require('./src/firestore/FirestoreEventStore')
const Err = require('./src/Err')

module.exports = {
  Aggregate,
  Event,
  CommandHandler,
  StreamReader,
  IEventHandler,
  IEventStore,
  ITracer,
  Err,
  /**
   * Initializes firebase and returns firestore
   */
  getFirestore: (firebase) => {
    if (!firebase) throw Err.missingArgument('firebase')
    if (!firebase.apps) throw Err.invalidArgument('firebase.apps')
    if (!firebase.apps.length) {
      firebase.initializeApp()
      const firestore = firebase.firestore()
      if (firestore.settings) firestore.settings({ timestampsInSnapshots: true })
      return firestore
    }
    return firebase.firestore()
  },
  /**
   * Creates a command handler
   */
  getFirestoreCommandHandler: (firestore, aggregates, { tracer = null, CACHE_SIZE = 10 } = {}) => {
    if (!firestore) throw Err.missingArgument('firestore')
    if (!aggregates) throw Err.missingArgument('aggregates')
    if (!(aggregates instanceof Array)) throw Err.invalidArgument('aggregates')
    if (tracer && !(tracer instanceof ITracer)) throw Err.invalidArgument('tracer')
    return new CommandHandler(new FirestoreEventStore(firestore, tracer), aggregates, tracer, CACHE_SIZE)
  },
  /**
   * Creates a stream reader
   */
  getFirestoreStreamReader: (firestore, tenant, stream, handlers, { tracer = null } = {}) => {
    if (!firestore) throw Err.missingArgument('firestore')
    if (!tenant) throw Err.missingArgument('tenant')
    if (!stream) throw Err.missingArgument('stream')
    if (!handlers) throw Err.missingArgument('handlers')
    if (tracer && !(tracer instanceof ITracer)) throw Err.invalidArgument('tracer')
    return new StreamReader(new FirestoreEventStore(firestore, tracer), tenant, stream, handlers, tracer)
  }
}
