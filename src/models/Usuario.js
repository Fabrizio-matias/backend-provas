const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { PERFIS, PERFIS_ARRAY } = require('../utils/constants');

const UsuarioSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: [true, 'O nome é obrigatório.'],
      trim: true,
      minlength: [2, 'O nome deve ter no mínimo 2 caracteres.']
    },
    email: {
      type: String,
      required: [true, 'O e-mail é obrigatório.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Por favor, informe um e-mail válido.']
    },
    senha: {
      type: String,
      required: [true, 'A senha é obrigatória.'],
      minlength: [6, 'A senha deve ter no mínimo 6 caracteres.']
    },
    perfil: {
      type: String,
      enum: {
        values: PERFIS_ARRAY,
        message: 'Perfil inválido: {VALUE}'
      },
      default: PERFIS.PROFESSOR
    },
    ativo: {
      type: Boolean,
      default: true
    },
    disciplinas: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Hash de senha antes de salvar
UsuarioSchema.pre('save', async function (next) {
  if (!this.isModified('senha')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.senha = await bcrypt.hash(this.senha, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Método para comparar senha informada com hash
UsuarioSchema.methods.compararSenha = async function (senhaCandidata) {
  return bcrypt.compare(senhaCandidata, this.senha);
};

// Não retornar a senha em chamadas toJSON
UsuarioSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.senha;
  return obj;
};

module.exports = mongoose.model('Usuario', UsuarioSchema);
