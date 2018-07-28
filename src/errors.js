'use strict'

/**
 * Module errors
 */
module.exports = {
  NOT_IMPLEMENTED_ERROR: (method) => new Error(`not implemented: ${method}`),
  INVALID_ARGUMENTS_ERROR: (args) => new Error(`invalid arguments: ${args}`),
  MISSING_ARGUMENTS_ERROR: (args) => new Error(`missing arguments: ${args}`),
  CONCURRENCY_ERROR: () => new Error('concurrency error'),
  DOCUMENT_NOT_FOUND_ERROR: (path) => new Error(`document not found: ${path}`),
  PRECONDITION_ERROR: (description) => new Error(`precondition error: ${description}`)
}