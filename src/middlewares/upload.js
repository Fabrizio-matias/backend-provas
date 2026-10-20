const multer = require('multer');

// Usamos armazenamento em memória para ter acesso imediato ao buffer
// facilitando o envio para Vercel Blob, AWS S3 ou disco local
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'image/jpeg',
  'image/png',
  'application/zip',
  'application/x-zip-compressed'
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Tipo de arquivo não permitido. Apenas PDF, DOC, DOCX, ODT, PNG, JPG e ZIP são aceitos.'
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // Limite de 50MB por arquivo
  },
  fileFilter
});

module.exports = upload;
