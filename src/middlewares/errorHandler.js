const errorHandler = (err, req, res, next) => {
  console.error(' [Error Handler]', err);

  // Erro do Multer
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'O arquivo enviado excede o tamanho máximo permitido de 50MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Erro no upload do arquivo: ${err.message}`
    });
  }

  // Erro de Validação do Mongoose
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos fornecidos.',
      errors: messages
    });
  }

  // Erro de Chave Duplicada no MongoDB (ex: e-mail já cadastrado)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `O campo '${field}' já está em uso por outro registro.`
    });
  }

  // Erro de Cast do Mongoose (ID inválido)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Identificador com formato inválido: ${err.value}`
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Ocorreu um erro interno no servidor.'
  });
};

module.exports = errorHandler;
