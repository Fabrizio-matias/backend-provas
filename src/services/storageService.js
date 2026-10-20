const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Detecta o provedor configurado
function getProvider() {
  const provider = (process.env.STORAGE_PROVIDER || '').toLowerCase();
  if (provider === 'vercel-blob' || process.env.BLOB_READ_WRITE_TOKEN) {
    return 'vercel-blob';
  }
  if (
    provider === 's3' ||
    (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_S3_BUCKET)
  ) {
    return 's3';
  }
  return 'local';
}

/**
 * Faz o upload de um arquivo para o armazenamento configurado.
 * @param {Object} file - Objeto do Multer contendo buffer, originalname, mimetype, size
 * @param {String} pasta - Subpasta lógica (ex: 'provas')
 * @returns {Promise<{ nomeOriginal: string, url: string, storageKey: string, tamanho: number, mimeType: string }>}
 */
async function uploadFile(file, pasta = 'provas') {
  if (!file || !file.buffer) {
    throw new Error('Nenhum arquivo válido fornecido para upload.');
  }

  const provider = getProvider();
  const randomSuffix = crypto.randomBytes(6).toString('hex');
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageKey = `${pasta}/${Date.now()}-${randomSuffix}-${safeName}`;

  if (provider === 'vercel-blob') {
    try {
      const { put } = require('@vercel/blob');
      const blob = await put(storageKey, file.buffer, {
        access: 'public',
        contentType: file.mimetype,
        token: process.env.BLOB_READ_WRITE_TOKEN
      });

      return {
        nomeOriginal: file.originalname,
        url: blob.url,
        storageKey: blob.pathname || storageKey,
        tamanho: file.size,
        mimeType: file.mimetype
      };
    } catch (err) {
      console.error('Erro ao enviar arquivo para o Vercel Blob:', err);
      throw new Error(`Falha no upload para o Vercel Blob: ${err.message}`);
    }
  }

  if (provider === 's3') {
    try {
      const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
      const s3 = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      });

      const bucket = process.env.AWS_S3_BUCKET;
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: file.buffer,
          ContentType: file.mimetype
        })
      );

      const url = `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${storageKey}`;
      return {
        nomeOriginal: file.originalname,
        url,
        storageKey,
        tamanho: file.size,
        mimeType: file.mimetype
      };
    } catch (err) {
      console.error('Erro ao enviar arquivo para o Amazon S3:', err);
      throw new Error(`Falha no upload para o Amazon S3: ${err.message}`);
    }
  }

  // Fallback Local (Ambiente de desenvolvimento local)
  const uploadsDir = path.resolve(__dirname, '../../uploads', pasta);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const fileName = `${Date.now()}-${randomSuffix}-${safeName}`;
  const localFilePath = path.join(uploadsDir, fileName);
  await fs.promises.writeFile(localFilePath, file.buffer);

  const localKey = `${pasta}/${fileName}`;
  const localUrl = `/uploads/${localKey}`;

  return {
    nomeOriginal: file.originalname,
    url: localUrl,
    storageKey: localKey,
    tamanho: file.size,
    mimeType: file.mimetype
  };
}

/**
 * Retorna o arquivo ou caminho para download seguro
 * @param {String} storageKey
 * @returns {Promise<{ type: 'url'|'stream'|'localPath', target: string }>}
 */
async function resolveFileDownload(storageKey, fileMetadata) {
  const provider = getProvider();

  if (provider === 'vercel-blob') {
    // Retorna a URL direta do blob
    return { type: 'url', target: fileMetadata.url };
  }

  if (provider === 's3') {
    return { type: 'url', target: fileMetadata.url };
  }

  // Local
  const localPath = path.resolve(__dirname, '../../uploads', storageKey);
  if (fs.existsSync(localPath)) {
    return { type: 'localPath', target: localPath };
  }

  // Se o storageKey for uma URL direta
  if (fileMetadata && fileMetadata.url && fileMetadata.url.startsWith('http')) {
    return { type: 'url', target: fileMetadata.url };
  }

  throw new Error('Arquivo não encontrado no armazenamento.');
}

module.exports = {
  getProvider,
  uploadFile,
  resolveFileDownload
};
