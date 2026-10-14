const axios = require('axios');

/**
 * Jobicy tem API pública gratuita, sem chave. Não faz busca livre por
 * palavra-chave no servidor — trazemos um lote de vagas recentes e
 * deixamos o matcher.js filtrar pelo conteúdo depois.
 */
async function buscarJobicy() {
  try {
    const { data } = await axios.get('https://jobicy.com/api/v2/remote-jobs', {
      params: { count: 50 },
      timeout: 15000
    });

    const vagas = data?.jobs || [];

    return vagas.map((job) => ({
      id: `jobicy-${job.id}`,
      fonte: 'Jobicy',
      titulo: job.jobTitle,
      empresa: job.companyName || 'Não informado',
      localizacao: job.jobGeo || 'Remoto',
      link: job.url,
      descricao: (job.jobDescription || job.jobExcerpt || '').replace(/<[^>]+>/g, ' ').slice(0, 4000),
      publicadoEm: job.pubDate || null
    }));
  } catch (err) {
    console.error('[Jobicy] erro ao buscar vagas:', err.message);
    return [];
  }
}

module.exports = { buscarJobicy };
