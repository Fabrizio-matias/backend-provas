const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const { registrarAtividade } = require('../services/atividadeService');
const { ACOES_AUDITORIA, PERFIS } = require('../utils/constants');

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

// POST /api/auth/registro
const registro = async (req, res, next) => {
  try {
    const { nome, email, senha, codigo } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({
        success: false,
        message: 'Informe nome, e-mail e senha.'
      });
    }

    if (senha.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'A senha deve ter no mínimo 6 caracteres.'
      });
    }

    const emailNormalizado = email.toLowerCase().trim();
    const existente = await Usuario.findOne({ email: emailNormalizado });
    if (existente) {
      return res.status(409).json({
        success: false,
        message: 'Já existe uma conta com esse e-mail.'
      });
    }

    // sem codigo valido a conta nasce como professor
    const codigoAdmin = process.env.CODIGO_ADMIN;
    const perfil = codigoAdmin && codigo === codigoAdmin ? PERFIS.ADMIN : PERFIS.PROFESSOR;

    const usuario = await Usuario.create({
      nome: nome.trim(),
      email: emailNormalizado,
      senha,
      perfil
    });

    const token = gerarToken(usuario);

    res.status(201).json({
      success: true,
      message: 'Conta criada com sucesso.',
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
  registro,
  getMe,
  logout
};
