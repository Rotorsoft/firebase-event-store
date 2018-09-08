'use strict'

const IEventStore = require('./IEventStore')
const Aggregate = require('./Aggregate')
const Err = require('./Err')

module.exports = class FirestoreEventStore extends IEventStore {
  constructor (db) {
    super()
    this._db_ = db
  }

  getAggregateCollectionRef (tenant, aggregateType) {
    return this._db_.collection('/tenants/'.concat(tenant, aggregateType.path))
  }

  async loadAggregateFromSnapshot (tenant, aggregateType, aggregateId) {
    if (aggregateId) {
      const doc = await this.getAggregateCollectionRef(tenant, aggregateType).doc(aggregateId).get()
      return Aggregate.create(this, aggregateType, doc.data() || { _aggregate_id_: aggregateId })
    }
    // return new aggregate
    return Aggregate.create(this, aggregateType, {})
  }

  async loadAggregateFromEvents (tenant, aggregateType, aggregateId) {
    const aggregate = Aggregate.create(this, aggregateType, { _aggregate_id_: aggregateId })
    const aggregateRef = this.getAggregateCollectionRef(tenant, aggregateType).doc(aggregateId)
    const snap = await aggregateRef.collection('events').get()
    snap.forEach(doc => {
      aggregate.loadEvent(Object.freeze(doc.data()))
    })
    return aggregate
  }

  async commitAggregate (tenant, aggregate, expectedVersion) {
    if (aggregate.aggregateVersion !== expectedVersion) throw Err.concurrencyError()
    const aggregateType = Object.getPrototypeOf(aggregate).constructor
    if (expectedVersion + 1 >= aggregateType.maxEvents - 1) throw Err.preconditionError('max events reached')
    const pad = (aggregateType.maxEvents - 1).toString().length
    if (pad > 6) throw Err.preconditionError('max events is higher than 1000000')
    const padStr = '000000'.substr(0, pad)

    const aggregateObject = Object.assign({}, aggregate) // change prototype to Object for firestore
    const batch = this._db_.batch()
    const aggCollRef = this.getAggregateCollectionRef(tenant, aggregateType)
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
      const paddedVersion = padStr.substr(0, pad - versionString.length).concat(versionString)
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
      throw Err.concurrencyError() 
    }
  }
}
