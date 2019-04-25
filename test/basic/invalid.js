const { Aggregate, IEventHandler, Err } = require('../../index')

class InvalidAggregate extends Aggregate {
  constructor() {
    super()
  }

  static get path () { return '/invalids' }
  
  get commands () { 
    return { 
      InvalidCommand: async () => {},
      InvalidCommand3: async (actor, _) => {
        if (_.a <= _.b) throw Err.precondition('a must be greater than b')
      }
    } 
  }
}

class InvalidAggregate2 extends Aggregate {
  constructor() {
    super()
  }

  get commands () { 
    return { 
      InvalidCommand: async () => {}
    }
  }
}

class InvalidHandler extends IEventHandler {
  constructor() {
    super()
  }
}

module.exports = {
  InvalidAggregate,
  InvalidAggregate2,
  InvalidHandler
}
