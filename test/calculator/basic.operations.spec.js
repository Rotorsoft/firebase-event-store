'use strict'

const { setup, ITracer } = require('../setup')
const Calculator = require('./calculator')

let bus

const actor1 = { id: 'user1', name: 'user1', tenant: 'tenant1', roles: [] }

class ConsoleTracer extends ITracer {
  constructor () {
    super()
    this.stats = {}
  }

  trace (fn) {
    const { method, context, events, ...args } = fn()
    if (method && events) {
      for (let event of events) {
        const key = event.commandName + '-' + event.eventName
        const s = this.stats[method] || {}
        const t = s[context.aggregateType.name] || {}
        const e = t[key] || {} 
        e.time = e.time || Date.now()
        e.count = (e.count || 0) + 1
        t[key] = e
        s[context.aggregateType.name] = t
        this.stats[method] = s
      }
    }
  }
}

const tracer = new ConsoleTracer()

describe('Calculator basic operations', () => {
  before (() => {
    bus = setup([Calculator], tracer)
  })

  async function c (calc, command, payload) {
    return await bus.command(actor1, command, Object.assign(payload, { aggregateId: calc.aggregateId, expectedVersion: calc.aggregateVersion }))
  }

  it('should compute 1+2-3*5=0', async () => {
    let ctx
    ctx = await bus.command(actor1, 'PressDigit', { digit: '1', aggregateId: 'c1' })
    ctx = await c(ctx.aggregate, 'PressOperator', { operator: '+' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '2'})
    ctx = await c(ctx.aggregate, 'PressOperator', { operator: '-' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '3'})
    ctx = await c(ctx.aggregate, 'PressOperator', { operator: '*' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '5' })
    ctx = await c(ctx.aggregate, 'PressEquals', {})
  
    ctx.aggregate.result.should.equal(0)
  })

  it('should compute 4*4+21-16*3=63', async () => {
    let ctx
    ctx = await bus.command(actor1, 'PressDigit', { digit: '4', aggregateId: 'c2' })
    ctx = await c(ctx.aggregate, 'PressOperator', { operator: '*' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '4' })
    ctx = await c(ctx.aggregate, 'PressOperator', { operator: '+' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '2' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '1' })
    ctx = await c(ctx.aggregate, 'PressOperator', { operator: '-' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '1' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '6' })
    ctx = await c(ctx.aggregate, 'PressOperator', { operator: '*' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '3' })
    ctx = await c(ctx.aggregate, 'PressEquals', {})
  
    ctx.aggregate.result.should.equal(63)
  })

  it('should compute 4*4+21-16*3===567', async () => {
    let ctx
    ctx = await bus.command(actor1, 'PressDigit', { digit: '4', aggregateId: 'c3' })
    ctx = await c(ctx.aggregate, 'PressOperator', { operator: '*' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '4' })
    ctx = await c(ctx.aggregate, 'PressOperator', { operator: '+' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '2' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '1' })
    ctx = await c(ctx.aggregate, 'PressOperator', { operator: '-' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '1' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '6' })
    ctx = await c(ctx.aggregate, 'PressOperator', { operator: '*' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '3' })
    ctx = await c(ctx.aggregate, 'PressEquals', {})
    ctx = await c(ctx.aggregate, 'PressEquals', {})
    ctx = await c(ctx.aggregate, 'PressEquals', {})
  
    ctx.aggregate.result.should.equal(567)
  })

  it('should compute 1.5+2.0-11.22+.33=-7.39', async () => {
    let ctx
    ctx = await bus.command(actor1, 'PressDigit', { digit: '1', aggregateId: 'c4' })
    ctx = await c(ctx.aggregate, 'PressDot', {})
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '5'})    
    ctx = await c(ctx.aggregate, 'PressOperator', { operator: '+' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '2'})
    ctx = await c(ctx.aggregate, 'PressDot', {})
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '0'})    
    ctx = await c(ctx.aggregate, 'PressOperator', { operator: '-' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '1'})
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '1'})
    ctx = await c(ctx.aggregate, 'PressDot', {})
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '2'})
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '2'})
    ctx = await c(ctx.aggregate, 'PressOperator', { operator: '+' })
    ctx = await c(ctx.aggregate, 'PressDot', {})
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '3' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '3' })
    ctx = await c(ctx.aggregate, 'PressEquals', {})
  
    ctx.aggregate.result.toFixed(2).should.equal('-7.39')
  })

  it('should compute 5.23/.33*2=31.6969696969697', async () => {
    let ctx
    ctx = await bus.command(actor1, 'PressDigit', { digit: '5', aggregateId: 'c5' })
    ctx = await c(ctx.aggregate, 'PressDot', {})
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '2'})
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '3'})   
    ctx = await c(ctx.aggregate, 'PressOperator', { operator: '/' })
    ctx = await c(ctx.aggregate, 'PressDot', {})
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '3' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '3' })
    ctx = await c(ctx.aggregate, 'PressOperator', { operator: '*' })
    ctx = await c(ctx.aggregate, 'PressDigit', { digit: '2'})
    ctx = await c(ctx.aggregate, 'PressEquals', {})
  
    ctx.aggregate.result.should.equal(31.6969696969697)

    console.log(JSON.stringify(tracer.stats))
  })
})
