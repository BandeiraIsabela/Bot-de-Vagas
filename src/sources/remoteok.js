const axios = require('axios');

/**
 * RemoteOK tem um endpoint JSON público e gratuito, sem chave. O primeiro
 * item do array retornado é sempre um objeto de aviso/legal, não uma vaga
 * — por isso o .slice(1). Não aceita busca por palavra-chave no servidor,
 * então trazemos a lista toda (últimas vagas publicadas) e deixamos o
 * matcher.js filtrar depois.
 */
async function buscarRemoteOK() {
  try {
    const { data } = await axios.get('https://remoteok.com/api', {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const vagas = Array.isArray(data) ? data.slice(1) : [];

    return vagas
      .map((job) => ({
        id: `remoteok-${job.id}`,
        fonte: 'RemoteOK',
        titulo: job.position || job.title,
        empresa: job.company || 'Não informado',
        localizacao: job.location || 'Remoto',
        link: job.url,
        descricao: (job.description || '').replace(/<[^>]+>/g, ' ').slice(0, 4000),
        publicadoEm: job.date || null
      }))
      .filter((v) => v.titulo && v.link);
  } catch (err) {
    console.error('[RemoteOK] erro ao buscar vagas:', err.message);
    return [];
  }
}

module.exports = { buscarRemoteOK };
