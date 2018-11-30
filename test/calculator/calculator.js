'use strict'

const { Aggregate, Err } = require('../../index')

const OPERATORS = ['+', '-', '*']

const EVENTS = {
  DigitPressed: 'DigitPressed',
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
  static get maxEvents () { return 100 }

  get commands () { 
    return { 
      PressDigit: async (actor, _) => {
        if (_.digit < '0' || _.digit > '9') throw Err.invalidArguments('digit')
        this.addEvent(actor.id, EVENTS.DigitPressed, _)
      },
      PressOperator: async (actor, _) => {
        if (!OPERATORS.includes(_.operator)) throw Err.invalidArguments('operator')
        this.addEvent(actor.id, EVENTS.OperatorPressed, _)
      },
      PressEquals: async (actor, _) => {
        this.addEvent(actor.id, EVENTS.EqualsPressed, _)
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
    if (!this.left) throw Err.preconditionError('missing left side')
    if (!this.right) throw Err.preconditionError('missing right side')
    if (!this.operator) throw Err.preconditionError('missing operator')
    const l = Number.parseInt(this.left)
    const r = Number.parseInt(this.right)
    switch (this.operator) {
      case '+': this.result = l + r; break;
      case '-': this.result = l - r; break;
      case '*': this.result = l * r; break;
    }
    this.left = this.result.toString()
  }
}
