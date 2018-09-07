const { Aggregate, IEventHandler, Errors } = require('../index')

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
        if (!Number.isInteger(_.number1)) throw Errors.invalidArguments('number1')
        if (!Number.isInteger(_.number2)) throw Errors.invalidArguments('number2')
        this.addEvent(actor.id, EVENTS.NumbersAdded, _)
      },
      SubtractNumbers: async (actor, _) => {
        if (!Number.isInteger(_.number1)) throw Errors.invalidArguments('number1')
        if (!Number.isInteger(_.number2)) throw Errors.invalidArguments('number2')
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
}

module.exports = {
  Calculator,
  EventCounter
}