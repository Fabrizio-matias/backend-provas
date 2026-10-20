const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/database');
const errorHandler = require('./middlewares/errorHandler');

// Rotas
const authRoutes = require('./routes/authRoutes');
const provaRoutes = require('./routes/provaRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const relatorioRoutes = require('./routes/relatorioRoutes');
const atividadeRoutes = require('./routes/atividadeRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');

const app = express();

// Configuração do CORS
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((u) => u.trim())
  : ['*'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Servir arquivos locais em ambiente de desenvolvimento (fallback de upload)
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Rota raiz da API (Informa que a API está conectada e operando)
app.get('/', async (req, res) => {
  const mongoose = require('mongoose');
  let dbStatus = 'desconectado';
  try {
    if (process.env.MONGODB_URI) {
      await connectDB();
      dbStatus = 'conectado';
    }
  } catch (err) {
    dbStatus = 'erro_conexao';
  }

  res.status(200).json({
    status: 'online',
    mensagem: 'API do Sistema de Gerenciamento do Setor de Provas conectada com sucesso.',
    bancoDeDados: dbStatus,
    versao: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/login',
      provas: '/api/provas',
      dashboard: '/api/dashboard',
      relatorios: '/api/relatorios/provas',
      usuarios: '/api/usuarios'
    }
  });
});

app.get('/api', (req, res) => {
  res.redirect('/');
});

// Health Check (sempre acessível para verificar status do serviço e conexão)
app.get('/api/health', async (req, res) => {
  const mongoose = require('mongoose');
  let dbStatus = 'desconectado';
  let erroDetalhe = null;

  try {
    if (process.env.MONGODB_URI) {
      await connectDB();
      dbStatus = 'conectado';
    }
  } catch (err) {
    dbStatus = 'erro_conexao';
    erroDetalhe = err.message;
  }

  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    servico: 'Sistema de Gerenciamento do Setor de Provas',
    bancoDeDados: dbStatus,
    ...(erroDetalhe && { erro: erroDetalhe })
  });
});

// Middleware para garantir conexão do banco nas rotas de negócio
app.use(async (req, res, next) => {
  try {
    if (process.env.MONGODB_URI) {
      await connectDB();
    }
    next();
  } catch (err) {
    console.error('Falha de conexão com MongoDB na requisição:', err.message);
    return res.status(503).json({
      success: false,
      message: 'Serviço temporariamente indisponível. Erro de conexão com o banco de dados (MongoDB Atlas). Verifique a variável MONGODB_URI no arquivo .env.'
    });
  }
});

// Montagem das Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/provas', provaRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/relatorios', relatorioRoutes);
app.use('/api/atividades', atividadeRoutes);
app.use('/api/usuarios', usuarioRoutes);

// Rota 404 para endpoints não encontrados
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `A rota '${req.originalUrl}' não foi encontrada na API.`
  });
});

// Middleware Centralizado de Erros
app.use(errorHandler);

// Inicialização se executado diretamente
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, async () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
    try {
      if (process.env.MONGODB_URI) {
        await connectDB();
      }
    } catch (err) {
      console.error('⚠️ Falha ao conectar ao MongoDB na inicialização:', err.message);
    }
  });
}

module.exports = app;
