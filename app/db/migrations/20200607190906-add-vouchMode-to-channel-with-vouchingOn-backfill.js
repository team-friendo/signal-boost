'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {

    // create new vouchMode column with values ('ON', 'OFF', 'ADMIN')
    await queryInterface.addColumn('channels', 'vouchMode', {
      type: Sequelize.ENUM,
      values: ['ON', 'OFF', 'ADMIN'],
      defaultValue: 'OFF',
      allowNull: false,
    })
    
    // map old boolean true/false values to 'ON'/'OFF'
    await queryInterface.sequelize.query(`
      update channels 
      set "vouchMode" = 'ON' where "vouchingOn" = true
    `)
    await queryInterface.sequelize.query(`
      update channels 
      set "vouchMode" = 'OFF' where "vouchingOn" = false
    `)
    
    // remove vouchingOn column
    await queryInterface.removeColumn('channels', 'vouchingOn')

    return Promise.resolve()
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('channels', 'vouchingOn', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    })

    await queryInterface.sequelize.query(`
      update channels 
      set "vouchingOn" = true where "vouchMode" = 'ON' 
    `)
    
    await queryInterface.sequelize.query(`
      update channels 
      set "vouchingOn" = false where "vouchMode" = 'OFF'
    `)

    await queryInterface.removeColumn('channels', 'vouchMode')
    
    // postgres doesn't automatically remove enum types when removing columns
    await queryInterface.sequelize.query(`DROP TYPE "enum_channels_vouchMode"`)

    return Promise.resolve()
  }
};
