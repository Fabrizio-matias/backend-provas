const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { requireRole } = require('../middlewares/role');
const upload = require('../middlewares/upload');
const { PERFIS } = require('../utils/constants');

const provaController = require('../controllers/provaController');
const versaoController = require('../controllers/versaoController');
const workflowController = require('../controllers/workflowController');

// Listagem e cadastro de provas
router.get('/', auth, provaController.listarProvas);
router.post(
  '/',
  auth,
  requireRole(PERFIS.PROFESSOR, PERFIS.SETOR_PROVAS, PERFIS.ADMIN),
  upload.single('arquivo'),
  provaController.criarProva
);

// Detalhes e atualização cadastral
router.get('/:id', auth, provaController.obterProvaPorId);
router.patch(
  '/:id',
  auth,
  requireRole(PERFIS.PROFESSOR, PERFIS.SETOR_PROVAS, PERFIS.ADMIN),
  provaController.atualizarProva
);

// Controle de Versões
router.get('/:id/versoes', auth, versaoController.listarVersoes);
router.post(
  '/:id/versoes',
  auth,
  requireRole(PERFIS.PROFESSOR, PERFIS.SETOR_PROVAS, PERFIS.ADMIN),
  upload.single('arquivo'),
  versaoController.enviarNovaVersao
);

// Etapas do Fluxo de Trabalho (Workflow)
router.post(
  '/:id/iniciar-conferencia',
  auth,
  requireRole(PERFIS.SETOR_PROVAS, PERFIS.ADMIN),
  workflowController.iniciarConferencia
);

router.post(
  '/:id/solicitar-correcao',
  auth,
  requireRole(PERFIS.SETOR_PROVAS, PERFIS.ADMIN),
  workflowController.solicitarCorrecao
);

router.post(
  '/:id/encaminhar-validacao',
  auth,
  requireRole(PERFIS.SETOR_PROVAS, PERFIS.ADMIN),
  workflowController.encaminharValidacao
);

router.post(
  '/:id/validar-professor',
  auth,
  requireRole(PERFIS.PROFESSOR, PERFIS.ADMIN),
  workflowController.validarProfessor
);

router.post(
  '/:id/solicitar-ajustes',
  auth,
  requireRole(PERFIS.PROFESSOR, PERFIS.ADMIN),
  workflowController.solicitarAjustes
);

router.post(
  '/:id/aprovar-final',
  auth,
  requireRole(PERFIS.APROVADOR, PERFIS.SETOR_PROVAS, PERFIS.ADMIN),
  workflowController.aprovarFinal
);

// BLOQUEIO CRÍTICO DE IMPRESSÃO: Libera exclusivamente se aprovada para impressão
router.get('/:id/arquivo-impressao', auth, workflowController.obterArquivoImpressao);

router.post(
  '/:id/concluir',
  auth,
  requireRole(PERFIS.APROVADOR, PERFIS.SETOR_PROVAS, PERFIS.ADMIN),
  workflowController.concluirProva
);

module.exports = router;
