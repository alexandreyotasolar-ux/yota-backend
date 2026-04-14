/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  YOTA — Dashboard Funil Bitrix24                            ║
 * ║  bitrix-funil.js — adicionar ao back-end Railway            ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Variável de ambiente necessária no Railway:
 *   BITRIX_WEBHOOK_URL = https://seudominio.bitrix24.com.br/rest/USER_ID/TOKEN/
 *
 * Registrar no server.js:
 *   app.use('/funil', require('./bitrix-funil'));
 */

const express = require('express');
const router  = express.Router();

// ── Configuração dos estágios ────────────────────────────────────────────────
// Ajuste os IDs conforme seu pipeline no Bitrix24.
// Para descobrir: GET /crm.dealcategory.list e /crm.dealcategory.stage.list
const ESTAGIOS = {
  // SDR
  LEAD          : { id: 'NEW',          label: 'Lead',              tipo: 'sdr'    },
  MQL           : { id: 'PREPARATION',  label: 'MQL',               tipo: 'sdr'    },
  FOLLOWUP      : { id: 'PREPAYMENT_INVOICE', label: 'Follow-up',   tipo: 'sdr'    },
  NUTRICAO      : { id: 'EXECUTING',    label: 'Nutrição',          tipo: 'sdr'    },
  // Closer
  NEGOCIACAO    : { id: 'FINAL_INVOICE',label: 'Negociação',        tipo: 'closer' },
  PROPOSTA      : { id: 'PREPAYMENT_INVOICE2', label: 'Proposta',   tipo: 'closer' },
  PEND_APROVACAO: { id: '1',            label: 'Pend. Aprovação',   tipo: 'closer' },
  FECHAMENTO    : { id: 'WON',          label: 'Fechamento',        tipo: 'closer' },
  PERDIDO       : { id: 'LOSE',         label: 'Perdido',           tipo: 'closer' },
};

// IDs de estágio que representam "reunião agendada" (SDR concluiu)
const ESTAGIOS_REUNIAO = ['FINAL_INVOICE', 'PREPAYMENT_INVOICE2', '1', 'WON', 'LOSE'];
// IDs de estágio de venda fechada
const ESTAGIOS_GANHO   = ['WON'];

// ── Helpers ──────────────────────────────────────────────────────────────────
function getWebhook() {
  const url = process.env.BITRIX_WEBHOOK_URL;
  if (!url) throw new Error('BITRIX_WEBHOOK_URL não configurado no Railway');
  return url.endsWith('/') ? url : url + '/';
}

