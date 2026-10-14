const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

const TEXTOS_POR_IDIOMA = {
  pt: {
    resumo: 'Resumo',
    habilidades: 'Habilidades Técnicas',
    experiencia: 'Experiência Profissional',
    projetos: 'Projetos',
    formacao: 'Formação'
  },
  en: {
    resumo: 'Summary',
    habilidades: 'Technical Skills',
    experiencia: 'Professional Experience',
    projetos: 'Projects',
    formacao: 'Education'
  }
};

function extrairPalavrasChaveDaVaga(descricaoVaga, regiao) {
  const texto = (descricaoVaga || '').toLowerCase();
  const candidatas = [...regiao.palavrasChaveObrigatorias, ...regiao.palavrasChaveDesejaveis];
  const encontradas = new Set();
  candidatas.forEach((termo) => {
    if (texto.includes(termo.toLowerCase())) encontradas.add(termo);
  });
  return Array.from(encontradas);
}

async function gerarCurriculoParaVaga(vaga, profile, regiao) {
  const idioma = regiao.idioma === 'en' ? 'en' : 'pt';
  const base = idioma === 'en' ? profile.curriculoBaseEN : profile.curriculoBase;
  const textos = TEXTOS_POR_IDIOMA[idioma];

  const keywordsDaVaga = extrairPalavrasChaveDaVaga(vaga.descricao, regiao);

  const habilidadesOrdenadas = [...base.habilidadesTecnicas].sort((a, b) => {
    const aMatch = keywordsDaVaga.includes(a.toLowerCase()) ? 0 : 1;
    const bMatch = keywordsDaVaga.includes(b.toLowerCase()) ? 0 : 1;
    return aMatch - bMatch;
  });

  const children = [];

  children.push(
    new Paragraph({ text: profile.seuNome, heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [new TextRun(`${base.contato.email} | ${base.contato.telefone} | ${base.contato.cidade} | ${base.contato.linkedin}`)]
    }),
    new Paragraph({ text: '' })
  );

  children.push(
    new Paragraph({ text: textos.resumo, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: base.resumo }),
    new Paragraph({ text: '' })
  );

  children.push(
    new Paragraph({ text: textos.habilidades, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: habilidadesOrdenadas.join(', ') }),
    new Paragraph({ text: '' })
  );

  children.push(new Paragraph({ text: textos.experiencia, heading: HeadingLevel.HEADING_1 }));
  base.experiencias.forEach((exp) => {
    children.push(
      new Paragraph({ children: [new TextRun({ text: `${exp.cargo} — ${exp.empresa}`, bold: true })] }),
      new Paragraph({ text: exp.periodo, italics: true })
    );
    exp.bullets.forEach((b) => children.push(new Paragraph({ text: `• ${b}` })));
    children.push(new Paragraph({ text: '' }));
  });

  children.push(new Paragraph({ text: textos.projetos, heading: HeadingLevel.HEADING_1 }));
  base.projetos.forEach((proj) => {
    children.push(
      new Paragraph({ children: [new TextRun({ text: proj.nome, bold: true })] }),
      new Paragraph({ text: proj.descricao }),
      new Paragraph({ text: '' })
    );
  });

  children.push(new Paragraph({ text: textos.formacao, heading: HeadingLevel.HEADING_1 }));
  base.formacao.forEach((f) => {
    children.push(
      new Paragraph({ children: [new TextRun({ text: `${f.curso} — ${f.instituicao}`, bold: true })] }),
      new Paragraph({ text: f.periodo }),
      new Paragraph({ text: '' })
    );
  });

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const buffer = await Packer.toBuffer(doc);

  const sufixoIdioma = idioma === 'en' ? 'en' : 'pt';
  const nomeArquivo = `curriculo_${sufixoIdioma}_${slugify(vaga.empresa)}_${slugify(vaga.titulo)}.docx`;
  const outDir = path.join(__dirname, '..', 'resume', 'gerados');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, nomeArquivo);
  fs.writeFileSync(outPath, buffer);

  return { outPath, nomeArquivo, keywordsDaVaga };
}

function slugify(texto) {
  return (texto || 'vaga')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

module.exports = { gerarCurriculoParaVaga };
