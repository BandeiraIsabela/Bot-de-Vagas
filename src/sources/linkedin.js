const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Usa o endpoint público "guest" de busca de vagas do LinkedIn (o mesmo que
 * carrega em linkedin.com/jobs/search sem estar logada). Não faz login nem
 * usa sua conta, então não há risco de banimento de conta.
 *
 * RESPEITANDO O LIMITE DE REQUISIÇÕES (erro 429 "Too Many Requests"):
 *  - Rodada única por hora: o bot chama esta função uma vez por cargo-alvo
 *    em cada ciclo de 10 min. Aqui, só a primeira "rodada" de cada hora é
 *    executada (as chamadas do mesmo ciclo passam; as dos ciclos seguintes
 *    na mesma hora são ignoradas). Isso reduz de ~72 para ~12 requisições/hora.
 *  - Espaçamento: no mínimo 4s entre requisições.
 *  - Pausa após 429: se o LinkedIn responder 429, paramos de chamar por 2h
 *    (ou pelo tempo do cabeçalho Retry-After, se vier). Insistir só
 *    prolonga o bloqueio.
 *
 * Limitação: essa listagem não traz a descrição completa da vaga (só
 * título, empresa e localização). Por isso o matcher.js usa um critério mais
 * frouxo de palavras-chave pra vagas do LinkedIn.
 */

const INTERVALO_ENTRE_RODADAS_MS = 60 * 60 * 1000; // 1 rodada por hora
const JANELA_DA_RODADA_MS = 8 * 60 * 1000; // cobre um ciclo inteiro do bot (10 min)
const ESPACAMENTO_ENTRE_REQUISICOES_MS = 4000;
const PAUSA_APOS_429_MS = 2 * 60 * 60 * 1000;

let rodadaIniciadaEm = 0;
let bloqueadoAte = 0;
let proximoSlot = 0;

function podeExecutarAgora() {
  const agora = Date.now();

  if (agora < bloqueadoAte) return false;

  const dentroDaRodadaAtual = agora - rodadaIniciadaEm <= JANELA_DA_RODADA_MS;
  if (dentroDaRodadaAtual) return true;

  const jaPassouUmaHora = agora - rodadaIniciadaEm >= INTERVALO_ENTRE_RODADAS_MS;
  if (jaPassouUmaHora) {
    rodadaIniciadaEm = agora; // abre uma nova rodada
    return true;
  }

  return false; // rodada desta hora já foi feita
}

async function esperarSeuTurno() {
  const inicio = Math.max(Date.now(), proximoSlot);
  proximoSlot = inicio + ESPACAMENTO_ENTRE_REQUISICOES_MS;
  const espera = inicio - Date.now();
  if (espera > 0) await new Promise((resolve) => setTimeout(resolve, espera));
}

async function buscarLinkedIn(termoBusca, localizacao) {
  if (!podeExecutarAgora()) return [];

  try {
    await esperarSeuTurno();

    const url = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search';
    const { data: html } = await axios.get(url, {
      params: { keywords: termoBusca, location: localizacao, start: 0 },
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(html);
    const vagas = [];

    $('li').each((_, el) => {
      const $el = $(el);
      const link = $el.find('a.base-card__full-link').attr('href');
      const titulo = $el.find('h3.base-search-card__title').text().trim();
      const empresa = $el.find('h4.base-search-card__subtitle').text().trim();
      const localizacaoVaga = $el.find('span.job-search-card__location').text().trim();

      if (!link || !titulo) return;

      const linkLimpo = link.split('?')[0];
      const idMatch = linkLimpo.match(/-(\d+)$/);
      const id = idMatch ? idMatch[1] : Buffer.from(linkLimpo).toString('base64').slice(0, 24);

      vagas.push({
        id: `linkedin-${id}`,
        fonte: 'LinkedIn',
        titulo,
        empresa: empresa || 'Não informado',
        localizacao: localizacaoVaga || localizacao,
        link: linkLimpo,
        descricao: `${titulo} ${empresa} ${localizacaoVaga}`,
        publicadoEm: null
      });
    });

    return vagas;
  } catch (err) {
    if (err.response && err.response.status === 429) {
      const retryAfterSeg = parseInt(err.response.headers?.['retry-after'], 10);
      const pausa = Number.isFinite(retryAfterSeg) && retryAfterSeg > 0
        ? retryAfterSeg * 1000
        : PAUSA_APOS_429_MS;
      bloqueadoAte = Date.now() + pausa;
      console.warn(
        `[LinkedIn] limite de requisições atingido (429). Pausando esta fonte por ${Math.round(pausa / 60000)} min — as outras fontes seguem normalmente.`
      );
      return [];
    }
    console.error('[LinkedIn] erro ao buscar vagas (endpoint pode ter mudado):', err.message);
    return [];
  }
}

module.exports = { buscarLinkedIn };
