'use strict'

const { Aggregate, Command, IEventHandler, ERRORS } = require('../index')
const Bus = require('../src/Bus')
const FirestoreEventStore = require('../src/FirestoreEventStore')
const IEventStore = require('../src/IEventStore')
const { Calculator } = require('./model')
const { setup, firebase } = require('./setup')
const setup2 = require('../index').setup
const bus = setup(false)
const firestore = bus.eventStore._db_

class InvalidAggregate extends Aggregate {
  constructor() {
    super()
  }

  get path () { return '/invalids' }
  
  static get COMMANDS () { return { InvalidCommand } }
}

class InvalidAggregate2 extends Aggregate {
  constructor() {
    super()
  }

  get path () { return '/invalids' }

  static get COMMANDS () { return { InvalidCommand } }

  handleCommand (actor, command) {
    this.addEvent(actor, InvalidAggregate, {})
  }

  applyEvent (e) {  }
}

class InvalidCommand extends Command {
  constructor() {
    super()
  }
  validate() {}
}

class InvalidCommand2 extends Command {
  constructor() {
    super()
  }

  validate(_) {
    if (!_.a) throw ERRORS.MISSING_ARGUMENTS_ERROR('a')
  }
}

class InvalidCommand3 extends Command {
  constructor() {
    super()
  }

  validate(_) {
    if (_.a <= _.b) throw ERRORS.PRECONDITION_ERROR('a must be greater than b')
  }
}

class InvalidHandler extends IEventHandler {
  constructor() {
    super()
  }
}

class InvalidEventStore extends IEventStore {
  constructor() {
    super()
    this._store_ = {}
  }

  getStore (path) {
    return this._store_[path] || (this._store_[path] = {})
  }
}

describe('Error handling', () => {
  it('should throw invalid arguments: store', async () => {
    try {
      let bus2 = new Bus(new Object())
    }
    catch(error) {
      error.message.should.equal('invalid arguments: store')
    }
  })

  it('should throw invalid arguments: handler', async () => {
    try {
      let bus2 = new Bus(new FirestoreEventStore(firestore))
      bus2.addEventHandler(new Object())
    }
    catch(error) {
      error.message.should.equal('invalid arguments: handler')
    }
  })
})

const actor1 = { id: 'user1', tenant: 'tenant1' }

describe('Not implemented', () => {
  it('should throw not implemented applyEvent', async () => {
    try {
      const bus = setup(false)
      bus.addEventHandler(new InvalidHandler())
      await bus.command(actor1, 'AddNumbers', { number1: 1, number2: 2, aggregateId: 'calc22' })
    }
    catch(error) {
      error.message.should.be.equal('not implemented: applyEvent')
    }
  })

  it('should throw not implemented handleCommand', async () => {
    try {
      const bus = setup2(firebase, [InvalidAggregate], false)
      await bus.command(actor1, 'InvalidCommand', { number1: 1, number2: 2 })
    }
    catch(error) { 
      error.message.should.be.equal('not implemented: handleCommand')
    }
  })

  it('should throw not implemented applyEvent', async () => {
    try {
      const bus = setup2(firebase, [InvalidAggregate], false)
      InvalidAggregate.prototype.handleCommand = Calculator.prototype.handleCommand
      await bus.command(actor1, 'InvalidCommand', { number1: 1, number2: 2 })
    }
    catch(error) { 
      error.message.should.be.equal('not implemented: applyEvent')
    }
  })

  it('should throw invalid arguments eventType', async () => {
    try {
      const bus = setup2(firebase, [InvalidAggregate2], false)
      await bus.command(actor1, 'InvalidCommand', { number1: 1, number2: 2 })
    }
    catch(error) { 
      error.message.should.be.equal('invalid arguments: eventType')
    }
  })

  it('should throw invalid arguments aggregateType', async () => {
    try {
      const bus = setup2(firebase, [InvalidCommand], false)
    }
    catch(error) {
      error.message.should.be.equal('invalid arguments: aggregateType')
    }
  })

  it('should throw not implemented validate', async () => {
    try {
      Command.create(InvalidCommand, { })
    }
    catch(error) {
      error.message.should.equal('not implemented: validate')
    } 
  })

  it('should throw invalid arguments commandType', async () => {
    try {
      Command.create(InvalidHandler, { })
    }
    catch(error) {
      error.message.should.equal('invalid arguments: commandType')
    } 
  })

  it('should throw missing arguments', async () => {
    try {
      Command.create(InvalidCommand2, {})
    }
    catch(error) {
      error.message.should.equal('missing arguments: a')
    } 
  })

  it('should throw precondition error', async () => {
    try {
      Command.create(InvalidCommand3, { a: 1, b: 3 })
    }
    catch(error) {
      error.message.should.equal('precondition error: a must be greater than b')
    }
  })
})
