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
  try {
    // Marcar reservas passadas como concluídas automaticamente
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM

    // Encontrar todas as reservas ativas que já passaram
    const pastReservations = await Reservation.findAll({
      where: {
        status: 'ativa',
        [Op.or]: [
          { date: { [Op.lt]: todayStr } }, // Data passada
          {
            [Op.and]: [
              { date: todayStr },
              { endTime: { [Op.lte]: currentTime } }, // Mesmo dia mas horário passou
            ],
          },
        ],
      },
    });

    // Marcar como concluídas
    for (const res of pastReservations) {
      res.status = 'concluída';
      await res.save();
    }

    const where = {};
    if (req.user.role !== 'admin') {
      where.userId = req.user.id;
    }
    // Only active reservations
    where.status = 'ativa';
    const reservations = await Reservation.findAll({
      where,
      include: [
        { model: Room },
        { model: User, attributes: ['matricula', 'name', 'role'] },
      ],
      order: [
        ['date', 'ASC'],
        ['startTime', 'ASC'],
      ],
    });
    res.json(reservations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

// Get history (past reservations)
router.get('/history', authMiddleware, async (req, res) => {
  try {
    // Marcar reservas passadas como concluídas automaticamente
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM

    // Encontrar todas as reservas ativas que já passaram
    const pastReservations = await Reservation.findAll({
      where: {
        status: 'ativa',
        [Op.or]: [
          { date: { [Op.lt]: todayStr } }, // Data passada
          {
            [Op.and]: [
              { date: todayStr },
              { endTime: { [Op.lte]: currentTime } }, // Mesmo dia mas horário passou
            ],
          },
        ],
      },
    });

    // Marcar como concluídas
    for (const res of pastReservations) {
      res.status = 'concluída';
      await res.save();
    }

    const where = {};
    if (req.user.role !== 'admin') {
      where.userId = req.user.id;
    }
    // Only completed or cancelled reservations
    where.status = { [Op.in]: ['concluída', 'cancelada'] };

    // Paginação
    const page = parseInt(req.query.page) || 1;
    const limit = 3; // 3 reservas por página
    const offset = (page - 1) * limit;

    const { count, rows } = await Reservation.findAndCountAll({
      where,
      include: [
        { model: Room },
        { model: User, attributes: ['matricula', 'name', 'role'] },
      ],
      order: [
        ['date', 'DESC'],
        ['startTime', 'DESC'],
      ],
      limit,
      offset,
    });

    const totalPages = Math.ceil(count / limit);
    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
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

    // Validate times (start/end) - basic format check
    const startMin = parseTimeToMinutes(startTime);
    const endMin = parseTimeToMinutes(endTime);
    if (startMin === null || endMin === null) {
      return res.status(400).json({ error: 'Horário inválido.' });
    }
    // minutes must be multiples of 15
    const startMinPart = parseInt(startTime.split(':')[1], 10);
    const endMinPart = parseInt(endTime.split(':')[1], 10);
    if (startMinPart % 15 !== 0 || endMinPart % 15 !== 0) {
      return res
        .status(400)
        .json({ error: 'Minutos devem ser múltiplos de 15 (ex: 00,15,30,45)' });
    }
    if (startMin > endMin) {
      return res.status(400).json({ error: 'Hora de término inválida.' });
    }
    if (endMin - startMin < 15) {
      return res
        .status(400)
        .json({ error: 'Tempo mínimo da reserva é 15 minutos.' });
    }

    // Note: Date, time range, and same-day validation are done client-side during search
    // Only check for room conflicts here

    // Rule 1: Check if user is not admin and already has 3 active reservations
    if (req.user.role !== 'admin') {
      const count = await Reservation.count({
        where: { userId: req.user.id, status: 'ativa' },
      });
      if (count >= 3)
        return res
          .status(400)
          .json({ error: 'Limite de 3 reservas por usuário atingido.' });
    }

    // Rule 2: check for conflicts in same room and overlapping times (only active reservations)
    const conflicts = await Reservation.findOne({
      where: {
        roomId,
        date,
        status: 'ativa',
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

// Cancel reservation: user can cancel their own; admin can cancel any
router.delete('/:id', authMiddleware, async (req, res) => {
  const id = req.params.id;
  const reservation = await Reservation.findByPk(id);
  if (!reservation) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'admin' && reservation.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // Mark as cancelled instead of deleting
  reservation.status = 'cancelada';
  await reservation.save();
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
      // Note: Date, time range, and same-day validation are done client-side during search
      // Only check for room conflicts here
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
    // minutes must be multiples of 15
    const checkStartMinPart = parseInt(checkStart.split(':')[1], 10);
    const checkEndMinPart = parseInt(checkEnd.split(':')[1], 10);
    if (checkStartMinPart % 15 !== 0 || checkEndMinPart % 15 !== 0) {
      return res
        .status(400)
        .json({ error: 'Minutos devem ser múltiplos de 15 (ex: 00,15,30,45)' });
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
      return res.status(400).json({
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

// Mark past reservations as completed (can be called periodically)
router.post('/complete-past', authMiddleware, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    // Find all active reservations with date before today
    const pastReservations = await Reservation.findAll({
      where: {
        status: 'ativa',
        date: { [Op.lt]: todayStr },
      },
    });

    // Mark them as completed
    for (const res of pastReservations) {
      res.status = 'concluída';
      await res.save();
    }

    res.json({ completed: pastReservations.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;
