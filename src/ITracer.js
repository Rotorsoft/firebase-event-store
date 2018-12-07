'use strict'

class ITracer {
  trace (...args) {}
}

class ConsoleTracer extends ITracer {
  constructor () {
    super()
  }

  trace (...args) {
    console.log('TRACE: '.concat(args.join(' ')))
  }
}

class NullTracer extends ITracer {
  constructor () {
    super ()
  }
}

module.exports = {
  ITracer,
  ConsoleTracer,
  NullTracer
}
