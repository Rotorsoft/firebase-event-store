'use strict'

const ERRORS = require('./errors')

/**
 * Command base abstract class
 */
module.exports = class Command {
  /**
   * Command factory method
   * @param {Object} commandType subclass of Command
   * @param {Object} payload command payload
   */
  static create (commandType, payload) {
    if (!(commandType.prototype instanceof Command)) throw ERRORS.INVALID_ARGUMENTS_ERROR('commandType')
    let command = new commandType.prototype.constructor()
    command.validate(payload)
    return command
  }

  /**
   * Validates command payload and copies any attributes needed later to create events
   * @param {Object} _ command payload
   */
  validate(_) { throw ERRORS.NOT_IMPLEMENTED_ERROR('validate') }
}
