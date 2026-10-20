const Usuario = require('../models/Usuario');
const { PERFIS, ACOES_AUDITORIA } = require('../utils/constants');
const { registrarAtividade } = require('../services/atividadeService');
const bcrypt = require('bcryptjs');

// GET /api/usuarios
const listarUsuarios = async (req, res, next) => {
  try {
    const { perfil, status, busca, page = 1, limit = 20 } = req.query;

    const query = {};

    if (perfil) {
      query.perfil = perfil;
    }

    if (status !== undefined && status !== '') {
      query.ativo = status === 'ativo' || status === 'true';
    }

    if (busca) {
      const regex = new RegExp(busca, 'i');
      query.$or = [{ nome: regex }, { email: regex }];
    }

    const paginaNum = Math.max(1, parseInt(page, 10));
    const limiteNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (paginaNum - 1) * limiteNum;

    const [total, usuarios] = await Promise.all([
      Usuario.countDocuments(query),
      Usuario.find(query)
        .select('-senha')
        .sort({ nome: 1 })
        .skip(skip)
        .limit(limiteNum)
    ]);

    res.status(200).json({
      success: true,
      total,
      pagina: paginaNum,
      totalPaginas: Math.ceil(total / limiteNum) || 1,
      usuarios
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/usuarios/professores (para alimentar selects de professores)
const listarProfessores = async (req, res, next) => {
  try {
    const professores = await Usuario.find({ perfil: PERFIS.PROFESSOR, ativo: true })
      .select('nome email disciplinas')
      .sort({ nome: 1 });

    res.status(200).json({
      success: true,
      professores
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/usuarios
const criarUsuario = async (req, res, next) => {
  try {
    const { nome, email, senha, perfil, disciplinas, ativo } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({
        success: false,
        message: 'Nome, e-mail e senha são campos obrigatórios.'
      });
    }

    const emailExiste = await Usuario.findOne({ email: email.toLowerCase().trim() });
    if (emailExiste) {
      return res.status(400).json({
        success: false,
        message: 'Já existe um usuário cadastrado com este e-mail.'
      });
    }

    const usuario = new Usuario({
      nome,
      email: email.toLowerCase().trim(),
      senha,
      perfil: perfil || PERFIS.PROFESSOR,
      disciplinas: Array.isArray(disciplinas)
        ? disciplinas
        : typeof disciplinas === 'string'
        ? disciplinas.split(',').map((d) => d.trim()).filter(Boolean)
        : [],
      ativo: ativo !== undefined ? ativo : true
    });

    await usuario.save();

    await registrarAtividade({
      usuarioId: req.user._id,
      acao: ACOES_AUDITORIA.CRIAR_USUARIO,
      descricao: `Novo usuário '${usuario.nome}' (${usuario.email}) criado com perfil '${usuario.perfil}'.`
    });

    res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso!',
      usuario: {
        id: usuario._id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        disciplinas: usuario.disciplinas,
        ativo: usuario.ativo
      }
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/usuarios/:id
const atualizarUsuario = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nome, email, perfil, disciplinas, ativo, novaSenha } = req.body;

    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }

    if (email && email.toLowerCase().trim() !== usuario.email) {
      const emailExiste = await Usuario.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: id }
      });
      if (emailExiste) {
        return res.status(400).json({
          success: false,
          message: 'Este e-mail já está em uso por outro usuário.'
        });
      }
      usuario.email = email.toLowerCase().trim();
    }

    if (nome) usuario.nome = nome;
    if (perfil) usuario.perfil = perfil;
    if (ativo !== undefined) usuario.ativo = ativo;

    if (disciplinas !== undefined) {
      usuario.disciplinas = Array.isArray(disciplinas)
        ? disciplinas
        : typeof disciplinas === 'string'
        ? disciplinas.split(',').map((d) => d.trim()).filter(Boolean)
        : [];
    }

    if (novaSenha && novaSenha.trim().length >= 6) {
      usuario.senha = novaSenha.trim(); // o pre('save') fará o hash
    }

    await usuario.save();

    await registrarAtividade({
      usuarioId: req.user._id,
      acao: ACOES_AUDITORIA.EDITAR_USUARIO,
      descricao: `Usuário '${usuario.nome}' atualizado por ${req.user.nome}.`
    });

    res.status(200).json({
      success: true,
      message: 'Usuário atualizado com sucesso.',
      usuario: {
        id: usuario._id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        disciplinas: usuario.disciplinas,
        ativo: usuario.ativo
      }
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/usuarios/:id/status
const alternarStatusUsuario = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Não permitir desativar a si próprio
    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Você não pode desativar o seu próprio usuário.'
      });
    }

    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }

    usuario.ativo = !usuario.ativo;
    await usuario.save();

    await registrarAtividade({
      usuarioId: req.user._id,
      acao: ACOES_AUDITORIA.STATUS_USUARIO,
      descricao: `Status do usuário '${usuario.nome}' alterado para ${usuario.ativo ? 'ATIVO' : 'INATIVO'} por ${req.user.nome}.`
    });

    res.status(200).json({
      success: true,
      message: `Usuário ${usuario.ativo ? 'ativado' : 'desativado'} com sucesso.`,
      usuario: {
        id: usuario._id,
        nome: usuario.nome,
        ativo: usuario.ativo
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listarUsuarios,
  listarProfessores,
  criarUsuario,
  atualizarUsuario,
  alternarStatusUsuario
};
