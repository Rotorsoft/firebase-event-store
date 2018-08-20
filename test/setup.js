const _ = require('lodash')
const {
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

chai.use(chaiasp)
chai.should()

module.exports = {
  setup: function (busName) {
    let docStore, evtStore, bus
    const db = mocksdk.firestore()
    docStore = new FirestoreDocumentStore(db)
    evtStore = new FirestoreEventStore(db)
    bus = new Bus(evtStore, busName)
    return { 
      evtStore: evtStore,
      docStore: docStore,
      bus: bus,
      firestore: db
    }
  }
}