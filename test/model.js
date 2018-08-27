const {
  Aggregate,
  Command,
  Evento,
  IEventHandler,
  ERRORS
} = require('../index')

class AddNumbers extends Command {
  validate(_) {
    if (!Number.isInteger(_.number1)) throw ERRORS.INVALID_ARGUMENTS_ERROR('number1')
    if (!Number.isInteger(_.number2)) throw ERRORS.INVALID_ARGUMENTS_ERROR('number2')
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

  handleCommand (actor, command) {
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

  async applyEvent (actor, event, aggregate) {
    const path = '/counters/counter1'
    if (event.eventName === NumbersAdded.name) {
      let snap = await this.db.doc(path).get()
      let doc = snap.data() || {}
      doc.eventCount = (doc.eventCount || 0) + 1
      return await this.db.doc(path).set(doc)
    }
  }
}

module.exports = {
  Calculator,
  AddNumbers,
  NumbersAdded,
  EventCounter
}