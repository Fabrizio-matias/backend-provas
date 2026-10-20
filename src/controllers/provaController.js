const Prova = require('../models/Prova');
const Versao = require('../models/Versao');
const { PERFIS, STATUS_PROVA, ACOES_AUDITORIA } = require('../utils/constants');
const { uploadFile } = require('../services/storageService');
const { registrarAtividade } = require('../services/atividadeService');

// GET /api/provas
const listarProvas = async (req, res, next) => {
  try {
    const {
      trimestre,
      divisao,
      turma,
      disciplina,
      professor,
      status,
      prazo, // 'atrasadas' | 'proximas'
      busca,
      page = 1,
      limit = 15,
      ordenarPor = 'createdAt',
      ordem = 'desc'
    } = req.query;

    const query = {};

    // Regra de perfil: Professor visualiza apenas as próprias provas
    if (req.user.perfil === PERFIS.PROFESSOR) {
      query.professor = req.user._id;
    } else if (professor) {
      query.professor = professor;
    }

    // Filtros obrigatórios por regra de negócio: Trimestre e Divisão AG/AD
    if (trimestre) {
      query.trimestre = trimestre;
    }
    if (divisao) {
      query.divisao = divisao.toUpperCase();
    }
    if (turma) {
      query.turma = { $regex: turma, $options: 'i' };
    }
    if (disciplina) {
      query.disciplina = { $regex: disciplina, $options: 'i' };
    }
    if (status) {
      query.status = status;
    }

    // Filtro especial de prazo
    if (prazo === 'atrasadas') {
      query.prazoEntrega = { $lt: new Date() };
      query.status = {
        $nin: [STATUS_PROVA.APROVADA_IMPRESSAO, STATUS_PROVA.CONCLUIDA]
      };
    }

    // Busca textual flexível por título, disciplina, turma ou código
    if (busca) {
      const regex = new RegExp(busca, 'i');
      query.$or = [
        { titulo: regex },
        { codigo: regex },
        { disciplina: regex },
        { turma: regex }
      ];
    }

    const paginaNum = Math.max(1, parseInt(page, 10));
    const limiteNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (paginaNum - 1) * limiteNum;

    const sortOptions = {};
    sortOptions[ordenarPor] = ordem === 'asc' ? 1 : -1;

    const [total, provas] = await Promise.all([
      Prova.countDocuments(query),
      Prova.find(query)
        .populate('professor', 'nome email disciplinas')
        .populate('responsavelUltimaAlteracao', 'nome email')
        .populate('aprovadoPor', 'nome email')
        .populate({
          path: 'historicoVersoes',
          select: 'numeroVersao rotuloVersao arquivo usuarioEnvio validacaoProfessor aprovacaoFinal createdAt',
          populate: { path: 'usuarioEnvio', select: 'nome perfil' }
        })
        .sort(sortOptions)
        .skip(skip)
        .limit(limiteNum)
    ]);

    res.status(200).json({
      success: true,
      total,
      pagina: paginaNum,
      totalPaginas: Math.ceil(total / limiteNum) || 1,
      limite: limiteNum,
      dados: provas
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/provas/:id
const obterProvaPorId = async (req, res, next) => {
  try {
    const { id } = req.params;

    const prova = await Prova.findById(id)
      .populate('professor', 'nome email disciplinas')
      .populate('responsavelUltimaAlteracao', 'nome email perfil')
      .populate('aprovadoPor', 'nome email perfil')
      .populate('idVersaoAprovada')
      .populate({
        path: 'historicoVersoes',
        populate: [
          { path: 'usuarioEnvio', select: 'nome email perfil' },
          { path: 'validacaoProfessor.usuario', select: 'nome email perfil' },
          { path: 'aprovacaoFinal.usuario', select: 'nome email perfil' }
        ]
      });

    if (!prova) {
      return res.status(404).json({
        success: false,
        message: 'Prova não encontrada.'
      });
    }

    // Regra de segurança: Se for professor, deve ser o professor responsável
    if (
      req.user.perfil === PERFIS.PROFESSOR &&
      prova.professor._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Você só pode visualizar as provas sob sua responsabilidade.'
      });
    }

    res.status(200).json({
      success: true,
      prova
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/provas
const criarProva = async (req, res, next) => {
  try {
    const {
      titulo,
      disciplina,
      turma,
      dataAplicacao,
      prazoEntrega,
      trimestre,
      divisao,
      observacoes,
      professorId
    } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'O envio do arquivo da prova é obrigatório para cadastrá-la.'
      });
    }

    // Define o professor responsável
    let responsavelProfessor = req.user._id;
    if (
      (req.user.perfil === PERFIS.ADMIN || req.user.perfil === PERFIS.SETOR_PROVAS) &&
      professorId
    ) {
      responsavelProfessor = professorId;
    }

    // 1. Upload do arquivo para o serviço de armazenamento
    const arquivoSalvo = await uploadFile(req.file, 'provas');

    // 2. Criação do documento da prova
    const novaProva = new Prova({
      titulo,
      professor: responsavelProfessor,
      disciplina,
      turma,
      dataAplicacao: new Date(dataAplicacao),
      prazoEntrega: new Date(prazoEntrega),
      trimestre,
      divisao: divisao ? divisao.toUpperCase() : 'AG',
      observacoes: observacoes || '',
      status: STATUS_PROVA.AGUARDANDO_CONFERENCIA, // Vai para a fila de conferência
      versaoAtual: 1,
      responsavelUltimaAlteracao: req.user._id
    });

    await novaProva.save();

    // 3. Criação da Versão 1 (V1)
    const versao1 = await Versao.create({
      prova: novaProva._id,
      numeroVersao: 1,
      arquivo: arquivoSalvo,
      usuarioEnvio: req.user._id,
      tipoEnvio: 'inicial_professor',
      descricaoAlteracoes: 'Versão inicial enviada para conferência do setor.'
    });

    // 4. Vincula a versão no histórico da prova
    novaProva.historicoVersoes.push(versao1._id);
    await novaProva.save();

    // 5. Auditoria
    await registrarAtividade({
      usuarioId: req.user._id,
      acao: ACOES_AUDITORIA.CADASTRO_PROVA,
      descricao: `Prova '${novaProva.titulo}' (${novaProva.codigo}) cadastrada por ${req.user.nome} com a versão V1.`,
      provaId: novaProva._id,
      versaoId: versao1._id
    });

    res.status(201).json({
      success: true,
      message: 'Prova cadastrada com sucesso e encaminhada para a fila de conferência.',
      prova: novaProva,
      versao: versao1
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/provas/:id
const atualizarProva = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      titulo,
      disciplina,
      turma,
      dataAplicacao,
      prazoEntrega,
      trimestre,
      divisao,
      observacoes
    } = req.body;

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
        message: 'Acesso negado. Você só pode editar as próprias provas.'
      });
    }

    if (prova.status === STATUS_PROVA.CONCLUIDA) {
      return res.status(400).json({
        success: false,
        message: 'Não é possível alterar informações de uma prova já concluída.'
      });
    }

    if (titulo) prova.titulo = titulo;
    if (disciplina) prova.disciplina = disciplina;
    if (turma) prova.turma = turma;
    if (dataAplicacao) prova.dataAplicacao = new Date(dataAplicacao);
    if (prazoEntrega) prova.prazoEntrega = new Date(prazoEntrega);
    if (trimestre) prova.trimestre = trimestre;
    if (divisao) prova.divisao = divisao.toUpperCase();
    if (observacoes !== undefined) prova.observacoes = observacoes;

    prova.responsavelUltimaAlteracao = req.user._id;
    await prova.save();

    await registrarAtividade({
      usuarioId: req.user._id,
      acao: ACOES_AUDITORIA.EDICAO_PROVA,
      descricao: `Dados cadastrais da prova '${prova.titulo}' (${prova.codigo}) foram atualizados.`,
      provaId: prova._id
    });

    res.status(200).json({
      success: true,
      message: 'Prova atualizada com sucesso.',
      prova
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listarProvas,
  obterProvaPorId,
  criarProva,
  atualizarProva
};
