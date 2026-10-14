const axios = require('axios');

/**
 * Arbeitnow tem uma API pública gratuita e OFICIAL (não é engenharia
 * reversa de site nenhum), sem necessidade de chave. Cobre vagas remotas
 * e da Europa, várias das quais aceitam candidatos de qualquer lugar.
 *
 * Não aceita busca por palavra-chave no servidor — buscamos as primeiras
 * páginas (mais recentes) e deixamos o matcher.js filtrar pelo
 * título/descrição depois. Docs: https://arbeitnow.com/api/job-board-api
 */
async function buscarArbeitnow() {
  try {
    const vagas = [];

    // Busca as 2 primeiras páginas (~200 vagas) — recente o suficiente
    // sem sobrecarregar a API gratuita a cada ciclo de 10 minutos.
    for (let pagina = 1; pagina <= 2; pagina++) {
      const { data } = await axios.get('https://arbeitnow.com/api/job-board-api', {
        params: { page: pagina },
        timeout: 15000
      });

      const lote = data?.data || [];
      if (lote.length === 0) break;

      lote.forEach((job) => {
        vagas.push({
          id: `arbeitnow-${job.slug}`,
          fonte: 'Arbeitnow',
          titulo: job.title,
          empresa: job.company_name || 'Não informado',
          localizacao: job.remote ? 'Remoto' : (job.location || 'Não informado'),
          link: job.url,
          descricao: (job.description || '').replace(/<[^>]+>/g, ' ').slice(0, 4000),
          publicadoEm: job.created_at ? new Date(job.created_at * 1000).toISOString() : null
        });
      });
    }

    return vagas;
  } catch (err) {
    console.error('[Arbeitnow] erro ao buscar vagas:', err.message);
    return [];
  }
}

module.exports = { buscarArbeitnow };
