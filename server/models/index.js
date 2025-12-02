const { Sequelize } = require('sequelize');
const path = require('path');
const DATABASE_URL = process.env.DATABASE_URL || '';
let sequelize;

if (DATABASE_URL) {
  // expects postgres style URL
  sequelize = new Sequelize(DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: false,
  });
} else {
  // fallback to sqlite for easy local tests
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database.sqlite'),
    logging: false,
  });
}

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// models
db.User = require('./user')(sequelize);
db.Room = require('./room')(sequelize);
db.Reservation = require('./reservation')(sequelize);

// associations
db.User.hasMany(db.Reservation, { foreignKey: 'userId' });
db.Reservation.belongsTo(db.User, { foreignKey: 'userId' });

db.Room.hasMany(db.Reservation, { foreignKey: 'roomId' });
db.Reservation.belongsTo(db.Room, { foreignKey: 'roomId' });

module.exports = db;
