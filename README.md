firebase-event-store [![Build Status](https://travis-ci.org/Rotorsoft/firebase-event-store.svg?branch=master)](https://travis-ci.org/Rotorsoft/firebase-event-store) [![Coverage Status](https://coveralls.io/repos/github/Rotorsoft/firebase-event-store/badge.svg?branch=master)](https://coveralls.io/github/Rotorsoft/firebase-event-store?branch=master)
=========

A basic multi-tenant event sourcing library using firestore to record aggregates, events, and documents (read model)

## Installation

  `npm install firebase-event-store`

## Usage

```javascript
const {
  Aggregate,
  Command,
  Evento,
  FirestoreEventStore,
  Bus,
  ERRORS
} = require('../index')

const firestoreDb = //TODO init firesore db
const evtStore = new FirestoreEventStore(firestoreDb)
const bus = new Bus(evtStore)
bus.addEventHandler(new EventCounter(docStore))

class AddNumbers extends Command {
  validate(_) {
    if (!_.number1) throw ERRORS.INVALID_ARGUMENTS_ERROR('number1')
    if (!_.number2) throw ERRORS.INVALID_ARGUMENTS_ERROR('number2')
    this.number1 = _.number1
    this.number2 = _.number2
  }
}

class NumbersAdded extends Evento { }

class Calculator extends Aggregate {
  constructor () {
    super()
    this.sum = 0
  }

  get path () { return '/calculators' }

  async handleCommand (actor, command) {
    switch (command.constructor) {
      case AddNumbers:
        this.addEvent(actor.id, NumbersAdded, { a: command.number1, b: command.number2 })
        break
    }
  }

  applyEvent (event) {
    switch (event.constructor) {
      case NumbersAdded:
        this.creator = event.eventCreator
        this.sum += (event.a + event.b)
        break
    }
  }
}

class EventCounter extends IEventHandler {
  constructor(db) {
    super()
    this.db = db
  }

  applyEvent (actor, event, aggregate) {
    const path = '/counters/counter1'
    if (event.eventName === NumbersAdded.name) {
      let snap = await this.db.doc(path).get()
      let doc = snap.data() || {}
      doc.eventCount = (doc.eventCount || 0) + 1
      return await this.db.doc(path).set(doc)
    }
  }
}

let actor = { id: 'user1', tenant: 'tenant1' }
let calc = await bus.sendCommand(actor, Command.create(AddNumbers, { number1: 1, number2: 2 }), Calculator, 'calc1')
calc = await bus.sendCommand(actor, Command.create(AddNumbers, { number1: 3, number2: 4 }), Calculator, calc.aggregateId, calc.aggregateVersion)
console.log(calc.sum)
```

## Tests

  `npm test`

## Contributing

In lieu of a formal style guide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code.
