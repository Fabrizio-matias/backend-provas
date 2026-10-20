const mongoose = require('mongoose');

const AtividadeSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: [true, 'O usuário da atividade é obrigatório.'],
      index: true
    },
    acao: {
      type: String,
      required: [true, 'O tipo de ação é obrigatório.'],
      index: true
    },
    descricao: {
      type: String,
      required: [true, 'A descrição da atividade é obrigatória.']
    },
    prova: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prova',
      index: true
    },
    versao: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Versao'
    },
    detalhes: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

AtividadeSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Atividade', AtividadeSchema);
