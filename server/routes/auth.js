const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

// helper validations
function isNumeric(str) {
  return /^\d+$/.test(str);
}

router.post('/register', async (req, res) => {
  try {
    const { matricula, password, name, role } = req.body;
    if (!matricula || !password)
      return res.status(400).json({ error: 'matricula and password required' });

    // role default user
    const r = role === 'admin' ? 'admin' : 'user';

    // validations: user matricula 7 digits, admin 9 digits
    if (r === 'user' && !(isNumeric(matricula) && matricula.length === 7)) {
      return res
        .status(400)
        .json({ error: 'matricula of user must be exactly 7 numeric digits' });
    }
    if (r === 'admin' && !(isNumeric(matricula) && matricula.length === 9)) {
      return res
        .status(400)
        .json({ error: 'matricula of admin must be exactly 9 numeric digits' });
    }

    const existing = await User.findOne({ where: { matricula } });
    if (existing)
      return res.status(400).json({ error: 'matricula already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ matricula, passwordHash, role: r, name });
    return res.json({
      id: user.id,
      matricula: user.matricula,
      role: user.role,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { matricula, password } = req.body;
    if (!matricula || !password)
      return res.status(400).json({ error: 'matricula and password required' });

    // validate matricula format: only numbers, 7-9 digits
    if (!/^\d{7,9}$/.test(matricula)) {
      return res.status(400).json({ error: 'Matrícula inválida' });
    }

    const user = await User.findOne({ where: { matricula } });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '8h' }
    );
    res.json({
      token,
      user: {
        id: user.id,
        matricula: user.matricula,
        role: user.role,
        name: user.name,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;
