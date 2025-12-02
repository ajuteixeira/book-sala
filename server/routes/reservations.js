const express = require('express');
const router = express.Router();
const { Reservation, Room, User } = require('../models');
const { authMiddleware, adminOnly } = require('../middlewares/auth');
const { Op } = require('sequelize');

// List reservations
// - admin: all reservations
// - user: only own reservations
router.get('/', authMiddleware, async (req, res) => {
  const where = {};
  if (req.user.role !== 'admin') {
    where.userId = req.user.id;
  }
  const reservations = await Reservation.findAll({
    where,
    include: [{ model: Room }, { model: User, attributes: ['matricula','name'] }],
    order: [['date','ASC'], ['startTime','ASC']]
  });
  res.json(reservations);
});

// Create a reservation
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { roomId, date, startTime, endTime, title, notes } = req.body;
    if (!roomId || !date || !startTime || !endTime) return res.status(400).json({ error: 'roomId, date, startTime and endTime required' });

    // check for conflicts in same room and overlapping times
    const conflicts = await Reservation.findOne({
      where: {
        roomId,
        date,
        [Op.or]: [
          {
            startTime: { [Op.between]: [startTime, endTime] }
          },
          {
            endTime: { [Op.between]: [startTime, endTime] }
          },
          {
            startTime: { [Op.lte]: startTime },
            endTime: { [Op.gte]: endTime }
          }
        ]
      }
    });
    if (conflicts) return res.status(400).json({ error: 'Conflicting reservation exists for this room/time' });

    const reservation = await Reservation.create({
      roomId, date, startTime, endTime, title, notes, userId: req.user.id
    });
    res.json(reservation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

// Cancel (delete) reservation: user can delete their own; admin can delete any
router.delete('/:id', authMiddleware, async (req, res) => {
  const id = req.params.id;
  const reservation = await Reservation.findByPk(id);
  if (!reservation) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'admin' && reservation.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await reservation.destroy();
  res.json({ success: true });
});

// admin edit a reservation
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const id = req.params.id;
  const reservation = await Reservation.findByPk(id);
  if (!reservation) return res.status(404).json({ error: 'Not found' });
  const { roomId, date, startTime, endTime, title, notes } = req.body;
  reservation.roomId = roomId ?? reservation.roomId;
  reservation.date = date ?? reservation.date;
  reservation.startTime = startTime ?? reservation.startTime;
  reservation.endTime = endTime ?? reservation.endTime;
  reservation.title = title ?? reservation.title;
  reservation.notes = notes ?? reservation.notes;
  await reservation.save();
  res.json(reservation);
});

module.exports = router;
