const Prova = require('../models/Prova');
const { PERFIS, STATUS_PROVA } = require('../utils/constants');

// GET /api/dashboard
const getDashboardData = async (req, res, next) => {
  try {
    const { trimestre, divisao, turma } = req.query;
    const baseQuery = {};

    // Restringe escopo para professores
    if (req.user.perfil === PERFIS.PROFESSOR) {
      baseQuery.professor = req.user._id;
    }

    if (trimestre) {
      baseQuery.trimestre = trimestre;
    }
    if (divisao) {
      baseQuery.divisao = divisao.toUpperCase();
    }
    if (turma) {
      baseQuery.turma = { $regex: turma, $options: 'i' };
    }

    const agora = new Date();

    // Consultas paralelas para máxima performance
    const [
      totalProvas,
      aguardandoConferencia,
      emConferencia,
      aguardandoCorrecao,
      aguardandoValidacaoProf,
      ajustesSolicitados,
      aguardandoAprovacaoFinal,
      aprovadasImpressao,
      concluidas,
      atrasadas,
      provasRecentes,
      distribuicaoTrimestre,
      distribuicaoDivisao
    ] = await Promise.all([
      // Total
      Prova.countDocuments(baseQuery),
      // Aguardando conferência / enviadas
      Prova.countDocuments({
        ...baseQuery,
        status: { $in: [STATUS_PROVA.ENVIADA, STATUS_PROVA.AGUARDANDO_CONFERENCIA] }
      }),
      // Em conferência
      Prova.countDocuments({
        ...baseQuery,
        status: STATUS_PROVA.EM_CONFERENCIA
      }),
      // Aguardando correção
      Prova.countDocuments({
        ...baseQuery,
        status: STATUS_PROVA.AGUARDANDO_CORRECAO
      }),
      // Aguardando validação do professor
      Prova.countDocuments({
        ...baseQuery,
        status: STATUS_PROVA.AGUARDANDO_VALIDACAO_PROFESSOR
      }),
      // Ajustes solicitados
      Prova.countDocuments({
        ...baseQuery,
        status: STATUS_PROVA.AJUSTES_SOLICITADOS
      }),
      // Aguardando aprovação final
      Prova.countDocuments({
        ...baseQuery,
        status: STATUS_PROVA.AGUARDANDO_APROVACAO_FINAL
      }),
      // Aprovadas para impressão
      Prova.countDocuments({
        ...baseQuery,
        status: STATUS_PROVA.APROVADA_IMPRESSAO
      }),
      // Concluídas
      Prova.countDocuments({
        ...baseQuery,
        status: STATUS_PROVA.CONCLUIDA
      }),
      // Atrasadas
      Prova.countDocuments({
        ...baseQuery,
        prazoEntrega: { $lt: agora },
        status: {
          $nin: [STATUS_PROVA.APROVADA_IMPRESSAO, STATUS_PROVA.CONCLUIDA]
        }
      }),
      // Provas recentes
      Prova.find(baseQuery)
        .populate('professor', 'nome email')
        .populate('responsavelUltimaAlteracao', 'nome')
        .sort({ updatedAt: -1 })
        .limit(8),
      // Agrupamento por Trimestre
      Prova.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$trimestre', total: { $sum: 1 } } }
      ]),
      // Agrupamento por Divisão (AG / AD)
      Prova.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$divisao', total: { $sum: 1 } } }
      ])
    ]);

    const cards = {
      total: totalProvas,
      aguardandoConferencia,
      emConferencia,
      aguardandoCorrecao,
      emCorrecaoTotal: emConferencia + aguardandoCorrecao + ajustesSolicitados,
      aguardandoValidacaoProf,
      ajustesSolicitados,
      aguardandoAprovacaoFinal,
      aprovadasImpressao,
      concluidas,
      atrasadas
    };

    res.status(200).json({
      success: true,
      cards,
      provasRecentes,
      estatisticas: {
        porTrimestre: distribuicaoTrimestre,
        porDivisao: distribuicaoDivisao
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardData
};
