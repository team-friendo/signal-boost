const { initDb, getDbConnection } = require('./db')
const { logger, wait } = require('./services/util')
const signal = require('./services/signal')
// TODO: move dispatcher/run, registrar/run to dispatcher/index, registrar/index
const dispatcher = require('./services/dispatcher/run')
const registrar = require('./services/registrar/run')

const run = async () => {
  logger.log('> Initializing Signalboost...')

  logger.log('Getting database connection...')
  const db = initDb()
  await getDbConnection(db).catch(logger.fatalError)
  logger.log('Got database connection!')

  logger.log('Connecting to signald socket...')
  const sock = await signal.getSocket().catch(logger.fatalError)
  logger.log('Connected to signald socket!')
  sock.close() // close and switch to the pool

  await wait(500)
  await registrar.run(db, signal.pool)
  await dispatcher.run(db, signal.pool)

  logger.log('> Signalboost running!')
}

module.exports = { run }
