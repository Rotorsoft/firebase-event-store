firebase-event-store [![Build Status](https://travis-ci.org/Rotorsoft/firebase-event-store.svg?branch=master)](https://travis-ci.org/Rotorsoft/firebase-event-store) [![Coverage Status](https://coveralls.io/repos/github/Rotorsoft/firebase-event-store/badge.svg?branch=master)](https://coveralls.io/github/Rotorsoft/firebase-event-store?branch=master)
=========

Using Firestore as the only storage technology in a fairly simple CQRS solution seems like a very natural compromise. The read side can be easily implemented using out of the box collections and documents that are automatically synchronized with client apps via snapshot listeners. This module tackles a very basic command side event store that supports multi-tenant/role-based apps, storing each aggregate type in their own colletion path, and always keeping the latest snapshot for easy reading. Events are saved inside the aggregate document (events collection).

## Installation

  `npm install @rotorsoft/firebase-event-store`

## Usage

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
const bus = setup(firebase, [Calculator], false)
bus.addEventHandler(new EventCounter(docStore))

let actor = { id: 'user1', name: 'actor 1', tenant: 'tenant1', roles: ['manager', 'user'] }
let calc = await bus.command(actor, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc1' })
calc = await bus.command(actor, 'AddNumbers', { number1: 3, number2: 4, aggregateId: calc.aggregateId, expectedVersion: calc.aggregateVersion })
calc = await bus.command(actor, 'SubtractNumbers', { aggregateId: 'calc1', number1: 1, number2: 1 })
console.log('calculator', calc)
```

## Tests

  `npm test`

## Contributing

In lieu of a formal style guide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code.
