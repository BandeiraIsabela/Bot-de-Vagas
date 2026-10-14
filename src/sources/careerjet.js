const axios = require('axios');

/**
 * Careerjet tem uma API de afiliado gratuita (cadastro simples, sem
 * cartão de crédito, aprovação automática) — cobre dezenas de países,
 * incluindo o Canadá. Cadastre-se em:
 *   https://www.careerjet.com/partners/signup.html
 * Depois de confirmar o email, pegue seu "Affiliate ID" (affid) no painel
 * e coloque em CAREERJET_AFFID no .env.
 *
 * Usa o endpoint público mais antigo da Careerjet (public.api.careerjet.net),
 * que continua funcionando sem exigir whitelist de IP — diferente da API
 * v4 mais nova, pensada pra sites com tráfego real e mais burocrática de
 * configurar. Não tem um limite vitalício rígido documentado como a
 * Jooble, mas ainda assim fazemos só 1 chamada por ciclo (cargos-alvo
 * combinados numa busca só), pelo mesmo motivo de sempre: economizar cota.
 */
async function buscarCareerjet(cargosAlvo, localeCode = 'en_CA') {
  const affid = process.env.CAREERJET_AFFID;

  if (!affid) {
    console.warn('[Careerjet] CAREERJET_AFFID não configurado no .env — pulando esta fonte.');
    return [];
  }

  try {
    const { data } = await axios.get('http://public.api.careerjet.net/search', {
      params: {
        affid,
        keywords: cargosAlvo.join(' '),
        locale_code: localeCode,
        user_ip: '1.1.1.1',
        user_agent: 'Mozilla/5.0',
        pagesize: 50
      },
      timeout: 15000
    });

    const vagas = data?.jobs || [];

    return vagas
      .map((job) => ({
        id: `careerjet-${Buffer.from(String(job.url || job.title)).toString('base64').slice(0, 24)}`,
        fonte: 'Careerjet',
        titulo: job.title,
        empresa: job.company || 'Não informado',
        localizacao: job.locations || 'Não informado',
        link: job.url,
        descricao: (job.description || '').replace(/<[^>]+>/g, ' ').slice(0, 4000),
        publicadoEm: job.date || null
      }))
      .filter((v) => v.titulo && v.link);
  } catch (err) {
    console.error('[Careerjet] erro ao buscar vagas:', err.message);
    return [];
  }
}

module.exports = { buscarCareerjet };
