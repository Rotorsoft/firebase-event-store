'use strict'

const Aggregate = require('./src/Aggregate')
const Command = require('./src/Command')
const Evento = require('./src/Evento')
const Bus = require('./src/Bus')
const IEventHandler = require('./src/IEventHandler')
const ERRORS = require('./src/errors')
const FirestoreEventStore = require('./src/FirestoreEventStore')
const FirestoreDocumentStore = require('./src/FirestoreDocumentStore')

module.exports = {
  Aggregate,
  Command,
  Evento,
  Bus,
  IEventHandler,
  ERRORS,
  FirestoreEventStore,
  FirestoreDocumentStore
}