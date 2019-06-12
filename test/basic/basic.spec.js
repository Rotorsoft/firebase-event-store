'use strict'

const { firestore, getFirestoreCommandHandler, getFirestoreStreamReader } = require('../setup')
const { Calculator, Calculator2, EventCounter } = require('./model')

let ch, sr, handlers

process.on('unhandledRejection', error => { console.log('unhandledRejection', error) })

const actor1 = { id: 'user1', name: 'user1', tenant: 'tenant1', roles: [] }

describe('Basic', () => {
  before (async () => {
    handlers = [new EventCounter(firestore, 'counter1'), new EventCounter(firestore, 'counter2')]
    ch = getFirestoreCommandHandler(firestore, [Calculator])
    sr = getFirestoreStreamReader(firestore, 'tenant1', 'main', handlers)
  })

  it('should accumulate numbers to 12 on calc123', async () => {
    let ctx
    ctx = await ch.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc123' })
    ctx = await ch.command(actor1, 'AddNumbers', { number1: 3, number2: 4, aggregateId: ctx.aggregateId })
    ctx = await ch.command(actor1, 'AddNumbers', { number1: 1, number2: 1, aggregateId: ctx.aggregateId })
    await sr.poll()
    let counter = await firestore.doc('/counters/counter1').get()
    ctx.aggregate.aggregateVersion.should.equal(2)
    ctx.aggregate.sum.should.equal(12)
    counter.data().eventCount.should.equal(3)
  })

  it('should accumulate numbers to 10', async () => {
    let ctx 
    ctx = await ch.command(actor1, 'AddNumbers', { number1: 1, number2: 2 })
    ctx = await ch.command(actor1, 'AddNumbers', { aggregateId: ctx.aggregateId, expectedVersion: ctx.aggregate.aggregateVersion, number1: 3, number2: 4 })
    await sr.poll()
    ctx.aggregate.aggregateVersion.should.equal(1)
    ctx.aggregate.sum.should.equal(10)
  })

  it('should throw concurrency error', async () => {
    try {
      let ctx
      ctx = await ch.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc1' })
      ctx = await ch.command(actor1, 'AddNumbers', { number1: 3, number2: 4, aggregateId: ctx.aggregateId, expectedVersion: ctx.aggregate.aggregateVersion })
      ctx = await ch.command(actor1, 'AddNumbers', { number1: 3, number2: 4, aggregateId: ctx.aggregateId, expectedVersion: 0 })
      await sr.poll()
    }
    catch(error) {
      error.name.should.be.equal('ConcurrencyError')
    }
  })

  it('should accumulate numbers to 12 on calc9', async () => {
    const iters = 12
    let ctx = await ch.command(actor1, 'AddNumbers', { number1: 0, number2: 1, aggregateId: 'calc9' })
    for (let i = 0; i < iters; i++) {
      ctx = await ch.command(actor1, 'AddNumbers', { number1: 0, number2: 1, aggregateId: ctx.aggregateId, expectedVersion: ctx.aggregate.aggregateVersion })
    }
    await sr.poll()
    ctx.aggregate.aggregateVersion.should.equal(iters)
    ctx.aggregate.sum.should.equal(iters + 1)
  })

  it('should throw precondition error: max events reached', async () => {
    try {
      const iters = 16
      let ctx = await ch.command(actor1, 'AddNumbers', { number1: 0, number2: 1, aggregateId: 'calc99' })
      for (let i = 0; i < iters; i++) {
        ctx = await ch.command(actor1, 'AddNumbers', { number1: 0, number2: 1, aggregateId: ctx.aggregateId, expectedVersion: ctx.aggregate.aggregateVersion })
      }
    }
    catch(error) {
      error.message.should.be.equal('max events reached')
    }
  })
})

describe('Basic without snapshots', () => {
  before (async () => {
    handlers = [new EventCounter(firestore)]
    ch = getFirestoreCommandHandler(firestore, [Calculator2])
    sr = getFirestoreStreamReader(firestore, 'tenant1', 'main', handlers)
  })

  it('should load aggregate from events', async () => {
    let ctx 
    ctx = await ch.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc100' })
    ctx = await ch.command(actor1, 'AddNumbers', { number1: 3, number2: 4, aggregateId: ctx.aggregateId, expectedVersion: ctx.aggregate.aggregateVersion })
    ctx = await ch.command(actor1, 'AddNumbers', { number1: 1, number2: 1, aggregateId: ctx.aggregateId, expectedVersion: ctx.aggregate.aggregateVersion })
    await sr.poll()
    ctx.aggregate.aggregateVersion.should.equal(2)
    ctx.aggregate.sum.should.equal(12)
  })

  it('should accumulate numbers to 3 with system generated id', async () => {
    let ctx
    ctx = await ch.command(actor1, 'AddNumbers', { number1: 2, number2: 2 })
    ctx = await ch.command(actor1, 'SubtractNumbers', { aggregateId: ctx.aggregateId, number1: 1, number2: 0 })
    await sr.poll()
    ctx.aggregate.aggregateVersion.should.equal(1)
    ctx.aggregate.aggregateId.length.should.be.at.least(10)
    ctx.aggregate.sum.should.equal(3)
  })
})
