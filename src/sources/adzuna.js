const axios = require('axios');

/**
 * Adzuna tem API oficial gratuita (limite diário/mensal baixo no free
 * tier) e cobre vários países, incluindo Brasil ('br') e Canadá ('ca').
 *
 * IMPORTANTE: recebe a lista INTEIRA de cargos-alvo e faz UMA chamada só,
 * combinando todos com lógica "OU" via parâmetro `what_or`. Antes disso,
 * o bot fazia uma chamada por cargo-alvo (6 chamadas por região a cada
 * ciclo de 10 min — quase 1.700/dia, bem acima do limite gratuito), o que
 * causava erro 503 constante por excesso de chamadas.
 */
async function buscarAdzuna(cargosAlvo, paisCodigo = 'br', onde = '') {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    console.warn('[Adzuna] ADZUNA_APP_ID/ADZUNA_APP_KEY não configurados no .env — pulando esta fonte.');
    return [];
  }

  try {
    const url = `https://api.adzuna.com/v1/api/jobs/${paisCodigo}/search/1`;
    const { data } = await axios.get(url, {
      params: {
        app_id: appId,
        app_key: appKey,
        what_or: cargosAlvo.join(' '),
        where: onde || undefined,
        results_per_page: 50
      },
      timeout: 15000
    });

    return (data.results || []).map((job) => ({
      id: `adzuna-${paisCodigo}-${job.id}`,
      fonte: 'Adzuna',
      titulo: job.title,
      empresa: job.company?.display_name || 'Não informado',
      localizacao: job.location?.display_name || 'Não informado',
      link: job.redirect_url,
      descricao: (job.description || '').slice(0, 4000),
      publicadoEm: job.created
    }));
  } catch (err) {
    console.error(`[Adzuna/${paisCodigo}] erro ao buscar vagas:`, err.message);
    return [];
  }
}

module.exports = { buscarAdzuna };
