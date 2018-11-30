'use strict'

const { setup } = require('../setup')
const Calculator = require('./calculator')

let bus

const actor1 = { id: 'user1', name: 'user1', tenant: 'tenant1', roles: [] }

describe('Calculator basic operations', () => {
  before (() => {
    bus = setup([Calculator], { debug: true })
  })

  it('should compute 1+2-3*5=0', async () => {
    let calc
    calc = await bus.command(actor1, 'PressDigit', { digit: '1', aggregateId: 'c1' })
    calc = await bus.command(actor1, 'PressOperator', { operator: '+', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressDigit', { digit: '2', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressOperator', { operator: '-', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressDigit', { digit: '3', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressOperator', { operator: '*', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressDigit', { digit: '5', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressEquals', { aggregateId: calc.aggregateId })
  
    calc.result.should.equal(0)
  })

  it('should compute 4*4+21-16*3=63', async () => {
    let calc
    calc = await bus.command(actor1, 'PressDigit', { digit: '4', aggregateId: 'c2' })
    calc = await bus.command(actor1, 'PressOperator', { operator: '*', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressDigit', { digit: '4', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressOperator', { operator: '+', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressDigit', { digit: '2', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressDigit', { digit: '1', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressOperator', { operator: '-', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressDigit', { digit: '1', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressDigit', { digit: '6', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressOperator', { operator: '*', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressDigit', { digit: '3', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressEquals', { aggregateId: calc.aggregateId })
  
    calc.result.should.equal(63)
  })

  it('should compute 4*4+21-16*3===567', async () => {
    let calc
    calc = await bus.command(actor1, 'PressDigit', { digit: '4', aggregateId: 'c3' })
    calc = await bus.command(actor1, 'PressOperator', { operator: '*', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressDigit', { digit: '4', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressOperator', { operator: '+', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressDigit', { digit: '2', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressDigit', { digit: '1', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressOperator', { operator: '-', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressDigit', { digit: '1', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressDigit', { digit: '6', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressOperator', { operator: '*', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressDigit', { digit: '3', aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressEquals', { aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressEquals', { aggregateId: calc.aggregateId })
    calc = await bus.command(actor1, 'PressEquals', { aggregateId: calc.aggregateId })
  
    calc.result.should.equal(567)
  })
})