'use strict'

const IEventHandler = require('./src/IEventHandler')
const Aggregate = require('./src/Aggregate')
const Command = require('./src/Command')
const Evento = require('./src/Evento')
const Bus = require('./src/Bus')
const ERRORS = require('./src/errors')
const FirestoreEventStore = require('./src/FirestoreEventStore')

let _bus_

module.exports = {
  Aggregate,
  Command,
  Evento,
  IEventHandler,
  ERRORS,
  setup: (firebase, aggregates, debug = false) => {
    console.log('setup')
    if (!firebase) throw ERRORS.MISSING_ARGUMENTS_ERROR('firebase')
    if (!firebase.apps) throw ERRORS.INVALID_ARGUMENTS_ERROR('firebase.apps')
    if (!aggregates || !(aggregates instanceof Array)) throw ERRORS.INVALID_ARGUMENTS_ERROR('aggregates')
    if (!firebase.apps.length) {
      firebase.initializeApp()
      const firestore = firebase.firestore()
      if (firestore.settings) firestore.settings({ timestampsInSnapshots: true })
      _bus_ = new Bus(new FirestoreEventStore(firestore), debug)
      aggregates.forEach(a => _bus_.register(a))
    }
    return _bus_
  },
  command: async (command, payload, auth) => {
    if (!_bus_) throw ERRORS.PRECONDITION_ERROR('app not initialized')
    if (!command) throw ERRORS.MISSING_ARGUMENTS_ERROR('command')
    if (!payload) throw ERRORS.MISSING_ARGUMENTS_ERROR('payload')
    if (!auth || !auth.uid || !auth.token) throw ERRORS.MISSING_ARGUMENTS_ERROR('auth')
    if (payload.expectedVersion >= 0 && !payload.aggregateId) throw ERRORS.MISSING_ARGUMENTS_ERROR('payload.aggregateId')
  
    const actor = { id: auth.uid, name: auth.token.name, tenant: auth.token.tenant, roles: auth.token.roles }
    return await _bus_.command(actor, command, payload)
  }
}
