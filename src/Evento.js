'use strict'

const ERRORS = require('./errors')

/**
 * Event base abstract class
 */
module.exports = class Evento {
  /**
   * Evento factory method
   * @param {Object} eventType subclass of Evento
   * @param {Object} payload event payload
   * @param {String} creator optional event creator, if not provided will search in payload for _event_creator_
   * @returns {Evento} instance of eventType
   */
  static create (eventType, payload, creator = null) {
    if (!(eventType.prototype instanceof Evento)) throw ERRORS.INVALID_ARGUMENTS_ERROR('eventType')
    let event = new eventType.prototype.constructor()
    Object.defineProperty(event, '_event_name_', { value: eventType.name, enumerable: true, writable: false })
    Object.defineProperty(event, '_event_creator_', { value: creator || payload._event_creator_, enumerable: true, writable: false })
    Object.keys(payload).forEach(k => {
      if (k !== '_event_name_' && k !== '_event_creator_') Object.defineProperty(event, k, { value: payload[k], enumerable: true, writable: false })
    })
    return event
  }

  get eventName() { return this._event_name_ }
  get eventCreator() { return this._event_creator_ }
}
