const { setup } = require('../index')
const { Calculator } = require('./model')
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
mockfirestore.autoFlush()

chai.should()

module.exports = {
  setup: (debug) => {
    mocksdk.apps = []
    return setup(mocksdk, [Calculator], debug)
  },
  firebase: mocksdk
}