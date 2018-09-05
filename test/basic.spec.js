'use strict'

const { Command, command } = require('../index')
const { setup } = require('./setup')
const { Calculator, AddNumbers, EventCounter, NumbersAdded, CommandMap } = require('./model')

let bus, firestore

process.on('unhandledRejection', error => { console.log('unhandledRejection', error) })

const actor1 = { id: 'user1', tenant: 'tenant1' }

describe('Basic', () => {
  before (() => {
    bus = setup(CommandMap, false)
    firestore = bus.eventStore._db_
    bus.addEventHandler(new EventCounter(firestore))
  })

  it('should accumulate numbers to 12', async () => {
    let calc = await bus.sendCommand(actor1, Command.create(AddNumbers, { number1: 1, number2: 2 }), Calculator, 'calc1')
    calc = await bus.sendCommand(actor1, Command.create(AddNumbers, { number1: 3, number2: 4 }), Calculator, calc.aggregateId)
    calc = await bus.sendCommand(actor1, Command.create(AddNumbers, { number1: 1, number2: 1 }), Calculator, calc.aggregateId)
    let counter = await firestore.doc('/counters/counter1').get()
    calc.aggregateVersion.should.equal(2)
    calc.sum.should.equal(12)
    calc.creator.should.equal('user1')
    counter.data().eventCount.should.equal(3)
  })

  it('should load aggregate from events', async () => {
    let calc = await bus.sendCommand(actor1, Command.create(AddNumbers, { number1: 1, number2: 2 }), Calculator, 'calc100')
    calc = await bus.sendCommand(actor1, Command.create(AddNumbers, { number1: 3, number2: 4 }), Calculator, calc.aggregateId, calc.aggregateVersion)
    calc = await bus.sendCommand(actor1, Command.create(AddNumbers, { number1: 1, number2: 1 }), Calculator, calc.aggregateId, calc.aggregateVersion)
    calc = await bus.eventStore.loadAggregateFromEvents(actor1.tenant, Calculator, calc.aggregateId, { NumbersAdded })
    calc.aggregateVersion.should.equal(2)
    calc.sum.should.equal(12)
    calc.creator.should.equal('user1')
  })

  it('should throw invalid event type when loading aggregate from events', async () => {
    try {
      let calc = bus.sendCommand(actor1, Command.create(AddNumbers, { number1: 1, number2: 2 }), Calculator, 'calc101')
      calc = await bus.sendCommand(actor1, Command.create(AddNumbers, { number1: 3, number2: 4 }), Calculator, calc.aggregateId, calc.aggregateVersion)
      calc = await bus.sendCommand(actor1, Command.create(AddNumbers, { number1: 1, number2: 1 }), Calculator, calc.aggregateId, calc.aggregateVersion)
      calc = await bus.eventStore.loadAggregateFromEvents(actor1.tenant, Calculator, calc.aggregateId, { })
    }
    catch(error) {
      error.message.should.be.equal('precondition error: Invalid event type: NumbersAdded')
    }
  })

  it('should accumulate numbers to 3 with system generated id', async () => {
    let calculator = await bus.sendCommand(actor1, Command.create(AddNumbers, { number1: 1, number2: 2 }), Calculator)
    calculator.aggregateVersion.should.equal(0)
    calculator.aggregateId.length.should.be.at.least(10)
    calculator.sum.should.equal(3)
    calculator.creator.should.equal('user1')
  })

  it('should accumulate numbers to 10', async () => {
    const auth = { uid: 'user1', token: { tenant: 'tenant1' } }
    let calc = await command('AddNumbers', { number1: 1, number2: 2 }, auth)
    calc = await command('AddNumbers', { aggregateId: calc.aggregateId, aggregateVersion: calc.aggregateVersion, number1: 3, number2: 4 }, auth)
    calc.aggregateVersion.should.equal(1)
    calc.sum.should.equal(10)
  })

  it('should throw concurrency error', async () => {
    try {
      let calc = await bus.sendCommand(actor1, Command.create(AddNumbers, { number1: 1, number2: 2 }), Calculator, 'calc1')
      calc = await bus.sendCommand(actor1, Command.create(AddNumbers, { number1: 3, number2: 4 }), Calculator, calc.aggregateId, calc.aggregateVersion)
      calc = await bus.sendCommand(actor1, Command.create(AddNumbers, { number1: 3, number2: 4 }), Calculator, calc.aggregateId, 0)
    }
    catch(error) {
      error.message.should.be.equal('concurrency error')
    }
  })

  it('should throw invalid arguments aggregateType', async () => {
    try {
      await bus.sendCommand(actor1, Command.create(AddNumbers, { number1: 1, number2: 2 }), AddNumbers)
    }
    catch(error) {
      error.message.should.be.equal('invalid arguments: aggregateType')
    }
  })
})

describe('Many commands', () => {
  it('should accumulate numbers to 1004', async () => {
    const iters = 1004
    const bus3 = setup(CommandMap, false)
    let cmd = Command.create(AddNumbers, { number1: 0, number2: 1 })
    let calc = await bus3.sendCommand(actor1, cmd, Calculator, 'calc9')
    for (let i = 0; i < iters; i++) {
      calc = await bus3.sendCommand(actor1, cmd, Calculator, calc.aggregateId, calc.aggregateVersion)
    }
    calc.aggregateVersion.should.equal(iters)
    calc.sum.should.equal(iters + 1)
  })
})
