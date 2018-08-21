'use strict'

const IDocumentStore = require('./IDocumentStore')
const ERRORS = require('./errors')

/**
 * Basic firestore implementation of IDocumentStore
 */
module.exports = class FirestoreDocumentStore extends IDocumentStore {
  constructor (db) {
    super()
    this._db_ = db
  }

  async get (path) {
    let docSnapshot = await this._db_.doc(path).get()
    if (!docSnapshot.exists) throw ERRORS.DOCUMENT_NOT_FOUND_ERROR(path)
    return docSnapshot.data()
  }

  async set (path, doc, merge = true) {
    await this._db_.doc(path).set(doc, { merge: merge })
    return await this.get(path)
  }

  async delete (path) {
    return await this._db_.doc(path).delete()
  }

  async query (path, where = null) {
    if (where) {
      let snapshot = await this._db_.collection(path).where(where.fieldPath, where.opStr, where.value).get()
      return snapshot.docs.map(d => { 
        let doc = d.data()
        doc._id_ = d.id
        return doc
      })
    }
    else {
      let snapshot = await this._db_.collection(path).get()
      return snapshot.docs.map(d => {
        let doc = d.data()
        doc._id_ = d.id
        return doc
      })
    }
  }
}
