'use strict'

const { getFirestoreCommandHandler, getFirestoreStreamReader, firestore, ITracer } = require('../setup')
const { Calculator, EventCounter } = require('./model')

let ch, tracer

const actor1 = { id: 'user1', name: 'user1', tenant: 'tenant1', roles: [] }

class ConsoleTracer extends ITracer {
  constructor () {
    super()
  }

  trace (fn) {
    const { method, context, tenant, stream, events, handler, error, event, ...args } = fn()
    if (error) {
      console.log(`!!! ERROR: ${error}`)
    }
    if (context) console.log(`  ${method}: ${JSON.stringify(context)}`)
    if (handler) console.log(`  ${handler}: handled event ${event.eventName}.v${event.eventVersion}, actor ${event.actorId}, aggregate ${event.aggregateId}.v${event.aggregateVersion}, on tenant ${tenant} - stream ${stream}`)
  }
}

describe('Streams', () => {
  before (async () => {
    tracer = new ConsoleTracer()
    firestore.children = []
    ch = getFirestoreCommandHandler(firestore, [Calculator], { tracer })
  })

  it('should catch up counter2 in current window', async () => {
    const handlers1 = [new EventCounter(firestore, 'counter11')]
    const handlers2 = [new EventCounter(firestore, 'counter11'), new EventCounter(firestore, 'counter21')]
    const sr1 = getFirestoreStreamReader(firestore, 'tenant1', 'main', handlers1, { tracer })
    const sr2 = getFirestoreStreamReader(firestore, 'tenant1', 'main', handlers2, { tracer })

    let calc
    calc = await ch.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'c1222' })
    calc = await ch.command(actor1, 'AddNumbers', { number1: 3, number2: 4, aggregateId: calc.aggregateId })
    calc = await ch.command(actor1, 'AddNumbers', { number1: 1, number2: 1, aggregateId: calc.aggregateId })
    await sr1.poll()
    let counter1 = await firestore.doc('/counters/counter11').get()
    counter1.data().eventCount.should.equal(3)
    
    calc = await ch.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'c1222' })
    calc = await ch.command(actor1, 'AddNumbers', { number1: 3, number2: 4, aggregateId: calc.aggregateId })
    calc = await ch.command(actor1, 'AddNumbers', { number1: 1, number2: 1, aggregateId: calc.aggregateId })
    await sr2.poll()
    counter1 = await firestore.doc('/counters/counter11').get()
    counter1.data().eventCount.should.equal(6)
    let counter2 = await firestore.doc('/counters/counter21').get()
    counter2.data().eventCount.should.equal(6)
  })

  it('should catch up counting with catchup window', async () => {
    const handlers1 = [new EventCounter(firestore, 'counter11')]
    const handlers2 = [new EventCounter(firestore, 'counter11'), new EventCounter(firestore, 'counter21'), new EventCounter(firestore, 'counter31')]
    const sr1 = getFirestoreStreamReader(firestore, 'tenant1', 'main', handlers1, { tracer })
    const sr2 = getFirestoreStreamReader(firestore, 'tenant1', 'main', handlers2, { tracer })

    let calc
    calc = await ch.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'cxz' })
    calc = await ch.command(actor1, 'AddNumbers', { number1: 3, number2: 4, aggregateId: calc.aggregateId })
    calc = await ch.command(actor1, 'AddNumbers', { number1: 1, number2: 1, aggregateId: calc.aggregateId })
    await sr1.poll()
    
    calc = await ch.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'cxz' })
    calc = await ch.command(actor1, 'AddNumbers', { number1: 3, number2: 4, aggregateId: calc.aggregateId })
    calc = await ch.command(actor1, 'AddNumbers', { number1: 1, number2: 1, aggregateId: calc.aggregateId })
    await sr2.poll({ limit: 5 })
    await sr2.poll({ limit: 5 })
    await sr2.poll({ limit: 5 })
    let counter1 = await firestore.doc('/counters/counter11').get()
    counter1.data().eventCount.should.equal(12)
    let counter2 = await firestore.doc('/counters/counter21').get()
    counter2.data().eventCount.should.equal(12)
    let counter3 = await firestore.doc('/counters/counter31').get()
    counter3.data().eventCount.should.equal(12)
  })

  it('should catch up counting with catchup window 2', async () => {
    const handlers1 = [new EventCounter(firestore, 'counter41')]
    const sr1 = getFirestoreStreamReader(firestore, 'tenant1', 'main', handlers1, { tracer })

    let calc
    calc = await ch.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'cxz' })
    calc = await ch.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'cxz' })
    await sr1.poll({ limit: 5 })
    await sr1.poll({ limit: 5 })
    await sr1.poll({ limit: 5 })
    let counter4 = await firestore.doc('/counters/counter41').get()
    counter4.data().eventCount.should.equal(14)
  })

  it('should catch up counting in parallel', async () => {
    const handlers1 = [new EventCounter(firestore, 'counter51')]
    const handlers2 = [new EventCounter(firestore, 'counter61')]
    const sr1 = getFirestoreStreamReader(firestore, 'tenant1', 'main', handlers1, { tracer })
    const sr2 = getFirestoreStreamReader(firestore, 'tenant1', 'main', handlers2, { tracer })

    await ch.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'cxz' })
    let ch2 = getFirestoreCommandHandler(firestore, [Calculator])
    await ch2.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'cxz' })
    await ch.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'cxz' })
    await sr1.poll({ limit: 7 })
    await sr1.poll({ limit: 7 })
    await sr1.poll({ limit: 7 })
    let main = await firestore.doc('/tenants/tenant1/streams/main').get()
    console.log(JSON.stringify(main.data()))
    await sr1.poll({ limit: 7 })
    main = await firestore.doc('/tenants/tenant1/streams/main').get()
    console.log(JSON.stringify(main.data()))

    await sr2.poll({ limit: 8 })
    await sr2.poll({ limit: 8 })
    await sr2.poll({ limit: 8 })

    main = await firestore.doc('/tenants/tenant1/streams/main').get()
    console.log(JSON.stringify(main.data()))
    let counter5 = await firestore.doc('/counters/counter51').get()
    counter5.data().eventCount.should.equal(17)
    let counter6 = await firestore.doc('/counters/counter61').get()
    counter6.data().eventCount.should.equal(17)
  })

  it('should poll until done', async () => {
    const handlers1 = [new EventCounter(firestore, 'counter71')]
    const sr1 = getFirestoreStreamReader(firestore, 'tenant1', 'main', handlers1, { tracer })

    await sr1.poll({ limit: 20 })
    await ch.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'cxz' })
    await sr1.poll()
    let counter7 = await firestore.doc('/counters/counter71').get()
    counter7.data().eventCount.should.equal(18)
  })
})
