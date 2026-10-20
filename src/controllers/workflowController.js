const Prova = require('../models/Prova');
const Versao = require('../models/Versao');
const {
  PERFIS,
  STATUS_PROVA,
  STATUS_VALIDACAO,
  STATUS_APROVACAO,
  ACOES_AUDITORIA
} = require('../utils/constants');
const { registrarAtividade } = require('../services/atividadeService');
const { resolveFileDownload } = require('../services/storageService');
const fs = require('fs');

// POST /api/provas/:id/iniciar-conferencia
const iniciarConferencia = async (req, res, next) => {
  try {
    const { id } = req.params;
    const prova = await Prova.findById(id);

    if (!prova) {
      return res.status(404).json({ success: false, message: 'Prova não encontrada.' });
    }

    if (prova.status === STATUS_PROVA.CONCLUIDA) {
      return res.status(400).json({
        success: false,
        message: 'A prova já foi concluída.'
      });
    }

    prova.status = STATUS_PROVA.EM_CONFERENCIA;
    prova.responsavelUltimaAlteracao = req.user._id;
    await prova.save();

    await registrarAtividade({
      usuarioId: req.user._id,
      acao: ACOES_AUDITORIA.INICIO_CONFERENCIA,
      descricao: `${req.user.nome} iniciou a conferência da prova '${prova.titulo}'.`,
      provaId: prova._id
    });

    res.status(200).json({
      success: true,
      message: 'Conferência iniciada com sucesso.',
      prova
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/provas/:id/solicitar-correcao
const solicitarCorrecao = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { observacoes } = req.body;

    const prova = await Prova.findById(id);
    if (!prova) {
      return res.status(404).json({ success: false, message: 'Prova não encontrada.' });
    }

    prova.status = STATUS_PROVA.AGUARDANDO_CORRECAO;
    if (observacoes) {
      prova.observacoes = (prova.observacoes ? prova.observacoes + '\n' : '') +
        `[${new Date().toLocaleDateString('pt-BR')} - Correção Solicitada por ${req.user.nome}]: ${observacoes}`;
    }
    prova.responsavelUltimaAlteracao = req.user._id;
    await prova.save();

    await registrarAtividade({
      usuarioId: req.user._id,
      acao: ACOES_AUDITORIA.SOLICITAR_CORRECAO,
      descricao: `${req.user.nome} solicitou correções para a prova '${prova.titulo}'.`,
      provaId: prova._id,
      detalhes: { observacoes }
    });

    res.status(200).json({
      success: true,
      message: 'Status atualizado para Aguardando Correção.',
      prova
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/provas/:id/encaminhar-validacao
const encaminharValidacao = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { observacoes } = req.body;

    const prova = await Prova.findById(id).populate('historicoVersoes');
    if (!prova) {
      return res.status(404).json({ success: false, message: 'Prova não encontrada.' });
    }

    // Pega a versão mais recente
    const ultimaVersao = await Versao.findOne({ prova: prova._id }).sort({ numeroVersao: -1 });
    if (!ultimaVersao) {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma versão foi encontrada para esta prova.'
      });
    }

    ultimaVersao.validacaoProfessor.status = STATUS_VALIDACAO.PENDENTE;
    if (observacoes) {
      ultimaVersao.observacoesFuncionario = observacoes;
    }
    await ultimaVersao.save();

    prova.status = STATUS_PROVA.AGUARDANDO_VALIDACAO_PROFESSOR;
    prova.responsavelUltimaAlteracao = req.user._id;
    await prova.save();

    await registrarAtividade({
      usuarioId: req.user._id,
      acao: ACOES_AUDITORIA.ENCAMINHAR_VALIDACAO,
      descricao: `Versão ${ultimaVersao.rotuloVersao} encaminhada para validação do professor por ${req.user.nome}.`,
      provaId: prova._id,
      versaoId: ultimaVersao._id,
      detalhes: { observacoes }
    });

    res.status(200).json({
      success: true,
      message: 'Versão encaminhada para validação do professor.',
      prova,
      versao: ultimaVersao
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/provas/:id/validar-professor
const validarProfessor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { acao, observacoes } = req.body; // acao: 'aprovar' | 'ajustes'

    const prova = await Prova.findById(id);
    if (!prova) {
      return res.status(404).json({ success: false, message: 'Prova não encontrada.' });
    }

    // Apenas o professor responsável pela prova ou administrador pode validar
    if (
      req.user.perfil === PERFIS.PROFESSOR &&
      prova.professor.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Apenas o professor titular desta prova pode realizar a validação.'
      });
    }

    const ultimaVersao = await Versao.findOne({ prova: prova._id }).sort({ numeroVersao: -1 });
    if (!ultimaVersao) {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma versão encontrada para validação.'
      });
    }

    if (acao === 'aprovar') {
      ultimaVersao.validacaoProfessor.status = STATUS_VALIDACAO.APROVADO;
      ultimaVersao.validacaoProfessor.data = new Date();
      ultimaVersao.validacaoProfessor.usuario = req.user._id;
      ultimaVersao.validacaoProfessor.observacoes = observacoes || 'Conteúdo aprovado pelo professor.';
      await ultimaVersao.save();

      // Regra obrigatória: A aprovação do professor NÃO libera a prova para impressão.
      // Encaminha a prova para a aprovação final do setor.
      prova.status = STATUS_PROVA.AGUARDANDO_APROVACAO_FINAL;
      prova.responsavelUltimaAlteracao = req.user._id;
      await prova.save();

      await registrarAtividade({
        usuarioId: req.user._id,
        acao: ACOES_AUDITORIA.VALIDACAO_PROFESSOR_APROVADO,
        descricao: `O professor ${req.user.nome} APROVOU o conteúdo da versão ${ultimaVersao.rotuloVersao}. Aguardando aprovação final do setor.`,
        provaId: prova._id,
        versaoId: ultimaVersao._id,
        detalhes: { observacoes }
      });

      return res.status(200).json({
        success: true,
        message: 'Conteúdo validado com sucesso! A prova agora aguarda a aprovação final do Setor de Provas.',
        prova,
        versao: ultimaVersao
      });
    } else if (acao === 'ajustes') {
      ultimaVersao.validacaoProfessor.status = STATUS_VALIDACAO.AJUSTES_SOLICITADOS;
      ultimaVersao.validacaoProfessor.data = new Date();
      ultimaVersao.validacaoProfessor.usuario = req.user._id;
      ultimaVersao.validacaoProfessor.observacoes = observacoes || 'Ajustes solicitados pelo professor.';
      await ultimaVersao.save();

      prova.status = STATUS_PROVA.AJUSTES_SOLICITADOS;
      prova.responsavelUltimaAlteracao = req.user._id;
      await prova.save();

      await registrarAtividade({
        usuarioId: req.user._id,
        acao: ACOES_AUDITORIA.VALIDACAO_PROFESSOR_AJUSTES,
        descricao: `O professor ${req.user.nome} SOLICITOU AJUSTES na versão ${ultimaVersao.rotuloVersao}.`,
        provaId: prova._id,
        versaoId: ultimaVersao._id,
        detalhes: { observacoes }
      });

      return res.status(200).json({
        success: true,
        message: 'Solicitação de ajustes registrada com sucesso.',
        prova,
        versao: ultimaVersao
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Ação de validação inválida. Utilize 'aprovar' ou 'ajustes'."
      });
    }
  } catch (error) {
    next(error);
  }
};

