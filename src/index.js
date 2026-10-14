require('dotenv').config();
const cron = require('node-cron');

const profile = require('../config/profile.json');
const { buscarRemotive } = require('./sources/remotive');
const { buscarAdzuna } = require('./sources/adzuna');
const { buscarGupy } = require('./sources/gupy');
const { buscarLinkedIn } = require('./sources/linkedin');
const { buscarArbeitnow } = require('./sources/arbeitnow');
const { buscarRemoteOK } = require('./sources/remoteok');
const { buscarJobicy } = require('./sources/jobicy');
const { buscarJooble } = require('./sources/jooble');
const { buscarCareerjet } = require('./sources/careerjet');
const { vagaCombinaComPerfil, calcularScore } = require('./matcher');
const { carregarEstado, salvarEstado, jaFoiProcessada, marcarComoProcessada } = require('./state');
const { gerarCurriculoParaVaga } = require('./resumeBuilder');
const { iniciarGoogle, uploadCurriculo, adicionarVagaNaPlanilha } = require('./googleSheets');
const { processarVagasManuais } = require('./manualJobs');

async function buscarVagasDaRegiao(regiao) {
  let todas = [];

  // Fontes "globais": não aceitam busca por palavra-chave no servidor,
  // então são buscadas uma vez só por ciclo (não uma vez por cargo-alvo)
  // e o matcher.js filtra pelo conteúdo depois.
  const buscasGlobais = [];
  if (regiao.fontes.includes('arbeitnow')) buscasGlobais.push(buscarArbeitnow());
  if (regiao.fontes.includes('remoteok')) buscasGlobais.push(buscarRemoteOK());
  if (regiao.fontes.includes('jobicy')) buscasGlobais.push(buscarJobicy());
  // Adzuna entra aqui também: UMA chamada por região (todos os cargos-alvo
  // combinados com "OU"), não uma chamada por cargo — evita estourar o
  // limite de chamadas do free tier (era a causa do erro 503 constante).
  if (regiao.fontes.includes('adzuna')) {
    buscasGlobais.push(buscarAdzuna(regiao.cargosAlvo, regiao.adzunaPais, regiao.adzunaOnde));
  }
  if (regiao.fontes.includes('jooble')) {
    buscasGlobais.push(buscarJooble(regiao.cargosAlvo, regiao.joobleLocation));
  }
  if (regiao.fontes.includes('careerjet')) {
    buscasGlobais.push(buscarCareerjet(regiao.cargosAlvo, regiao.careerjetLocale));
  }
  const resultadosGlobais = await Promise.all(buscasGlobais);
  resultadosGlobais.forEach((r) => { todas = todas.concat(r); });

  // Fontes que precisam de uma chamada por cargo-alvo (não suportam
  // combinar vários termos numa única busca)
  for (const termo of regiao.cargosAlvo) {
    const buscas = [];

    if (regiao.fontes.includes('remotive')) buscas.push(buscarRemotive(termo));
    if (regiao.fontes.includes('gupy')) buscas.push(buscarGupy(termo));
    if (regiao.fontes.includes('linkedin')) buscas.push(buscarLinkedIn(termo, regiao.linkedinLocation));

    const resultados = await Promise.all(buscas);
    resultados.forEach((r) => { todas = todas.concat(r); });
  }

  return Array.from(new Map(todas.map((v) => [v.id, v])).values());
}

async function processarVaga(vaga, score, regiao) {
  console.log(`Processando [${regiao.pais}]: [${score}%] ${vaga.titulo} — ${vaga.empresa} (${vaga.fonte})`);

  const { outPath, nomeArquivo, keywordsDaVaga } = await gerarCurriculoParaVaga(vaga, profile, regiao);
  console.log(`  → Currículo (${regiao.idioma}) gerado (palavras-chave: ${keywordsDaVaga.join(', ') || 'nenhuma extra'})`);

  const linkCurriculo = await uploadCurriculo(outPath, nomeArquivo);
  console.log(`  → Currículo enviado ao Drive: ${linkCurriculo}`);

  await adicionarVagaNaPlanilha(vaga, score, linkCurriculo, regiao.pais);
  console.log('  → Linha adicionada na planilha.');
}

async function cicloDeBuscaRegiao(regiao) {
  const vagas = await buscarVagasDaRegiao(regiao);
  const state = carregarEstado();
  const combinam = vagas.filter((v) => vagaCombinaComPerfil(v, regiao));
  const novas = combinam.filter((v) => !jaFoiProcessada(state, v.id));

  if (novas.length === 0) {
    console.log(`[${regiao.pais}] Nenhuma vaga nova compatível desta vez.`);
    return;
  }

  novas.sort((a, b) => calcularScore(b, regiao) - calcularScore(a, regiao));

  for (const vaga of novas) {
    const score = calcularScore(vaga, regiao);
    try {
      await processarVaga(vaga, score, regiao);
      marcarComoProcessada(state, vaga);
      salvarEstado(state);
    } catch (err) {
      console.error(`[${regiao.pais}] Erro ao processar a vaga "${vaga.titulo}":`, err.message);
    }
  }
}

async function cicloDeBusca() {
  console.log(`\n[${new Date().toLocaleString('pt-BR')}] Buscando novas vagas...`);
  try {
    for (const regiao of Object.values(profile.regioes)) {
      await cicloDeBuscaRegiao(regiao);
    }
  } catch (err) {
    console.error('Erro durante o ciclo de busca de vagas:', err.message);
  }

  try {
    await processarVagasManuais(profile);
  } catch (err) {
    console.error('Erro ao processar vagas manuais:', err.message);
  }
}

async function main() {
  console.log('🚀 Iniciando vaga-bot...');
  console.log(`Regiões configuradas: ${Object.values(profile.regioes).map((r) => r.pais).join(', ')}`);

  await iniciarGoogle();
  await cicloDeBusca();

  cron.schedule('*/10 * * * *', cicloDeBusca);
  console.log('⏰ Agendado para rodar a cada 10 minutos.');
}

process.on('unhandledRejection', (err) => console.error('Erro não tratado (unhandledRejection):', err));
process.on('uncaughtException', (err) => console.error('Erro não tratado (uncaughtException):', err));

main().catch((err) => console.error('Erro fatal ao iniciar o bot:', err.message));
