'use strict'

const setup = require('./setup').setup
const { Bus, Aggregate, Command, FirestoreEventStore, IEventHandler, ERRORS } = require('../index')
const IEventStore = require('../src/IEventStore')
const IDocumentStore = require('../src/IDocumentStore')
const { Calculator, AddNumbers } = require('./model')

let docStore
let bus
let firestore

class InvalidAggregate extends Aggregate {
  constructor() {
    super()
  }
}

class InvalidAggregate2 extends Aggregate {
  constructor() {
    super()
  }

  handleCommand (command) {
    this.addEvent(InvalidAggregate, command.uid, {})
  }

  applyEvent (e) {  }
}

class InvalidCommand extends Command {
  constructor() {
    super()
  }
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

class InvalidDocumentStore extends IDocumentStore {
  constructor () {
    super()
    this._store_ = {}
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

describe('Not implemented', () => {
  before (() => {
    ({ docStore, bus, firestore } = setup())
  })

  it('should throw not implemented applyEvent', async () => {
    try {
      const store = new FirestoreEventStore(firestore)
      const bus = new Bus(store)
      bus.addEventHandler(new InvalidHandler())
      await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator, 'calc22')
    }
    catch(error) {
      error.message.should.be.equal('not implemented: applyEvent')
    }
  })

  it('should throw not implemented handleCommand', async () => {
    try {
      const store = new FirestoreEventStore(firestore)
      const bus = new Bus(store)
      await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', InvalidAggregate)
    }
    catch(error) { 
      error.message.should.be.equal('not implemented: handleCommand')
    }
  })

  it('should throw not implemented applyEvent', async () => {
    try {
      const store = new FirestoreEventStore(firestore)
      const bus = new Bus(store)
      InvalidAggregate.prototype.handleCommand = Calculator.prototype.handleCommand
      await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', InvalidAggregate)
    }
    catch(error) { 
      error.message.should.be.equal('not implemented: applyEvent')
    }
  })

  it('should throw invalid arguments eventType', async () => {
    try {
      const store = new FirestoreEventStore(firestore)
      const bus = new Bus(store)
      await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', InvalidAggregate2)
    }
    catch(error) { 
      error.message.should.be.equal('invalid arguments: eventType')
    }
  })

  it('should throw invalid arguments aggregateType', async () => {
    try {
      const store = new FirestoreEventStore(firestore)
      const bus = new Bus(store)
      await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', InvalidCommand)
    }
    catch(error) {
      error.message.should.be.equal('invalid arguments: aggregateType')
    }
  })

  it('should throw not implemented validate', async () => {
    try {
      Command.create(InvalidCommand, 'user1', { })
    }
    catch(error) {
      error.message.should.equal('not implemented: validate')
    } 
  })

  it('should throw invalid arguments commandType', async () => {
    try {
      Command.create(InvalidHandler, 'user1', { })
    }
    catch(error) {
      error.message.should.equal('invalid arguments: commandType')
    } 
  })

  it('should throw missing arguments', async () => {
    try {
      Command.create(InvalidCommand2, 'user1', {})
    }
    catch(error) {
      error.message.should.equal('missing arguments: a')
    } 
  })

  it('should throw precondition error', async () => {
    try {
      Command.create(InvalidCommand3, 'user1', { a: 1, b: 3 })
    }
    catch(error) {
      error.message.should.equal('precondition error: a must be greater than b')
    }
  })
  
  it('should throw not implemented event store loadAggregate', async () => {
    try {
      const store = new InvalidEventStore()
      const bus = new Bus(store)
      await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator, 'calc1')
    }
    catch(error) { 
      error.message.should.be.equal('not implemented: loadAggregateFromSnapshot')
    }
  })

  it('should throw not implemented event store commitAggregate', async () => {
    try {
      const store = new FirestoreEventStore(firestore)
      delete FirestoreEventStore.prototype.commitAggregate
      const bus = new Bus(store)
      await bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator, 'calc1')
    }
    catch(error) {
      error.message.should.be.equal('not implemented: commitAggregate')
    }
  })

  it('should throw not implemented document store get', async () => {
    try {
      const store = new InvalidDocumentStore()
      await store.get('/')
    }
    catch(error) {
      error.message.should.be.equal('not implemented: get')
    }
  })

  it('should throw not implemented document store set', async () => {
    try {
      const store = new InvalidDocumentStore()
      await store.set('/', {})
    }
    catch(error) {
      error.message.should.be.equal('not implemented: set')
    }
  })

  it('should throw not implemented document store delete', async () => {
    try {
      const store = new InvalidDocumentStore()
      await store.delete('/')
    }
    catch(error) {
      error.message.should.be.equal('not implemented: delete')
    }
  })

  it('should throw not implemented document store query', async () => {
    try {
      const store = new InvalidDocumentStore()
      await store.query('/', {})
    }
    catch(error) {
      error.message.should.be.equal('not implemented: query')
    }
  })
})
