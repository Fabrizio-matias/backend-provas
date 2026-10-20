const { PERFIS } = require('../utils/constants');

/**
 * Middleware para autorização baseada em perfis
 * @param {...string} perfisPermitidos
 */
function requireRole(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Acesso não autenticado.'
      });
    }

    // Administrador tem acesso a todas as rotas protegidas por perfil por padrão
    if (req.user.perfil === PERFIS.ADMIN) {
      return next();
    }

    if (!perfisPermitidos.includes(req.user.perfil)) {
      return res.status(403).json({
        success: false,
        message: `Acesso negado. O seu perfil (${req.user.perfil}) não possui permissão para executar esta ação.`
      });
    }

    next();
  };
}

module.exports = {
  requireRole
};
