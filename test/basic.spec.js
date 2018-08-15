'use strict'

const { Command } = require('../index')
const setup = require('./setup').setup
const { Calculator, AddNumbers, EventCounter } = require('./model')

let docStore
let bus

process.on('unhandledRejection', error => { console.log('unhandledRejection', error) })

describe('In Memory', () => {
  before (() => {
    ({ docStore, bus } = setup(true))
    bus.addEventHandler(new EventCounter(docStore))
  })

  it('should accumulate numbers to 12', (done) => {
    let calculator
    bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator, 'calc1')
      .then(calc => bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 3, number2: 4 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, calc.aggregateVersion))
      .then(calc => bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 1 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, calc.aggregateVersion))
      .then(calc => { 
        calculator = calc
        return docStore.get('/counters/counter1')
      })
      .then(counter => {
        calculator.aggregateVersion.should.equal(2)
        calculator.sum.should.equal(12)
        calculator.creator.should.equal('user1')
        counter.eventCount.should.equal(3)
        done()
      })
      .catch(error => {
        done(error)
      })
  })

  it('should accumulate numbers to 3 with system generated id', (done) => {
    bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator)
      .then(calculator => {
        calculator.aggregateVersion.should.equal(0)
        calculator.aggregateId.should.equal('1')
        calculator.sum.should.equal(3)
        calculator.creator.should.equal('user1')
        done()
      })
      .catch(error => {
        done(error)
      })
  })

  it('should save doc', (done) => {
    const path = '/docs/doc1'
    docStore.set(path, { a: 1, b: 2 })
      .then(doc => {
        return docStore.get(path)
      })
      .then(doc2 => {
        doc2.a.should.equal(1)
        doc2.b.should.equal(2)
        done()
      })
      .catch(error => {
        done(error)
      })
  })

  it('should merge doc', (done) => {
    const path = '/docs/doc1'
    docStore.set(path, { a: 1, b: 2 })
      .then(doc => {
        return docStore.set(path, { c: 3 }, true)
      })
      .then(doc2 => {
        doc2.a.should.equal(1)
        doc2.b.should.equal(2)
        doc2.c.should.equal(3)
        done()
      })
      .catch(error => {
        done(error)
      })
  })

  it('should not merge doc', (done) => {
    const path = '/docs/doc1'
    docStore.set(path, { a: 1, b: 2 })
      .then(doc => {
        return docStore.set(path, { c: 3 }, false)
      })
      .then(doc2 => {
        Object.keys(doc2).length.should.equal(1)
        doc2.c.should.equal(3)
        done()
      })
      .catch(error => {
        done(error)
      })
  })

  it('should save and delete doc', (done) => {
    const path = '/docs/doc2'
    let promise = docStore.set(path, { a: 1, b: 2 })
      .then(() => docStore.delete(path))
      .then(() => docStore.get(path))
    
    promise.should.be.rejectedWith('document not found').notify(done)
  })

  it('should throw concurrency error', (done) => {
    let promise = bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator, 'calc1')
      .then(calc => bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 3, number2: 4 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, calc.aggregateVersion))
      .then(calc => bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 3, number2: 4 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, 0))

    promise.should.be.rejectedWith('concurrency error').notify(done)
  })
})

describe('Firebase Mock', () => {
  before (() => {
    ({ docStore, bus } = setup(false))
  })

  it('should accumulate numbers to 10', (done) => {
    bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator, 'calc1')
      .then(calc => bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 3, number2: 4 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, calc.aggregateVersion))
      .then(calc => {
        calc.aggregateVersion.should.equal(1)
        calc.sum.should.equal(10)
        done()
      }) 
      .catch(error => {
        done(error)
      })
  })

  it('should accumulate numbers to 3 with system generated id', (done) => {
    bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator)
      .then(calculator => {
        calculator.aggregateVersion.should.equal(0)
        calculator.aggregateId.length.should.not.equal(0)
        calculator.sum.should.equal(3)
        calculator.creator.should.equal('user1')
        done()
      })
      .catch(error => {
        done(error)
      })
  })

  it('should save doc', (done) => {
    const path = '/docs/doc1'
    docStore.set(path, { a: 1, b: 2 })
      .then(doc => {
        return docStore.get(path)
      })
      .then(doc2 => {
        doc2.a.should.equal(1)
        doc2.b.should.equal(2)
        done()
      })
      .catch(error => {
        done(error)
      })
  })

  it('should query docs', (done) => {
    docStore.set('/docs/doc1', { a: 1, b: 2 })
      .then(() => docStore.set('/docs/doc2', { a: 2, b: 2 }))
      .then(() => docStore.query('/docs', { fieldPath: 'a', opStr: '==', value: 2 }))
      .then(docs => {
        docs.length.should.equal(1)
        done()
      })
      .catch(error => {
        done(error)
      })
  })

  it('should query all docs', (done) => {
    docStore.set('/docs/doc1', { a: 1, b: 2 })
      .then(() => docStore.set('/docs/doc2', { a: 2, b: 2 }))
      .then(() => docStore.query('/docs'))
      .then(docs => {
        docs.length.should.equal(2)
        docs[0].a.should.equal(1)
        docs[1].b.should.equal(2)
        docs[0]._id_.should.equal('doc1')
        docs[1]._id_.should.equal('doc2')
        done()
      })
      .catch(error => {
        done(error)
      })
  })

  it('should save and delete doc', (done) => {
    const path = '/docs/doc2'
    let promise = docStore.set(path, { a: 1, b: 2 })
      .then(() => docStore.delete(path))
      .then(() => docStore.get(path))
    
    promise.should.be.rejectedWith('document not found').notify(done)
  })

  it('should throw concurrency error', (done) => {
    let promise = bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator, 'calc1')
      .then(calc => bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 3, number2: 4 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, calc.aggregateVersion))
      .then(calc => bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 3, number2: 4 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, 0))
       
    promise.should.be.rejectedWith('concurrency error').notify(done)
  })

  it('should throw invalid arguments aggregateType', (done) => {
    let promise = bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', AddNumbers)

    promise.should.be.rejectedWith('invalid arguments: aggregateType').notify(done)
  })
})

describe('Many commands', () => {
  it('should accumulate numbers to 1004', (done) => {
    const iters = 1004
    const bus3 = setup(false, 'many').bus
    let cmd = Command.create(AddNumbers, 'user1', { number1: 0, number2: 1 })
    bus3.sendCommand(cmd, '/tenants/tenant1', '/calculators', Calculator, 'calc2')
      .then(calc => {
        let commands = []
        for (let i = 0; i < iters; i++) {
          cmd = Command.create(AddNumbers, 'user1', { number1: 0, number2: 1 })
          commands.push(cmd)
        }
        return bus3.sendCommands(commands, '/tenants/tenant1', '/calculators', Calculator, 'calc2', 0)
      })
      .then(calc => {
        calc.aggregateVersion.should.equal(iters)
        calc.sum.should.equal(iters + 1)
        done()
      })
      .catch(error => {
        done(error)
      })
  })
})
