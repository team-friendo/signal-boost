const { initDb, getDbConnection } = require('./db')
const { logger, wait } = require('./services/util')
const socket = require('./services/socket')
// TODO: move dispatcher/run, registrar/run to dispatcher/index, registrar/index
const dispatcher = require('./services/dispatcher/run')
const registrar = require('./services/registrar/run')

let db, sock

const run = async () => {
  logger.log('> Initializing Signalboost...')
  
  // INITIALIZE RESOURCES
  logger.log('Getting database connection...')
  db = initDb()
  await getDbConnection(db).catch(logger.fatalError)
  logger.log('Got database connection!')

  logger.log('Connecting to signald socket...')
  sock = await socket.getSocket().catch(logger.fatalError)
  logger.log('Connected to signald socket!')
  
  // START SERVICES
  await wait(500)
  await registrar.run(db, sock)
  await dispatcher.run()

  logger.log('> Signalboost running!')
}

module.exports = { run, db, sock }
