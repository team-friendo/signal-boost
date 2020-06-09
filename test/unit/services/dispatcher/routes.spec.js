import { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import sinon from 'sinon'
import request from 'supertest'
import { Registry } from 'prom-client'
import { startServer } from '../../../../app/services/dispatcher/api'

describe("dispatcher routes", () => {

  let server
  before(async () => (server = (await startServer(200)).server))
  after(() => server.close())

  describe('GET /metrics', () => {
    it("returns 200", async () => {
      await request(server)
        .get('/metrics')
        .expect(200)
    })
  })
})
