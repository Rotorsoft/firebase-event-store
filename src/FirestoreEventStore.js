'use strict'

const IEventStore = require('./IEventStore')
const Aggregate = require('./Aggregate')
const ERRORS = require('./errors')

/**
 * Basic firestore implementation of IEventStore
 */
module.exports = class FirestoreEventStore extends IEventStore {
  constructor (db) {
    super()
    this._db_ = db
  }

  loadAggregateFromSnapshot (aggregatePath, aggregateType, aggregateId = null) {
    try {
      let aggregate = Aggregate.create(aggregateType, aggregateId || '')
      if (!aggregateId) return Promise.resolve(aggregate)

      return this._db_.doc(aggregatePath.concat('/', aggregateId)).get()
        .then(doc => {
          aggregate.loadSnapshot(doc.data())
          return aggregate
        })
    } catch(error) {
      return Promise.reject(error)
    }
  }

  loadAggregateFromEvents (aggregatePath, aggregateType, aggregateId, eventTypes) {
    try {
      let aggregate = Aggregate.create(aggregateType, aggregateId)
      return this._db_.doc(aggregatePath.concat('/', aggregateId)).collection('events').get()
        .then(eventsQuerySnapshot => {
          eventsQuerySnapshot.forEach(doc => {
            aggregate.loadEvent(eventTypes, doc.data())
          })
          return aggregate
        })
    } catch(error) {
      return Promise.reject(error)
    }
  }

  commitAggregate (aggregatePath, aggregate, expectedVersion = -1) {
    if (aggregate.aggregateVersion !== expectedVersion) {
      throw ERRORS.CONCURRENCY_ERROR()
    }
    
    let plainAggregate = Object.assign({}, aggregate)
    let batch = this._db_.batch()
    let aggCollRef = this._db_.collection(aggregatePath)
    let aggRef = null
    
    if (!aggregate._aggregate_id_) {
      aggRef = aggCollRef.doc()
      plainAggregate._aggregate_id_ = aggregate._aggregate_id_ = aggRef.id
    } else {
      aggRef = aggCollRef.doc(aggregate._aggregate_id_)
    }
    if (expectedVersion === -1) batch.create(aggRef, plainAggregate)

    let eventsCollRef = aggRef.collection('events')
    aggregate._uncommitted_events_.forEach(e => {
      expectedVersion++
      let pad = expectedVersion < 10 ? '000' : (expectedVersion < 100 ? '00' : (expectedVersion < 1000 ? '0' : ''))
      let versionString = pad + expectedVersion.toString()
      let plainEvent = Object.assign({}, e) // assign to plain js object => Object prototype
      batch.create(eventsCollRef.doc(versionString), plainEvent)
    })
    plainAggregate._aggregate_version_ = expectedVersion
    batch.update(aggRef, plainAggregate)
    return batch.commit()
      .then(results => {
        // console.log(results)
        aggregate._aggregate_version_ = expectedVersion
        return aggregate
      })
      .catch(() => {
        throw ERRORS.CONCURRENCY_ERROR() 
      })
  }
}
