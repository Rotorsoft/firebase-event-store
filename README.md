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
        this.addEvent(actor.id, EVENTS.NumbersAdded, _)
      },
      SubtractNumbers: async (actor, _) => {
        if (!Number.isInteger(_.number1)) throw Err.invalidArguments('number1')
        if (!Number.isInteger(_.number2)) throw Err.invalidArguments('number2')
        this.addEvent(actor.id, EVENTS.NumbersSubtracted, _)
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
      [EVENTS.NumbersAdded]: async (actor, aggregate) => {
        return await this.count()
      },
      [EVENTS.NumbersSubtracted]: async (actor, aggregate) => {
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
        this.addEvent(actor.id, EVENTS.DigitPressed, _)
      },
      PressDot: async (actor, _) => {
        this.addEvent(actor.id, EVENTS.DotPressed, _)
      },
      PressOperator: async (actor, _) => {
        if (!Object.keys(OPERATORS).includes(_.operator)) throw Err.invalidArguments('operator')
        this.addEvent(actor.id, EVENTS.OperatorPressed, _)
      },
      PressEquals: async (actor, _) => {
        this.addEvent(actor.id, EVENTS.EqualsPressed, _)
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

describe('Calculator basic operations', () => {
  before (() => {
    bus = setup([Calculator], { debug: true }) // SEE FULL CHAI AND FIREBASE-MOCK SETUP IN TEST FOLDER
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

## Tests

  `npm test`

## Contributing

In lieu of a formal style guide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code.
