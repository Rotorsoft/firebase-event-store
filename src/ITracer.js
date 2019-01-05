'use strict'

/**
 * Trace interface
 */
module.exports = class ITracer {
  /**
   * Calls trace function that returns object with trace values
   * 
   * @param {Function} fn Trace function invoked only by concrete tracers
   */
  trace (fn) {}
}
