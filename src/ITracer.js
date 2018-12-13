'use strict'

/**
 * Trace interface
 */
module.exports = class ITracer {
  /**
   * 
   * @param {Integer} level Trace level
   * @param {String} stat Trace stats (counters, etc)
   * @param {Object} args Other arguments (msg, payload, aggregateType, event, etc)
   */
  trace ({ level = 0, ...args } = {}) {}
}
