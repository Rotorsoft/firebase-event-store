firebase-event-store [![Build Status](https://travis-ci.org/Rotorsoft/firebase-event-store.svg?branch=master)](https://travis-ci.org/Rotorsoft/firebase-event-store) [![Coverage Status](https://coveralls.io/repos/github/Rotorsoft/firebase-event-store/badge.svg?branch=master)](https://coveralls.io/github/Rotorsoft/firebase-event-store?branch=master)
=========

I started this project as a proof of concept, trying to figure out if a low cost (practically free) persistance platform in the cloud could support a couple of mobile applications I developed this year.

[Cloud Firestore](https://firebase.google.com/docs/firestore/) is an inexpensive Non-SQL cloud database to store and sync data for mobile, web, and server development. Since most of my web applications are following the [CQRS](http://codebetter.com/gregyoung/2012/09/09/cqrs-is-not-an-architecture-2/) pattern proposed by Greg Young around 2010 (see Figure 1), I was curious about using Firestore Documents and Collections to model my Event Streams, Aggregate Snapshots, and Projections. After some tinkering with the APIs, and a few beers, the Command Side started to emerge. 

Always afraid of overengineering, I decided not to implement the Query Side and settled for just listening to the documents holding my aggregate snapshots as my Read Model (realtime listeners is a nice out-of-the-box feature in Firestore that allows clients to synchronize data with the store). I just created a basic event handler to store Aggregate snapshots in separate collections. This also helps to speed up the write side after a few hundred events.

So far the results have been positive. The current store supports multiple tenants as well as multiple event streams within each tenant. This is just a seed, and there is a lot of room for improvement. I would like to see a serverless Pub/Sub messaging solution inside Firebase (not the gcloud one) to refactor the in-memory Bus and make it more scalable. I would also like to revisit the Query Side and explore different types of projection models. In the meantime, I will be deploying more applications.

#### Figure 1 - CQRS Reference Architecture
![Figure 1](/assets/CQRSArchitecture.PNG)

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
const bus = setup(firebase, [Calculator])
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
