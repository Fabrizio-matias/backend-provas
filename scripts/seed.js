const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../src/config/database');

const Usuario = require('../src/models/Usuario');
const Prova = require('../src/models/Prova');
const Versao = require('../src/models/Versao');
const Atividade = require('../src/models/Atividade');
const {
  PERFIS,
  STATUS_PROVA,
  STATUS_VALIDACAO,
  STATUS_APROVACAO,
  ACOES_AUDITORIA
} = require('../src/utils/constants');

async function seed() {
  try {
    console.log(' Conectando ao MongoDB para semeadura inicial...');
    await connectDB();

    console.log(' Limpando dados de teste anteriores...');
    await Usuario.deleteMany({});
    await Prova.deleteMany({});
    await Versao.deleteMany({});
    await Atividade.deleteMany({});

    console.log(' Criando usuários padrão com perfis do sistema...');
    const admin = await Usuario.create({
      nome: 'Administrador do Sistema',
      email: 'admin@colegio.edu.br',
      senha: 'admin123',
      perfil: PERFIS.ADMIN,
      ativo: true
    });

    const profCarlos = await Usuario.create({
      nome: 'Prof. Carlos Eduardo',
      email: 'carlos@colegio.edu.br',
      senha: 'senha123',
      perfil: PERFIS.PROFESSOR,
      disciplinas: ['Matemática', 'Física'],
      ativo: true
    });

    const profAna = await Usuario.create({
      nome: 'Profa. Ana Beatriz',
      email: 'ana@colegio.edu.br',
      senha: 'senha123',
      perfil: PERFIS.PROFESSOR,
      disciplinas: ['História', 'Geografia'],
      ativo: true
    });

    const setorFuncionario = await Usuario.create({
      nome: 'Mariana Lima (Setor de Provas)',
      email: 'setor@colegio.edu.br',
      senha: 'setor123',
      perfil: PERFIS.SETOR_PROVAS,
      ativo: true
    });

    const aprovadorChefe = await Usuario.create({
      nome: 'Prof. Roberto Mendes (Aprovador Final)',
      email: 'aprovador@colegio.edu.br',
      senha: 'aprovador123',
      perfil: PERFIS.APROVADOR,
      ativo: true
    });

    const coordenacaoPedagogica = await Usuario.create({
      nome: 'Coordenação Pedagógica',
      email: 'coordenacao@colegio.edu.br',
      senha: 'coord123',
      perfil: PERFIS.COORDENACAO,
      ativo: true
    });

    console.log(' Usuários criados com sucesso!');

    // Prova 1: Carlos - Matemática - 1º Tri - AG - Aprovada para impressão (demonstra fluxo completo e liberação)
    console.log(' Criando Prova 1 (Aprovada para impressão)...');
    const dataApp1 = new Date();
    dataApp1.setDate(dataApp1.getDate() + 7);
    const prazo1 = new Date();
    prazo1.setDate(prazo1.getDate() + 3);

    const prova1 = new Prova({
      codigo: 'PRV-2026-0001',
      titulo: 'Avaliação Geral de Matemática - Funções Quadráticas',
      professor: profCarlos._id,
      disciplina: 'Matemática',
      turma: '1º Ano EM A',
      dataAplicacao: dataApp1,
      prazoEntrega: prazo1,
      trimestre: '1º',
      divisao: 'AG',
      status: STATUS_PROVA.APROVADA_IMPRESSAO,
      versaoAtual: 2,
      aprovadoParaImpressao: true,
      aprovadoPor: aprovadorChefe._id,
      dataAprovacao: new Date(),
      observacoes: 'Prova revisada pelo setor e conteúdo homologado pelo professor.',
      responsavelUltimaAlteracao: aprovadorChefe._id
    });
    await prova1.save();

    // Versão 1 de Prova 1
    const v1Prova1 = await Versao.create({
      prova: prova1._id,
      numeroVersao: 1,
      rotuloVersao: 'V1',
      arquivo: {
        nomeOriginal: 'Prova_Matematica_1EM_V1.pdf',
        url: '/uploads/provas/exemplo-matematica-v1.pdf',
        storageKey: 'provas/exemplo-matematica-v1.pdf',
        tamanho: 245000,
        mimeType: 'application/pdf'
      },
      usuarioEnvio: profCarlos._id,
      tipoEnvio: 'inicial_professor',
      descricaoAlteracoes: 'Versão inicial enviada para conferência de digitação e formatação.',
      validacaoProfessor: {
        status: STATUS_VALIDACAO.NAO_NECESSARIO
      },
      aprovacaoFinal: {
        status: STATUS_APROVACAO.PENDENTE
      }
    });

    // Versão 2 de Prova 1 (aprovada)
    const v2Prova1 = await Versao.create({
      prova: prova1._id,
      numeroVersao: 2,
      rotuloVersao: 'V2',
      arquivo: {
        nomeOriginal: 'Prova_Matematica_1EM_Final_Aprovada.pdf',
        url: '/uploads/provas/exemplo-matematica-v2.pdf',
        storageKey: 'provas/exemplo-matematica-v2.pdf',
        tamanho: 249000,
        mimeType: 'application/pdf'
      },
      usuarioEnvio: setorFuncionario._id,
      tipoEnvio: 'correcao_setor',
      descricaoAlteracoes: 'Ajuste de cabeçalho escolar e correção ortográfica no enunciado da questão 3.',
      houveAlteracaoConteudo: true,
      validacaoProfessor: {
        status: STATUS_VALIDACAO.APROVADO,
        observacoes: 'Aprovado pelo professor Carlos.',
        data: new Date(),
        usuario: profCarlos._id
      },
      aprovacaoFinal: {
        status: STATUS_APROVACAO.APROVADO,
        observacoes: 'Revisado e liberado para impressão da tiragem de 35 cópias.',
        data: new Date(),
        usuario: aprovadorChefe._id
      }
    });

    prova1.historicoVersoes = [v1Prova1._id, v2Prova1._id];
    prova1.idVersaoAprovada = v2Prova1._id;
    await prova1.save();

    // Prova 2: Ana - História - 2º Tri - AD - Aguardando validação do professor
    console.log(' Criando Prova 2 (Aguardando validação do professor)...');
    const dataApp2 = new Date();
    dataApp2.setDate(dataApp2.getDate() + 14);
    const prazo2 = new Date();
    prazo2.setDate(prazo2.getDate() + 8);

    const prova2 = new Prova({
      codigo: 'PRV-2026-0002',
      titulo: 'Avaliação Diagnóstica de História - Revolução Francesa',
      professor: profAna._id,
      disciplina: 'História',
      turma: '8º Ano B',
      dataAplicacao: dataApp2,
      prazoEntrega: prazo2,
      trimestre: '2º',
      divisao: 'AD',
      status: STATUS_PROVA.AGUARDANDO_VALIDACAO_PROFESSOR,
      versaoAtual: 2,
      aprovadoParaImpressao: false,
      observacoes: 'Setor refez o mapa da página 2 para melhorar legibilidade.',
      responsavelUltimaAlteracao: setorFuncionario._id
    });
    await prova2.save();

    const v1Prova2 = await Versao.create({
      prova: prova2._id,
      numeroVersao: 1,
      rotuloVersao: 'V1',
      arquivo: {
        nomeOriginal: 'Hist_8B_AD_V1.docx',
        url: '/uploads/provas/exemplo-historia-v1.docx',
        storageKey: 'provas/exemplo-historia-v1.docx',
        tamanho: 180000,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      },
      usuarioEnvio: profAna._id,
      tipoEnvio: 'inicial_professor',
      descricaoAlteracoes: 'Upload inicial.'
    });

    const v2Prova2 = await Versao.create({
      prova: prova2._id,
      numeroVersao: 2,
      rotuloVersao: 'V2',
      arquivo: {
        nomeOriginal: 'Hist_8B_AD_V2_Corrigida.pdf',
        url: '/uploads/provas/exemplo-historia-v2.pdf',
        storageKey: 'provas/exemplo-historia-v2.pdf',
        tamanho: 210000,
        mimeType: 'application/pdf'
      },
      usuarioEnvio: setorFuncionario._id,
      tipoEnvio: 'correcao_setor',
      descricaoAlteracoes: 'Substituição do mapa da questão 2 por imagem em alta resolução e ajuste tipográfico.',
      houveAlteracaoConteudo: true,
      validacaoProfessor: {
        status: STATUS_VALIDACAO.PENDENTE
      },
      aprovacaoFinal: {
        status: STATUS_APROVACAO.PENDENTE
      }
    });

    prova2.historicoVersoes = [v1Prova2._id, v2Prova2._id];
    await prova2.save();

    // Prova 3: Carlos - Física - 1º Tri - AG - Em conferência
    console.log(' Criando Prova 3 (Em conferência)...');
    const dataApp3 = new Date();
    dataApp3.setDate(dataApp3.getDate() + 5);
    const prazo3 = new Date();
    prazo3.setDate(prazo3.getDate() + 2);

    const prova3 = new Prova({
      codigo: 'PRV-2026-0003',
      titulo: 'Avaliação Geral de Física - Leis de Newton',
      professor: profCarlos._id,
      disciplina: 'Física',
      turma: '2º Ano EM A',
      dataAplicacao: dataApp3,
      prazoEntrega: prazo3,
      trimestre: '1º',
      divisao: 'AG',
      status: STATUS_PROVA.EM_CONFERENCIA,
      versaoAtual: 1,
      aprovadoParaImpressao: false,
      responsavelUltimaAlteracao: setorFuncionario._id
    });
    await prova3.save();

    const v1Prova3 = await Versao.create({
      prova: prova3._id,
      numeroVersao: 1,
      rotuloVersao: 'V1',
      arquivo: {
        nomeOriginal: 'Fisica_2EM_LeisNewton.pdf',
        url: '/uploads/provas/exemplo-fisica-v1.pdf',
        storageKey: 'provas/exemplo-fisica-v1.pdf',
        tamanho: 310000,
        mimeType: 'application/pdf'
      },
      usuarioEnvio: profCarlos._id,
      tipoEnvio: 'inicial_professor',
      descricaoAlteracoes: 'Prova cadastrada pelo professor.'
    });

    prova3.historicoVersoes = [v1Prova3._id];
    await prova3.save();

    // Prova 4: Ana - Geografia - 3º Tri - AG - Aguardando aprovação final
    console.log(' Criando Prova 4 (Aguardando aprovação final)...');
    const dataApp4 = new Date();
    dataApp4.setDate(dataApp4.getDate() + 20);
    const prazo4 = new Date();
    prazo4.setDate(prazo4.getDate() + 10);

    const prova4 = new Prova({
      codigo: 'PRV-2026-0004',
      titulo: 'Avaliação Geral de Geografia - Geopolítica e Climatologia',
      professor: profAna._id,
      disciplina: 'Geografia',
      turma: '9º Ano A',
      dataAplicacao: dataApp4,
      prazoEntrega: prazo4,
      trimestre: '3º',
      divisao: 'AG',
      status: STATUS_PROVA.AGUARDANDO_APROVACAO_FINAL,
      versaoAtual: 1,
      aprovadoParaImpressao: false,
      observacoes: 'Fluxo simplificado: diagramação validada pelo setor, sem alterações conceituais.',
      responsavelUltimaAlteracao: setorFuncionario._id
    });
    await prova4.save();

    const v1Prova4 = await Versao.create({
      prova: prova4._id,
      numeroVersao: 1,
      rotuloVersao: 'V1',
      arquivo: {
        nomeOriginal: 'Geografia_9A_AG.pdf',
        url: '/uploads/provas/exemplo-geografia-v1.pdf',
        storageKey: 'provas/exemplo-geografia-v1.pdf',
        tamanho: 420000,
        mimeType: 'application/pdf'
      },
      usuarioEnvio: profAna._id,
      tipoEnvio: 'inicial_professor',
      descricaoAlteracoes: 'Versão inicial revisada.',
      houveAlteracaoConteudo: false,
      validacaoProfessor: {
        status: STATUS_VALIDACAO.NAO_NECESSARIO
      },
      aprovacaoFinal: {
        status: STATUS_APROVACAO.PENDENTE
      }
    });

    prova4.historicoVersoes = [v1Prova4._id];
    await prova4.save();

    // Registra Atividades de Auditoria Iniciais
    console.log(' Gravando histórico de auditoria...');
    await Atividade.create([
      {
        usuario: admin._id,
        acao: ACOES_AUDITORIA.LOGIN,
        descricao: 'Inicialização do banco e criação de usuários de teste.'
      },
      {
        usuario: profCarlos._id,
        acao: ACOES_AUDITORIA.CADASTRO_PROVA,
        descricao: `Prova '${prova1.titulo}' cadastrada com V1.`,
        prova: prova1._id,
        versao: v1Prova1._id
      },
      {
        usuario: setorFuncionario._id,
        acao: ACOES_AUDITORIA.ENVIO_NOVA_VERSAO,
        descricao: `Versão V2 enviada com correções ortográficas e de cabeçalho.`,
        prova: prova1._id,
        versao: v2Prova1._id
      },
      {
        usuario: profCarlos._id,
        acao: ACOES_AUDITORIA.VALIDACAO_PROFESSOR_APROVADO,
        descricao: `Professor validou o conteúdo da versão V2.`,
        prova: prova1._id,
        versao: v2Prova1._id
      },
      {
        usuario: aprovadorChefe._id,
        acao: ACOES_AUDITORIA.APROVACAO_FINAL,
        descricao: `Prova liberada para impressão na versão V2 pelo Aprovador Final.`,
        prova: prova1._id,
        versao: v2Prova1._id
      },
      {
        usuario: profAna._id,
        acao: ACOES_AUDITORIA.CADASTRO_PROVA,
        descricao: `Prova '${prova2.titulo}' cadastrada com V1.`,
        prova: prova2._id,
        versao: v1Prova2._id
      },
      {
        usuario: setorFuncionario._id,
        acao: ACOES_AUDITORIA.ENVIO_NOVA_VERSAO,
        descricao: `Versão V2 enviada com mapa em alta definição. Encaminhada para validação.`,
        prova: prova2._id,
        versao: v2Prova2._id
      }
    ]);

    console.log('\n======================================================');
    console.log(' SEED EXECUTADO COM SUCESSO!');
    console.log('======================================================');
    console.log('Credenciais para teste no sistema:');
    console.log('1. Administrador:');
    console.log('   E-mail: admin@colegio.edu.br | Senha: admin123');
    console.log('2. Professor (Carlos - Matemática/Física):');
    console.log('   E-mail: carlos@colegio.edu.br | Senha: senha123');
    console.log('3. Professora (Ana - História/Geografia):');
    console.log('   E-mail: ana@colegio.edu.br | Senha: senha123');
    console.log('4. Setor de Provas (Mariana):');
    console.log('   E-mail: setor@colegio.edu.br | Senha: setor123');
    console.log('5. Aprovador Final (Roberto):');
    console.log('   E-mail: aprovador@colegio.edu.br | Senha: aprovador123');
    console.log('6. Coordenação Pedagógica:');
    console.log('   E-mail: coordenacao@colegio.edu.br | Senha: coord123');
    console.log('======================================================\n');

    process.exit(0);
  } catch (error) {
    console.error(' Erro ao executar o seed:', error);
    process.exit(1);
  }
}

seed();
