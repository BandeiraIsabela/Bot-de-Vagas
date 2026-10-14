const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Tenta extrair o texto visível de uma página de vaga, pra usar como
 * "descrição" na hora de destacar palavras-chave no currículo. É melhor
 * esforço: muitos sites (LinkedIn, Indeed, páginas com login, sites que
 * renderizam o conteúdo via JavaScript) vão bloquear ou retornar pouca
 * coisa. Quando isso acontece, retorna string vazia — o currículo ainda
 * é gerado normalmente, só sem o destaque extra de palavras-chave
 * específicas daquela vaga.
 */
async function buscarTextoDaPagina(url) {
  try {
    const { data: html } = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(html);
    $('script, style, nav, header, footer').remove();

    const texto = $('body').text().replace(/\s+/g, ' ').trim();
    return texto.slice(0, 6000);
  } catch (err) {
    console.warn(`  → Não consegui extrair o texto da página (${err.message}). Currículo será gerado sem descrição extra.`);
    return '';
  }
}

module.exports = { buscarTextoDaPagina };