async function bxCall(method, params = {}) {
  const base = getWebhook();
  const url  = `${base}${method}.json`;
  const qs   = new URLSearchParams();
  // Serializa params incluindo arrays
  function flatten(obj, prefix = '') {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}[${k}]` : k;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        flatten(v, key);
      } else if (Array.isArray(v)) {
        v.forEach((item, i) => qs.append(`${key}[${i}]`, item));
      } else {
        qs.append(key, v);
      }
    }
  }
  flatten(params);

  const res = await fetch(`${url}?${qs.toString()}`);
  if (!res.ok) throw new Error(`Bitrix API error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Bitrix: ${data.error_description || data.error}`);
  return data.result;
}

/**
 * Busca TODOS os deals paginando (Bitrix retorna máx 50 por vez).
 */
async function getAllDeals(filter = {}, select = []) {
  const deals = [];
  let start = 0;
  const defaultSelect = ['ID','TITLE','STAGE_ID','ASSIGNED_BY_ID','DATE_CREATE',
                         'DATE_MODIFY','CLOSEDATE','OPPORTUNITY','SOURCE_ID',
                         'CONTACT_ID','COMPANY_ID','COMMENTS'];
  while (true) {
    const res = await bxCall('crm.deal.list', {
      filter,
      select: select.length ? select : defaultSelect,
      start,
    });
    if (!res || !res.length) break;
    deals.push(...res);
    if (res.length < 50) break;
    start += 50;
  }
  return deals;
}

/**
 * Busca histórico de mudança de estágio para um deal.
 * Usa crm.deal.stagehistory.list se disponível, senão crm.timeline.
 */
async function getStageHistory(dealId) {
  try {
    const res = await bxCall('crm.stagehistory.list', {
      entityTypeId: 2,  // 2 = Deal
      filter: { OWNER_ID: dealId },
      select: ['ID','OWNER_ID','STAGE_ID','CREATED_TIME'],
    });
    return Array.isArray(res) ? res : (res.items || []);
  } catch {
    return [];
  }
}

// ── Cálculos de métricas ─────────────────────────────────────────────────────

function calcularMetricasSDR(deals) {
  const totalLeads    = deals.length;
  const reunioes      = deals.filter(d => ESTAGIOS_REUNIAO.includes(d.STAGE_ID)).length;
  const taxaConversao = totalLeads > 0 ? (reunioes / totalLeads) * 100 : 0;

  // Agrupamento por responsável
  const porVendedor = {};
  for (const d of deals) {
    const id = d.ASSIGNED_BY_ID;
    if (!porVendedor[id]) porVendedor[id] = { leads: 0, reunioes: 0 };
    porVendedor[id].leads++;
    if (ESTAGIOS_REUNIAO.includes(d.STAGE_ID)) porVendedor[id].reunioes++;
  }
  const rankingSDR = Object.entries(porVendedor).map(([id, v]) => ({
    vendedorId  : id,
    leads       : v.leads,
    reunioes    : v.reunioes,
    conversao   : v.leads > 0 ? ((v.reunioes / v.leads) * 100).toFixed(1) : '0.0',
    alertaBaixo : (v.leads > 0 && v.reunioes / v.leads < 0.25),
  })).sort((a, b) => b.reunioes - a.reunioes);

  // Leads por dia (últimos 30 dias)
  const hoje   = new Date();
  const limite = new Date(hoje - 30 * 24 * 3600 * 1000);
  const porDia = {};
  for (const d of deals) {
    const dt = new Date(d.DATE_CREATE);
    if (dt < limite) continue;
    const key = dt.toISOString().slice(0, 10);
    porDia[key] = (porDia[key] || 0) + 1;
  }

  return { totalLeads, reunioes, taxaConversao: taxaConversao.toFixed(1), rankingSDR, porDia };
}

function calcularMetricasCloser(deals) {
  const reunioes     = deals.filter(d => ESTAGIOS_REUNIAO.includes(d.STAGE_ID)).length;
  const propostas    = deals.filter(d => ['PREPAYMENT_INVOICE2','1','WON','LOSE'].includes(d.STAGE_ID)).length;
  const ganhos       = deals.filter(d => ESTAGIOS_GANHO.includes(d.STAGE_ID));
  const vendas       = ganhos.length;
  const receita      = ganhos.reduce((s, d) => s + (parseFloat(d.OPPORTUNITY) || 0), 0);
  const ticketMedio  = vendas > 0 ? receita / vendas : 0;

  const txReuProp    = reunioes > 0   ? (propostas / reunioes * 100).toFixed(1)  : '0.0';
  const txPropVenda  = propostas > 0  ? (vendas / propostas * 100).toFixed(1)    : '0.0';
  const txReuVenda   = reunioes > 0   ? (vendas / reunioes * 100).toFixed(1)     : '0.0';

  // Ranking por vendedor
  const porVendedor = {};
  for (const d of deals) {
    const id = d.ASSIGNED_BY_ID;
    if (!porVendedor[id]) porVendedor[id] = { vendas: 0, receita: 0, propostas: 0 };
    if (['PREPAYMENT_INVOICE2','1','WON'].includes(d.STAGE_ID)) porVendedor[id].propostas++;
    if (ESTAGIOS_GANHO.includes(d.STAGE_ID)) {
      porVendedor[id].vendas++;
      porVendedor[id].receita += parseFloat(d.OPPORTUNITY) || 0;
    }
  }
  const rankingCloser = Object.entries(porVendedor).map(([id, v]) => ({
    vendedorId  : id,
    vendas      : v.vendas,
    receita     : v.receita,
    propostas   : v.propostas,
    ticket      : v.vendas > 0 ? v.receita / v.vendas : 0,
  })).sort((a, b) => b.receita - a.receita);

  return { reunioes, propostas, vendas, receita, ticketMedio, txReuProp, txPropVenda, txReuVenda, rankingCloser };
}

function calcularPipeline(deals) {
  const pipeline = {};
  for (const [key, estagio] of Object.entries(ESTAGIOS)) {
    const lista  = deals.filter(d => d.STAGE_ID === estagio.id);
    const valor  = lista.reduce((s, d) => s + (parseFloat(d.OPPORTUNITY) || 0), 0);
    pipeline[key] = {
      label    : estagio.label,
      tipo     : estagio.tipo,
      quantidade: lista.length,
      valor,
    };
  }
  return pipeline;
}

function calcularAlertas(deals) {
  const agora    = Date.now();
  const alertas  = [];

  for (const d of deals) {
    const modif   = new Date(d.DATE_MODIFY).getTime();
    const diasParado = Math.floor((agora - modif) / (1000 * 3600 * 24));

    // Lead sem contato > 1 dia
    if (d.STAGE_ID === 'NEW' && diasParado >= 1) {
      alertas.push({ tipo: 'sem_contato', dealId: d.ID, titulo: d.TITLE,
                     vendedorId: d.ASSIGNED_BY_ID, diasParado, mensagem: `Lead sem contato há ${diasParado}d` });
    }
    // Negociação parada > 7 dias
    if (d.STAGE_ID === 'FINAL_INVOICE' && diasParado >= 7) {
      alertas.push({ tipo: 'negociacao_parada', dealId: d.ID, titulo: d.TITLE,
                     vendedorId: d.ASSIGNED_BY_ID, diasParado, mensagem: `Negociação parada há ${diasParado}d` });
    }
    // Proposta sem resposta > 5 dias
    if (d.STAGE_ID === 'PREPAYMENT_INVOICE2' && diasParado >= 5) {
      alertas.push({ tipo: 'proposta_sem_retorno', dealId: d.ID, titulo: d.TITLE,
                     vendedorId: d.ASSIGNED_BY_ID, diasParado, mensagem: `Proposta sem retorno há ${diasParado}d` });
    }
  }

  return alertas.sort((a, b) => b.diasParado - a.diasParado);
}

// Busca nomes dos usuários Bitrix para exibir no dashboard
async function getUsuarios() {
  try {
    const res = await bxCall('user.get', { filter: { ACTIVE: true } });
    const mapa = {};
    for (const u of (res || [])) {
      mapa[u.ID] = `${u.NAME} ${u.LAST_NAME}`.trim();
    }
    return mapa;
  } catch {
    return {};
  }
}

// ── Cache simples em memória (5 minutos) ─────────────────────────────────────
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function getDadosFunil(forceRefresh = false) {
  if (!forceRefresh && _cache && Date.now() - _cacheAt < CACHE_TTL) {
    return _cache;
  }

  // Busca em paralelo: todos os deals + usuários
  const [deals, usuarios] = await Promise.all([
    getAllDeals({}, ['ID','TITLE','STAGE_ID','ASSIGNED_BY_ID',
                     'DATE_CREATE','DATE_MODIFY','OPPORTUNITY','SOURCE_ID']),
    getUsuarios(),
  ]);

  // Enriquece deals com nome do vendedor
  for (const d of deals) {
    d._vendedorNome = usuarios[d.ASSIGNED_BY_ID] || `User ${d.ASSIGNED_BY_ID}`;
  }

  const sdr     = calcularMetricasSDR(deals);
  const closer  = calcularMetricasCloser(deals);
  const pipeline = calcularPipeline(deals);
  const alertas = calcularAlertas(deals);

  // Enriquece rankings com nomes
  sdr.rankingSDR = sdr.rankingSDR.map(r => ({
    ...r, vendedor: usuarios[r.vendedorId] || `User ${r.vendedorId}`
  }));
  closer.rankingCloser = closer.rankingCloser.map(r => ({
    ...r, vendedor: usuarios[r.vendedorId] || `User ${r.vendedorId}`
  }));

  _cache = {
    geradoEm : new Date().toISOString(),
    totalDeals: deals.length,
    sdr, closer, pipeline, alertas,
  };
  _cacheAt = Date.now();
  return _cache;
}

// ── Endpoints ────────────────────────────────────────────────────────────────

/**
 * GET /funil/dados
 * Retorna todas as métricas calculadas.
 * ?refresh=1 força re-fetch do Bitrix.
 */
router.get('/dados', async (req, res) => {
  try {
    const dados = await getDadosFunil(req.query.refresh === '1');
    res.json({ ok: true, ...dados });
  } catch (err) {
    console.error('[funil/dados]', err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

/**
 * GET /funil/pipeline
 * Retorna só o pipeline (mais leve, para polling frequente).
 */
router.get('/pipeline', async (req, res) => {
  try {
    const dados = await getDadosFunil();
    res.json({ ok: true, pipeline: dados.pipeline, alertas: dados.alertas });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

/**
 * GET /funil/estagios
 * Lista os estágios do pipeline do Bitrix (útil para configurar os IDs).
 */
router.get('/estagios', async (req, res) => {
  try {
    const res2 = await bxCall('crm.dealcategory.list', {});
    const categorias = Array.isArray(res2) ? res2 : (res2.items || []);
    const estagios = [];
    for (const cat of categorias) {
      const stages = await bxCall('crm.dealcategory.stage.list', { id: cat.ID });
      estagios.push({ categoria: cat, stages: stages || [] });
    }
    // Também busca estágios do pipeline padrão (categoryId = 0)
    const default_stages = await bxCall('crm.stage.list', { entityTypeId: 2 });
    res.json({ ok: true, default: default_stages, categorias: estagios });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

module.exports = router;
