'use strict'

class NotImplementedError extends Error {
  constructor (method, ...args) {
    super(args)
    this.name = 'NotImplementedError'
    this.method = method
  }
}

class InvalidArgumentError extends Error {
  constructor (argument, ...args) {
    super(args)
    this.name = 'InvalidArgumentError'
    this.argument = argument
  }
}

class MissingArgumentError extends Error {
  constructor (argument, ...args) {
    super(args)
    this.name = 'MissingArgumentError'
    this.argument = argument
  }
}

class ConcurrencyError extends Error {
  constructor (...args) {
    super(args)
    this.name = 'ConcurrencyError'
  }
}

class PreconditionError extends Error {
  constructor (message, ...args) {
    super(args)
    this.name = 'PreconditionError'
    this.message = message
  }
}

module.exports = {
  NotImplementedError,
  InvalidArgumentError,
  MissingArgumentError,
  ConcurrencyError,
  PreconditionError,
  notImplemented: method => new NotImplementedError(method),
  invalidArgument: arg => new InvalidArgumentError(arg),
  missingArgument: arg => new MissingArgumentError(arg),
  concurrency: () => new ConcurrencyError(),
  precondition: msg => new PreconditionError(msg)
}
