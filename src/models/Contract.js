const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  // Referência à proposta de origem
  proposta_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Proposal' },
  // Dados do cliente
  nome_completo: { type: String, required: true, trim: true },
  telefone:      { type: String, required: true, trim: true },
  email:         { type: String, required: true, lowercase: true, trim: true },
  cidade:        { type: String, required: true, trim: true },
  // Documentos
  status_documentos: {
    conta_luz: { type: String, enum: ['Pendente','Recebido'], default: 'Pendente' },
    rg:        { type: String, enum: ['Pendente','Recebido'], default: 'Pendente' },
  },
  // Status geral
  status:        { type: String, enum: ['pendente','em_andamento','concluido','cancelado'], default: 'pendente' },
  // Vendedor
  vendedor_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendedor_nome: { type: String },
  data_criacao:  { type: Date, default: Date.now },
});

contractSchema.index({ vendedor_id: 1, data_criacao: -1 });
contractSchema.index({ proposta_id: 1 });

module.exports = mongoose.model('Contract', contractSchema);
