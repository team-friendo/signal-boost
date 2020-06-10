const { prometheus, registry, register, collectDefaults } = require('../metrics_module')()

module.exports = {
  registry,
  collectDefaults
}
