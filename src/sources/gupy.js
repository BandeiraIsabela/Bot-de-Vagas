const axios = require('axios');

/**
 * Endpoint público não-documentado do portal Gupy (employability-portal.gupy.io).
 * Testado ao vivo em 30/09/2026 e confirmado funcionando — retorna 200 com
 * dados reais. Se voltar a dar 404 de forma constante no futuro, o
 * endpoint pode ter mudado de novo (ou sido descontinuado) e vale
 * pesquisar o endpoint atual antes de tentar "consertar" às cegas.
 *
 * ATENÇÃO aos nomes de campos: confirmados pela resposta real da API,
 * que usa nomes diferentes do que se poderia supor:
 *   - título da vaga vem em "name" (não "title")
 *   - nome da empresa vem em "careerPageName" (não "company")
 *   - link de candidatura vem em "jobUrl" (não "applyUrl")
 *   - tipo de contrato vem em "type" (não "employmentType")
 */
async function buscarGupy(termoBusca) {
  try {
    const url = 'https://employability-portal.gupy.io/api/v1/jobs';
    const { data } = await axios.get(url, {
      params: {
        jobName: termoBusca,
        limit: 20,
        offset: 0
      },
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json'
      }
    });

    const vagas = data?.data || [];

    return vagas.map((job) => ({
      id: `gupy-${job.id}`,
      fonte: 'Gupy',
      titulo: job.name,
      empresa: job.careerPageName || 'Não informado',
      localizacao: job.isRemoteWork ? 'Remoto' : (job.city ? `${job.city}, ${job.state}` : 'Não informado'),
      link: job.jobUrl,
      // Esse endpoint traz a descrição completa da vaga em "description"
      descricao: (job.description || '').replace(/<[^>]+>/g, ' ').slice(0, 4000),
      publicadoEm: job.publishedDate
    })).filter((v) => v.titulo && v.link); // descarta qualquer item sem título/link válido
  } catch (err) {
    console.error('[Gupy] erro ao buscar vagas (endpoint pode ter mudado de novo):', err.message);
    return [];
  }
}

module.exports = { buscarGupy };
