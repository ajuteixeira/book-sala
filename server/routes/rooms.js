const express = require('express');
const router = express.Router();
const { Room, Reservation } = require('../models');
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

const getOpeningHours = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  if (dow === 0) return null; // Sunday closed
  if (dow === 6) return { open: '08:00', close: '13:55' }; // Saturday
  return { open: '07:00', close: '21:55' };
};

router.get('/', authMiddleware, async (req, res) => {
  const rooms = await Room.findAll();
  res.json(rooms);
});

// Return available rooms for a given date and time interval
// Query params: date, startTime, endTime, quantity
router.get('/available', authMiddleware, async (req, res) => {
  try {
    const { date, startTime, endTime, quantity } = req.query;
    if (!date || !startTime || !endTime)
      return res
        .status(400)
        .json({ error: 'date, startTime and endTime required' });

    // Validate quantity if provided
    const requestedQuantity = quantity ? parseInt(quantity, 10) : null;
    if (
      requestedQuantity &&
      (requestedQuantity < 1 || requestedQuantity > 1000)
    ) {
      return res.status(400).json({ error: 'Quantidade de pessoas inválida.' });
    }

    // validate date is not in the past and within 30 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const requested = new Date(date + 'T00:00:00');
    requested.setHours(0, 0, 0, 0);
    if (requested < today) {
      return res.status(400).json({
        error:
          'Selecione uma data válida. Não é possível buscar salas para o passado.',
      });
    }
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 30);
    if (requested > maxDate) {
      return res
        .status(400)
        .json({ error: 'Você só pode buscar salas até 30 dias no futuro.' });
    }

    // Validate times (start/end)
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

    // Check if user already has an ACTIVE or COMPLETED reservation on that date
    // (Only for non-admin users)
    if (req.user.role !== 'admin') {
      const existing = await Reservation.findOne({
        where: {
          userId: req.user.id,
          date,
          status: { [Op.in]: ['ativa', 'concluída'] },
        },
      });
      if (existing) {
        const message =
          existing.status === 'concluída'
            ? 'Você já possui uma reserva concluída para este dia.'
            : 'Você já possui uma reserva para este dia. Selecione outro dia.';
        return res.status(400).json({ error: message });
      }
    }

    // check opening hours
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

    // find reservations that overlap with requested interval on that date
    const conflicts = await Reservation.findAll({
      where: {
        date,
        [Op.or]: [
          { startTime: { [Op.between]: [startTime, endTime] } },
          { endTime: { [Op.between]: [startTime, endTime] } },
          {
            startTime: { [Op.lte]: startTime },
            endTime: { [Op.gte]: endTime },
          },
        ],
      },
    });

    const occupied = new Set(conflicts.map((c) => c.roomId));
    const rooms = await Room.findAll();
    let available = rooms.filter((r) => !occupied.has(r.id));

    // Filter by capacity if quantity was provided
    if (requestedQuantity) {
      available = available.filter((r) => r.capacity >= requestedQuantity);
    }

    res.json(available);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

// admin can create rooms
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { name, capacity, description } = req.body;
  const room = await Room.create({ name, capacity, description });
  res.json(room);
});

module.exports = router;
