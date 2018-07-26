'use strict'

const {
  Aggregate,
  Command,
  Evento,
  InMemoryEventStore,
  Bus,
  ERRORS
} = require('../index')
const chai = require('chai')
const chaiasp = require('chai-as-promised')
chai.use(chaiasp)
chai.should()

class AddNumbers extends Command {
  validate() {
    let _ = this.payload
    console.log(`validating payload: ${JSON.stringify(_)}`)
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
        console.log(`handling command AddNumbers: ${_.number1} + ${_.number2}`)
        this.addEvent(new NumbersAdded(command.uid, _.number1, _.number2))
        break
    }
  }

  applyEvent (e) {
    switch (e.eventName) {
      case NumbersAdded.name:
        console.log(`applying event NumbersAdded: ${e.number1} + ${e.number2}`)
        this.sum = (this.sum || 0)
        this.sum += (e.number1 + e.number2)
        break
    }
  }
}

const evtStore = new InMemoryEventStore()
const bus = new Bus(evtStore)

describe('Basic', () => {
  it('should accumulate numbers to 10', (done) => {
    bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator, 'calc1')
      .then(calc => bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 3, number2: 4 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, calc.aggregateVersion))
      .then(calc => {
        calc.aggregateVersion.should.equal(1)
        calc.sum.should.equal(10)
        done()
      }) 
      .catch(error => {
        done(error)
      })
  })

  it('should throw concurrency error', (done) => {
    let promise = bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator, 'calc1')
      .then(calc => bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 3, number2: 4 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, calc.aggregateVersion))
      .then(calc => bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 3, number2: 4 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, 0))
       
    promise.should.be.rejectedWith('concurrency error').notify(done)
  })
})
