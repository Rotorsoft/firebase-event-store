const { setup, ITracer } = require('../index')
const chai = require('chai')
const _ = require('lodash')

const firebasemock = require('firebase-mock')
const MockFirestoreQuery = require('firebase-mock/src/firestore-query')
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

// implement more query operators
MockFirestoreQuery.prototype.where = function (property, operator, value) {
  if (_.size(this.data) !== 0) {
    var results = {};
    _.forEach(this.data, function(data, key) {
      switch (operator) {
        case '==':
          if (_.isEqual(_.get(data, property), value)) {
            results[key] = _.cloneDeep(data);
          }
          break;
        case '>':
          if (_.get(data, property) > value) {
            results[key] = _.cloneDeep(data);
          }
          break;
        case '>=':
          if (_.get(data, property) >= value) {
            results[key] = _.cloneDeep(data);
          }
          break;  
        default:
          results[key] = _.cloneDeep(data);
          break;
      }
    });
    return new MockFirestoreQuery(this.path, results, this.parent, this.id);
  } else {
    return new MockFirestoreQuery(this.path, null, this.parent, this.id);
  }
}

module.exports = {
  setup: (aggregates, tracer = null, CACHE_SIZE = 10) => {
    mocksdk.apps = []
    return setup(mocksdk, aggregates, { tracer, CACHE_SIZE })
  },
  firebase: mocksdk,
  ITracer
}