const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { requireRole } = require('../middlewares/role');
const { PERFIS } = require('../utils/constants');
const usuarioController = require('../controllers/usuarioController');

// Rota para listar professores (acessível por setor de provas e admin para preencher formulários)
router.get(
  '/professores',
  auth,
  requireRole(PERFIS.ADMIN, PERFIS.SETOR_PROVAS, PERFIS.COORDENACAO),
  usuarioController.listarProfessores
);

// Rotas de administração de usuários (apenas Administrador)
router.get('/', auth, requireRole(PERFIS.ADMIN), usuarioController.listarUsuarios);
router.post('/', auth, requireRole(PERFIS.ADMIN), usuarioController.criarUsuario);
router.patch('/:id', auth, requireRole(PERFIS.ADMIN), usuarioController.atualizarUsuario);
router.patch('/:id/status', auth, requireRole(PERFIS.ADMIN), usuarioController.alternarStatusUsuario);

module.exports = router;
