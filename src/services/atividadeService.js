const Atividade = require('../models/Atividade');

/**
 * Registra uma ação de auditoria no sistema
 * @param {Object} params
 * @param {string} params.usuarioId
 * @param {string} params.acao
 * @param {string} params.descricao
 * @param {string} [params.provaId]
 * @param {string} [params.versaoId]
 * @param {Object} [params.detalhes]
 */
async function registrarAtividade({
  usuarioId,
  acao,
  descricao,
  provaId = null,
  versaoId = null,
  detalhes = {}
}) {
  try {
    const atividade = await Atividade.create({
      usuario: usuarioId,
      acao,
      descricao,
      prova: provaId,
      versao: versaoId,
      detalhes
    });
    return atividade;
  } catch (err) {
    console.error('Falha ao registrar atividade de auditoria:', err.message);
    // Não interrompe o fluxo principal caso falhe o log
    return null;
  }
}

module.exports = {
  registrarAtividade
};
