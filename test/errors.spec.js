'use strict'

const Bus = require('../src/Bus')
const FirestoreEventStore = require('../src/FirestoreEventStore')
const { Calculator } = require('./model')
const { InvalidAggregate, InvalidHandler } = require('./invalid')
const { setup, firebase } = require('./setup')
const setup2 = require('../index').setup
const bus = setup(false)
const firestore = bus.eventStore._db_

describe('Error handling', () => {
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
})

const actor1 = { id: 'user1', name: 'user1', tenant: 'tenant1', roles: [] }

describe('Not implemented', () => {
  it('should throw not implemented events', async () => {
    try {
      const bus = setup(false)
      bus.addEventHandler(new InvalidHandler())
      await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('not implemented: events')
    }
  })

  it('should throw not implemented commands', async () => {
    try {
      const bus = setup2(firebase, [InvalidAggregate], false)
      await bus.command(actor1, 'InvalidCommand', { number1: 1, number2: 2 })
    }
    catch(error) { 
      error.message.should.be.equal('not implemented: commands')
    }
  })

  it('should throw not implemented events', async () => {
    try {
      const bus = setup2(firebase, [InvalidAggregate], false)
      InvalidAggregate.prototype.handleCommand = Calculator.prototype.handleCommand
      await bus.command(actor1, 'InvalidCommand', { number1: 1, number2: 2 })
    }
    catch(error) { 
      error.message.should.be.equal('not implemented: events')
    }
  })

  it('should throw invalid arguments aggregateType', async () => {
    try {
      const bus = setup2(firebase, [InvalidCommand], false)
    }
    catch(error) {
      error.message.should.be.equal('InvalidCommand is not defined')
    }
  })

  it('should throw precondition error', async () => {
    try {
      const bus = setup2(firebase, [InvalidAggregate], false)
      await bus.command(actor1, 'InvalidCommand3', { a: 1, b: 3 })
    }
    catch(error) {
      error.message.should.equal('precondition error: a must be greater than b')
    }
  })
})
