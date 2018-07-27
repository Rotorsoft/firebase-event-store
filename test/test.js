'use strict'

const _ = require('lodash')
const {
  Aggregate,
  Command,
  Evento,
  InMemoryEventStore,
  InMemoryDocumentStore,
  FirestoreEventStore,
  FirestoreDocumentStore,
  Bus,
  IEventHandler,
  ERRORS
} = require('../index')
const chai = require('chai')
const chaiasp = require('chai-as-promised')

const firebasemock = require('firebase-mock')
// const mockauth = new firebasemock.MockAuthentication()
const mockfirestore = new firebasemock.MockFirestore()
const mocksdk = new firebasemock.MockFirebaseSdk(
  // use null if your code does not use RTDB
  null,
  // use null if your code does not use AUTHENTICATION
  null, // () => { return mockauth },
  // use null if your code does not use FIRESTORE
  () => { return mockfirestore },
  // use null if your code does not use STORAGE
  null, // () => { return mockstorage },
  // use null if your code does not use MESSAGING
  null // () => { return mockmessaging }
)
mocksdk.initializeApp()
mockfirestore.autoFlush()

const doccreate = function (data, callback) {
  var err = this._nextErr('create');
  if (this.data) 
    err = new Error('document already exists')
  else 
    data = _.cloneDeep(data);
  var self = this;
  return new Promise(function (resolve, reject) {
    self._defer('create', _.toArray(arguments), function () {
      if (err === null) {
        self._dataChanged(data);
        resolve(data);
      } else {
        if (callback) {
          callback(err);
        }
        reject(err);
      }
    });
  });
};

firebasemock.MockFirestore.prototype.batch = function () {
  var self = this;
  let promises = []
  return {
    create: function(doc, data) {
      Object.getPrototypeOf(doc).create = doccreate
      promises.push(doc.create(data))
    }, 
    set: function(doc, data, opts) {
      var _opts = _.assign({}, { merge: false }, opts);
      if (_opts.merge) {
        promises.push(doc._update(data, { setMerge: true }))
      }
      else {
        promises.push(doc.set(data))
      }
    },
    update: function(doc, data) {
      promises.push(doc.update(data))
    },
    delete: function(doc) {
      promises.push(doc.delete())
    },
    commit: function() {
      if (self.queue.events.length > 0) {
        self.flush();
      }
      // execute sequentially
      return Promise.all(promises)
      // return promises.reduce((chain, task) => { 
      //   return chain.then(results => task.then(result => [...results, result]))
      // }, Promise.resolve([]))
    }
  };
};

chai.use(chaiasp)
chai.should()

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

let docStore
let evtStore
let bus

describe('In Memory', () => {
  before (() => {
    docStore = new InMemoryDocumentStore()
    evtStore = new InMemoryEventStore()
    bus = new Bus(evtStore)
    bus.addEventHandler(new EventCounter(docStore))
  })

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

  it('should accumulate numbers to 12', (done) => {
    let calculator
    bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 2 }), '/tenants/tenant1', '/calculators', Calculator, 'calc1')
      .then(calc => bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 3, number2: 4 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, calc.aggregateVersion))
      .then(calc => bus.sendCommand(Command.create(AddNumbers, 'user1', { number1: 1, number2: 1 }), '/tenants/tenant1', '/calculators', Calculator, calc.aggregateId, calc.aggregateVersion))
      .then(calc => { 
        calculator = calc
        return docStore.get('/counters/counter1')
      })
      .then(counter => {
        calculator.aggregateVersion.should.equal(2)
        calculator.sum.should.equal(12)
        counter.eventCount.should.equal(3)
        done()
      })
      .catch(error => {
        done(error)
      })
  })

  it('should save doc', (done) => {
    const path = '/docs/doc1'
    docStore.set(path, { a: 1, b: 2 })
      .then(doc => {
        return docStore.get(path)
      })
      .then(doc2 => {
        doc2.a.should.equal(1)
        doc2.b.should.equal(2)
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

describe('Firebase Mock', () => {
  before (() => {
    let db = mocksdk.firestore()
    docStore = new FirestoreDocumentStore(db)
    evtStore = new FirestoreEventStore(db)
    bus = new Bus(evtStore)
  })

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

  it('should save doc', (done) => {
    const path = '/docs/doc1'
    docStore.set(path, { a: 1, b: 2 })
      .then(doc => {
        return docStore.get(path)
      })
      .then(doc2 => {
        doc2.a.should.equal(1)
        doc2.b.should.equal(2)
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
