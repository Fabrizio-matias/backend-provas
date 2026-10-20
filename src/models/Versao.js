const mongoose = require('mongoose');
const { STATUS_VALIDACAO, STATUS_APROVACAO } = require('../utils/constants');

const VersaoSchema = new mongoose.Schema(
  {
    prova: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prova',
      required: [true, 'A prova vinculada é obrigatória.'],
      index: true
    },
    numeroVersao: {
      type: Number,
      required: [true, 'O número da versão é obrigatório.']
    },
    rotuloVersao: {
      type: String, // ex: 'V1', 'V2', 'V3'
      default: function () {
        return `V${this.numeroVersao}`;
      }
    },
    arquivo: {
      nomeOriginal: {
        type: String,
        required: [true, 'O nome original do arquivo é obrigatório.']
      },
      url: {
        type: String,
        required: [true, 'A URL de armazenamento é obrigatória.']
      },
      storageKey: {
        type: String,
        required: [true, 'A chave de identificação no armazenamento é obrigatória.']
      },
      tamanho: {
        type: Number,
        default: 0
      },
      mimeType: {
        type: String,
        default: 'application/octet-stream'
      }
    },
    usuarioEnvio: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: [true, 'O usuário responsável pelo envio é obrigatório.']
    },
    tipoEnvio: {
      type: String,
      enum: ['inicial_professor', 'correcao_setor', 'nova_versao_professor'],
      default: 'inicial_professor'
    },
    descricaoAlteracoes: {
      type: String,
      default: 'Versão inicial cadastrada pelo professor.'
    },
    observacoesFuncionario: {
      type: String,
      default: ''
    },
    houveAlteracaoConteudo: {
      type: Boolean,
      default: false
    },
    validacaoProfessor: {
      status: {
        type: String,
        enum: Object.values(STATUS_VALIDACAO),
        default: STATUS_VALIDACAO.NAO_NECESSARIO
      },
      observacoes: {
        type: String,
        default: ''
      },
      data: {
        type: Date,
        default: null
      },
      usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null
      }
    },
    aprovacaoFinal: {
      status: {
        type: String,
        enum: Object.values(STATUS_APROVACAO),
        default: STATUS_APROVACAO.PENDENTE
      },
      observacoes: {
        type: String,
        default: ''
      },
      data: {
        type: Date,
        default: null
      },
      usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null
      }
    }
  },
  {
    timestamps: true
  }
);

VersaoSchema.index({ prova: 1, numeroVersao: 1 }, { unique: true });

module.exports = mongoose.model('Versao', VersaoSchema);
