const bcrypt = require('bcrypt');
const { User, Room, Reservation, sequelize } = require('./models');

async function seed() {
  try {
    await sequelize.sync({ force: true });

    console.log('🔄 Banco recriado!');

    // ==========================
    // SEED ADMIN
    // ==========================
    const adminMatricula = '123456789'; // 9 dígitos
    const adminPasswordHash = await bcrypt.hash('adminpass', 10);

    await User.create({
      name: 'Ana',
      matricula: adminMatricula,
      passwordHash: adminPasswordHash, // <- CORRETO
      role: 'admin',
    });

    console.log('✔ Admin criado');

    // ==========================
    // SEED USUÁRIO COMUM
    // ==========================
    const commonUserMatricula = '1234567'; // 7 dígitos
    const commonUserPasswordHash = await bcrypt.hash('userpass', 10);

    await User.create({
      name: 'Juliana',
      matricula: commonUserMatricula,
      passwordHash: commonUserPasswordHash, // <- CORRETO
      role: 'user',
    });

    console.log('✔ Usuário comum criado');

    // ==========================
    // SALAS
    // ==========================
    await Room.bulkCreate([
      { name: 'Sala 101', capacity: 6 },
      { name: 'Sala 102', capacity: 8 },
      { name: 'Sala 201', capacity: 10 },
      { name: 'Sala 202', capacity: 2 },
      { name: 'Sala 301', capacity: 1 },
      { name: 'Sala 302', capacity: 2 },
      { name: 'Sala Rachel de Queiroz', capacity: 20 },
    ]);

    console.log('✔ Salas criadas');
    console.log('🌱 SEED FINALIZADO!');
    process.exit();
  } catch (error) {
    console.error('Erro ao rodar seed:', error);
    process.exit(1);
  }
}

seed();
