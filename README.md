firebase-event-store
=========

A basic event sourcing library using firestore to record aggregates, events, and documents (read model)

## Installation

  `npm install firebase-event-store`

## Usage

```javascript
const {
  Aggregate,
  Command,
  Evento,
  InMemoryEventStore,
  Bus,
  ERRORS
} = require('../index')

class AddNumbers extends Command {
  validate() {
    let _ = this.payload
    console.log(``validating payload: ${JSON.stringify(_)}``)
    if (!_.number1) throw ERRORS.INVALID_ARGUMENTS_ERROR('number1')
    if (!_.number2) throw ERRORS.INVALID_ARGUMENTS_ERROR('number2')
  }
}

class NumbersAdded extends Evento {
  constructor (uid, number1, number2) {
    super(uid)
    this.number1 = number1
    this.number2 = number2
  }
}

class Calculator extends Aggregate {
  handleCommand (command) {
    let _ = command.payload
    switch (command.constructor) {
      case AddNumbers:
        console.log(``handling command AddNumbers: ${_.number1} + ${_.number2}``)
        this.addEvent(new NumbersAdded(command.uid, _.number1, _.number2))
        break
    }
  }

  applyEvent (e) {
    switch (e.eventName) {
      case NumbersAdded.name:
        console.log(``applying event NumbersAdded: ${e.number1} + ${e.number2}``)
        this.sum = (this.sum || 0)
        this.sum += (e.number1 + e.number2)
        break
    }
  }
}

const evtStore = new InMemoryEventStore()
const bus = new Bus(evtStore)

bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator, 'calc1')
  .then(calc => bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 3, number2: 4 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, calc.aggregateVersion))
    .then(calc => {
      console.log(calc.sum)
    }) 
    .catch(error => {
      console.error(error)
    })
  })
```  

## Tests

  `npm test`

## Contributing

In lieu of a formal style guide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code.
