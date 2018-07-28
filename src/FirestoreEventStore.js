'use strict'

const IEventStore = require('./IEventStore')
const Aggregate = require('./Aggregate')
const Evento = require('./Evento')
const ERRORS = require('./errors')

/**
 * Basic firestore implementation of IEventStore
 */
module.exports = class FirestoreEventStore extends IEventStore {
  constructor (db) {
    super()
    this._db_ = db
  }

  // tenants/tenantid/aggregates/aggregateId/events/{version}/event
  loadAggregate (aggregatePath, aggregateType, aggregateId = null) {
    if (!(aggregateType.prototype instanceof Aggregate))
      return Promise.reject(ERRORS.INVALID_ARGUMENTS_ERROR('aggregateType'))

    if (!aggregateId)
      return Promise.resolve(Aggregate.create(aggregateType))
    else {
      let aggregate = Aggregate.create(aggregateType, aggregateId)
      let aggRef = this._db_.doc(aggregatePath.concat('/', aggregateId))
      return aggRef.collection('events').get()
        .then(eventsQuerySnapshot => {
          eventsQuerySnapshot.forEach(eventSnapshot => {
            let e = Object.create(Evento.prototype)
            Object.assign(e, eventSnapshot.data())
            aggregate.loadEvent(e)
          })
          return aggregate
        })
    }
  }

  commitAggregate (aggregatePath, aggregate, expectedVersion = -1) {
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
