const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Acesso não autorizado. Token não fornecido ou inválido.'
      });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'secret_fallback_key_setor_provas';

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (jwtErr) {
      return res.status(401).json({
        success: false,
        message: 'Token expirado ou inválido. Por favor, faça login novamente.'
      });
    }

    const usuario = await Usuario.findById(decoded.id);

    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuário associado ao token não foi encontrado.'
      });
    }

    if (!usuario.ativo) {
      return res.status(403).json({
        success: false,
        message: 'Esta conta de usuário foi desativada. Contate o administrador.'
      });
    }

    // Injeta o usuário autenticado na requisição
    req.user = usuario;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = auth;
