const mongoose = require('mongoose');
const {
  STATUS_PROVA,
  STATUS_PROVA_ARRAY,
  TRIMESTRES,
  DIVISOES
} = require('../utils/constants');

const ProvaSchema = new mongoose.Schema(
  {
    codigo: {
      type: String,
      unique: true,
      index: true
    },
    titulo: {
      type: String,
      required: [true, 'O título da prova é obrigatório.'],
      trim: true
    },
    professor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: [true, 'O professor responsável é obrigatório.'],
      index: true
    },
    disciplina: {
      type: String,
      required: [true, 'A disciplina é obrigatória.'],
      trim: true,
      index: true
    },
    turma: {
      type: String,
      required: [true, 'A turma é obrigatória.'],
      trim: true,
      index: true
    },
    dataAplicacao: {
      type: Date,
      required: [true, 'A data de aplicação é obrigatória.']
    },
    prazoEntrega: {
      type: Date,
      required: [true, 'O prazo de entrega é obrigatório.']
    },
    trimestre: {
      type: String,
      enum: {
        values: TRIMESTRES,
        message: 'Trimestre inválido. Escolha entre 1º, 2º ou 3º.'
      },
      required: [true, 'O trimestre é obrigatório.'],
      index: true
    },
    divisao: {
      type: String,
      enum: {
        values: DIVISOES,
        message: 'Divisão inválida. Escolha entre AG ou AD.'
      },
      required: [true, 'A divisão da avaliação (AG ou AD) é obrigatória.'],
      index: true
    },
    status: {
      type: String,
      enum: {
        values: STATUS_PROVA_ARRAY,
        message: 'Status inválido: {VALUE}'
      },
      default: STATUS_PROVA.ENVIADA,
      index: true
    },
    versaoAtual: {
      type: Number,
      default: 1
    },
    // Guarda o ID exato da versão aprovada para impressão
    idVersaoAprovada: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Versao',
      default: null
    },
    aprovadoParaImpressao: {
      type: Boolean,
      default: false,
      index: true
    },
    aprovadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null
    },
    dataAprovacao: {
      type: Date,
      default: null
    },
    observacoes: {
      type: String,
      default: ''
    },
    responsavelUltimaAlteracao: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    historicoVersoes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Versao'
      }
    ]
  },
  {
    timestamps: true
  }
);

// Geração automática do código de prova (ex: PRV-2026-0001)
ProvaSchema.pre('save', async function (next) {
  if (this.isNew && !this.codigo) {
    try {
      const ano = new Date().getFullYear();
      const count = await this.constructor.countDocuments();
      const seq = String(count + 1).padStart(4, '0');
      this.codigo = `PRV-${ano}-${seq}`;
    } catch (err) {
      // fallback com timestamp se falhar a contagem
      const rand = Math.floor(1000 + Math.random() * 9000);
      this.codigo = `PRV-${new Date().getFullYear()}-${rand}`;
    }
  }
  next();
});

// Índices compostos para filtros rápidos
ProvaSchema.index({ trimestre: 1, divisao: 1 });
ProvaSchema.index({ turma: 1, trimestre: 1, divisao: 1 });
ProvaSchema.index({ professor: 1, status: 1 });

module.exports = mongoose.model('Prova', ProvaSchema);
