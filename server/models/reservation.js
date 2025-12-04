const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Reservation = sequelize.define(
    'Reservation',
    {
      date: { type: DataTypes.DATEONLY, allowNull: false },
      startTime: { type: DataTypes.TIME, allowNull: false },
      endTime: { type: DataTypes.TIME, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      reason: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Outro',
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'ativa',
        validate: {
          isIn: [['ativa', 'concluída', 'cancelada']],
        },
      },
    },
    {
      tableName: 'Reservations',
    }
  );
  return Reservation;
};
