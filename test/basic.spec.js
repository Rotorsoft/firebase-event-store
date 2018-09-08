'use strict'

const { setup } = require('./setup')
const { Calculator, EventCounter } = require('./model')

let bus, firestore

process.on('unhandledRejection', error => { console.log('unhandledRejection', error) })

const actor1 = { id: 'user1', name: 'user1', tenant: 'tenant1', roles: [] }

describe('Basic', () => {
  before (() => {
    bus = setup(false)
    firestore = bus.eventStore._db_
    bus.addEventHandler(new EventCounter(firestore))
  })

  it('should accumulate numbers to 12', async () => {
    let calc
    calc = await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc1' })
    calc = await bus.command(actor1, 'AddNumbers', { number1: 3, number2: 4, aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 1, aggregateId: calc.aggregateId })
    let counter = await firestore.doc('/counters/counter1').get()
    calc.aggregateVersion.should.equal(2)
    calc.sum.should.equal(12)
    counter.data().eventCount.should.equal(3)
  })

  it('should load aggregate from events', async () => {
    let calc 
    calc = await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc100' })
    calc = await bus.command(actor1, 'AddNumbers', { number1: 3, number2: 4, aggregateId: calc.aggregateId, expectedVersion: calc.aggregateVersion })
    calc = await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 1, aggregateId: calc.aggregateId, expectedVersion: calc.aggregateVersion })
    calc = await bus.eventStore.loadAggregateFromEvents(actor1.tenant, Calculator, calc.aggregateId)
    calc.aggregateVersion.should.equal(2)
    calc.sum.should.equal(12)
  })

  it('should accumulate numbers to 3 with system generated id', async () => {
    let calculator
    calculator = await bus.command(actor1, 'AddNumbers', { number1: 2, number2: 2 })
    calculator = await bus.command(actor1, 'SubtractNumbers', { aggregateId: calculator.aggregateId, number1: 1, number2: 0 })
    calculator.aggregateVersion.should.equal(1)
    calculator.aggregateId.length.should.be.at.least(10)
    calculator.sum.should.equal(3)
  })

  it('should accumulate numbers to 10', async () => {
    let calc 
    calc = await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2 })
    calc = await bus.command(actor1, 'AddNumbers', { aggregateId: calc.aggregateId, aggregateVersion: calc.aggregateVersion, number1: 3, number2: 4 })
    calc.aggregateVersion.should.equal(1)
    calc.sum.should.equal(10)
  })

  it('should throw concurrency error', async () => {
    try {
      let calc
      calc = await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc1' })
      calc = await bus.command(actor1, 'AddNumbers', { number1: 3, number2: 4, aggregateId: calc.aggregateId, expectedVersion: calc.aggregateVersion })
      calc = await bus.command(actor1, 'AddNumbers', { number1: 3, number2: 4, aggregateId: calc.aggregateId, expectedVersion: 0 })
    }
    catch(error) {
      error.message.should.be.equal('concurrency error')
    }
  })
})

describe('Many commands', () => {
  it('should accumulate numbers to 12', async () => {
    const iters = 12
    const bus3 = setup(true)
    let calc = await bus3.command(actor1, 'AddNumbers', { number1: 0, number2: 1, aggregateId: 'calc9' })
    for (let i = 0; i < iters; i++) {
      calc = await bus3.command(actor1, 'AddNumbers', { number1: 0, number2: 1, aggregateId: calc.aggregateId, expectedVersion: calc.aggregateVersion })
    }
    calc.aggregateVersion.should.equal(iters)
    calc.sum.should.equal(iters + 1)
  })

  it('should throw precondition error: max events reached', async () => {
    try {
      const iters = 16
      const bus3 = setup(true)
      let calc = await bus3.command(actor1, 'AddNumbers', { number1: 0, number2: 1, aggregateId: 'calc9' })
      for (let i = 0; i < iters; i++) {
        calc = await bus3.command(actor1, 'AddNumbers', { number1: 0, number2: 1, aggregateId: calc.aggregateId, expectedVersion: calc.aggregateVersion })
      }
    }
    catch(error) {
      error.message.should.be.equal('precondition error: max events reached')
    }
  })
})
