import { connect } from 'node:net'

export function connectOnce (port) {
  return new Promise(done => {
    const socket = connect(port, '127.0.0.1', () => done(socket))
    socket.on('error', () => done(null))
  })
}

export class MarionetteClient {
  constructor (socket) {
    this.socket = socket
    this.buffer = Buffer.alloc(0)
    this.inbox = []
    this.waiters = []
    this.count = 0
    this.closed = false
    socket.on('data', chunk => {
      this.buffer = Buffer.concat([this.buffer, chunk])
      this.parse()
    })
    socket.on('close', () => {
      this.closed = true
      for (const waiter of this.waiters.splice(0)) waiter.reject(new Error('Marionette connection closed'))
    })
    socket.on('error', () => {})
  }

  parse () {
    for (;;) {
      const colon = this.buffer.indexOf(':')
      if (colon < 0) return
      const end = colon + 1 + Number(this.buffer.subarray(0, colon).toString())
      if (this.buffer.length < end) return
      const message = JSON.parse(this.buffer.subarray(colon + 1, end).toString('utf8'))
      this.buffer = this.buffer.subarray(end)
      const waiter = this.waiters.shift()
      if (waiter) waiter.resolve(message)
      else this.inbox.push(message)
    }
  }

  next () {
    if (this.inbox.length) return Promise.resolve(this.inbox.shift())
    if (this.closed) return Promise.reject(new Error('Marionette connection closed'))
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }))
  }

  async send (command, params = {}) {
    const body = JSON.stringify([0, ++this.count, command, params])
    this.socket.write(`${Buffer.byteLength(body)}:${body}`)
    const [, , error, result] = await this.next()
    if (error) throw new Error(`${command}: ${error.message}`)
    return result
  }

  async handshake () {
    return this.next()
  }

  close () {
    this.socket.destroy()
  }
}
