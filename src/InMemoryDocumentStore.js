'use strict'

const IDocumentStore = require('./IDocumentStore')
const ERRORS = require('./errors')

/**
 * Basic in-memory implementation of DocumentStore
 */
module.exports = class InMemoryDocumentStore extends IDocumentStore {
  constructor () {
    super()
    this._store_ = {}
  }

  get (path) {
    return new Promise(resolve => {
      let doc = this._store_[path]
      if (!doc) throw ERRORS.DOCUMENT_NOT_FOUND_ERROR(path)
      resolve(doc)
    })
  }

  set (path, doc) {
    return new Promise(resolve => {
      let stored = this._store_[path] || {}
      doc = Object.assign(stored, doc)
      this._store_[path] = doc
      resolve(doc)
    })
  }

  delete (path) {
    return new Promise(resolve => {
      delete this._store_[path]
      resolve()
    })
  }

  query (path) {
    return new Promise(resolve => {
      resolve(Object.keys(this._store_).map(k => this._store_[k]))
    })
  }
}
