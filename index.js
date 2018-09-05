'use strict'

const IEventHandler = require('./src/IEventHandler')
const Aggregate = require('./src/Aggregate')
const Command = require('./src/Command')
const Evento = require('./src/Evento')
const Bus = require('./src/Bus')
const ERRORS = require('./src/errors')
const FirestoreEventStore = require('./src/FirestoreEventStore')

let _bus_, _map_

module.exports = {
  Aggregate,
  Command,
  Evento,
  IEventHandler,
  ERRORS,
  setup: (firebase, map, debug = false) => {
    console.log('setup')
    if (!firebase) throw ERRORS.MISSING_ARGUMENTS_ERROR('firebase')
    if (!firebase.apps) throw ERRORS.INVALID_ARGUMENTS_ERROR('firebase.apps')
    if (!firebase.apps.length) {
      firebase.initializeApp()
      const firestore = firebase.firestore()
      if (firestore.settings) firestore.settings({ timestampsInSnapshots: true })
      _bus_ = new Bus(new FirestoreEventStore(firestore), debug ? 'debug' : null)
    }
    _map_ = map
    return _bus_
  },
  command: (command, payload, auth) => {
    if (!_bus_) return Promise.reject(ERRORS.PRECONDITION_ERROR('app not initialized'))
    if (!command) return Promise.reject(ERRORS.MISSING_ARGUMENTS_ERROR('command'))
    if (!payload) return Promise.reject(ERRORS.MISSING_ARGUMENTS_ERROR('payload'))
    if (!auth || !auth.uid || !auth.token) return Promise.reject(ERRORS.MISSING_ARGUMENTS_ERROR('auth'))
    if (payload.expectedVersion >= 0 && !payload.aggregateId) return Promise.reject(ERRORS.MISSING_ARGUMENTS_ERROR('payload.aggregateId'))
  
    const binding = _map_[command]
    if (!binding) return Promise.reject(ERRORS.INVALID_ARGUMENTS_ERROR(`command ${command} not found`))
    const actor = { id: auth.uid, name: auth.token.name, tenant: auth.token.tenant, roles: auth.token.roles }
    const expectedVersion = typeof payload.expectedVersion === 'undefined' ? -1 : payload.expectedVersion
    return _bus_.sendCommand(actor, Command.create(binding.commandType, payload), binding.aggregateType, payload.aggregateId, expectedVersion)
  }
}
