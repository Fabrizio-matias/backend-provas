const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const relatorioController = require('../controllers/relatorioController');

router.get('/provas', auth, relatorioController.getRelatorioProvas);

module.exports = router;
