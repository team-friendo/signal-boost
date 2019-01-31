const { isPhoneNumber } = require('../validations')

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
    },
  })

  channel.associate = db => {
    channel.hasMany(db.administration, {
      hooks: true,
      onDelete: 'cascade',
    })
    channel.hasMany(db.subscription, {
      hooks: true,
      onDelete: 'cascade',
    })
  }

  return channel
}

module.exports = { channelOf }