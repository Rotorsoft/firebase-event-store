'use strict'

const { Aggregate, IEventHandler, Err } = require('../../index')

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
  constructor(db, name) {
    super()
    this.db = db
    this._name_ = name
  }

  get name () { return this._name_ }
  
  async count (event) {
    const path = '/counters/'.concat(this.name)
    let snap = await this.db.doc(path).get()
    let doc = snap.data() || {}
    doc.eventCount = (doc.eventCount || 0) + 1
    await this.db.doc(path).set(doc)
    if (this.name) console.log(`${this.name} handled event ${event._version_} and count is ${doc.eventCount}`)
  }

  get events () {
    return {
      [EVENTS.NumbersAdded]: async event => {
        return await this.count(event)
      }
    }
  }
}

module.exports = {
  Calculator,
  EventCounter
}