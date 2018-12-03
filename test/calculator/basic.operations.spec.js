'use strict'

const { setup } = require('../setup')
const Calculator = require('./calculator')

let bus

const actor1 = { id: 'user1', name: 'user1', tenant: 'tenant1', roles: [] }

describe('Calculator basic operations', () => {
  before (() => {
    bus = setup([Calculator], { debug: true })
  })

  async function c (calc, command, payload) {
    return await bus.command(actor1, command, Object.assign(payload, { aggregateId: calc.aggregateId, expectedVersion: calc.aggregateVersion }))
  }

  it('should compute 1+2-3*5=0', async () => {
    let calc
    calc = await bus.command(actor1, 'PressDigit', { digit: '1', aggregateId: 'c1' })
    calc = await c(calc, 'PressOperator', { operator: '+' })
    calc = await c(calc, 'PressDigit', { digit: '2'})
    calc = await c(calc, 'PressOperator', { operator: '-' })
    calc = await c(calc, 'PressDigit', { digit: '3'})
    calc = await c(calc, 'PressOperator', { operator: '*' })
    calc = await c(calc, 'PressDigit', { digit: '5' })
    calc = await c(calc, 'PressEquals', {})
  
    calc.result.should.equal(0)
  })

  it('should compute 4*4+21-16*3=63', async () => {
    let calc
    calc = await bus.command(actor1, 'PressDigit', { digit: '4', aggregateId: 'c2' })
    calc = await c(calc, 'PressOperator', { operator: '*' })
    calc = await c(calc, 'PressDigit', { digit: '4' })
    calc = await c(calc, 'PressOperator', { operator: '+' })
    calc = await c(calc, 'PressDigit', { digit: '2' })
    calc = await c(calc, 'PressDigit', { digit: '1' })
    calc = await c(calc, 'PressOperator', { operator: '-' })
    calc = await c(calc, 'PressDigit', { digit: '1' })
    calc = await c(calc, 'PressDigit', { digit: '6' })
    calc = await c(calc, 'PressOperator', { operator: '*' })
    calc = await c(calc, 'PressDigit', { digit: '3' })
    calc = await c(calc, 'PressEquals', {})
  
    calc.result.should.equal(63)
  })

  it('should compute 4*4+21-16*3===567', async () => {
    let calc
    calc = await bus.command(actor1, 'PressDigit', { digit: '4', aggregateId: 'c3' })
    calc = await c(calc, 'PressOperator', { operator: '*' })
    calc = await c(calc, 'PressDigit', { digit: '4' })
    calc = await c(calc, 'PressOperator', { operator: '+' })
    calc = await c(calc, 'PressDigit', { digit: '2' })
    calc = await c(calc, 'PressDigit', { digit: '1' })
    calc = await c(calc, 'PressOperator', { operator: '-' })
    calc = await c(calc, 'PressDigit', { digit: '1' })
    calc = await c(calc, 'PressDigit', { digit: '6' })
    calc = await c(calc, 'PressOperator', { operator: '*' })
    calc = await c(calc, 'PressDigit', { digit: '3' })
    calc = await c(calc, 'PressEquals', {})
    calc = await c(calc, 'PressEquals', {})
    calc = await c(calc, 'PressEquals', {})
  
    calc.result.should.equal(567)
  })

  it('should compute 1.5+2.0-11.22+.33=-7.39', async () => {
    let calc
    calc = await bus.command(actor1, 'PressDigit', { digit: '1', aggregateId: 'c4' })
    calc = await c(calc, 'PressDot', {})
    calc = await c(calc, 'PressDigit', { digit: '5'})    
    calc = await c(calc, 'PressOperator', { operator: '+' })
    calc = await c(calc, 'PressDigit', { digit: '2'})
    calc = await c(calc, 'PressDot', {})
    calc = await c(calc, 'PressDigit', { digit: '0'})    
    calc = await c(calc, 'PressOperator', { operator: '-' })
    calc = await c(calc, 'PressDigit', { digit: '1'})
    calc = await c(calc, 'PressDigit', { digit: '1'})
    calc = await c(calc, 'PressDot', {})
    calc = await c(calc, 'PressDigit', { digit: '2'})
    calc = await c(calc, 'PressDigit', { digit: '2'})
    calc = await c(calc, 'PressOperator', { operator: '+' })
    calc = await c(calc, 'PressDot', {})
    calc = await c(calc, 'PressDigit', { digit: '3' })
    calc = await c(calc, 'PressDigit', { digit: '3' })
    calc = await c(calc, 'PressEquals', {})
  
    calc.result.toFixed(2).should.equal('-7.39')
  })

  it('should compute 5.23/.33*2=31.6969696969697', async () => {
    let calc
    calc = await bus.command(actor1, 'PressDigit', { digit: '5', aggregateId: 'c5' })
    calc = await c(calc, 'PressDot', {})
    calc = await c(calc, 'PressDigit', { digit: '2'})
    calc = await c(calc, 'PressDigit', { digit: '3'})   
    calc = await c(calc, 'PressOperator', { operator: '/' })
    calc = await c(calc, 'PressDot', {})
    calc = await c(calc, 'PressDigit', { digit: '3' })
    calc = await c(calc, 'PressDigit', { digit: '3' })
    calc = await c(calc, 'PressOperator', { operator: '*' })
    calc = await c(calc, 'PressDigit', { digit: '2'})
    calc = await c(calc, 'PressEquals', {})
  
    calc.result.should.equal(31.6969696969697)
  })
})
