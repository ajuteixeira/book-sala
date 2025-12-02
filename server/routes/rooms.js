const express = require('express');
const router = express.Router();
const { Room } = require('../models');
const { authMiddleware, adminOnly } = require('../middlewares/auth');

router.get('/', authMiddleware, async (req, res) => {
  const rooms = await Room.findAll();
  res.json(rooms);
});

// admin can create rooms
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { name, capacity, description } = req.body;
  const room = await Room.create({ name, capacity, description });
  res.json(room);
});

module.exports = router;
