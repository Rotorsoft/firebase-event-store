'use strict'

const Aggregate = require('../../src/Aggregate')
const FirestoreEventStore = require('../../src/FirestoreEventStore')
const CommandHandler = require('../../src/CommandHandler')
const { Calculator } = require('./model')
const { InvalidAggregate, InvalidHandler } = require('./invalid')
const { setup, firebase } = require('../setup')
const storeSetup = require('../../index').setup
const actor1 = { id: 'user1', name: 'user1', tenant: 'tenant1', roles: [] }

const bus = setup([Calculator])
const firestore = firebase.firestore()

describe('Err handling', () => {
  it('should throw missing arguments actor', async () => {
    try {
      await bus.command(null, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('missing arguments: actor')
    }
  })

  it('should throw missing arguments actor.id', async () => {
    try {
      await bus.command({ name: 'user1', tenant: 'tenant1', roles: [] }, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('missing arguments: actor.id')
    }
  })

  it('should throw missing arguments actor.name', async () => {
    try {
      await bus.command({ id: 'user1', tenant: 'tenant1', roles: [] }, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('missing arguments: actor.name')
    }
  })

  it('should throw missing arguments actor.tenant', async () => {
    try {
      await bus.command({ id: 'user1', name: 'user1', roles: [] }, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('missing arguments: actor.tenant')
    }
  })

  it('should throw missing arguments actor.roles', async () => {
    try {
      await bus.command({ id: 'user1', name: 'user1', tenant: 'tenant1' }, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('missing arguments: actor.roles')
    }
  })

  it('should throw missing arguments command', async () => {
    try {
      await bus.command(actor1, '', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('missing arguments: command')
    }
  })

  it('should throw invalid arguments command', async () => {
    try {
      await bus.command(actor1, 'abc', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('invalid arguments: command abc not found')
    }
  })

  it('should throw missing arguments aggregateId', async () => {
    try {
      await bus.command(actor1, 'abc', { number1: 1, number2: 2, expectedVersion: 1 })
    }
    catch(error) {
      error.message.should.be.equal('missing arguments: aggregateId')
    }
  })

  it('should throw invalid arguments number1', async () => {
    try {
      await bus.command(actor1, 'AddNumbers')
    }
    catch(error) {
      error.message.should.be.equal('invalid arguments: number1')
    }
  })
})

describe('Not implemented', () => {
  it('should throw not implemented loadAggregate', async () => {
    const m = FirestoreEventStore.prototype.loadAggregate
    try {
      delete FirestoreEventStore.prototype.loadAggregate
      await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('not implemented: loadAggregate')
      FirestoreEventStore.prototype.loadAggregate = m
    }
  })

  it('should throw not implemented commitEvents', async () => {
    const m = FirestoreEventStore.prototype.commitEvents
    try {
      delete FirestoreEventStore.prototype.commitEvents
      await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('not implemented: commitEvents')
      FirestoreEventStore.prototype.commitEvents = m
    }
  })

  it('should throw not implemented events', async () => {
    try {
      bus.addEventHandler(new InvalidHandler())
      await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('not implemented: events')
    }
  })
})

describe('Err handling 2', () => {  
  it('should throw invalid arguments: store', async () => {
    try {
      let bus2 = new CommandHandler(new Object(), [])
    }
    catch(error) {
      error.message.should.equal('invalid arguments: store')
    }
  })

  it('should throw invalid arguments: handler', async () => {
    try {
      let bus2 = new CommandHandler(new FirestoreEventStore(firestore), [])
      bus2.addEventHandler(new Object())
    }
    catch(error) {
      error.message.should.equal('invalid arguments: handler')
    }
  })
  
  it('should throw not implemented commands', async () => {
    try {
      const bus = storeSetup(firebase, [InvalidAggregate])
      await bus.command(actor1, 'InvalidCommand', { number1: 1, number2: 2 })
    }
    catch(error) { 
      error.message.should.be.equal('not implemented: commands')
    }
  })

  it('should throw not implemented events', async () => {
    try {
      const bus = storeSetup(firebase, [InvalidAggregate])
      InvalidAggregate.prototype.handleCommand = Calculator.prototype.handleCommand
      await bus.command(actor1, 'InvalidCommand', { number1: 1, number2: 2 })
    }
    catch(error) { 
      error.message.should.be.equal('not implemented: events')
    }
  })

  it('should throw invalid arguments aggregateType', async () => {
    try {
      const bus = storeSetup(firebase, [InvalidCommand])
    }
    catch(error) {
      error.message.should.be.equal('InvalidCommand is not defined')
    }
  })

  it('should throw precondition error', async () => {
    try {
      const bus = storeSetup(firebase, [InvalidAggregate])
      await bus.command(actor1, 'InvalidCommand3', { a: 1, b: 3 })
    }
    catch(error) {
      error.message.should.equal('precondition error: a must be greater than b')
    }
  })

  it('should throw not implemented events', async () => {
    try {
      class A extends Aggregate {
        constructor() { super() }
        static get path () { return '/invalids' }
        get commands () { return { C: async () => { this.addEvent('a', 'E', {}) } } }
      }
      const bus = storeSetup(firebase, [A])
      await bus.command(actor1, 'C')
    }
    catch(error) {
      error.message.should.be.equal('not implemented: events')
    }
  })

  it('should throw not implemented commands', async () => {
    try {
      class A extends Aggregate {
        constructor() { super() }
        static get path () { return '/invalids' }
        get events () { return { E: () => {} } }
      }
      const bus = storeSetup(firebase, [A])
      await bus.command(actor1, 'C')
    }
    catch(error) {
      error.message.should.be.equal('not implemented: commands')
    }
  })

  it('should throw not implemented path', async () => {
    try {
      delete Calculator.path
      const bus = storeSetup(firebase, [Calculator])
      await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('not implemented: path')
    }
  })
})
