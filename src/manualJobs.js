const { buscarTextoDaPagina } = require('./fetchPage');
const { gerarCurriculoParaVaga } = require('./resumeBuilder');
const {
  lerLinhasManuaisPendentes, atualizarLinhaManual, uploadCurriculo
} = require('./googleSheets');

/**
 * Escolhe qual configuração de região (idioma/palavras-chave) usar pra
 * gerar o currículo, com base na coluna "Idioma" que você preencheu na
 * aba Manual. "en" usa o currículo em inglês; qualquer outra coisa
 * (incluindo vazio) usa português por padrão.
 */
function escolherRegiao(idioma, profile) {
  return idioma === 'en' ? profile.regioes.canada : profile.regioes.brasil;
}

/**
 * Processa todas as linhas pendentes da aba "Manual": pra cada uma, tenta
 * extrair o texto da página da vaga, gera o currículo ajustado, sobe pro
 * Drive, e escreve o resultado de volta na planilha.
 */
async function processarVagasManuais(profile) {
  const pendentes = await lerLinhasManuaisPendentes();

  if (pendentes.length === 0) return;

  console.log(`\n[Manual] ${pendentes.length} vaga(s) colada(s) pra processar...`);

  for (const item of pendentes) {
    try {
      console.log(`[Manual] Processando: ${item.link}`);

      // Se você colou a descrição na planilha, ela tem prioridade (é o jeito
      // confiável pra sites com anti-bot). Só tenta buscar a página se estiver vazia.
      const descricao = item.descricao || await buscarTextoDaPagina(item.link);
      const regiao = escolherRegiao(item.idioma, profile);

      const vaga = {
        titulo: item.cargo || 'Vaga informada manualmente',
        empresa: item.empresa || 'Não informado',
        localizacao: regiao.pais,
        link: item.link,
        descricao,
        fonte: 'Manual'
      };

      const { outPath, nomeArquivo, keywordsDaVaga } = await gerarCurriculoParaVaga(vaga, profile, regiao);
      console.log(`  → Currículo (${regiao.idioma}) gerado (palavras-chave: ${keywordsDaVaga.join(', ') || 'nenhuma extra'})`);

      const linkCurriculo = await uploadCurriculo(outPath, nomeArquivo);
      console.log(`  → Currículo enviado ao Drive: ${linkCurriculo}`);

      await atualizarLinhaManual(item.numeroLinha, 'Pronto', linkCurriculo);
    } catch (err) {
      console.error(`[Manual] Erro ao processar "${item.link}":`, err.message);
      // Grava o erro na própria planilha, pra você ver sem precisar olhar
      // os logs — e pra essa linha não ficar sendo tentada de novo sem parar.
      // Se quiser tentar de novo, é só apagar o texto da coluna Status.
      await atualizarLinhaManual(item.numeroLinha, `Erro: ${err.message}`.slice(0, 200), '');
    }
  }
}

module.exports = { processarVagasManuais };
