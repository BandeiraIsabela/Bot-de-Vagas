// Fontes cuja listagem não traz a descrição completa da vaga (só
// título/empresa/localização) — ver nota em src/sources/linkedin.js.
// Pra essas, exigimos só 1 palavra-chave obrigatória em vez de 2,
// já que o texto disponível pra bater é bem mais curto.
const FONTES_COM_DESCRICAO_LIMITADA = ['LinkedIn'];

function normalizar(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // remove acentos
}

function contemAlguma(texto, lista) {
  const t = normalizar(texto);
  return lista.some((termo) => t.includes(normalizar(termo)));
}

/**
 * Retorna true se a vaga combina com o perfil configurado em config/profile.json
 */
function vagaCombinaComPerfil(vaga, regiao) {
  const textoCompleto = `${vaga.titulo} ${vaga.descricao}`;

  if (contemAlguma(textoCompleto, regiao.excluirSeConter)) {
    return false;
  }

  const mencionaAlgumNivel = contemAlguma(textoCompleto, [
    ...regiao.nivel,
    ...regiao.excluirSeConter
  ]);
  if (mencionaAlgumNivel && !contemAlguma(textoCompleto, regiao.nivel)) {
    return false;
  }

  const obrigatoriasBatidas = regiao.palavrasChaveObrigatorias.filter((p) =>
    normalizar(textoCompleto).includes(normalizar(p))
  );
  const minimoObrigatorias = FONTES_COM_DESCRICAO_LIMITADA.includes(vaga.fonte) ? 1 : 2;
  if (obrigatoriasBatidas.length < minimoObrigatorias) {
    return false;
  }

  if (regiao.localizacao.aceitaSomenteRemoto) {
    if (!contemAlguma(vaga.localizacao, ['remoto', 'remote', 'home office'])) {
      return false;
    }
  } else {
    const localOk = contemAlguma(vaga.localizacao, regiao.localizacao.cidades) ||
      contemAlguma(textoCompleto, regiao.localizacao.cidades);
    if (!localOk) {
      return false;
    }
  }

  return true;
}

/**
 * Calcula um score simples (0-100) pra ordenar as vagas mais aderentes primeiro
 */
function calcularScore(vaga, regiao) {
  const textoCompleto = normalizar(`${vaga.titulo} ${vaga.descricao}`);
  let score = 0;

  regiao.palavrasChaveObrigatorias.forEach((p) => {
    if (textoCompleto.includes(normalizar(p))) score += 10;
  });
  regiao.palavrasChaveDesejaveis.forEach((p) => {
    if (textoCompleto.includes(normalizar(p))) score += 5;
  });
  if (contemAlguma(textoCompleto, regiao.cargosAlvo)) score += 20;

  return Math.min(score, 100);
}

module.exports = { vagaCombinaComPerfil, calcularScore };
