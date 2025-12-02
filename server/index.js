require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const reservationRoutes = require('./routes/reservations');
const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/reservations', reservationRoutes);

const PORT = process.env.PORT || 4000;

(async () => {
  try {
    await sequelize.authenticate();
    console.log('DB Connected.');
    // Sync models (development convenience). In production, use migrations.
    await sequelize.sync({ alter: true });
    app.listen(PORT, () => console.log('Server running on port', PORT));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
