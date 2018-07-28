const _ = require('lodash')
const {
  InMemoryEventStore,
  InMemoryDocumentStore,
  FirestoreEventStore,
  FirestoreDocumentStore,
  Bus,
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

module.exports = {
  setup: function (inMemory) {
    let docStore, evtStore, bus
    if (inMemory) {
      docStore = new InMemoryDocumentStore()
      evtStore = new InMemoryEventStore()
      bus = new Bus(evtStore)
    } else {
      const db = mocksdk.firestore()
      docStore = new FirestoreDocumentStore(db)
      evtStore = new FirestoreEventStore(db)
      bus = new Bus(evtStore)
    }
    return { 
      docStore: docStore,
      bus: bus
    }
  }
}