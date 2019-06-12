'use strict'

const ITracer = require('./ITracer')
const IEventStore = require('./IEventStore')
const Err = require('./Err')

/**
 * Event Stream Reader
 */
module.exports = class StreamReader {
  /**
   * Constructor
   * 
   * @param {IEventStore} store The event store
   * @param {String} tenant tenant id
   * @param {String} stream stream name
   * @param {Array} handlers Array of event handlers
   * @param {ITracer} tracer Tracer module
   */
  constructor (store, tenant, stream, handlers, tracer = null) {
    if (!(store instanceof IEventStore)) throw Err.invalidArgument('store')
    if (tracer && !(tracer instanceof ITracer)) throw Err.invalidArgument('tracer')
    this._store_ = store
    this._tenant_ = tenant
    this._stream_ = stream
    this._handlers_ = handlers.filter(h => h.name && h.stream === stream)
    this._tracer_ = tracer || new ITracer()
  }

  /**
   * Polls stream, handles new events, and commits cursors
   * 
   * @param {Integer} limit Max number of events to poll
   * @param {Integer} timeout Timeout in milliseconds to expire lease
   * @returns True if any of the handlers is still behind
   */
  async poll ({ limit = 10, timeout = 10000 } = {}) {
    if (!this._handlers_.length) return false

    const lease = await this._store_.pollStream(this._tenant_, this._stream_, this._handlers_, limit, timeout)
    if (lease && lease.events.length) {
      for (let event of lease.events) {
        for (let handler of lease.handlers) {
          if (event.streamVersion > lease.cursors[handler.name]) {
            try {
              this._tracer_.trace(() => ({ method: 'handle', handler: handler.name, tenant: this._tenant_, stream: this._stream_, event }))
              await handler.handle(this._tenant_, event)
              lease.cursors[handler.name] = event.streamVersion
            }
            catch (e) {
              this._tracer_.trace(() => ({ error: e }))
            }
          }
        }
      }
      return await this._store_.commitCursors(lease)
    }
    return false
  }
}
