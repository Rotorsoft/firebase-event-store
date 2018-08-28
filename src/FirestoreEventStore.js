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

  async loadAggregateFromSnapshot (tenant, aggregateType, aggregateId = null) {
    const aggregate = Aggregate.create(this, aggregateType, aggregateId || '')
    if (!aggregateId) return aggregate
    const aggregatePath = '/tenants/'.concat(tenant, aggregate.path, '/', aggregateId)
    const doc = await this._db_.doc(aggregatePath).get()
    const snap = doc.data()
    if (snap) {
      Object.keys(snap).forEach(key => {
        if (key !== '_aggregate_id_') aggregate[key] = snap[key]
      })
    }
    return aggregate
  }

  async loadAggregateFromEvents (tenant, aggregateType, aggregateId, eventTypes) {
    const aggregate = Aggregate.create(this, aggregateType, aggregateId)
    const aggregatePath = '/tenants/'.concat(tenant, aggregate.path, '/', aggregateId)
    const snap = await this._db_.doc(aggregatePath).collection('events').get()
    snap.forEach(doc => {
      aggregate.loadEvent(eventTypes, doc.data())
    })
    return aggregate
  }

  async commitAggregate (tenant, aggregate, expectedVersion = -1) {
    if (aggregate.aggregateVersion !== expectedVersion) {
      throw ERRORS.CONCURRENCY_ERROR()
    }
    
    const plainAggregate = Object.assign({}, aggregate)
    const batch = this._db_.batch()
    const aggregatesPath = '/tenants/'.concat(tenant, aggregate.path)
    const aggCollRef = this._db_.collection(aggregatesPath)
    let aggRef = null
    
    if (!aggregate._aggregate_id_) {
      aggRef = aggCollRef.doc()
      plainAggregate._aggregate_id_ = aggregate._aggregate_id_ = aggRef.id
    } else {
      aggRef = aggCollRef.doc(aggregate._aggregate_id_)
    }
    if (expectedVersion === -1) batch.create(aggRef, plainAggregate)

    const eventsCollRef = aggRef.collection('events')
    aggregate._uncommitted_events_.forEach(e => {
      expectedVersion++
      let pad = expectedVersion < 10 ? '000' : (expectedVersion < 100 ? '00' : (expectedVersion < 1000 ? '0' : ''))
      let versionString = pad + expectedVersion.toString()
      let plainEvent = Object.assign({}, e) // assign to plain js object => Object prototype
      batch.create(eventsCollRef.doc(versionString), plainEvent)
    })
    plainAggregate._aggregate_version_ = expectedVersion
    batch.update(aggRef, plainAggregate)
    try {
      await batch.commit()
      // console.log(results)
      aggregate._aggregate_version_ = expectedVersion
      return aggregate
    }
    catch(error) {
      throw ERRORS.CONCURRENCY_ERROR() 
    }
  }
}
