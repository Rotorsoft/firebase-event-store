'use strict'

/**
 * Module errors
 */
module.exports = {
  notImplemented: (method) => new Error(`not implemented: ${method}`),
  invalidArguments: (args) => new Error(`invalid arguments: ${args}`),
  missingArguments: (args) => new Error(`missing arguments: ${args}`),
  concurrencyError: () => new Error('concurrency error'),
  preconditionError: (description) => new Error(`precondition error: ${description}`)
}