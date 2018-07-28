const {
  Aggregate,
  Command,
  Evento,
  IEventHandler,
  ERRORS
} = require('../index')

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

  handleCommand (command) {
    switch (command.constructor) {
      case AddNumbers:
        this.addEvent(NumbersAdded, command.uid, { a: command.number1, b: command.number2 })
        break
    }
  }

  applyEvent (e) {
    switch (e.eventName) {
      case NumbersAdded.name:
        this.creator = e.eventCreator
        this.sum += (e.a + e.b)
        break
    }
  }
}

class EventCounter extends IEventHandler {
  constructor(docStore) {
    super()
    this.docStore = docStore
  }

  applyEvent (tenantPath, event, aggregate) {
    const path = '/counters/counter1'
    if (event.eventName === NumbersAdded.name) {
      this.docStore.set(path, {})
        .then(doc => {
          doc.eventCount = (doc.eventCount || 0) + 1
          return this.docStore.set(path, doc)
        })
    }
  }
}

module.exports = {
  Calculator,
  AddNumbers,
  NumbersAdded,
  EventCounter
}