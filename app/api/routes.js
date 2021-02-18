/* eslint require-atomic-updates: 0 */
const phoneNumberService = require('../registrar/phoneNumber')
const channelRegistrar = require('../registrar/channel')
const { get, find, merge } = require('lodash')
const {
  twilio: { smsEndpoint },
} = require('../config')
const app = require('../index')

const routesOf = async router => {
  router.get('/hello', async ctx => {
    ctx.body = { msg: 'hello world' }
  })

  router.get('/metrics', async ctx => {
    ctx.body = app.metrics.register.metrics()
  })

  router.get('/channels', async ctx => {
    const result = await channelRegistrar.list()
    merge(ctx, { status: httpStatusOf(get(result, 'status')), body: result.data })
  })

  router.post('/channels', async ctx => {
    const { phoneNumber, admins } = ctx.request.body
    const result = await channelRegistrar.create(admins, phoneNumber)
    merge(ctx, { status: httpStatusOf(get(result, 'status')), body: result })
  })

  router.post('/channels/admins', async ctx => {
    const { channelPhoneNumber, adminPhoneNumber } = ctx.request.body
    const result = await channelRegistrar.addAdmin({
      channelPhoneNumber,
      adminPhoneNumber,
    })
    merge(ctx, { status: httpStatusOf(get(result, 'status')), body: result })
  })

  router.get('/phoneNumbers', async ctx => {
    const filter = phoneNumberService.filters[ctx.query.filter] || null
    const phoneNumberList = await phoneNumberService.list(filter)
    merge(ctx, { status: httpStatusOf(phoneNumberList.status), body: phoneNumberList.data })
  })

  router.post('/phoneNumbers', async ctx => {
    const { num, areaCode } = ctx.request.body
    const n = parseInt(num) || 1

    const phoneNumberStatuses = await phoneNumberService.provisionN({ areaCode, n })
    merge(ctx, { status: httpStatusOfMany(phoneNumberStatuses), body: phoneNumberStatuses })
  })

  router.post('/phoneNumbers/register', async ctx => {
    const { phoneNumber, captchaToken } = ctx.request.body
    const { status, error } = await phoneNumberService.register(phoneNumber, captchaToken)
    merge(ctx, {
      status: httpStatusOf(status),
      body: { status, phoneNumber, ...(error ? { error } : {}) },
    })
  })

  router.delete('/phoneNumbers', async ctx => {
    const { phoneNumbers } = ctx.request.body
    const result = await phoneNumberService.requestToDestroy(phoneNumbers.split(','))
    merge(ctx, { status: httpStatusOfMany(result), body: result })
  })

  router.post(`/${smsEndpoint}`, async ctx => {
    const { To: phoneNumber, Body: smsBody, From: senderPhoneNumber } = ctx.request.body
    const { status, message } = await phoneNumberService.handleSms({
      phoneNumber,
      senderPhoneNumber,
      message: smsBody,
    })
    const header = { 'content-type': 'text/xml' }
    merge(ctx, { status: httpStatusOf(status), body: message, header })
  })
}

// HELPERS

const httpStatusOf = status => (status === phoneNumberService.statuses.ERROR ? 500 : 200)
const httpStatusOfMany = pnStatuses =>
  find(pnStatuses, pns => pns.status === phoneNumberService.statuses.ERROR) ? 500 : 200

module.exports = routesOf
