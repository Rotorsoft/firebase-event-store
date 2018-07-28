'use strict'

const { Bus, Aggregate, Command, InMemoryEventStore, IEventHandler, ERRORS } = require('../index')
const IEventStore = require('../src/IEventStore')
const IDocumentStore = require('../src/IDocumentStore')
const { Calculator, AddNumbers } = require('./model')

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
  it('should throw invalid arguments: store', (done) => {
    try {
      let bus2 = new Bus(new Object())
      done('should not happen')
    }
    catch(error) {
      error.message.should.equal('invalid arguments: store')
      done()
    }
  })

  it('should throw invalid arguments: handler', (done) => {
    try {
      let bus2 = new Bus(new InMemoryEventStore())
      bus2.addEventHandler(new Object())
      done('should not happen')
    }
    catch(error) {
      error.message.should.equal('invalid arguments: handler')
      done()
    }
  })
})

describe('Not implemented', () => {
  it('should throw not implemented applyEvent', (done) => {
    const store = new InMemoryEventStore()
    const bus = new Bus(store)
    bus.addEventHandler(new InvalidHandler())
    let promise = bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator, 'calc1')
     
    promise.should.be.rejectedWith('not implemented: applyEvent').notify(done)
  })

  it('should throw not implemented handleCommand', (done) => {
    const store = new InMemoryEventStore()
    const bus = new Bus(store)
    let promise = bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', InvalidAggregate)
     
    promise.should.be.rejectedWith('not implemented: handleCommand').notify(done)
  })

  it('should throw not implemented applyEvent', (done) => {
    const store = new InMemoryEventStore()
    const bus = new Bus(store)
    InvalidAggregate.prototype.handleCommand = Calculator.prototype.handleCommand
    let promise = bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', InvalidAggregate)
     
    promise.should.be.rejectedWith('not implemented: applyEvent').notify(done)
  })

  it('should throw invalid arguments eventType', (done) => {
    const store = new InMemoryEventStore()
    const bus = new Bus(store)
    let promise = bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', InvalidAggregate2)
     
    promise.should.be.rejectedWith('invalid arguments: eventType').notify(done)
  })

  it('should throw invalid arguments aggregateType', (done) => {
    const store = new InMemoryEventStore()
    const bus = new Bus(store)
    let promise = bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', InvalidCommand)
     
    promise.should.be.rejectedWith('invalid arguments: aggregateType').notify(done)
  })

  it('should throw not implemented validate', (done) => {
    try {
      Command.create(InvalidCommand, 'user1', { })
      done('should not happen')
    }
    catch(error) {
      error.message.should.equal('not implemented: validate')
      done()
    } 
  })

  it('should throw invalid arguments commandType', (done) => {
    try {
      Command.create(InvalidHandler, 'user1', { })
      done('should not happen')
    }
    catch(error) {
      error.message.should.equal('invalid arguments: commandType')
      done()
    } 
  })

  it('should throw missing arguments', (done) => {
    try {
      Command.create(InvalidCommand2, 'user1', {})
      done('should not happen')
    }
    catch(error) {
      error.message.should.equal('missing arguments: a')
      done()
    } 
  })

  it('should throw precondition error', (done) => {
    try {
      Command.create(InvalidCommand3, 'user1', { a: 1, b: 3 })
      done('should not happen')
    }
    catch(error) {
      error.message.should.equal('precondition error: a must be greater than b')
      done()
    }
  })
  
  it('should throw not implemented event store loadAggregate', (done) => {
    const store = new InvalidEventStore()
    const bus = new Bus(store)
    let promise = bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator, 'calc1')
     
    promise.should.be.rejectedWith('not implemented').notify(done)
  })

  it('should throw not implemented event store commitAggregate', (done) => {
    const store = new InvalidEventStore()
    InvalidEventStore.prototype.loadAggregate = InMemoryEventStore.prototype.loadAggregate
    const bus = new Bus(store)
    let promise = bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator, 'calc1')
     
    promise.should.be.rejectedWith('not implemented').notify(done)
  })

  it('should throw not implemented document store get', (done) => {
    const store = new InvalidDocumentStore()
    let promise = store.get('/')
     
    promise.should.be.rejectedWith('not implemented: get').notify(done)
  })

  it('should throw not implemented document store set', (done) => {
    const store = new InvalidDocumentStore()
    let promise = store.set('/', {})
     
    promise.should.be.rejectedWith('not implemented: set').notify(done)
  })

  it('should throw not implemented document store delete', (done) => {
    const store = new InvalidDocumentStore()
    let promise = store.delete('/')
     
    promise.should.be.rejectedWith('not implemented: delete').notify(done)
  })

  it('should throw not implemented document store query', (done) => {
    const store = new InvalidDocumentStore()
    let promise = store.query('/', {})
     
    promise.should.be.rejectedWith('not implemented: query').notify(done)
  })
})
