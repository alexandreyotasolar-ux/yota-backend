/**
 * Seed inicial: cria o usuário admin padrão se não existir.
 * Execute com: npm run seed
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User     = require('../models/User');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Conectado ao MongoDB');

  const existe = await User.findOne({ email: 'admin@yota.com.br' });
  if (existe) {
    console.log('ℹ️  Admin já existe:', existe.email);
  } else {
    await User.create({
      nome:  'Administrador',
      email: 'admin@yota.com.br',
      senha: 'admin123',
      tipo:  'admin',
    });
    console.log('✅ Admin criado — email: admin@yota.com.br | senha: admin123');
  }

  await mongoose.disconnect();
  console.log('✅ Seed concluído.');
}

seed().catch(err => {
  console.error('❌ Seed falhou:', err.message);
  process.exit(1);
});
