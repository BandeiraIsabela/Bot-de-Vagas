const axios = require('axios');

/**
 * Jooble é um agregador com API gratuita mediante cadastro simples (como
 * a Adzuna) — cobre o Canadá de forma ampla, agregando milhares de sites.
 *
 * IMPORTANTE #1: cada domínio regional da Jooble usa uma chave própria. Pra
 * vagas do Canadá, cadastre-se especificamente em:
 *   https://ca.jooble.org/api/about
 * (uma chave obtida em jooble.org "comum" só cobre vagas dos EUA)
 *
 * IMPORTANTE #2 — LIMITE BAIXO E VITALÍCIO: o free tier da Jooble dá só
 * 500 CHAMADAS NO TOTAL por chave, pra sempre (não é por mês). Mesmo
 * fazendo só 1 chamada por ciclo (como este código já faz), rodando a
 * cada 10 minutos isso dá ~144 chamadas/dia — a chave se esgota em
 * menos de 4 dias de bot ligado o tempo todo. Quando isso acontecer,
 * essa fonte simplesmente para de retornar vagas (sem quebrar o resto
 * do bot) — gere uma chave nova gratuita em ca.jooble.org/api/about
 * (é instantâneo) e atualize o JOOBLE_API_KEY no .env quando quiser
 * reativar. Pra esticar mais a cota, considere rodar o bot com um
 * intervalo maior que 10 minutos, ou aceitar que essa fonte específica
 * funciona "por rodadas".
 *
 * Recebe a lista inteira de cargos-alvo e faz UMA chamada só por ciclo,
 * igual ao padrão já usado pra Adzuna — evita gastar a cota gratuita
 * rápido demais.
 */
async function buscarJooble(cargosAlvo, localizacao = 'Canada') {
  const apiKey = process.env.JOOBLE_API_KEY;

  if (!apiKey) {
    console.warn('[Jooble] JOOBLE_API_KEY não configurada no .env — pulando esta fonte.');
    return [];
  }

  try {
    const { data } = await axios.post(
      `https://ca.jooble.org/api/${apiKey}`,
      {
        keywords: cargosAlvo.join(' '),
        location: localizacao
      },
      { timeout: 15000 }
    );

    const vagas = data?.jobs || [];

    return vagas
      .map((job, indice) => {
        const idBase = job.id || job.link || `${job.title}-${indice}`;
        return {
          id: `jooble-${Buffer.from(String(idBase)).toString('base64').slice(0, 24)}`,
          fonte: 'Jooble',
          titulo: job.title,
          empresa: job.company || 'Não informado',
          localizacao: job.location || localizacao,
          link: job.link,
          descricao: (job.snippet || '').replace(/<[^>]+>/g, ' ').slice(0, 4000),
          publicadoEm: job.updated || null
        };
      })
      .filter((v) => v.titulo && v.link);
  } catch (err) {
    console.error('[Jooble] erro ao buscar vagas:', err.message);
    return [];
  }
}

module.exports = { buscarJooble };
