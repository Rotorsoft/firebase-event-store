'use strict'

const ERRORS = require('./errors')

/**
 * DocumentStore interface
 */
module.exports = class IDocumentStore {
  /**
   * Gets document from store
   * @param {String} path Path to document 
   */
  get (path) { return Promise.reject(ERRORS.NOT_IMPLEMENTED_ERROR('get')) }

  /**
   * Sets document (create or update)
   * @param {String} path Path to document 
   * @param {Object} doc Document
   */
  set (path, doc) { return Promise.reject(ERRORS.NOT_IMPLEMENTED_ERROR('set')) }

  /**
   * Deletes document
   * @param {String} path Path to document
   */
  delete (path) { return Promise.reject(ERRORS.NOT_IMPLEMENTED_ERROR('delete')) }
  
  /**
   * Queries document collection
   * @param {String} path Path to collection
   * @param {Object} where Optional where clause 
   */
  query (path, where = null) { return Promise.reject(ERRORS.NOT_IMPLEMENTED_ERROR('query')) }
}