'use strict'

/**
 * Event base abstract class
 */
module.exports = class Evento {
  get eventName() { return this._event_name_ }
  get eventCreator() { return this._event_creator_ }
}
