const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const CABECALHO = [
  'Data', 'País', 'Score (%)', 'Cargo', 'Empresa', 'Localização',
  'Fonte', 'Link da Vaga', 'Link do Currículo (Drive)'
];

const NOME_ABA_MANUAL = 'Manual';
const CABECALHO_MANUAL = [
  'Link da Vaga', 'Cargo (opcional)', 'Empresa (opcional)', 'Idioma (pt/en)',
  'Status', 'Link do Currículo (Drive)', 'Descrição da vaga (cole aqui, opcional)'
];

const REDIRECT_URI = 'http://localhost:53682/oauth2callback';

let sheetsClient;
let driveClient;

async function iniciarGoogle() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const tokenPath = process.env.GOOGLE_OAUTH_TOKEN_PATH || path.join(__dirname, '..', 'config', 'google-token.json');

  if (!clientId || !clientSecret) {
    throw new Error(
      'GOOGLE_OAUTH_CLIENT_ID e/ou GOOGLE_OAUTH_CLIENT_SECRET não configurados no .env.'
    );
  }
  if (!fs.existsSync(tokenPath)) {
    throw new Error(
      `Token do Google não encontrado em "${tokenPath}". Rode "node scripts/setup-google-auth.js" (fora do Docker, uma única vez).`
    );
  }

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  const token = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
  oAuth2Client.setCredentials(token);

  sheetsClient = google.sheets({ version: 'v4', auth: oAuth2Client });
  driveClient = google.drive({ version: 'v3', auth: oAuth2Client });

  await garantirCabecalho();
  await garantirAbaManual();
  console.log('✅ Conectado ao Google Sheets e Google Drive.');
}

async function garantirCabecalho() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const { data } = await sheetsClient.spreadsheets.values.get({ spreadsheetId, range: 'A1:I1' });

  if (!data.values || data.values.length === 0) {
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range: 'A1',
      valueInputOption: 'RAW',
      requestBody: { values: [CABECALHO] }
    });
  }
}

/**
 * Garante que existe uma aba "Manual" na planilha, com cabeçalho. Se ela
 * não existir ainda, cria automaticamente — você não precisa criar essa
 * aba manualmente.
 */
async function garantirAbaManual() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const { data } = await sheetsClient.spreadsheets.get({ spreadsheetId });

  const abaExiste = data.sheets.some((s) => s.properties.title === NOME_ABA_MANUAL);

  if (!abaExiste) {
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: NOME_ABA_MANUAL } } }]
      }
    });
  }

  const { data: cabecalhoAtual } = await sheetsClient.spreadsheets.values.get({
    spreadsheetId,
    range: `${NOME_ABA_MANUAL}!A1:G1`
  });

  const colunasAtuais = (cabecalhoAtual.values && cabecalhoAtual.values[0]) || [];
  if (colunasAtuais.length < CABECALHO_MANUAL.length) {
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range: `${NOME_ABA_MANUAL}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [CABECALHO_MANUAL] }
    });
  }
}

/**
 * Lê as linhas da aba "Manual" e retorna só as que têm um link preenchido
 * e ainda não foram processadas (coluna Status vazia).
 */
async function lerLinhasManuaisPendentes() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const { data } = await sheetsClient.spreadsheets.values.get({
    spreadsheetId,
     range: `${NOME_ABA_MANUAL}!A2:G`
  });

  const linhas = data.values || [];
  const pendentes = [];

  linhas.forEach((linha, indice) => {
    const [link, cargo, empresa, idioma, status, , descricao] = linha;
    if (link && !status) {
      pendentes.push({
        numeroLinha: indice + 2, // +2 porque a planilha começa em 1 e pulamos o cabeçalho
        link: link.trim(),
        cargo: (cargo || '').trim(),
        empresa: (empresa || '').trim(),
        idioma: (idioma || '').trim().toLowerCase(),
        descricao: (descricao || '').trim()
      });
    }
  });

  return pendentes;
}

/**
 * Escreve o resultado do processamento de volta na linha correspondente
 * da aba "Manual" (colunas Status e Link do Currículo).
 */
async function atualizarLinhaManual(numeroLinha, status, linkCurriculo = '') {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: `${NOME_ABA_MANUAL}!E${numeroLinha}:F${numeroLinha}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status, linkCurriculo]] }
  });
}

async function uploadCurriculo(localPath, nomeArquivo) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const { data: arquivo } = await driveClient.files.create({
    requestBody: { name: nomeArquivo, parents: folderId ? [folderId] : undefined },
    media: {
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      body: fs.createReadStream(localPath)
    },
    fields: 'id'
  });

  await driveClient.permissions.create({
    fileId: arquivo.id,
    requestBody: { role: 'reader', type: 'anyone' }
  });

  const { data: arquivoComLink } = await driveClient.files.get({ fileId: arquivo.id, fields: 'webViewLink' });
  return arquivoComLink.webViewLink;
}

async function adicionarVagaNaPlanilha(vaga, score, linkCurriculo, pais) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const linha = [
    new Date().toLocaleString('pt-BR'),
    pais, score, vaga.titulo, vaga.empresa, vaga.localizacao,
    vaga.fonte, vaga.link, linkCurriculo
  ];

  await sheetsClient.spreadsheets.values.append({
    spreadsheetId,
    range: 'A1',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [linha] }
  });
}

module.exports = {
  iniciarGoogle,
  uploadCurriculo,
  adicionarVagaNaPlanilha,
  lerLinhasManuaisPendentes,
  atualizarLinhaManual
};
