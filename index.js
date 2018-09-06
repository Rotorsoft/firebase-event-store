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

      // build commands map
      const commands = {}
      aggregates.forEach(a => {
        if (!(a.prototype instanceof Aggregate)) throw ERRORS.PRECONDITION_ERROR(`aggregate ${a.name} is not subclass of Aggregate`)
        Object.keys(a.COMMANDS).forEach(key => {
          commands[key] = { commandType: a.COMMANDS[key], aggregateType: a }
        })
      })
      _bus_ = new Bus(new FirestoreEventStore(firestore), commands, debug)
    }
    return _bus_
  }
}
