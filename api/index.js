const app = require('../src/app');
const connectDB = require('../src/config/database');

module.exports = async (req, res) => {
  try {
    if (process.env.MONGODB_URI) {
      await connectDB();
    }
  } catch (error) {
    console.error('Erro na conexão serverless com MongoDB:', error);
  }
  return app(req, res);
};
