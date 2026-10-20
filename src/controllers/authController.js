const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const { registrarAtividade } = require('../services/atividadeService');
const { ACOES_AUDITORIA } = require('../utils/constants');

const gerarToken = (usuario) => {
  const secret = process.env.JWT_SECRET || 'secret_fallback_key_setor_provas';
  return jwt.sign(
    {
      id: usuario._id,
      email: usuario.email,
      perfil: usuario.perfil,
      nome: usuario.nome
    },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, informe o e-mail e a senha.'
      });
    }

    const usuario = await Usuario.findOne({ email: email.toLowerCase().trim() });

    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'E-mail ou senha incorretos.'
      });
    }

    if (!usuario.ativo) {
      return res.status(403).json({
        success: false,
        message: 'Sua conta de usuário está desativada. Contate o administrador.'
      });
    }

    const senhaCorreta = await usuario.compararSenha(senha);
    if (!senhaCorreta) {
      return res.status(401).json({
        success: false,
        message: 'E-mail ou senha incorretos.'
      });
    }

    const token = gerarToken(usuario);

    // Registro na auditoria
    await registrarAtividade({
      usuarioId: usuario._id,
      acao: ACOES_AUDITORIA.LOGIN,
      descricao: `Usuário '${usuario.nome}' realizou login no sistema.`
    });

    res.status(200).json({
      success: true,
      message: 'Login realizado com sucesso.',
      token,
      usuario: {
        id: usuario._id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        disciplinas: usuario.disciplinas
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    usuario: {
      id: req.user._id,
      nome: req.user.nome,
      email: req.user.email,
      perfil: req.user.perfil,
      disciplinas: req.user.disciplinas,
      ativo: req.user.ativo
    }
  });
};

// POST /api/auth/logout
const logout = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logout realizado com sucesso.'
  });
};

module.exports = {
  login,
  getMe,
  logout
};
