/**
 * Roda este script UMA ÚNICA VEZ, direto no seu PC (não dentro do Docker):
 *   1. npm install
 *   2. node scripts/setup-google-auth.js
 *   3. Abra o link que aparecer, faça login e autorize.
 *   4. Um arquivo config/google-token.json é criado sozinho.
 */
require('dotenv').config();
const http = require('http');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const TOKEN_PATH = path.join(__dirname, '..', 'config', 'google-token.json');

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('❌ Preencha GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET no .env antes de rodar este script.');
  process.exit(1);
}

const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
  ]
});

console.log('\n📎 Abra este link no navegador e faça login com a conta Google que o bot deve usar:\n');
console.log(authUrl);
console.log('\n⏳ Aguardando você autorizar...\n');

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, REDIRECT_URI);
    const code = url.searchParams.get('code');
    const erro = url.searchParams.get('error');

    if (erro) {
      res.end('Autorização cancelada ou negada.');
      console.error(`❌ Autorização não concluída: ${erro}`);
      server.close();
      process.exit(1);
      return;
    }
    if (!code) {
      res.end('Nenhum código recebido nessa requisição.');
      return;
    }

    const { tokens } = await oAuth2Client.getToken(code);
    fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

    res.end('✅ Autorizado com sucesso! Pode fechar esta aba e voltar pro terminal.');
    console.log(`✅ Token salvo em: ${TOKEN_PATH}`);
    console.log('Agora você já pode rodar o bot normalmente com "docker compose up".');
    server.close();
    process.exit(0);
  } catch (err) {
    res.end('Erro ao trocar o código pelo token. Confira o terminal.');
    console.error('❌ Erro ao finalizar a autorização:', err.message);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`(Aguardando resposta em http://localhost:${PORT} — não feche este terminal ainda)`);
});
