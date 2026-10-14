# vaga-bot 🤖📊

Captura vagas compatíveis com seu perfil a cada 10 minutos (Brasil e Canadá,
em 5 fontes diferentes), gera automaticamente um currículo ajustado
(ATS-friendly) pra cada uma no idioma certo, sobe o currículo pro Google
Drive, e registra tudo numa planilha do Google Sheets.

## Fontes de vagas e confiabilidade

| Fonte | Como funciona | Confiabilidade |
|---|---|---|
| **Remotive** | API pública oficial, sem chave | Alta |
| **Adzuna** | API oficial, precisa de chave gratuita | Alta (1 chamada/região/ciclo) |
| **Arbeitnow** | API pública oficial, sem chave (Canadá) | Alta |
| **RemoteOK** | API pública, sem chave (Canadá) | Alta |
| **Jobicy** | API pública, sem chave (Canadá) | Alta |
| **Gupy** | Endpoint não-documentado do site (BR) — atualizado em set/2026 | Média — pode quebrar sem aviso |
| **LinkedIn** | Página pública "guest" de busca, sem login | Média — pode quebrar sem aviso |

**Indeed foi removido**: não existe mais API pública nem forma estável de
acessá-lo sem login — é o site com a detecção anti-bot mais agressiva entre
os testados, e continuar tentando contornar isso não valia o esforço. As
três fontes novas (Arbeitnow, RemoteOK, Jobicy) cobrem vagas remotas
internacionais e são mais estáveis, então entram só na região **Canadá**
(são focadas em vagas remotas em inglês — fazem mais sentido pra essa
busca). Elas não fazem busca por palavra-chave no servidor: o bot busca as
vagas mais recentes de cada uma e o `matcher.js` filtra pelo conteúdo
depois.

LinkedIn e Indeed **não usam login nem sua conta pessoal** — são endpoints
públicos que qualquer pessoa acessa sem estar logada, então não há risco de
banimento de conta. O risco real é só a fonte parar de retornar resultados
se o site mudar a estrutura da página (nesse caso, as outras 3 fontes
continuam funcionando normalmente). Se o Indeed começar a falhar sempre,
pode remover `"indeed"` da lista `fontes` de uma região no `profile.json`
sem afetar o resto.

Como o LinkedIn e o Indeed não trazem a descrição completa da vaga na
listagem (só título/empresa/local), o critério de palavras-chave é um pouco
mais frouxo pra essas duas fontes — veja `FONTES_COM_DESCRICAO_LIMITADA` em
`src/matcher.js` se quiser ajustar.

## Antes de rodar

Precisa ficar **rodando num computador/servidor seu**, ligado, o tempo todo.

## Passo 1 — Configure o Google Cloud (uma vez só)

Este projeto usa OAuth2 com sua conta Google pessoal (não uma "conta de
serviço" — contas de serviço não têm cota de armazenamento própria no Drive
fora de Shared Drives, recurso só disponível em contas Workspace pagas).

1. Acesse https://console.cloud.google.com/ e crie um projeto novo.
2. **APIs e serviços > Biblioteca**: ative **Google Sheets API** e
   **Google Drive API**.
3. **APIs e serviços > Tela de consentimento OAuth**: escolha **Externo**,
   preencha nome do app e seu email. Na etapa "Usuários de teste", adicione
   seu próprio email (necessário porque o app fica em modo de teste).
4. **APIs e serviços > Credenciais > Criar credenciais > ID do cliente
   OAuth**. Tipo: **App para computador**. Copie o **ID do cliente** e a
   **Chave secreta**.

## Passo 2 — Crie a planilha e a pasta do Drive

1. Crie uma planilha nova no Google Sheets (pode ficar em branco).
2. Pegue o **ID da planilha** da URL:
   `docs.google.com/spreadsheets/d/ESTE_TRECHO/edit`
3. Crie uma pasta no Google Drive pra guardar os currículos.
4. Pegue o **ID da pasta** da URL: `drive.google.com/drive/folders/ESTE_TRECHO`

Como é sua própria conta autenticando via OAuth, não precisa compartilhar
nada com ninguém.

## Passo 3 — Configure e autorize

```bash
cd vaga-bot
cp .env.example .env
```

Preencha no `.env`: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
`GOOGLE_SHEET_ID`, `GOOGLE_DRIVE_FOLDER_ID` (chaves da Adzuna são opcionais).

Rode o script de autorização **uma vez, fora do Docker**:

```bash
npm install
node scripts/setup-google-auth.js
```

Abra o link que aparecer, faça login, autorize (se aparecer aviso de "app
não verificado", clique em Avançado > Acessar mesmo assim — é esperado,
o app está em modo de teste só pra você). Isso cria `config/google-token.json`.

Edite `config/profile.json` com seus dados reais de contato (nos blocos
`curriculoBase` e `curriculoBaseEN`) e ajuste cargos-alvo se quiser.

## Passo 4 — Rode com Docker

```bash
docker compose up --build
```

Rodar em segundo plano: `docker compose up -d --build`
Ver logs: `docker compose logs -f` — Parar: `docker compose down`

## Regiões (Brasil + Canadá)

O `profile.json` tem uma seção `regioes` com Brasil (currículo em
português, `curriculoBase`) e Canadá (currículo em inglês,
`curriculoBaseEN`) — cada uma com suas próprias fontes, cargos-alvo e
critérios. A planilha tem uma coluna **País** pra você filtrar por região.

## Estrutura do projeto

```
vaga-bot/
├── config/
│   ├── profile.json              ← perfil, regiões, currículo PT/EN
│   └── google-token.json         ← token OAuth (gerado pelo script)
├── scripts/
│   └── setup-google-auth.js      ← rode uma vez, fora do Docker
├── src/
│   ├── index.js                   ← orquestrador + agendamento
│   ├── matcher.js                  ← filtra vagas compatíveis
│   ├── resumeBuilder.js              ← gera .docx (PT/EN, ATS-friendly)
│   ├── state.js                       ← controla vagas já processadas
│   ├── googleSheets.js                 ← integração Sheets + Drive (OAuth2)
│   └── sources/
│       ├── remotive.js, adzuna.js        ← fontes estáveis
│       ├── gupy.js, linkedin.js            ← fontes best-effort
│       └── indeed.js                        ← fonte mais frágil
├── data/, resume/gerados/         ← gerado automaticamente
└── .env                           ← suas configurações (não compartilhe)
```

## Segurança

- Nunca compartilhe `config/google-token.json` nem o `.env` publicamente.
- Pra revogar acesso: https://myaccount.google.com/permissions
- Currículos no Drive ficam com link "qualquer pessoa com o link pode ver".
