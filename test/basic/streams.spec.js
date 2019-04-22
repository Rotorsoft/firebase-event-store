'use strict'

const { setup, firebase, ITracer } = require('../setup')
const { Calculator, EventCounter } = require('./model')
const FirebaseEventStream = require('../../src/firestore/FirestoreEventStream')

let bus, firestore

const actor1 = { id: 'user1', name: 'user1', tenant: 'tenant1', roles: [] }

class ConsoleTracer extends ITracer {
  constructor () {
    super()
  }

  trace (fn) {
    const { stat, method, actor, payload, command, aggregate, aggregateId, expectedVersion, aggregateType, cursors, error, event, handler, ...args } = fn()
    if (error) console.log(`!!! ERROR: ${error}`)
    switch (method) {
      case 'command':
        console.log(`-> ${command} ${aggregateId} ${expectedVersion} ${JSON.stringify(payload)}`)
        break
      case 'loadAggregate':
        console.log(`   ${aggregateType.name} loaded ${JSON.stringify(aggregate)}`)
        break
      case 'commitEvents':
         console.log(`   ${aggregateType.name} committed ${JSON.stringify(aggregate)}`)
         break
      case 'commitCursors':
        console.log(`   cursors committed ${JSON.stringify(cursors)}`)  
        break
      case 'handle':
        console.log(`   ${handler._handler_.name} handled ${JSON.stringify(event)}`)
        break 
    }
  }
}

describe('Streams', () => {
  before (async () => {
    bus = setup([Calculator], true, new ConsoleTracer())
    firestore = firebase.firestore()
    firestore.children = []
    await bus.subscribe([new FirebaseEventStream(firestore, 'tenant1', 'main', 100)], [new EventCounter(firestore, 'counter11')])
  })

  it('should catch up counter2 in current window', async () => {
    let calc
    calc = await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'c1222' })
    calc = await bus.command(actor1, 'AddNumbers', { number1: 3, number2: 4, aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 1, aggregateId: calc.aggregateId })
    await bus.poll('tenant1', 'main')
    await bus.flush('tenant1')
    let counter1 = await firestore.doc('/counters/counter11').get()
    counter1.data().eventCount.should.equal(3)
    
    await bus.subscribe([new FirebaseEventStream(firestore, 'tenant1', 'main', 100)], [new EventCounter(firestore, 'counter11'), new EventCounter(firestore, 'counter21')])
    calc = await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'c1222' })
    calc = await bus.command(actor1, 'AddNumbers', { number1: 3, number2: 4, aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 1, aggregateId: calc.aggregateId })
    await bus.poll('tenant1', 'main')
    await bus.flush('tenant1')
    counter1 = await firestore.doc('/counters/counter11').get()
    counter1.data().eventCount.should.equal(6)
    let counter2 = await firestore.doc('/counters/counter21').get()
    counter2.data().eventCount.should.equal(6)
  })

  it('should catch up counting with catchup window', async () => {
    let calc
    calc = await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'cxz' })
    calc = await bus.command(actor1, 'AddNumbers', { number1: 3, number2: 4, aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 1, aggregateId: calc.aggregateId })
    await bus.poll('tenant1', 'main')
    await bus.flush('tenant1')
    
    await bus.subscribe([new FirebaseEventStream(firestore, 'tenant1', 'main', 5)], [new EventCounter(firestore, 'counter11'), new EventCounter(firestore, 'counter21'), new EventCounter(firestore, 'counter31')])
    calc = await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'cxz' })
    calc = await bus.command(actor1, 'AddNumbers', { number1: 3, number2: 4, aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 1, aggregateId: calc.aggregateId })
    await bus.poll('tenant1', 'main')
    await bus.poll('tenant1', 'main')
    await bus.flush('tenant1')
    let counter1 = await firestore.doc('/counters/counter11').get()
    counter1.data().eventCount.should.equal(12)
    let counter2 = await firestore.doc('/counters/counter21').get()
    counter2.data().eventCount.should.equal(12)
    let counter3 = await firestore.doc('/counters/counter31').get()
    counter3.data().eventCount.should.equal(12)
  })

  it('should catch up counting with catchup window 2', async () => {
    let calc
    calc = await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'cxz' })
    await bus.flush('tenant1')
    await bus.subscribe([new FirebaseEventStream(firestore, 'tenant1', 'main', 5)], [new EventCounter(firestore, 'counter41')])
    calc = await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'cxz' })
    await bus.poll('tenant1', 'main')
    await bus.poll('tenant1', 'main')
    await bus.flush('tenant1')

    let counter4 = await firestore.doc('/counters/counter41').get()
    counter4.data().eventCount.should.equal(14)
  })

  it('should catch up counting in parallel', async () => {
    let calc
    calc = await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'cxz' })
    let bus2 = setup([Calculator])
    await bus.subscribe([new FirebaseEventStream(firestore, 'tenant1', 'main', 5)], [new EventCounter(firestore, 'counter51')])
    await bus2.subscribe([new FirebaseEventStream(firestore, 'tenant1', 'main', 8)], [new EventCounter(firestore, 'counter61')])
    calc = await bus2.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'cxz' })
    calc = await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'cxz' })
    await bus.poll('tenant1', 'main')
    await bus.poll('tenant1', 'main')
    await bus.poll('tenant1', 'main')
    await bus2.poll('tenant1', 'main')
    await bus2.poll('tenant1', 'main')
    await bus2.poll('tenant1', 'main')
    await bus.flush('tenant1')
    await bus2.flush('tenant1')

    let stream = await firestore.doc('/tenants/tenant1/streams/main').get()
    console.log(JSON.stringify(stream.data()))
    let counter5 = await firestore.doc('/counters/counter51').get()
    counter5.data().eventCount.should.equal(17)
    let counter6 = await firestore.doc('/counters/counter61').get()
    counter6.data().eventCount.should.equal(17)
  })

  it('should poll until done', async () => {
    let bus3 = setup([Calculator], true, new ConsoleTracer())
    await bus3.subscribe([new FirebaseEventStream(firestore, 'tenant1', 'main', 20)], [new EventCounter(firestore, 'counter71')])
    await bus3.poll('tenant1', 'main')
    await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'cxz' })
    await bus3.poll('tenant1', 'main')
    await bus3.flush('tenant1')
    let counter7 = await firestore.doc('/counters/counter71').get()
    counter7.data().eventCount.should.equal(18)
  })
})
