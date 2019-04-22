'use strict'

const PromiseQueue = require('./PromiseQueue')
const ITracer = require('./ITracer')

/**
 * Pushes events to handlers
 * @returns version
 */
const _push = async ({ stream, handlers, event = null, load = false }) => {
  let e = []
  let v = -1
  // get min version
  for (let handler of Object.values(handlers)) {
    if (v < 0 || handler._version_ < v) v = handler._version_
  }

  // load events from min version
  if (v < stream._version_ || load) {
    e = await stream.loadEvents(v + 1, stream._size_)
    if (e.length) {
      v = e[e.length - 1]._version_ // max event version loaded
      if (v > stream._version_) stream._version_ = v // move stream version
      stream._tracer_.trace(() => ({ method: 'loadEvents', events: e }))
    }
  }

  // append event if adjacent to window
  if (event) {
    if (event._version_ === v + 1) {
      e.push(event)
      stream._version_ = v = event._version_ // move stream version
      stream._tracer_.trace(() => ({ stat: 'pushEvent', event }))
    }
  }

  // handle events
  if (e.length) {
    while (e.length) {
      const ev = e[0]
      for (let handler of Object.values(handlers)) {
        if (handler._version_ === ev._version_ - 1) {
          try {
            stream._tracer_.trace(() => ({ method: 'handle', handler, stream, event: ev }))
            await handler._handler_.handle(stream._tenant_, ev)
            handler._version_ = ev._version_
          }
          catch (e) {
            stream._tracer_.trace(() => ({ error: e }))
          }
        }
      }
      e.shift()
    }
    await stream.commitCursors(handlers)
    stream._tracer_.trace(() => ({ method: 'commitCursors', cursors: stream.cursors }))
    return v
  }
}

/**
 * Pushes catchup window to catchup handlers until current
 */
const _catchup = async (stream) => {
  if (Object.keys(stream._catchup_).length) {
    let v = await _push({ stream, handlers: stream._catchup_ })
    if (v < stream.version) return true // keep going
    
    // done catching up, move handlers to current window and make final push
    Object.assign(stream._handlers_, stream._catchup_)
    stream._catchup_ = {}
    await stream.push(null, true)
  }
  return false
}

module.exports = class IEventStream {
  constructor (tenant, name, size, tracer = null) {
    this._tenant_ = tenant
    this._name_ = name
    this._size_ = size
    this._handlers_ = {}
    this._catchup_ = {}
    this._currentQueue = new PromiseQueue()
    this._catchupQueue = new PromiseQueue()
    this._tracer_ = tracer || new ITracer()
  }

  /**
   * Stream version (version of last committed event)
   */
  get version () { throw Err.notImplemented('version') }

  /**
   * Object mapping event handler names to committed cursors
   */
  get cursors () { throw Err.notImplemented('cursors') }

  /**
   * Loads stream data (versions and cursors)
   */
  async load () { throw Err.notImplemented('load') }

  /**
   * Loads events from stream starting from given version
   * @param {Integer} fromVersion starting from version
   * @param {Integer} limit max numbers of events to load
   * @returns Promise with array of loaded events
   */
  async loadEvents (fromVersion, limit) { throw Err.notImplemented('loadEvents') }

  /**
   * Commits event handler cursors after events are handled succesfully
   * @param {Object} handlers Object map of registered event handlers with confirmed _version_ field
   */
  async commitCursors (handlers) { throw Err.notImplemented('commitCursors') }

  /**
   * Subscribes event handler with stream
   * @param {IEventHandler} handler 
   */
  async subscribe (handler) {
    await this.load()
    const ver = this.cursors[handler.name] || -1
    const han = { _handler_: handler, _version_: ver }
    if (ver + this._size_ < this.version) this._catchup_[handler.name] = han
    else this._handlers_[handler.name] = han
  }

  /**
   * Pushes event to handlers and commits cursors after sync
   * 
   * @param {Object} event (Optional) event to be appended at the end of current window
   * @param {Boolean} load (Optional) flag to force loading window when empty (poll for new events)
   */
  async push (event, load = false) { await this._currentQueue.push(_push, { stream: this, handlers: this._handlers_, event, load }) }

  /**
   * Starts catchup loop
   */
  catchup () {
    const loop = () => {
      const c = async resolve => {
        if (await _catchup(this)) setTimeout(c, 1000, resolve)
        else resolve()
      }
      return new Promise(c)
    }
    this._catchupQueue.push(loop, {})
  }

  /**
   * Flushes queues
   */
  async flush () {
    await this._catchupQueue.flush()
    await this._currentQueue.flush()
  }
}
