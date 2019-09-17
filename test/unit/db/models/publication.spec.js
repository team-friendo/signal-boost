import { expect } from 'chai'
import { describe, it, test, before, after } from 'mocha'
import { keys } from 'lodash'
import { initDb } from '../../../../app/db/index'
import { publicationFactory } from '../../../support/factories/publication'
import { channelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { defaultLanguage } from '../../../../app/config'

describe('publication model', () => {
  let db, publication

  before(async () => {
    db = initDb()
  })

  after(async () => {
    await db.publication.destroy({ where: {} })
    await db.channel.destroy({ where: {} })
    await db.sequelize.close()
  })

  test('fields', async () => {
    publication = await db.publication.create(publicationFactory())
    expect(keys(publication.get())).to.have.members([
      'id',
      'channelPhoneNumber',
      'publisherPhoneNumber',
      'language',
      'createdAt',
      'updatedAt',
    ])
  })

  describe('defaults', () => {
    it('sets language to DEFAULT_LANGUAGE if none provided', async () => {
      const sub = await db.publication.create(publicationFactory({ language: undefined }))
      expect(sub.language).to.eql(defaultLanguage)
    })
  })

  describe('associations', () => {
    before(async () => {
      const channel = await db.channel.create(channelFactory())
      publication = await db.publication.create({
        publisherPhoneNumber: genPhoneNumber(),
        channelPhoneNumber: channel.phoneNumber,
      })
    })

    it('belongs to a channel', async () => {
      expect(await publication.getChannel()).to.be.an('object')
    })
  })
})
