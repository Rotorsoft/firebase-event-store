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

  get (path) {
    return this._db_.doc(path).get()
      .then(docSnapshot => {
        if (!docSnapshot.exists) throw ERRORS.DOCUMENT_NOT_FOUND_ERROR(path)
        return docSnapshot.data()
      })
  }

  set (path, doc) {
    return this._db_.doc(path).set(doc, { merge: true })
      .then(() => this.get(path))
  }

  delete (path) {
    return this._db_.doc(path).delete()
  }

  query (path, where) {
    return this._db_.collection(path).where(where.fieldPath, where.opStr, where.value).get()
      .then(snapshot => snapshot.docs.map(d => d.data()))
  }
}
