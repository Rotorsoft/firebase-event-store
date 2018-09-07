'use strict'

const IEventStore = require('./IEventStore')
const Aggregate = require('./Aggregate')
const Errors = require('./Errors')

module.exports = class FirestoreEventStore extends IEventStore {
  constructor (db) {
    super()
    this._db_ = db
  }

  async loadAggregateFromSnapshot (tenant, aggregateType, aggregateId = '') {
    if (aggregateId) {
      const aggregatePath = '/tenants/'.concat(tenant, aggregateType.path, '/', aggregateId)
      const doc = await this._db_.doc(aggregatePath).get()
      return Aggregate.create(this, aggregateType, doc.data() || { _aggregate_id_: aggregateId })
    }
    // return new aggregate
    return Aggregate.create(this, aggregateType, {})
  }

  async loadAggregateFromEvents (tenant, aggregateType, aggregateId) {
    const aggregate = Aggregate.create(this, aggregateType, { _aggregate_id_: aggregateId })
    const aggregateRef = this._db_.doc('/tenants/'.concat(tenant, aggregateType.path, '/', aggregateId))
    const snap = await aggregateRef.collection('events').get()
    snap.forEach(doc => {
      aggregate.loadEvent(doc.data())
    })
    return aggregate
  }

  async commitAggregate (tenant, aggregate, expectedVersion = -1) {
    if (aggregate.aggregateVersion !== expectedVersion) {
      throw Errors.concurrencyError()
    }
    
    const aggregateObject = Object.assign({}, aggregate) // change prototype to Object for firestore
    const batch = this._db_.batch()
    const aggCollRef = this._db_.collection('/tenants/'.concat(tenant, Object.getPrototypeOf(aggregate).constructor.path))
    let aggRef = null
    
    if (!aggregate._aggregate_id_) {
      // assign new id
      aggRef = aggCollRef.doc()
      aggregateObject._aggregate_id_ = aggregate._aggregate_id_ = aggRef.id
    } else {
      aggRef = aggCollRef.doc(aggregate._aggregate_id_)
    }

    // create first snapshot
    if (expectedVersion === -1) batch.create(aggRef, aggregateObject)

    // commit events
    const eventsCollRef = aggRef.collection('events')
    aggregate._uncommitted_events_.forEach(event => {
      expectedVersion++
      const versionString = expectedVersion.toString()
      const paddedVersion = '0000'.substr(0, 5 - versionString.length).concat(versionString) // up to 100,000 events per aggregate
      batch.create(eventsCollRef.doc(paddedVersion), event)
    })

    // update latest aggregate snapshot in batch
    aggregateObject._aggregate_version_ = expectedVersion
    batch.update(aggRef, aggregateObject)

    // commit batch
    try {
      await batch.commit()
      // console.log(results)
      aggregate._aggregate_version_ = expectedVersion
      return aggregate
    }
    catch(error) {
      throw Errors.concurrencyError() 
    }
  }
}
