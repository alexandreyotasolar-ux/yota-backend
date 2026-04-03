const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  nome:        { type: String, required: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  senha:       { type: String, required: true, minlength: 6 },
  tipo:        { type: String, enum: ['vendedor', 'admin'], default: 'vendedor' },
  ativo:       { type: Boolean, default: true },
  data_criacao:{ type: Date,   default: Date.now },
});

// Hash senha antes de salvar
userSchema.pre('save', async function(next) {
  if (!this.isModified('senha')) return next();
  this.senha = await bcrypt.hash(this.senha, 12);
  next();
});

// Comparar senha
userSchema.methods.verificarSenha = function(senha) {
  return bcrypt.compare(senha, this.senha);
};

// Retornar sem senha
userSchema.methods.toSafeJSON = function() {
  const obj = this.toObject();
  delete obj.senha;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
