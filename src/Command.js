'use strict'

const ERRORS = require('./errors')

/**
 * Command base abstract class
 */
module.exports = class Command {
  /**
   * Command factory method
   * @param {Object} commandType subclass of Command
   * @param {String} uid user id sending command
   * @param {Object} payload command payload
   */
  static create (commandType, uid, payload) {
    if (!(commandType.prototype instanceof Command)) throw ERRORS.INVALID_ARGUMENTS_ERROR('commandType')
    let command = new commandType.prototype.constructor()
    Object.defineProperty(command, '_uid_', { value: uid, enumerable: true, writable: false })
    command.validate(payload)
    return command
  }

  /**
   * Gets user who created this command
   */
  get uid() { return this._uid_ }

  /**
   * Validates command payload and copies any attributes needed later to create events
   * @param {Object} _ command payload
   */
  validate(_) { throw ERRORS.NOT_IMPLEMENTED_ERROR('validate') }
}
