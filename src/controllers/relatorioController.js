const Prova = require('../models/Prova');
const Atividade = require('../models/Atividade');
const { PERFIS } = require('../utils/constants');

// GET /api/relatorios/provas
const getRelatorioProvas = async (req, res, next) => {
  try {
    const { trimestre, divisao, turma, disciplina, professor, dataInicio, dataFim } = req.query;

    const match = {};

    if (req.user.perfil === PERFIS.PROFESSOR) {
      match.professor = req.user._id;
    } else if (professor) {
      match.professor = professor;
    }

    if (trimestre) match.trimestre = trimestre;
    if (divisao) match.divisao = divisao.toUpperCase();
    if (turma) match.turma = { $regex: turma, $options: 'i' };
    if (disciplina) match.disciplina = { $regex: disciplina, $options: 'i' };

    if (dataInicio || dataFim) {
      match.dataAplicacao = {};
      if (dataInicio) match.dataAplicacao.$gte = new Date(dataInicio);
      if (dataFim) match.dataAplicacao.$lte = new Date(dataFim);
    }

    const [
      porTrimestre,
      porDivisao,
      porStatus,
      porTurma,
      porDisciplina,
      totalGeral
    ] = await Promise.all([
      Prova.aggregate([
        { $match: match },
        { $group: { _id: '$trimestre', total: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      Prova.aggregate([
        { $match: match },
        { $group: { _id: '$divisao', total: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      Prova.aggregate([
        { $match: match },
        { $group: { _id: '$status', total: { $sum: 1 } } },
        { $sort: { total: -1 } }
      ]),
      Prova.aggregate([
        { $match: match },
        { $group: { _id: '$turma', total: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      Prova.aggregate([
        { $match: match },
        { $group: { _id: '$disciplina', total: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      Prova.countDocuments(match)
    ]);

    res.status(200).json({
      success: true,
      totalGeral,
      filtrosAplicados: { trimestre, divisao, turma, disciplina },
      dados: {
        porTrimestre,
        porDivisao,
        porStatus,
        porTurma,
        porDisciplina
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/atividades
const getAtividades = async (req, res, next) => {
  try {
    const { usuarioId, acao, provaId, page = 1, limit = 25 } = req.query;

    const query = {};
    if (usuarioId) query.usuario = usuarioId;
    if (acao) query.acao = acao;
    if (provaId) query.prova = provaId;

    // Se professor, limita atividades às suas provas ou a ele mesmo
    if (req.user.perfil === PERFIS.PROFESSOR) {
      query.$or = [{ usuario: req.user._id }];
    }

    const paginaNum = Math.max(1, parseInt(page, 10));
    const limiteNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (paginaNum - 1) * limiteNum;

    const [total, atividades] = await Promise.all([
      Atividade.countDocuments(query),
      Atividade.find(query)
        .populate('usuario', 'nome email perfil')
        .populate('prova', 'titulo codigo disciplina turma')
        .populate('versao', 'numeroVersao rotuloVersao')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limiteNum)
    ]);

    res.status(200).json({
      success: true,
      total,
      pagina: paginaNum,
      totalPaginas: Math.ceil(total / limiteNum) || 1,
      limite: limiteNum,
      atividades
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRelatorioProvas,
  getAtividades
};
