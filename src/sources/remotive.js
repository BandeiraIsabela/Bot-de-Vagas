const axios = require('axios');

/**
 * Remotive tem uma API pública e gratuita, sem necessidade de chave.
 * Docs: https://remotive.com/api-documentation
 */
async function buscarRemotive(termoBusca) {
  try {
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(termoBusca)}`;
    const { data } = await axios.get(url, { timeout: 15000 });

    return (data.jobs || []).map((job) => ({
      id: `remotive-${job.id}`,
      fonte: 'Remotive',
      titulo: job.title,
      empresa: job.company_name,
      localizacao: job.candidate_required_location || 'Remoto',
      link: job.url,
      descricao: (job.description || '').replace(/<[^>]+>/g, ' ').slice(0, 4000),
      publicadoEm: job.publication_date
    }));
  } catch (err) {
    console.error('[Remotive] erro ao buscar vagas:', err.message);
    return [];
  }
}

module.exports = { buscarRemotive };
