const {
  FirestoreEventStore,
  Bus,
} = require('../index')
const chai = require('chai')

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

chai.should()

module.exports = {
  setup: function (busName) {
    let evtStore, bus
    const db = mocksdk.firestore()
    evtStore = new FirestoreEventStore(db)
    bus = new Bus(evtStore, busName)
    return { 
      evtStore: evtStore,
      bus: bus,
      firestore: db
    }
  }
}