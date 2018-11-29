'use strict'

const Bus = require('../src/Bus')
const Aggregate = require('../src/Aggregate')
const { FirestoreEventStore } = require('../src/FirestoreEventStore')
const { Calculator } = require('./model')
const { InvalidAggregate, InvalidHandler } = require('./invalid')
const { setup, firebase } = require('./setup')
const setup2 = require('../index').setup
const bus = setup()
const firestore = bus.eventStore._db_
const actor1 = { id: 'user1', name: 'user1', tenant: 'tenant1', roles: [] }

describe('Err handling', () => {
  it('should throw invalid arguments: store', async () => {
    try {
      let bus2 = new Bus(new Object())
    }
    catch(error) {
      error.message.should.equal('invalid arguments: store')
    }
  })

  it('should throw invalid arguments: handler', async () => {
    try {
      let bus2 = new Bus(new FirestoreEventStore(firestore))
      bus2.addEventHandler(new Object())
    }
    catch(error) {
      error.message.should.equal('invalid arguments: handler')
    }
  })

  it('should throw missing arguments actor', async () => {
    try {
      const bus = setup()
      await bus.command(null, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('missing arguments: actor')
    }
  })

  it('should throw missing arguments actor.id', async () => {
    try {
      const bus = setup()
      await bus.command({ name: 'user1', tenant: 'tenant1', roles: [] }, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('missing arguments: actor.id')
    }
  })

  it('should throw missing arguments actor.name', async () => {
    try {
      const bus = setup()
      await bus.command({ id: 'user1', tenant: 'tenant1', roles: [] }, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('missing arguments: actor.name')
    }
  })

  it('should throw missing arguments actor.tenant', async () => {
    try {
      const bus = setup()
      await bus.command({ id: 'user1', name: 'user1', roles: [] }, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('missing arguments: actor.tenant')
    }
  })

  it('should throw missing arguments actor.roles', async () => {
    try {
      const bus = setup()
      await bus.command({ id: 'user1', name: 'user1', tenant: 'tenant1' }, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('missing arguments: actor.roles')
    }
  })

  it('should throw missing arguments command', async () => {
    try {
      const bus = setup()
      await bus.command(actor1, '', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('missing arguments: command')
    }
  })

  it('should throw invalid arguments command', async () => {
    try {
      const bus = setup()
      await bus.command(actor1, 'abc', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('invalid arguments: command abc not found')
    }
  })

  it('should throw missing arguments aggregateId', async () => {
    try {
      const bus = setup()
      await bus.command(actor1, 'abc', { number1: 1, number2: 2, expectedVersion: 1 })
    }
    catch(error) {
      error.message.should.be.equal('missing arguments: aggregateId')
    }
  })

  it('should throw invalid arguments number1', async () => {
    try {
      const bus = setup()
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
      const bus = setup()
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
      const bus = setup()
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
      const bus = setup()
      bus.addEventHandler(new InvalidHandler())
      await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('not implemented: events')
    }
  })

  it('should throw not implemented commands', async () => {
    try {
      const bus = setup2(firebase, [InvalidAggregate])
      await bus.command(actor1, 'InvalidCommand', { number1: 1, number2: 2 })
    }
    catch(error) { 
      error.message.should.be.equal('not implemented: commands')
    }
  })

  it('should throw not implemented events', async () => {
    try {
      const bus = setup2(firebase, [InvalidAggregate])
      InvalidAggregate.prototype.handleCommand = Calculator.prototype.handleCommand
      await bus.command(actor1, 'InvalidCommand', { number1: 1, number2: 2 })
    }
    catch(error) { 
      error.message.should.be.equal('not implemented: events')
    }
  })

  it('should throw invalid arguments aggregateType', async () => {
    try {
      const bus = setup2(firebase, [InvalidCommand])
    }
    catch(error) {
      error.message.should.be.equal('InvalidCommand is not defined')
    }
  })

  it('should throw precondition error', async () => {
    try {
      const bus = setup2(firebase, [InvalidAggregate])
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
      const bus = setup2(firebase, [A])
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
      const bus = setup2(firebase, [A])
      await bus.command(actor1, 'C')
    }
    catch(error) {
      error.message.should.be.equal('not implemented: commands')
    }
  })

  it('should throw not implemented path', async () => {
    try {
      delete Calculator.path
      const bus = setup2(firebase, [Calculator])
      await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('not implemented: path')
    }
  })
})
