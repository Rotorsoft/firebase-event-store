'use strict'

module.exports = class PromiseQueue {
  constructor () {
    this.queue = Promise.resolve()
  }

  async push (generator, args) {
    this.queue = this.queue.then(() => generator(args))
    return await this.queue
  }
  
  async flush () {
    await new Promise(resolve => setImmediate(async () => {
      await this.queue
      resolve()
    }))
  }
}