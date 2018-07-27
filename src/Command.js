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
    Object.defineProperty(command, '_', { value: payload, enumerable: true, writable: false })
    command.validate()
    return command
  }

  get uid() { return this._uid_ }
  get payload() { return this._ }

  validate() { throw ERRORS.NOT_IMPLEMENTED_ERROR() }
}
