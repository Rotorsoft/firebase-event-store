'use strict'

const { Aggregate, Err } = require('../../index')

const OPERATORS = {
  ['+']: (l, r) => l + r, 
  ['-']: (l, r) => l - r,
  ['*']: (l, r) => l * r,
  ['/']: (l, r) => l / r
}

const EVENTS = {
  DigitPressed: 'DigitPressed',
  DotPressed: 'DotPressed',
  OperatorPressed: 'OperatorPressed',
  EqualsPressed: 'EqualsPressed' 
}

module.exports = class Calculator extends Aggregate {
  constructor () {
    super()
    this.left = '0'
    this.result = 0
  }

  static get path () { return '/calculators' }

  get commands () { 
    return { 
      PressDigit: async (actor, _) => {
        if (_.digit < '0' || _.digit > '9') throw Err.invalidArgument('digit')
        this.addEvent(EVENTS.DigitPressed, _)
      },
      PressDot: async (actor, _) => {
        this.addEvent(EVENTS.DotPressed, _)
      },
      PressOperator: async (actor, _) => {
        if (!Object.keys(OPERATORS).includes(_.operator)) throw Err.invalidArgument('operator')
        this.addEvent(EVENTS.OperatorPressed, _)
      },
      PressEquals: async (actor, _) => {
        this.addEvent(EVENTS.EqualsPressed, _)
      }
    }
  }

  get events () {
    return { 
      [EVENTS.DigitPressed]: _ => {
        if (this.operator) {
          this.right = (this.right || '').concat(_.digit)
        }
        else this.left = (this.left || '').concat(_.digit)
      },
      [EVENTS.DotPressed]: _ => {
        if (this.operator) {
          this.right = (this.right || '').concat('.')
        }
        else this.left = (this.left || '').concat('.')
      },
      [EVENTS.OperatorPressed]: _ => {
        if (this.operator) this.compute()
        this.operator = _.operator
        this.right = null
      },
      [EVENTS.EqualsPressed]: _ => {
        this.compute()
      }
    }
  }

  compute () {
    if (!this.left) throw Err.precondition('missing left side')
    if (!this.right) throw Err.precondition('missing right side')
    if (!this.operator) throw Err.precondition('missing operator')
    const l = Number.parseFloat(this.left)
    const r = Number.parseFloat(this.right)
    this.result = OPERATORS[this.operator](l, r)
    this.left = this.result.toString()
  }
}
