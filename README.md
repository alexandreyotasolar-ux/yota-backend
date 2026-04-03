# Yota Energia Solar — Back-end API

## Stack
- **Node.js** + **Express** — servidor HTTP
- **MongoDB** (Atlas ou local) — banco de dados
- **JWT** — autenticação
- **bcryptjs** — hash de senhas

---

## Instalação

```bash
# 1. Entrar na pasta
cd yota-backend

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com sua string de conexão MongoDB e JWT_SECRET

# 4. Criar admin inicial no banco
npm run seed

# 5. Iniciar servidor
npm start          # produção
npm run dev        # desenvolvimento (nodemon)
```

---

## Variáveis de Ambiente (.env)

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `MONGODB_URI` | String de conexão MongoDB Atlas | `mongodb+srv://user:pass@cluster.mongodb.net/yota` |
| `JWT_SECRET` | Chave secreta JWT (string longa aleatória) | `yota_2024_secret_xYz...` |
| `PORT` | Porta da API | `3001` |
| `NODE_ENV` | Ambiente | `production` |
| `CORS_ORIGIN` | URL do front-end | `https://seusite.com` |

---

## Endpoints

### Autenticação
| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/api/register` | Criar conta | ❌ |
| POST | `/api/login` | Login → retorna JWT | ❌ |
| GET | `/api/me` | Usuário logado | ✅ |

### Usuários (admin)
| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/api/users` | Listar todos | Admin |
| PATCH | `/api/users/:id/tipo` | Promover/rebaixar | Admin |
| DELETE | `/api/users/:id` | Desativar | Admin |

### Propostas
| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/api/proposals` | Criar proposta | ✅ |
| GET | `/api/proposals` | Listar (filtrado) | ✅ |
| GET | `/api/proposals/:id` | Detalhe | ✅ |
| PATCH | `/api/proposals/:id/status` | Atualizar status | ✅ |
| DELETE | `/api/proposals/:id` | Remover | ✅ |
| GET | `/api/proposals/stats/summary` | Resumo por vendedor | Admin |

### Contratos
| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/api/contracts` | Criar contrato | ✅ |
| GET | `/api/contracts` | Listar (filtrado) | ✅ |
| GET | `/api/contracts/:id` | Detalhe | ✅ |
| PATCH | `/api/contracts/:id` | Atualizar docs/status | ✅ |
| DELETE | `/api/contracts/:id` | Remover | ✅ |

### Health
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Status do servidor |

---

## Autenticação

Todas as rotas protegidas exigem o header:
```
Authorization: Bearer <token_jwt>
```

O token é retornado no login e tem validade de **7 dias**.

---

## Deploy recomendado

### Railway (mais simples)
1. Crie conta em railway.app
2. New Project → Deploy from GitHub
3. Adicione as variáveis de ambiente no painel
4. Deploy automático

### Render
1. New Web Service → Connect repository
2. Build command: `npm install`
3. Start command: `npm start`
4. Adicione variáveis de ambiente

### MongoDB Atlas (banco)
1. Crie conta em mongodb.com/atlas
2. Crie cluster gratuito (M0)
3. Database Access → Add user
4. Network Access → Allow from anywhere (0.0.0.0/0)
5. Copie a connection string para MONGODB_URI

---

## Estrutura de Arquivos

```
yota-backend/
├── .env.example
├── package.json
├── README.md
└── src/
    ├── server.js              ← Entry point
    ├── config/
    │   └── database.js        ← Conexão MongoDB
    ├── middleware/
    │   └── auth.js            ← JWT verify + adminOnly
    ├── models/
    │   ├── User.js            ← Schema usuários
    │   ├── Proposal.js        ← Schema propostas
    │   └── Contract.js        ← Schema contratos
    ├── routes/
    │   ├── users.js           ← Rotas de usuários
    │   ├── proposals.js       ← Rotas de propostas
    │   └── contracts.js       ← Rotas de contratos
    └── scripts/
        └── seed.js            ← Seed admin inicial
```
