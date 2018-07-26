'use strict'

/**
 * Event base abstract class
 */
module.exports = class Evento {
  /**
   * Event constructor
   * @param {String} uid user id creating the event
   */
  constructor (uid) {
    Object.defineProperty(this, '_event_name_', { value: this.constructor.name, enumerable: true })
    Object.defineProperty(this, '_event_creator_', { value: uid, enumerable: true })
  }

  get eventName() { return this._event_name_ }
  get eventCreator() { return this._event_creator_ }
}
