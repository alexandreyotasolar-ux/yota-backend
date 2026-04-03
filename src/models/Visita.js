const mongoose = require('mongoose');

const visitaSchema = new mongoose.Schema({
  nome_cliente:  { type: String, required: true, trim: true },
  telefone:      { type: String, required: true, trim: true, index: true },
  cidade:        { type: String, trim: true, default: '' },
  indicado_por:  { type: String, trim: true, default: '' },
  vendedor_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  vendedor_nome: { type: String, required: true },
  status:        { type: String, enum: ['visitado', 'interessado'], default: 'visitado', index: true },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Índices para performance
visitaSchema.index({ created_at: -1 });
visitaSchema.index({ vendedor_id: 1, created_at: -1 });
visitaSchema.index({ status: 1, created_at: -1 });

module.exports = mongoose.model('Visita', visitaSchema);
