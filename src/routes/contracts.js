const express  = require('express');
const Contract = require('../models/Contract');
const Proposal = require('../models/Proposal');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/contracts ── Criar contrato
router.post('/', auth, async (req, res) => {
  try {
    const {
      proposta_id, nome_completo, telefone,
      email, cidade, status_documentos,
    } = req.body;

    if (!nome_completo || !telefone || !email || !cidade)
      return res.status(400).json({ erro: 'Campos obrigatórios: nome_completo, telefone, email, cidade.' });

    // Se veio proposta_id, verificar acesso e marcar como convertida
    if (proposta_id) {
      const prop = await Proposal.findById(proposta_id);
      if (prop) {
        if (req.user.tipo !== 'admin' && String(prop.vendedor_id) !== String(req.user._id))
          return res.status(403).json({ erro: 'Acesso negado à proposta.' });
        prop.status = 'convertida';
        await prop.save();
      }
    }

    const docs = status_documentos || {};
    const contract = await Contract.create({
      proposta_id:   proposta_id || undefined,
      nome_completo: nome_completo.trim(),
      telefone:      telefone.trim(),
      email:         email.trim().toLowerCase(),
      cidade:        cidade.trim(),
      status_documentos: {
        conta_luz: docs.conta_luz === 'Recebido' ? 'Recebido' : 'Pendente',
        rg:        docs.rg        === 'Recebido' ? 'Recebido' : 'Pendente',
      },
      vendedor_id:   req.user._id,
      vendedor_nome: req.user.nome,
    });

    res.status(201).json(contract);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── GET /api/contracts ── Listar
router.get('/', auth, async (req, res) => {
  try {
    const filter = req.user.tipo === 'admin' ? {} : { vendedor_id: req.user._id };
    const { status, limit = 100, page = 1 } = req.query;
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [docs, total] = await Promise.all([
      Contract.find(filter)
        .populate('proposta_id', 'cidade quantidade_placas valor_kit')
        .sort({ data_criacao: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Contract.countDocuments(filter),
    ]);

    res.json({ total, pagina: Number(page), docs });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── GET /api/contracts/:id ── Detalhe
router.get('/:id', auth, async (req, res) => {
  try {
    const ct = await Contract.findById(req.params.id).populate('proposta_id');
    if (!ct) return res.status(404).json({ erro: 'Contrato não encontrado.' });
    if (req.user.tipo !== 'admin' && String(ct.vendedor_id) !== String(req.user._id))
      return res.status(403).json({ erro: 'Acesso negado.' });
    res.json(ct);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── PATCH /api/contracts/:id ── Atualizar documentos / status
router.patch('/:id', auth, async (req, res) => {
  try {
    const ct = await Contract.findById(req.params.id);
    if (!ct) return res.status(404).json({ erro: 'Contrato não encontrado.' });
    if (req.user.tipo !== 'admin' && String(ct.vendedor_id) !== String(req.user._id))
      return res.status(403).json({ erro: 'Acesso negado.' });

    const { status, status_documentos } = req.body;
    if (status) ct.status = status;
    if (status_documentos?.conta_luz) ct.status_documentos.conta_luz = status_documentos.conta_luz;
    if (status_documentos?.rg)        ct.status_documentos.rg        = status_documentos.rg;
    await ct.save();
    res.json(ct);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── DELETE /api/contracts/:id ── Remover
router.delete('/:id', auth, async (req, res) => {
  try {
    const ct = await Contract.findById(req.params.id);
    if (!ct) return res.status(404).json({ erro: 'Contrato não encontrado.' });
    if (req.user.tipo !== 'admin' && String(ct.vendedor_id) !== String(req.user._id))
      return res.status(403).json({ erro: 'Acesso negado.' });
    await ct.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
