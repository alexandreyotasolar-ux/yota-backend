const express  = require('express');
const Proposal = require('../models/Proposal');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/proposals ── Criar proposta
router.post('/', auth, async (req, res) => {
  try {
    const {
      nome_cliente, telefone, cidade, quantidade_placas,
      kwp, valor_kit, observacao,
      consumo_kwh, tipo_rede, geracao_mensal, geracao_anual,
      area_util, inversor,
    } = req.body;

    if (!nome_cliente || !telefone || !cidade || !quantidade_placas)
      return res.status(400).json({ erro: 'Campos obrigatórios: nome_cliente, telefone, cidade, quantidade_placas.' });

    const prop = await Proposal.create({
      nome_cliente: nome_cliente.trim(),
      telefone:     telefone.trim(),
      cidade:       cidade.trim(),
      quantidade_placas: Number(quantidade_placas),
      kwp:          kwp ? Number(kwp) : undefined,
      valor_kit:    valor_kit || undefined,
      observacao:   observacao || '',
      consumo_kwh:  consumo_kwh ? Number(consumo_kwh) : undefined,
      tipo_rede,
      geracao_mensal:  geracao_mensal ? Number(geracao_mensal) : undefined,
      geracao_anual:   geracao_anual  ? Number(geracao_anual)  : undefined,
      area_util:       area_util      ? Number(area_util)      : undefined,
      inversor,
      vendedor_id:   req.user._id,
      vendedor_nome: req.user.nome,
    });

    res.status(201).json(prop);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── GET /api/proposals ── Listar (vendedor vê as suas; admin vê todas)
router.get('/', auth, async (req, res) => {
  try {
    const filter = req.user.tipo === 'admin' ? {} : { vendedor_id: req.user._id };
    const { status, cidade, limit = 100, page = 1 } = req.query;
    if (status) filter.status = status;
    if (cidade)  filter.cidade = new RegExp(cidade, 'i');

    const skip  = (Number(page) - 1) * Number(limit);
    const [docs, total] = await Promise.all([
      Proposal.find(filter).sort({ data_criacao: -1 }).skip(skip).limit(Number(limit)),
      Proposal.countDocuments(filter),
    ]);

    res.json({ total, pagina: Number(page), docs });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── GET /api/proposals/:id ── Detalhe
router.get('/:id', auth, async (req, res) => {
  try {
    const prop = await Proposal.findById(req.params.id);
    if (!prop) return res.status(404).json({ erro: 'Proposta não encontrada.' });
    if (req.user.tipo !== 'admin' && String(prop.vendedor_id) !== String(req.user._id))
      return res.status(403).json({ erro: 'Acesso negado.' });
    res.json(prop);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── PATCH /api/proposals/:id/status ── Atualizar status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['aberta','convertida','cancelada'].includes(status))
      return res.status(400).json({ erro: 'Status inválido.' });
    const prop = await Proposal.findById(req.params.id);
    if (!prop) return res.status(404).json({ erro: 'Proposta não encontrada.' });
    if (req.user.tipo !== 'admin' && String(prop.vendedor_id) !== String(req.user._id))
      return res.status(403).json({ erro: 'Acesso negado.' });
    prop.status = status;
    await prop.save();
    res.json(prop);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── DELETE /api/proposals/:id ── Remover
router.delete('/:id', auth, async (req, res) => {
  try {
    const prop = await Proposal.findById(req.params.id);
    if (!prop) return res.status(404).json({ erro: 'Proposta não encontrada.' });
    if (req.user.tipo !== 'admin' && String(prop.vendedor_id) !== String(req.user._id))
      return res.status(403).json({ erro: 'Acesso negado.' });
    await prop.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── GET /api/proposals/stats/summary ── Resumo admin
router.get('/stats/summary', auth, adminOnly, async (req, res) => {
  try {
    const stats = await Proposal.aggregate([
      { $group: {
        _id: '$vendedor_nome',
        total: { $sum: 1 },
        abertas: { $sum: { $cond: [{ $eq: ['$status','aberta'] }, 1, 0] } },
        convertidas: { $sum: { $cond: [{ $eq: ['$status','convertida'] }, 1, 0] } },
      }},
      { $sort: { total: -1 } },
    ]);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
