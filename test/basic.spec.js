'use strict'

const { Command } = require('../index')
const setup = require('./setup').setup
const { Calculator, AddNumbers, EventCounter, NumbersAdded } = require('./model')

let evtStore
let docStore
let bus

process.on('unhandledRejection', error => { console.log('unhandledRejection', error) })

describe('Basic', () => {
  before (() => {
    ({ evtStore, docStore, bus } = setup('basic'))
    bus.addEventHandler(new EventCounter(docStore))
  })

  it('should accumulate numbers to 12', async () => {
    let calc = await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator, 'calc1')
    calc = await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 3, number2: 4 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, calc.aggregateVersion)
    calc = await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 1 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, calc.aggregateVersion)
    let counter = await docStore.get('/counters/counter1')
    calc.aggregateVersion.should.equal(2)
    calc.sum.should.equal(12)
    calc.creator.should.equal('user1')
    counter.eventCount.should.equal(3)
  })

  it('should load aggregate from events', async () => {
    let calc = await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator, 'calc100')
    calc = await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 3, number2: 4 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, calc.aggregateVersion)
    calc = await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 1 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, calc.aggregateVersion)
    calc = await evtStore.loadAggregateFromEvents('/tenants/tenant1/calculators', Calculator, calc.aggregateId, { NumbersAdded })
    calc.aggregateVersion.should.equal(2)
    calc.sum.should.equal(12)
    calc.creator.should.equal('user1')
  })

  it('should throw invalid event type when loading aggregate from events', async () => {
    try {
      let calc = bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator, 'calc101')
      calc = await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 3, number2: 4 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, calc.aggregateVersion)
      calc = await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 1 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, calc.aggregateVersion)
      calc = await evtStore.loadAggregateFromEvents('/tenants/tenant1/calculators', Calculator, calc.aggregateId, { })
    }
    catch(error) {
      error.message.should.be.equal('precondition error: Invalid event type: NumbersAdded')
    }
  })

  it('should accumulate numbers to 3 with system generated id', async () => {
    let calculator = await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator)
    calculator.aggregateVersion.should.equal(0)
    calculator.aggregateId.length.should.be.at.least(10)
    calculator.sum.should.equal(3)
    calculator.creator.should.equal('user1')
  })

  it('should save doc', async () => {
    const path = '/docs/doc1'
    let doc = await docStore.set(path, { a: 1, b: 2 })
    let doc2 = await docStore.get(path)
    doc2.a.should.equal(1)
    doc2.b.should.equal(2)
  })

  it('should merge doc', async () => {
    const path = '/docs/doc1'
    let doc = await docStore.set(path, { a: 1, b: 2 })
    let doc2 = await docStore.set(path, { c: 3 }, true)
    doc2.a.should.equal(1)
    doc2.b.should.equal(2)
    doc2.c.should.equal(3)
  })

  it('should not merge doc', async () => {
    const path = '/docs/doc1'
    let doc = await docStore.set(path, { a: 1, b: 2 })
    let doc2 = await docStore.set(path, { c: 3 }, false)
    Object.keys(doc2).length.should.equal(1)
    doc2.c.should.equal(3)
  })

  it('should save and delete doc', async () => {
    const path = '/docs/doc2'
    try {
      await docStore.set(path, { a: 1, b: 2 })
      await docStore.delete(path)
      await docStore.get(path)
    }
    catch(error) {
      error.message.should.be.equal('document not found: /docs/doc2')
    }
  })

  it('should accumulate numbers to 10', async () => {
    let calc = await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator, 'calc2')
    calc = await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 3, number2: 4 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, calc.aggregateVersion)
    calc.aggregateVersion.should.equal(1)
    calc.sum.should.equal(10)
  })

  it('should query docs', async () => {
    await docStore.set('/docs/doc1', { a: 1, b: 2 })
    await docStore.set('/docs/doc2', { a: 2, b: 2 })
    let docs = await docStore.query('/docs', { fieldPath: 'a', opStr: '==', value: 2 })
    docs.length.should.equal(1)
  })

  it('should query all docs', async () => {
    await docStore.set('/docs/doc1', { a: 1, b: 2 })
    await docStore.set('/docs/doc2', { a: 2, b: 2 })
    let docs = await docStore.query('/docs')
    docs.length.should.equal(2)
    docs[0].a.should.equal(1)
    docs[1].b.should.equal(2)
    docs[0]._id_.should.equal('doc1')
    docs[1]._id_.should.equal('doc2')
  })

  it('should throw concurrency error', async () => {
    try {
      let calc = await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator, 'calc1')
      calc = await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 3, number2: 4 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, calc.aggregateVersion)
      calc = await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 3, number2: 4 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, 0)
    }
    catch(error) {
      error.message.should.be.equal('concurrency error')
    }
  })

  it('should throw invalid arguments aggregateType', async () => {
    try {
      await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', AddNumbers)
    }
    catch(error) {
      error.message.should.be.equal('invalid arguments: aggregateType')
    }
  })
})

describe('Many commands', () => {
  it('should accumulate numbers to 1004', async () => {
    const iters = 1004
    const bus3 = setup().bus
    let cmd = Command.create(AddNumbers, 'user1', { number1: 0, number2: 1 })
    let calc = await bus3.sendCommand(cmd, '/tenants/tenant1', '/calculators', Calculator, 'calc9')
    let commands = []
    for (let i = 0; i < iters; i++) {
      cmd = Command.create(AddNumbers, 'user1', { number1: 0, number2: 1 })
      commands.push(cmd)
    }
    calc = await bus3.sendCommands(commands, '/tenants/tenant1', '/calculators', Calculator, 'calc9', 0)
    calc.aggregateVersion.should.equal(iters)
    calc.sum.should.equal(iters + 1)
  })
})
