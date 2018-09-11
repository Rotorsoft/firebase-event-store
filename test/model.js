const { Aggregate, IEventHandler, Err } = require('../index')

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
  static get maxEvents () { return 15 }

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

module.exports = {
  Calculator,
  EventCounter
}