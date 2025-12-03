const express = require('express');
const router = express.Router();
const { Reservation, Room, User } = require('../models');
const { authMiddleware, adminOnly } = require('../middlewares/auth');
const { Op } = require('sequelize');

const parseTimeToMinutes = (t) => {
  if (!t) return null;
  const parts = t.split(':');
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

// Library opening hours (returns {open: 'HH:MM', close: 'HH:MM'} or null if closed)
const getOpeningHours = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay(); // 0 = Sunday, 1 = Monday, ...
  // Sunday closed
  if (dow === 0) return null;
  // Saturday 08:00 - 13:55
  if (dow === 6) return { open: '08:00', close: '13:55' };
  // Mon,Tue,Wed,Thu,Fri => 07:00 - 21:55
  return { open: '07:00', close: '21:55' };
};

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
    include: [
      { model: Room },
      { model: User, attributes: ['matricula', 'name'] },
    ],
    order: [
      ['date', 'ASC'],
      ['startTime', 'ASC'],
    ],
  });
  res.json(reservations);
});

// Create a reservation
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { roomId, date, startTime, endTime, title, notes, quantity, reason } =
      req.body;
    if (!roomId || !date || !startTime || !endTime || !quantity || !reason) {
      return res.status(400).json({
        error: 'roomId, date, startTime, endTime, quantity and reason required',
      });
    }

    // Validate date is not in the past and within 30 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const requested = new Date(date + 'T00:00:00');
    requested.setHours(0, 0, 0, 0);
    if (requested < today) {
      return res.status(400).json({
        error: 'Selecione uma data válida.',
      });
    }
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 30);
    if (requested > maxDate) {
      return res
        .status(400)
        .json({ error: 'Você só pode fazer reservas até 30 dias no futuro.' });
    }

    // Validate times (start/end)
    const startMin = parseTimeToMinutes(startTime);
    const endMin = parseTimeToMinutes(endTime);
    if (startMin === null || endMin === null) {
      return res.status(400).json({ error: 'Horário inválido.' });
    }
    if (startMin > endMin) {
      return res.status(400).json({ error: 'Hora de término inválida.' });
    }
    if (endMin - startMin < 15) {
      return res
        .status(400)
        .json({ error: 'Tempo mínimo da reserva é 15 minutos.' });
    }

    // check opening hours for this date
    const hours = getOpeningHours(date);
    if (!hours) {
      return res
        .status(400)
        .json({ error: 'Biblioteca fechada nesse dia. Selecione outra data.' });
    }
    const openMin = parseTimeToMinutes(hours.open);
    const closeMin = parseTimeToMinutes(hours.close);
    if (startMin < openMin || endMin > closeMin) {
      return res.status(400).json({
        error: `Horário fora do horário de funcionamento: ${hours.open}–${hours.close}.`,
      });
    }

    // Rule 1: Check if user already has a reservation on the same date
    const sameDay = await Reservation.findOne({
      where: {
        userId: req.user.id,
        date,
      },
    });
    if (sameDay)
      return res
        .status(400)
        .json({ error: 'Você já possui uma reserva para este dia.' });

    // Rule 2: Check if user is not admin and already has 3 reservations
    if (req.user.role !== 'admin') {
      const count = await Reservation.count({
        where: { userId: req.user.id },
      });
      if (count >= 3)
        return res
          .status(400)
          .json({ error: 'Limite de 3 reservas por usuário atingido.' });
    }

    // check for conflicts in same room and overlapping times
    const conflicts = await Reservation.findOne({
      where: {
        roomId,
        date,
        [Op.or]: [
          {
            startTime: { [Op.between]: [startTime, endTime] },
          },
          {
            endTime: { [Op.between]: [startTime, endTime] },
          },
          {
            startTime: { [Op.lte]: startTime },
            endTime: { [Op.gte]: endTime },
          },
        ],
      },
    });
    if (conflicts)
      return res
        .status(400)
        .json({ error: 'Conflicting reservation exists for this room/time' });

    const reservation = await Reservation.create({
      roomId,
      date,
      startTime,
      endTime,
      title,
      notes,
      quantity,
      reason,
      userId: req.user.id,
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

// Edit a reservation (admin or owner)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const reservation = await Reservation.findByPk(id);
    if (!reservation) return res.status(404).json({ error: 'Not found' });

    // allow admin or the owner of the reservation
    if (req.user.role !== 'admin' && reservation.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { roomId, date, startTime, endTime, title, notes, quantity, reason } =
      req.body;

    // Validate date constraints if date provided
    if (date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newDate = new Date(date + 'T00:00:00');
      newDate.setHours(0, 0, 0, 0);

      if (newDate < today) {
        return res.status(400).json({
          error:
            'Selecione uma data válida. Não é possível reservar para o passado.',
        });
      }

      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + 30);
      if (newDate > maxDate) {
        return res.status(400).json({
          error: 'Você só pode fazer reservas até 30 dias no futuro.',
        });
      }

      // Rule: user cannot have another reservation on the same date (exclude current reservation)
      const existingSameDay = await Reservation.findOne({
        where: {
          userId: reservation.userId,
          date,
          id: { [Op.ne]: reservation.id },
        },
      });
      if (existingSameDay) {
        return res.status(400).json({
          error:
            'Você já possui uma reserva para este dia. Selecione outro dia.',
        });
      }
    }

    // If changing room/time/date, check for conflicts with other reservations for that room
    const checkRoomId = roomId ?? reservation.roomId;
    const checkDate = date ?? reservation.date;
    const checkStart = startTime ?? reservation.startTime;
    const checkEnd = endTime ?? reservation.endTime;

    // Validate times for the updated values
    const checkStartMin = parseTimeToMinutes(checkStart);
    const checkEndMin = parseTimeToMinutes(checkEnd);
    if (checkStartMin === null || checkEndMin === null) {
      return res.status(400).json({ error: 'Horário inválido.' });
    }
    if (checkStartMin > checkEndMin) {
      return res.status(400).json({ error: 'Hora de término inválida.' });
    }
    if (checkEndMin - checkStartMin < 15) {
      return res
        .status(400)
        .json({ error: 'Tempo mínimo da reserva é 15 minutos.' });
    }

    const conflicts = await Reservation.findOne({
      where: {
        roomId: checkRoomId,
        date: checkDate,
        id: { [Op.ne]: reservation.id },
        [Op.or]: [
          { startTime: { [Op.between]: [checkStart, checkEnd] } },
          { endTime: { [Op.between]: [checkStart, checkEnd] } },
          {
            startTime: { [Op.lte]: checkStart },
            endTime: { [Op.gte]: checkEnd },
          },
        ],
      },
    });
    if (conflicts)
      return res.status(400).json({
        error: 'Já existe uma reserva conflitante para essa sala/horário.',
      });

    // check opening hours for updated date
    const hours2 = getOpeningHours(checkDate);
    if (!hours2) {
      return res
        .status(400)
        .json({ error: 'Biblioteca fechada nesse dia. Selecione outra data.' });
    }
    const openMin2 = parseTimeToMinutes(hours2.open);
    const closeMin2 = parseTimeToMinutes(hours2.close);
    if (checkStartMin < openMin2 || checkEndMin > closeMin2) {
      return res
        .status(400)
        .json({
          error: `Horário fora do horário de funcionamento: ${hours2.open}–${hours2.close}.`,
        });
    }

    // apply updates
    reservation.roomId = checkRoomId ?? reservation.roomId;
    reservation.date = date ?? reservation.date;
    reservation.startTime = checkStart ?? reservation.startTime;
    reservation.endTime = checkEnd ?? reservation.endTime;
    reservation.title = title ?? reservation.title;
    reservation.notes = notes ?? reservation.notes;
    if (quantity !== undefined) reservation.quantity = quantity;
    if (reason !== undefined) reservation.reason = reason;

    await reservation.save();
    res.json(reservation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;
