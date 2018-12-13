firebase-event-store [![Build Status](https://travis-ci.org/Rotorsoft/firebase-event-store.svg?branch=master)](https://travis-ci.org/Rotorsoft/firebase-event-store) [![Coverage Status](https://coveralls.io/repos/github/Rotorsoft/firebase-event-store/badge.svg?branch=master)](https://coveralls.io/github/Rotorsoft/firebase-event-store?branch=master)
=========

I started this project as a proof of concept, trying to figure out if a low cost (practically free) persistance platform in the cloud could support a couple of mobile applications I developed this year.

[Cloud Firestore](https://firebase.google.com/docs/firestore/) is an inexpensive Non-SQL cloud database to store and sync data for mobile, web, and server development. Since most of my web applications are following the [CQRS](http://codebetter.com/gregyoung/2012/09/09/cqrs-is-not-an-architecture-2/) pattern proposed by Greg Young around 2010 (Figure 1), I was curious about using Firestore Documents and Collections to model my Event Streams, Aggregate Snapshots, and Projections. After some tinkering with the APIs, and a few beers, the Command Side started to emerge. 

Always afraid of overengineering, I decided not to implement the Query Side and settled for just listening to documents holding my aggregate snapshots as my Read Model (realtime listeners is a nice out-of-the-box feature in Firestore that allows clients to synchronize data with the store). The basic event handler in charge of taking snapshots also helped to speed up the write side after a few hundred events, and evaporated the extra cost of unnecessary event reads.

So far the results have been positive. The store supports multiple tenants as well as multiple event streams within each tenant. Notice that this is just a seed (not to be interpreted as a framework!), and there is a lot of room for improvement. I would like to see Firebase integrating a serverless Pub/Sub messaging solution in their ecosystem. This will facilitate a refactoring of the in-memory Bus to make it more scalable. I would also like to revisit the Query Side and explore different types of projection models... In the meantime, I will be deploying more apps.

#### Figure 1. CQRS - Command Query Resposibility Segregation Reference Architecture
![Figure 1](/assets/CQRSArchitecture.PNG)

## Installation

  `npm install @rotorsoft/firebase-event-store`

## Usage

A trivial aggregate and event handler:

```javascript
const { setup, Aggregate, IEventHandler, Err } = require('@rotorsoft/firebase-event-store')

const EVENTS = {
  NumbersAdded: 'NumbersAdded',
  NumbersSubtracted: 'NumbersSubtracted'
}

class Calculator extends Aggregate {
  constructor () {
    super()
    this.sum = 0
  }

  static get path () { return '/calculators' }

  get commands () { 
    return { 
      AddNumbers: async (actor, _) => {
        if (!Number.isInteger(_.number1)) throw Err.invalidArguments('number1')
        if (!Number.isInteger(_.number2)) throw Err.invalidArguments('number2')
        this.addEvent(EVENTS.NumbersAdded, _)
      },
      SubtractNumbers: async (actor, _) => {
        if (!Number.isInteger(_.number1)) throw Err.invalidArguments('number1')
        if (!Number.isInteger(_.number2)) throw Err.invalidArguments('number2')
        this.addEvent(EVENTS.NumbersSubtracted, _)
      }
    }
  }

  get events () {
    return { 
      [EVENTS.NumbersAdded]: _ => {
        this.sum += (_.number1 + _.number2)
      },
      [EVENTS.NumbersSubtracted]: _ => {
        this.sum -= (_.number1 + _.number2)
      }
    }
  }
}

class EventCounter extends IEventHandler {
  constructor(db) {
    super()
    this.db = db
  }

  async count () {
    const path = '/counters/counter1'
    let snap = await this.db.doc(path).get()
    let doc = snap.data() || {}
    doc.eventCount = (doc.eventCount || 0) + 1
    return await this.db.doc(path).set(doc)
  }

  get events () {
    return {
      [EVENTS.NumbersAdded]: async event => {
        return await this.count()
      },
      [EVENTS.NumbersSubtracted]: async event => {
        return await this.count()
      }
    }
  }

  async pump (actor, payload) {
    const path = '/counters/pumps'
    let snap = await this.db.doc(path).get()
    let doc = snap.data() || {}
    doc.pumpCount = (doc.pumpCount || 0) + 1
    return await this.db.doc(path).set(doc)
  }
}

const firebase = //TODO get firebase ref
const bus = setup(firebase, [Calculator])
bus.addEventHandler(new EventCounter(docStore))

let actor = { id: 'user1', name: 'actor 1', tenant: 'tenant1', roles: ['manager', 'user'] }
let calc = await bus.command(actor, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc1' })
calc = await bus.command(actor, 'AddNumbers', { number1: 3, number2: 4, aggregateId: calc.aggregateId, expectedVersion: calc.aggregateVersion })
calc = await bus.command(actor, 'SubtractNumbers', { aggregateId: 'calc1', number1: 1, number2: 1 })
console.log('calculator', calc)
```

Let's now pretend that we need to build a real basic calculator and store every single key pressed in a ledger for audit purposes. The calculator aggregate might look like this:

```javascript
'use strict'

const { Aggregate, Err } = require('../../index')

const OPERATORS = {
  ['+']: (l, r) => l + r, 
  ['-']: (l, r) => l - r,
  ['*']: (l, r) => l * r,
  ['/']: (l, r) => l / r
}

const EVENTS = {
  DigitPressed: 'DigitPressed',
  DotPressed: 'DotPressed',
  OperatorPressed: 'OperatorPressed',
  EqualsPressed: 'EqualsPressed' 
}

module.exports = class Calculator extends Aggregate {
  constructor () {
    super()
    this.left = '0'
    this.result = 0
  }

  static get path () { return '/calculators' }
  static get maxEvents () { return 100 }

  get commands () { 
    return { 
      PressDigit: async (actor, _) => {
        if (_.digit < '0' || _.digit > '9') throw Err.invalidArguments('digit')
        this.addEvent(EVENTS.DigitPressed, _)
      },
      PressDot: async (actor, _) => {
        this.addEvent(EVENTS.DotPressed, _)
      },
      PressOperator: async (actor, _) => {
        if (!Object.keys(OPERATORS).includes(_.operator)) throw Err.invalidArguments('operator')
        this.addEvent(EVENTS.OperatorPressed, _)
      },
      PressEquals: async (actor, _) => {
        this.addEvent(EVENTS.EqualsPressed, _)
      }
    }
  }

  get events () {
    return { 
      [EVENTS.DigitPressed]: _ => {
        if (this.operator) {
          this.right = (this.right || '').concat(_.digit)
        }
        else this.left = (this.left || '').concat(_.digit)
      },
      [EVENTS.DotPressed]: _ => {
        if (this.operator) {
          this.right = (this.right || '').concat('.')
        }
        else this.left = (this.left || '').concat('.')
      },
      [EVENTS.OperatorPressed]: _ => {
        if (this.operator) this.compute()
        this.operator = _.operator
        this.right = null
      },
      [EVENTS.EqualsPressed]: _ => {
        this.compute()
      }
    }
  }

  compute () {
    if (!this.left) throw Err.preconditionError('missing left side')
    if (!this.right) throw Err.preconditionError('missing right side')
    if (!this.operator) throw Err.preconditionError('missing operator')
    const l = Number.parseFloat(this.left)
    const r = Number.parseFloat(this.right)
    this.result = OPERATORS[this.operator](l, r)
    this.left = this.result.toString()
  }
}
```
And we can unit test it with chai:

```javascript
'use strict'

const Calculator = require('./calculator')

let bus

const actor1 = { id: 'user1', name: 'user1', tenant: 'tenant1', roles: [] }

class ConsoleTracer extends ITracer {
  constructor () {
    super()
    this.stats = {}
  }

  trace ({ level = 0, stat = null, aggregateType = 'aggregateType', event = 'event', ...args } = {}) {
    if (stat) {
      const s = this.stats[stat] || {}
      const t = s[aggregateType.name] || {}
      const e = t[event._c + '-' + event._n] || {} 
      e.time = e.time || Date.now()
      e.count = (e.count || 0) + 1
      t[event._c + '-' + event._n] = e
      s[aggregateType.name] = t
      this.stats[stat] = s
    } else {
      console.log('TRACE: '.concat(JSON.stringify(args)))
    }
  }
}

const tracer = new ConsoleTracer()

describe('Calculator basic operations', () => {
  before (() => {
    bus = setup([Calculator], false, tracer) // SEE FULL CHAI AND FIREBASE-MOCK SETUP IN TEST FOLDER
  })

  async function c (calc, command, payload) {
    return await bus.command(actor1, command, Object.assign(payload, { aggregateId: calc.aggregateId, expectedVersion: calc.aggregateVersion }))
  }

  it('should compute 1+2-3*5=0', async () => {
    let calc
    calc = await bus.command(actor1, 'PressDigit', { digit: '1', aggregateId: 'c1' })
    calc = await c(calc, 'PressOperator', { operator: '+' })
    calc = await c(calc, 'PressDigit', { digit: '2'})
    calc = await c(calc, 'PressOperator', { operator: '-' })
    calc = await c(calc, 'PressDigit', { digit: '3'})
    calc = await c(calc, 'PressOperator', { operator: '*' })
    calc = await c(calc, 'PressDigit', { digit: '5' })
    calc = await c(calc, 'PressEquals', {})
  
    calc.result.should.equal(0)
  })

  it('should compute 4*4+21-16*3=63', async () => {
    let calc
    calc = await bus.command(actor1, 'PressDigit', { digit: '4', aggregateId: 'c2' })
    calc = await c(calc, 'PressOperator', { operator: '*' })
    calc = await c(calc, 'PressDigit', { digit: '4' })
    calc = await c(calc, 'PressOperator', { operator: '+' })
    calc = await c(calc, 'PressDigit', { digit: '2' })
    calc = await c(calc, 'PressDigit', { digit: '1' })
    calc = await c(calc, 'PressOperator', { operator: '-' })
    calc = await c(calc, 'PressDigit', { digit: '1' })
    calc = await c(calc, 'PressDigit', { digit: '6' })
    calc = await c(calc, 'PressOperator', { operator: '*' })
    calc = await c(calc, 'PressDigit', { digit: '3' })
    calc = await c(calc, 'PressEquals', {})
  
    calc.result.should.equal(63)
  })

  it('should compute 4*4+21-16*3===567', async () => {
    let calc
    calc = await bus.command(actor1, 'PressDigit', { digit: '4', aggregateId: 'c3' })
    calc = await c(calc, 'PressOperator', { operator: '*' })
    calc = await c(calc, 'PressDigit', { digit: '4' })
    calc = await c(calc, 'PressOperator', { operator: '+' })
    calc = await c(calc, 'PressDigit', { digit: '2' })
    calc = await c(calc, 'PressDigit', { digit: '1' })
    calc = await c(calc, 'PressOperator', { operator: '-' })
    calc = await c(calc, 'PressDigit', { digit: '1' })
    calc = await c(calc, 'PressDigit', { digit: '6' })
    calc = await c(calc, 'PressOperator', { operator: '*' })
    calc = await c(calc, 'PressDigit', { digit: '3' })
    calc = await c(calc, 'PressEquals', {})
    calc = await c(calc, 'PressEquals', {})
    calc = await c(calc, 'PressEquals', {})
  
    calc.result.should.equal(567)
  })

  it('should compute 1.5+2.0-11.22+.33=-7.39', async () => {
    let calc
    calc = await bus.command(actor1, 'PressDigit', { digit: '1', aggregateId: 'c4' })
    calc = await c(calc, 'PressDot', {})
    calc = await c(calc, 'PressDigit', { digit: '5'})    
    calc = await c(calc, 'PressOperator', { operator: '+' })
    calc = await c(calc, 'PressDigit', { digit: '2'})
    calc = await c(calc, 'PressDot', {})
    calc = await c(calc, 'PressDigit', { digit: '0'})    
    calc = await c(calc, 'PressOperator', { operator: '-' })
    calc = await c(calc, 'PressDigit', { digit: '1'})
    calc = await c(calc, 'PressDigit', { digit: '1'})
    calc = await c(calc, 'PressDot', {})
    calc = await c(calc, 'PressDigit', { digit: '2'})
    calc = await c(calc, 'PressDigit', { digit: '2'})
    calc = await c(calc, 'PressOperator', { operator: '+' })
    calc = await c(calc, 'PressDot', {})
    calc = await c(calc, 'PressDigit', { digit: '3' })
    calc = await c(calc, 'PressDigit', { digit: '3' })
    calc = await c(calc, 'PressEquals', {})
  
    calc.result.toFixed(2).should.equal('-7.39')
  })

  it('should compute 5.23/.33*2=31.6969696969697', async () => {
    let calc
    calc = await bus.command(actor1, 'PressDigit', { digit: '5', aggregateId: 'c5' })
    calc = await c(calc, 'PressDot', {})
    calc = await c(calc, 'PressDigit', { digit: '2'})
    calc = await c(calc, 'PressDigit', { digit: '3'})   
    calc = await c(calc, 'PressOperator', { operator: '/' })
    calc = await c(calc, 'PressDot', {})
    calc = await c(calc, 'PressDigit', { digit: '3' })
    calc = await c(calc, 'PressDigit', { digit: '3' })
    calc = await c(calc, 'PressOperator', { operator: '*' })
    calc = await c(calc, 'PressDigit', { digit: '2'})
    calc = await c(calc, 'PressEquals', {})
  
    calc.result.should.equal(31.6969696969697)
  })
})
```
After running npm test, the ConsoleTracer displays the following resuts:

```
 Calculator basic operations
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c1 (v-1) with","payload":{"digit":"1"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"0","result":0,"_aggregate_id_":"c1","_aggregate_version_":-1}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c1","_v":"00","_n":"DigitPressed","digit":"1"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressOperator to Calculator c1 (v0) with","payload":{"operator":"+"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"01","result":0,"_aggregate_id_":"c1","_aggregate_version_":0}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressOperator","_a":"c1","_v":"01","_n":"OperatorPressed","operator":"+"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c1 (v1) with","payload":{"digit":"2"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"01","result":0,"_aggregate_id_":"c1","_aggregate_version_":1,"operator":"+","right":null}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c1","_v":"02","_n":"DigitPressed","digit":"2"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressOperator to Calculator c1 (v2) with","payload":{"operator":"-"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"01","result":0,"_aggregate_id_":"c1","_aggregate_version_":2,"operator":"+","right":"2"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressOperator","_a":"c1","_v":"03","_n":"OperatorPressed","operator":"-"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c1 (v3) with","payload":{"digit":"3"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"3","result":3,"_aggregate_id_":"c1","_aggregate_version_":3,"operator":"-","right":null}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c1","_v":"04","_n":"DigitPressed","digit":"3"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressOperator to Calculator c1 (v4) with","payload":{"operator":"*"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"3","result":3,"_aggregate_id_":"c1","_aggregate_version_":4,"operator":"-","right":"3"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressOperator","_a":"c1","_v":"05","_n":"OperatorPressed","operator":"*"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c1 (v5) with","payload":{"digit":"5"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"0","result":0,"_aggregate_id_":"c1","_aggregate_version_":5,"operator":"*","right":null}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c1","_v":"06","_n":"DigitPressed","digit":"5"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressEquals to Calculator c1 (v6) with","payload":{}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"0","result":0,"_aggregate_id_":"c1","_aggregate_version_":6,"operator":"*","right":"5"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressEquals","_a":"c1","_v":"07","_n":"EqualsPressed"}]}
    √ should compute 1+2-3*5=0
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c2 (v-1) with","payload":{"digit":"4"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"0","result":0,"_aggregate_id_":"c2","_aggregate_version_":-1}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c2","_v":"00","_n":"DigitPressed","digit":"4"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressOperator to Calculator c2 (v0) with","payload":{"operator":"*"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"04","result":0,"_aggregate_id_":"c2","_aggregate_version_":0}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressOperator","_a":"c2","_v":"01","_n":"OperatorPressed","operator":"*"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c2 (v1) with","payload":{"digit":"4"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"04","result":0,"_aggregate_id_":"c2","_aggregate_version_":1,"operator":"*","right":null}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c2","_v":"02","_n":"DigitPressed","digit":"4"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressOperator to Calculator c2 (v2) with","payload":{"operator":"+"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"04","result":0,"_aggregate_id_":"c2","_aggregate_version_":2,"operator":"*","right":"4"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressOperator","_a":"c2","_v":"03","_n":"OperatorPressed","operator":"+"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c2 (v3) with","payload":{"digit":"2"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"16","result":16,"_aggregate_id_":"c2","_aggregate_version_":3,"operator":"+","right":null}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c2","_v":"04","_n":"DigitPressed","digit":"2"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c2 (v4) with","payload":{"digit":"1"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"16","result":16,"_aggregate_id_":"c2","_aggregate_version_":4,"operator":"+","right":"2"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c2","_v":"05","_n":"DigitPressed","digit":"1"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressOperator to Calculator c2 (v5) with","payload":{"operator":"-"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"16","result":16,"_aggregate_id_":"c2","_aggregate_version_":5,"operator":"+","right":"21"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressOperator","_a":"c2","_v":"06","_n":"OperatorPressed","operator":"-"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c2 (v6) with","payload":{"digit":"1"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"37","result":37,"_aggregate_id_":"c2","_aggregate_version_":6,"operator":"-","right":null}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c2","_v":"07","_n":"DigitPressed","digit":"1"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c2 (v7) with","payload":{"digit":"6"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"37","result":37,"_aggregate_id_":"c2","_aggregate_version_":7,"operator":"-","right":"1"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c2","_v":"08","_n":"DigitPressed","digit":"6"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressOperator to Calculator c2 (v8) with","payload":{"operator":"*"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"37","result":37,"_aggregate_id_":"c2","_aggregate_version_":8,"operator":"-","right":"16"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressOperator","_a":"c2","_v":"09","_n":"OperatorPressed","operator":"*"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c2 (v9) with","payload":{"digit":"3"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"21","result":21,"_aggregate_id_":"c2","_aggregate_version_":9,"operator":"*","right":null}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c2","_v":"10","_n":"DigitPressed","digit":"3"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressEquals to Calculator c2 (v10) with","payload":{}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"21","result":21,"_aggregate_id_":"c2","_aggregate_version_":10,"operator":"*","right":"3"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressEquals","_a":"c2","_v":"11","_n":"EqualsPressed"}]}
    √ should compute 4*4+21-16*3=63
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c3 (v-1) with","payload":{"digit":"4"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"0","result":0,"_aggregate_id_":"c3","_aggregate_version_":-1}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c3","_v":"00","_n":"DigitPressed","digit":"4"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressOperator to Calculator c3 (v0) with","payload":{"operator":"*"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"04","result":0,"_aggregate_id_":"c3","_aggregate_version_":0}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressOperator","_a":"c3","_v":"01","_n":"OperatorPressed","operator":"*"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c3 (v1) with","payload":{"digit":"4"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"04","result":0,"_aggregate_id_":"c3","_aggregate_version_":1,"operator":"*","right":null}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c3","_v":"02","_n":"DigitPressed","digit":"4"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressOperator to Calculator c3 (v2) with","payload":{"operator":"+"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"04","result":0,"_aggregate_id_":"c3","_aggregate_version_":2,"operator":"*","right":"4"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressOperator","_a":"c3","_v":"03","_n":"OperatorPressed","operator":"+"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c3 (v3) with","payload":{"digit":"2"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"16","result":16,"_aggregate_id_":"c3","_aggregate_version_":3,"operator":"+","right":null}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c3","_v":"04","_n":"DigitPressed","digit":"2"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c3 (v4) with","payload":{"digit":"1"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"16","result":16,"_aggregate_id_":"c3","_aggregate_version_":4,"operator":"+","right":"2"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c3","_v":"05","_n":"DigitPressed","digit":"1"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressOperator to Calculator c3 (v5) with","payload":{"operator":"-"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"16","result":16,"_aggregate_id_":"c3","_aggregate_version_":5,"operator":"+","right":"21"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressOperator","_a":"c3","_v":"06","_n":"OperatorPressed","operator":"-"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c3 (v6) with","payload":{"digit":"1"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"37","result":37,"_aggregate_id_":"c3","_aggregate_version_":6,"operator":"-","right":null}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c3","_v":"07","_n":"DigitPressed","digit":"1"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c3 (v7) with","payload":{"digit":"6"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"37","result":37,"_aggregate_id_":"c3","_aggregate_version_":7,"operator":"-","right":"1"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c3","_v":"08","_n":"DigitPressed","digit":"6"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressOperator to Calculator c3 (v8) with","payload":{"operator":"*"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"37","result":37,"_aggregate_id_":"c3","_aggregate_version_":8,"operator":"-","right":"16"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressOperator","_a":"c3","_v":"09","_n":"OperatorPressed","operator":"*"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c3 (v9) with","payload":{"digit":"3"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"21","result":21,"_aggregate_id_":"c3","_aggregate_version_":9,"operator":"*","right":null}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c3","_v":"10","_n":"DigitPressed","digit":"3"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressEquals to Calculator c3 (v10) with","payload":{}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"21","result":21,"_aggregate_id_":"c3","_aggregate_version_":10,"operator":"*","right":"3"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressEquals","_a":"c3","_v":"11","_n":"EqualsPressed"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressEquals to Calculator c3 (v11) with","payload":{}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"63","result":63,"_aggregate_id_":"c3","_aggregate_version_":11,"operator":"*","right":"3"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressEquals","_a":"c3","_v":"12","_n":"EqualsPressed"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressEquals to Calculator c3 (v12) with","payload":{}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"189","result":189,"_aggregate_id_":"c3","_aggregate_version_":12,"operator":"*","right":"3"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressEquals","_a":"c3","_v":"13","_n":"EqualsPressed"}]}
    √ should compute 4*4+21-16*3===567
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c4 (v-1) with","payload":{"digit":"1"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"0","result":0,"_aggregate_id_":"c4","_aggregate_version_":-1}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c4","_v":"00","_n":"DigitPressed","digit":"1"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDot to Calculator c4 (v0) with","payload":{}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"01","result":0,"_aggregate_id_":"c4","_aggregate_version_":0}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDot","_a":"c4","_v":"01","_n":"DotPressed"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c4 (v1) with","payload":{"digit":"5"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"01.","result":0,"_aggregate_id_":"c4","_aggregate_version_":1}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c4","_v":"02","_n":"DigitPressed","digit":"5"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressOperator to Calculator c4 (v2) with","payload":{"operator":"+"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"01.5","result":0,"_aggregate_id_":"c4","_aggregate_version_":2}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressOperator","_a":"c4","_v":"03","_n":"OperatorPressed","operator":"+"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c4 (v3) with","payload":{"digit":"2"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"01.5","result":0,"_aggregate_id_":"c4","_aggregate_version_":3,"operator":"+","right":null}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c4","_v":"04","_n":"DigitPressed","digit":"2"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDot to Calculator c4 (v4) with","payload":{}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"01.5","result":0,"_aggregate_id_":"c4","_aggregate_version_":4,"operator":"+","right":"2"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDot","_a":"c4","_v":"05","_n":"DotPressed"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c4 (v5) with","payload":{"digit":"0"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"01.5","result":0,"_aggregate_id_":"c4","_aggregate_version_":5,"operator":"+","right":"2."}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c4","_v":"06","_n":"DigitPressed","digit":"0"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressOperator to Calculator c4 (v6) with","payload":{"operator":"-"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"01.5","result":0,"_aggregate_id_":"c4","_aggregate_version_":6,"operator":"+","right":"2.0"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressOperator","_a":"c4","_v":"07","_n":"OperatorPressed","operator":"-"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c4 (v7) with","payload":{"digit":"1"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"3.5","result":3.5,"_aggregate_id_":"c4","_aggregate_version_":7,"operator":"-","right":null}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c4","_v":"08","_n":"DigitPressed","digit":"1"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c4 (v8) with","payload":{"digit":"1"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"3.5","result":3.5,"_aggregate_id_":"c4","_aggregate_version_":8,"operator":"-","right":"1"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c4","_v":"09","_n":"DigitPressed","digit":"1"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDot to Calculator c4 (v9) with","payload":{}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"3.5","result":3.5,"_aggregate_id_":"c4","_aggregate_version_":9,"operator":"-","right":"11"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDot","_a":"c4","_v":"10","_n":"DotPressed"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c4 (v10) with","payload":{"digit":"2"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"3.5","result":3.5,"_aggregate_id_":"c4","_aggregate_version_":10,"operator":"-","right":"11."}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c4","_v":"11","_n":"DigitPressed","digit":"2"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c4 (v11) with","payload":{"digit":"2"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"3.5","result":3.5,"_aggregate_id_":"c4","_aggregate_version_":11,"operator":"-","right":"11.2"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c4","_v":"12","_n":"DigitPressed","digit":"2"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressOperator to Calculator c4 (v12) with","payload":{"operator":"+"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"3.5","result":3.5,"_aggregate_id_":"c4","_aggregate_version_":12,"operator":"-","right":"11.22"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressOperator","_a":"c4","_v":"13","_n":"OperatorPressed","operator":"+"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDot to Calculator c4 (v13) with","payload":{}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"-7.720000000000001","result":-7.720000000000001,"_aggregate_id_":"c4","_aggregate_version_":13,"operator":"+","right":null}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDot","_a":"c4","_v":"14","_n":"DotPressed"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c4 (v14) with","payload":{"digit":"3"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"-7.720000000000001","result":-7.720000000000001,"_aggregate_id_":"c4","_aggregate_version_":14,"operator":"+","right":"."}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c4","_v":"15","_n":"DigitPressed","digit":"3"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c4 (v15) with","payload":{"digit":"3"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"-7.720000000000001","result":-7.720000000000001,"_aggregate_id_":"c4","_aggregate_version_":15,"operator":"+","right":".3"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c4","_v":"16","_n":"DigitPressed","digit":"3"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressEquals to Calculator c4 (v16) with","payload":{}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"-7.720000000000001","result":-7.720000000000001,"_aggregate_id_":"c4","_aggregate_version_":16,"operator":"+","right":".33"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressEquals","_a":"c4","_v":"17","_n":"EqualsPressed"}]}
    √ should compute 1.5+2.0-11.22+.33=-7.39
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c5 (v-1) with","payload":{"digit":"5"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"0","result":0,"_aggregate_id_":"c5","_aggregate_version_":-1}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c5","_v":"00","_n":"DigitPressed","digit":"5"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDot to Calculator c5 (v0) with","payload":{}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"05","result":0,"_aggregate_id_":"c5","_aggregate_version_":0}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDot","_a":"c5","_v":"01","_n":"DotPressed"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c5 (v1) with","payload":{"digit":"2"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"05.","result":0,"_aggregate_id_":"c5","_aggregate_version_":1}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c5","_v":"02","_n":"DigitPressed","digit":"2"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c5 (v2) with","payload":{"digit":"3"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"05.2","result":0,"_aggregate_id_":"c5","_aggregate_version_":2}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c5","_v":"03","_n":"DigitPressed","digit":"3"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressOperator to Calculator c5 (v3) with","payload":{"operator":"/"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"05.23","result":0,"_aggregate_id_":"c5","_aggregate_version_":3}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressOperator","_a":"c5","_v":"04","_n":"OperatorPressed","operator":"/"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDot to Calculator c5 (v4) with","payload":{}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"05.23","result":0,"_aggregate_id_":"c5","_aggregate_version_":4,"operator":"/","right":null}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDot","_a":"c5","_v":"05","_n":"DotPressed"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c5 (v5) with","payload":{"digit":"3"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"05.23","result":0,"_aggregate_id_":"c5","_aggregate_version_":5,"operator":"/","right":"."}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c5","_v":"06","_n":"DigitPressed","digit":"3"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c5 (v6) with","payload":{"digit":"3"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"05.23","result":0,"_aggregate_id_":"c5","_aggregate_version_":6,"operator":"/","right":".3"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c5","_v":"07","_n":"DigitPressed","digit":"3"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressOperator to Calculator c5 (v7) with","payload":{"operator":"*"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"05.23","result":0,"_aggregate_id_":"c5","_aggregate_version_":7,"operator":"/","right":".33"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressOperator","_a":"c5","_v":"08","_n":"OperatorPressed","operator":"*"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressDigit to Calculator c5 (v8) with","payload":{"digit":"2"}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"15.84848484848485","result":15.84848484848485,"_aggregate_id_":"c5","_aggregate_version_":8,"operator":"*","right":null}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressDigit","_a":"c5","_v":"09","_n":"DigitPressed","digit":"2"}]}
TRACE: {"msg":"actor {\"id\":\"user1\",\"name\":\"user1\",\"tenant\":\"tenant1\",\"roles\":[]} sent PressEquals to Calculator c5 (v9) with","payload":{}}
TRACE: {"msg":"after loading Calculator","aggregate":{"left":"15.84848484848485","result":15.84848484848485,"_aggregate_id_":"c5","_aggregate_version_":9,"operator":"*","right":"2"}}
TRACE: {"msg":"after committing","events":[{"_u":"user1","_c":"PressEquals","_a":"c5","_v":"10","_n":"EqualsPressed"}]}
{"loadEvent":{"Calculator":{"PressDigit-DigitPressed":{"time":1544711245288,"count":232},"PressOperator-OperatorPressed":{"time":1544711245289,"count":106},"PressEquals-EqualsPressed":{"time":1544711245344,"count":3},"PressDot-DotPressed":{"time":1544711245347,"count":52}}}}
    √ should compute 5.23/.33*2=31.6969696969697


  33 passing (212ms)
```
Note the last line, here we are capturing trace stats from the store to count the number of events loaded. One of the big advantages of Event Sourcing is having a "replayable history". With proper instrumentation you can easily solve problems like:

* Testing the application at any point in time
* Integrating to other systems by just resending events to a new handler
* Recreating or creating new projections when requirements change
* Keeping documentation in sync with the source code - Self documenting code

Source code and documentation tend to diverge with time, and the investment needed to keep them in sync is not always sustainable. By replaying your events to capture the sequence of commands triggered by actors (people or systems) that generated them in the first place, you can recreate documents like the Event Storming sticker boards I love to use to discover business rules with my clients. 

## Contributing

In lieu of a formal style guide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code.
