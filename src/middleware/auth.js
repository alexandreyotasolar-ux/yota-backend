const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// ── Verificar token JWT ──
async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ erro: 'Token não fornecido.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('-senha');
    if (!user || !user.ativo) return res.status(401).json({ erro: 'Usuário inválido ou inativo.' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

// ── Apenas admin ──
function adminOnly(req, res, next) {
  if (req.user?.tipo !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores.' });
  }
  next();
}

module.exports = { auth, adminOnly };
