const Prova = require('../models/Prova');
const Versao = require('../models/Versao');
const {
  PERFIS,
  STATUS_PROVA,
  STATUS_VALIDACAO,
  STATUS_APROVACAO,
  ACOES_AUDITORIA
} = require('../utils/constants');
const { uploadFile } = require('../services/storageService');
const { registrarAtividade } = require('../services/atividadeService');

// GET /api/provas/:id/versoes
const listarVersoes = async (req, res, next) => {
  try {
    const { id } = req.params;

    const prova = await Prova.findById(id);
    if (!prova) {
      return res.status(404).json({
        success: false,
        message: 'Prova não encontrada.'
      });
    }

    if (
      req.user.perfil === PERFIS.PROFESSOR &&
      prova.professor.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Você só pode acessar versões de suas próprias provas.'
      });
    }

    const versoes = await Versao.find({ prova: id })
      .populate('usuarioEnvio', 'nome email perfil')
      .populate('validacaoProfessor.usuario', 'nome email perfil')
      .populate('aprovacaoFinal.usuario', 'nome email perfil')
      .sort({ numeroVersao: -1 });

    res.status(200).json({
      success: true,
      versoes
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/provas/:id/versoes
const enviarNovaVersao = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      descricaoAlteracoes,
      observacoesFuncionario,
      houveAlteracaoConteudo
    } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'É necessário anexar um arquivo para criar uma nova versão.'
      });
    }

    const prova = await Prova.findById(id);
    if (!prova) {
      return res.status(404).json({
        success: false,
        message: 'Prova não encontrada.'
      });
    }

    // Regra de autorização
    if (
      req.user.perfil === PERFIS.PROFESSOR &&
      prova.professor.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Você só pode enviar versões para suas próprias provas.'
      });
    }

    if (prova.status === STATUS_PROVA.CONCLUIDA) {
      return res.status(400).json({
        success: false,
        message: 'Não é possível enviar novas versões para uma prova já concluída.'
      });
    }

    const ehProfessor = req.user.perfil === PERFIS.PROFESSOR;
    const alterouConteudo =
      houveAlteracaoConteudo === true ||
      houveAlteracaoConteudo === 'true' ||
      houveAlteracaoConteudo === '1';

    // 1. Upload do novo arquivo
    const arquivoSalvo = await uploadFile(req.file, 'provas');

    // 2. Incrementa versão
    const proximaVersao = (prova.versaoAtual || 1) + 1;

    // 3. REGRA DE SEGURANÇA CRÍTICA:
    // O envio de uma nova versão INVALIDA IMEDIATAMENTE qualquer autorização de impressão prévia
    prova.aprovadoParaImpressao = false;
    prova.idVersaoAprovada = null;
    prova.aprovadoPor = null;
    prova.dataAprovacao = null;
    prova.versaoAtual = proximaVersao;
    prova.responsavelUltimaAlteracao = req.user._id;

    // 4. Cria documento da versão
    let tipoEnvio = 'correcao_setor';
    let validacaoProfStatus = STATUS_VALIDACAO.NAO_NECESSARIO;

    if (ehProfessor) {
      tipoEnvio = 'nova_versao_professor';
      prova.status = STATUS_PROVA.AGUARDANDO_CONFERENCIA;
    } else {
      // Enviado pelo Setor de Provas ou Admin
      tipoEnvio = 'correcao_setor';
      if (alterouConteudo) {
        // Regra obrigatória: Se houve alteração de conteúdo, o professor DEVE validar
        validacaoProfStatus = STATUS_VALIDACAO.PENDENTE;
        prova.status = STATUS_PROVA.AGUARDANDO_VALIDACAO_PROFESSOR;
      } else {
        // Fluxo simplificado (apenas diagramação/formatação/cabeçalho)
        validacaoProfStatus = STATUS_VALIDACAO.NAO_NECESSARIO;
        prova.status = STATUS_PROVA.AGUARDANDO_APROVACAO_FINAL;
      }
    }

    const novaVersao = await Versao.create({
      prova: prova._id,
      numeroVersao: proximaVersao,
      rotuloVersao: `V${proximaVersao}`,
      arquivo: arquivoSalvo,
      usuarioEnvio: req.user._id,
      tipoEnvio,
      descricaoAlteracoes:
        descricaoAlteracoes || `Versão V${proximaVersao} enviada por ${req.user.nome}.`,
      observacoesFuncionario: observacoesFuncionario || '',
      houveAlteracaoConteudo: alterouConteudo,
      validacaoProfessor: {
        status: validacaoProfStatus,
        observacoes: '',
        data: null,
        usuario: null
      },
      aprovacaoFinal: {
        status: STATUS_APROVACAO.PENDENTE,
        observacoes: '',
        data: null,
        usuario: null
      }
    });

    // 5. Vincula a versão à prova e salva
    prova.historicoVersoes.push(novaVersao._id);
    await prova.save();

    // 6. Auditoria
    await registrarAtividade({
      usuarioId: req.user._id,
      acao: ACOES_AUDITORIA.ENVIO_NOVA_VERSAO,
      descricao: `Nova versão V${proximaVersao} enviada por ${req.user.nome} para a prova '${prova.titulo}'. Status atualizado para '${prova.status}'.`,
      provaId: prova._id,
      versaoId: novaVersao._id,
      detalhes: {
        numeroVersao: proximaVersao,
        houveAlteracaoConteudo: alterouConteudo,
        novoStatus: prova.status
      }
    });

    res.status(201).json({
      success: true,
      message: `Versão V${proximaVersao} enviada com sucesso!`,
      prova,
      versao: novaVersao
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listarVersoes,
  enviarNovaVersao
};
