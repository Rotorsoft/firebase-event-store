'use strict'

const Err = require('./Err')

module.exports = class Padder {
  constructor (max) {
    this.padLen = (max - 1).toString().length
    if (this.padLen > 6) throw Err.preconditionError('max events is higher than 1000000')
    this.padStr = '000000'.substr(0, this.padLen)
  }

  pad (number) {
    const s = number.toString()
    return this.padStr.substr(0, this.padLen - s.length).concat(s)
  }
}