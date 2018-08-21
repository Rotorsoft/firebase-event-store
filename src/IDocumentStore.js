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
  async get (path) { throw ERRORS.NOT_IMPLEMENTED_ERROR('get') }

  /**
   * Sets document (create or update)
   * @param {String} path Path to document 
   * @param {Object} doc Document
   * @param {Boolean} merge Merge attributes (true by default)
   */
  async set (path, doc, merge = true) { throw ERRORS.NOT_IMPLEMENTED_ERROR('set') }

  /**
   * Deletes document
   * @param {String} path Path to document
   */
  async delete (path) { throw ERRORS.NOT_IMPLEMENTED_ERROR('delete') }
  
  /**
   * Queries document collection
   * @param {String} path Path to collection
   * @param {Object} where Optional where clause 
   */
  async query (path, where = null) { throw ERRORS.NOT_IMPLEMENTED_ERROR('query') }
}