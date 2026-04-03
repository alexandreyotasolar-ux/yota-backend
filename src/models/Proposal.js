const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema({
  nome_cliente:      { type: String, required: true, trim: true },
  telefone:          { type: String, required: true, trim: true },
  cidade:            { type: String, required: true, trim: true },
  quantidade_placas: { type: Number, required: true, min: 1 },
  kwp:               { type: Number },
  valor_kit:         { type: String },
  observacao:        { type: String, default: '' },
  // Dados do cálculo de dimensionamento (opcionais)
  consumo_kwh:       { type: Number },
  tipo_rede:         { type: String },
  geracao_mensal:    { type: Number },
  geracao_anual:     { type: Number },
  area_util:         { type: Number },
  inversor:          { type: String },
  // Vendedor
  vendedor_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendedor_nome:     { type: String },
  // Status
  status:            { type: String, enum: ['aberta','convertida','cancelada'], default: 'aberta' },
  data_criacao:      { type: Date, default: Date.now },
});

// Índices
proposalSchema.index({ vendedor_id: 1, data_criacao: -1 });
proposalSchema.index({ cidade: 1 });

module.exports = mongoose.model('Proposal', proposalSchema);
