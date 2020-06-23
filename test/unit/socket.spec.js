import { expect } from 'chai'
import { afterEach, beforeEach, describe, it } from 'mocha'
import sinon from 'sinon'
import fs from 'fs-extra'
import net from 'net'
import app from '../../app'
import testApp from '../support/testApp'
import { wait } from '../../app/util'
import { EventEmitter } from 'events'
import socket, { socketPoolOf } from '../../app/socket'

const {
  socket: { poolSize },
} = require('../../app/config')

describe('socket module', () => {
  const sock = new EventEmitter()
  sock.setEncoding = () => null

  afterEach(() => sinon.restore())

  describe('creating a socket pool', () => {
    it('creates a fixed-size pool with a stop method', async () => {
      const create = sinon.stub()
      const destroy = sinon.stub()
      const pool = await socket.socketPoolOf({ create, destroy })

      expect(create.callCount).to.eql(poolSize)
      expect(pool.size).to.eql(poolSize)
      expect(pool.max).to.eql(poolSize)
      expect(pool.min).to.eql(poolSize)
      expect(pool.stop).to.be.a('function')
    })
  })

  describe('getting a socket', () => {
    let pathExistsStub, connectStub

    beforeEach(() => {
      pathExistsStub = sinon.stub(fs, 'pathExists')
      connectStub = sinon.stub(net, 'createConnection').returns(sock)
    })

    describe('when socket is eventually available', () => {
      let result
      beforeEach(async () => {
        pathExistsStub.onCall(0).returns(Promise.resolve(false))
        pathExistsStub.onCall(1).returns(Promise.resolve(false))
        pathExistsStub.onCall(2).callsFake(() => {
          wait(5).then(() => sock.emit('connect', sock))
          return Promise.resolve(true)
        })
        result = await socket.getSocketConnection()
      })

      it('looks for a socket descriptor at an interval', async () => {
        expect(pathExistsStub.callCount).to.eql(3)
      })

      it('connects to socket once it exists', () => {
        expect(connectStub.callCount).to.eql(1)
      })

      it('returns the connected socket', () => {
        expect(result).to.eql(sock)
      })
    })

    describe('when connection is never available', () => {
      beforeEach(() => pathExistsStub.returns(Promise.resolve(false)))

      it('attempts to connect a finite number of times then rejects', async () => {
        const result = await socket.getSocketConnection().catch(a => a)
        expect(pathExistsStub.callCount).to.be.above(10)
        expect(connectStub.callCount).to.eql(0)
        expect(result.message).to.eql('Maximum signald connection attempts exceeded.')
      })
    })
  })

  describe('writing to a socket', () => {
    let writeStub, acquireSpy, releaseSpy

    beforeEach(async () => {
      writeStub = sinon.stub().callsFake((data, cb) => cb(null, true))
      await app.run({
        ...testApp,
        socketPool: {
          run: () =>
            Promise.resolve(
              socketPoolOf({
                create: () => Promise.resolve({ write: writeStub }),
                destroy: () => Promise.resolve(),
              }),
            ),
        },
      })
      acquireSpy = sinon.spy(app.socketPool, 'acquire')
      releaseSpy = sinon.spy(app.socketPool, 'release')
    })

    it('acquires a socket from the pool, writes a signald-encoded message to it and releases it', async () => {
      await socket.write({ foo: 'bar' })
      expect(acquireSpy.callCount).to.eql(1)
      expect(writeStub.getCall(0).args[0]).to.eql('{"foo":"bar"}\n')
      expect(releaseSpy.callCount).to.eql(1)
    })
  })
})
