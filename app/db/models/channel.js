const { isPhoneNumber } = require('../validations')
const {
  signal: { defaultMessageExpiryTime },
} = require('../../config')

const channelOf = (sequelize, DataTypes) => {
  const channel = sequelize.define('channel', {
    phoneNumber: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true,
      validate: isPhoneNumber,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '',
    },
    messageExpiryTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: defaultMessageExpiryTime,
    },
    hotlineOn: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
    },
    vouchMode: {
      type: DataTypes.ENUM,
      values: ['ON', 'OFF', 'ADMIN'],
      defaultValue: 'OFF',
      allowNull: false,
    },
    vouchLevel: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    socketId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  })

  const associationDefaults = {
    hooks: true,
    onDelete: 'cascade',
  }

  channel.associate = db => {
    channel.hasMany(db.deauthorization, associationDefaults)
    channel.hasMany(db.hotlineMessage, associationDefaults)
    channel.hasMany(db.invite, associationDefaults)
    channel.hasMany(db.membership, associationDefaults)
    channel.hasOne(db.messageCount, associationDefaults)
    channel.hasOne(db.recycleRequest, associationDefaults)
  }

  return channel
}

module.exports = { channelOf }