// POST /api/provas/:id/solicitar-ajustes (atalho)
const solicitarAjustes = async (req, res, next) => {
  req.body.acao = 'ajustes';
  return validarProfessor(req, res, next);
};

// POST /api/provas/:id/aprovar-final
// APROVAÇÃO FINAL DO RESPONSÁVEL DO SETOR - LIBERA PARA IMPRESSÃO
const aprovarFinal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { observacoes } = req.body;

    const prova = await Prova.findById(id);
    if (!prova) {
      return res.status(404).json({ success: false, message: 'Prova não encontrada.' });
    }

    const ultimaVersao = await Versao.findOne({ prova: prova._id }).sort({ numeroVersao: -1 });
    if (!ultimaVersao) {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma versão foi encontrada para aprovação final.'
      });
    }

    // Regra obrigatória: Se houve alteração de conteúdo, o professor OBRIGATORIAMENTE deve ter aprovado
    if (
      ultimaVersao.houveAlteracaoConteudo &&
      ultimaVersao.validacaoProfessor.status !== STATUS_VALIDACAO.APROVADO
    ) {
      return res.status(400).json({
        success: false,
        message: `Não é possível aprovar para impressão: A versão ${ultimaVersao.rotuloVersao} teve alteração de conteúdo e ainda está com validação do professor como '${ultimaVersao.validacaoProfessor.status}'.`
      });
    }

    // Regra obrigatória: A liberação é vinculada estritamente ao identificador exato da versão aprovada
    ultimaVersao.aprovacaoFinal.status = STATUS_APROVACAO.APROVADO;
    ultimaVersao.aprovacaoFinal.data = new Date();
    ultimaVersao.aprovacaoFinal.usuario = req.user._id;
    ultimaVersao.aprovacaoFinal.observacoes = observacoes || 'Aprovado pelo responsável do setor de provas.';
    await ultimaVersao.save();

    prova.status = STATUS_PROVA.APROVADA_IMPRESSAO;
    prova.versaoAtual = ultimaVersao.numeroVersao;
    prova.idVersaoAprovada = ultimaVersao._id;
    prova.aprovadoParaImpressao = true;
    prova.aprovadoPor = req.user._id;
    prova.dataAprovacao = new Date();
    prova.responsavelUltimaAlteracao = req.user._id;
    await prova.save();

    await registrarAtividade({
      usuarioId: req.user._id,
      acao: ACOES_AUDITORIA.APROVACAO_FINAL,
      descricao: `Prova '${prova.titulo}' (${prova.codigo}) APROVADA PARA IMPRESSÃO por ${req.user.nome}. Versão autorizada: ${ultimaVersao.rotuloVersao}.`,
      provaId: prova._id,
      versaoId: ultimaVersao._id,
      detalhes: {
        versaoAprovada: ultimaVersao.rotuloVersao,
        idVersao: ultimaVersao._id,
        observacoes
      }
    });

    res.status(200).json({
      success: true,
      message: `Prova liberada com sucesso para impressão na versão ${ultimaVersao.rotuloVersao}!`,
      prova,
      versaoAprovada: ultimaVersao
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/provas/:id/arquivo-impressao
// BLOQUEIO CRÍTICO DE IMPRESSÃO
const obterArquivoImpressao = async (req, res, next) => {
  try {
    const { id } = req.params;

    const prova = await Prova.findById(id).populate('idVersaoAprovada');
    if (!prova) {
      return res.status(404).json({ success: false, message: 'Prova não encontrada.' });
    }

    // 1. Verificação de Permissão do Usuário
    if (
      req.user.perfil === PERFIS.PROFESSOR &&
      prova.professor.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Você não é o professor responsável por esta avaliação.'
      });
    }

    // 2. REGRA DE SEGURANÇA CRÍTICA: BLOQUEIO DE IMPRESSÃO
    // O backend bloqueia categoricamente o download se a prova não estiver aprovada para impressão
    if (
      !prova.aprovadoParaImpressao ||
      !prova.idVersaoAprovada ||
      prova.status !== STATUS_PROVA.APROVADA_IMPRESSAO && prova.status !== STATUS_PROVA.CONCLUIDA
    ) {
      return res.status(403).json({
        success: false,
        bloqueado: true,
        message: 'IMPRESSÃO BLOQUEADA: Esta prova ainda NÃO foi aprovada para impressão pelo responsável do Setor de Provas.'
      });
    }

    const versaoAprovada = prova.idVersaoAprovada;
    if (!versaoAprovada || !versaoAprovada.arquivo) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo da versão aprovada não localizado.'
      });
    }

    // 3. Auditoria do download para impressão
    await registrarAtividade({
      usuarioId: req.user._id,
      acao: ACOES_AUDITORIA.DOWNLOAD_IMPRESSAO,
      descricao: `Arquivo aprovado da versão ${versaoAprovada.rotuloVersao} baixado para impressão por ${req.user.nome} (${req.user.perfil}).`,
      provaId: prova._id,
      versaoId: versaoAprovada._id
    });

    // 4. Entrega do arquivo (local ou redirect para cloud/blob)
    const downloadInfo = await resolveFileDownload(
      versaoAprovada.arquivo.storageKey,
      versaoAprovada.arquivo
    );

    if (downloadInfo.type === 'localPath') {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(versaoAprovada.arquivo.nomeOriginal)}"`
      );
      res.setHeader('Content-Type', versaoAprovada.arquivo.mimeType);
      const stream = fs.createReadStream(downloadInfo.target);
      return stream.pipe(res);
    } else {
      // URL externa assinada ou Vercel Blob
      return res.redirect(downloadInfo.target);
    }
  } catch (error) {
    next(error);
  }
};

// POST /api/provas/:id/concluir
const concluirProva = async (req, res, next) => {
  try {
    const { id } = req.params;

    const prova = await Prova.findById(id);
    if (!prova) {
      return res.status(404).json({ success: false, message: 'Prova não encontrada.' });
    }

    if (!prova.aprovadoParaImpressao) {
      return res.status(400).json({
        success: false,
        message: 'A prova não pode ser concluída sem antes ter sido aprovada para impressão.'
      });
    }

    prova.status = STATUS_PROVA.CONCLUIDA;
    prova.responsavelUltimaAlteracao = req.user._id;
    await prova.save();

    await registrarAtividade({
      usuarioId: req.user._id,
      acao: ACOES_AUDITORIA.FINALIZAR_PROVA,
      descricao: `Prova '${prova.titulo}' (${prova.codigo}) foi marcada como Concluída por ${req.user.nome}.`,
      provaId: prova._id
    });

    res.status(200).json({
      success: true,
      message: 'Prova finalizada e marcada como Concluída!',
      prova
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  iniciarConferencia,
  solicitarCorrecao,
  encaminharValidacao,
  validarProfessor,
  solicitarAjustes,
  aprovarFinal,
  obterArquivoImpressao,
  concluirProva
};
