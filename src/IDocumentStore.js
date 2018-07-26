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
  get (path) { throw ERRORS.NOT_IMPLEMENTED_ERROR() }

  /**
   * Sets document (create or update)
   * @param {String} path Path to document 
   * @param {Object} doc Document
   */
  set (path, doc) { throw ERRORS.NOT_IMPLEMENTED_ERROR() }

  /**
   * Deletes document
   * @param {String} path Path to document
   */
  delete (path) { throw ERRORS.NOT_IMPLEMENTED_ERROR() }
  
  /**
   * Queries document collection
   * @param {String} path Path to collection
   * @param {Object} where Where clause 
   */
  query (path, where) { throw ERRORS.NOT_IMPLEMENTED_ERROR() }
}