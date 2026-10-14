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

Atualmente não existe nenhuma API confiavel e/ou estavel para a GUPY, 
nesse caso durante os logs vai aparecer como quebrado

## Aba Manual: gerar currículo para qualquer vaga

Além da busca automática, você pode gerar um currículo ajustado para qualquer
vaga que encontrar por conta própria (indicação, grupo, site que o bot não
cobre, vaga de uma plataforma com proteção anti-bot, etc.). Para isso, o bot
cria automaticamente uma aba chamada **Manual** na mesma planilha, com estas
colunas:

| Coluna | Nome | O que preencher |
|---|---|---|
| A | Link da Vaga | **Obrigatório.** O link da vaga. |
| B | Cargo (opcional) | Título da vaga. |
| C | Empresa (opcional) | Nome da empresa. |
| D | Idioma (pt/en) | `pt` para currículo em português, `en` para inglês. Em branco, usa português. |
| E | Status | **O bot preenche.** Não escreva nada aqui. |
| F | Link do Currículo (Drive) | **O bot preenche.** |
| G | Descrição da vaga (cole aqui, opcional) | O texto da descrição da vaga, copiado por você. |

### Como usar

1. Abra a aba **Manual** da planilha.
2. Na primeira linha vazia, cole o link da vaga na coluna **A**.
3. (Recomendado) Preencha **Cargo**, **Empresa** e **Idioma**.
4. (Recomendado) Abra a vaga no seu navegador, copie o texto da descrição e
   cole na coluna **G**.
5. Aguarde o próximo ciclo do bot (até 10 minutos). Ele vai preencher
   sozinho as colunas **Status** e **Link do Currículo (Drive)**.
6. Clique no link da coluna **F** para abrir o currículo ajustado.

### Como o bot usa a descrição

O bot compara o texto da vaga com as suas palavras-chave (definidas no
`profile.json`) e coloca no topo da seção de habilidades do currículo as
que aparecem na vaga. Ele escolhe a fonte do texto nesta ordem:

1. **O que você colou na coluna G.** É o jeito mais confiável, e o único que
   funciona bem em sites com proteção anti-bot (como o Indeed) ou que exigem
   login (como o LinkedIn).
2. **O texto da própria página**, se a coluna G estiver vazia. O bot tenta
   baixar a página da vaga sozinho. Isso funciona em páginas simples de
   carreira, mas costuma falhar em sites que exigem login ou que carregam o
   conteúdo via JavaScript.
3. **Nenhum texto**, se as duas opções acima falharem. O currículo ainda é
   gerado normalmente, com o seu currículo base, só sem o destaque de
   palavras-chave

   ### Status possíveis

| Status | Significado |
|---|---|
| *(vazio)* | A linha ainda não foi processada. Será no próximo ciclo. |
| `Pronto` | O currículo foi gerado e o link está na coluna F. |
| `Erro: ...` | Algo falhou. A mensagem explica o motivo. |

Para **tentar de novo** uma linha com erro (ou gerar o currículo novamente
depois de colar uma descrição melhor), apague o conteúdo da célula de
**Status** e das células E e F dessa linha. No próximo ciclo ela será
processada de novo.

### Dicas

- Não apague nem renomeie a aba **Manual** nem o cabeçalho da primeira
  linha. O bot depende deles.
- Você pode colar várias vagas de uma vez, uma por linha. O bot processa
  todas as pendentes no mesmo ciclo.
- O currículo gerado fica salvo na sua pasta do Google Drive e também em
  `resume/gerados/`, no seu computador.

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
│       ├── remotive.js, adzuna.js, remoteok.js, arbeitnow.js        ← fontes estáveis
│       ├── linkedin.js, jobicy.js, jooble.js, careerjet.js    ← fontes best-effort
│       └── gupy.js,                        ← fonte mais frágil
├── data/, resume/gerados/         ← gerado automaticamente
└── .env                           ← suas configurações (não compartilhe suas chaves)
```
## Conteudo do ENV.:

Copie este arquivo para ".env" e preencha suas credenciais

Crie grátis em https://developer.adzuna.com/ (necessário pra vagas via Adzuna)
- ADZUNA_APP_ID= 
- ADZUNA_APP_KEY= 

Crie grátis em https://ca.jooble.org/api/about (necessário pra vagas via
Jooble no Canadá — IMPORTANTE: cadastre-se no domínio ca.jooble.org, não
no jooble.org genérico, senão a chave só cobre vagas dos EUA).
ATENÇÃO: limite vitalício de 500 chamadas por chave (não é por mês!).
Veja o comentário em src/sources/jooble.js pra detalhes.
- JOOBLE_API_KEY= 

Crie grátis em https://www.careerjet.com/partners/signup.html
(necessário pra vagas via Careerjet no Canadá)
- CAREERJET_AFFID=

Credenciais OAuth do Google (tipo "Desktop app"), criadas no Google Cloud
Console. Veja o README para o passo a passo completo.
- GOOGLE_OAUTH_CLIENT_ID= 
- GOOGLE_OAUTH_CLIENT_SECRET= 

Caminho (dentro do container) do token gerado por scripts/setup-google-auth.js
- GOOGLE_OAUTH_TOKEN_PATH=/app/config/google-token.json

ID da planilha do Google Sheets (pegue da URL: .../spreadsheets/d/ESTE_ID/edit)
- GOOGLE_SHEET_ID= 

ID da pasta do Google Drive (pegue da URL: .../drive/folders/ESTE_ID)
- GOOGLE_DRIVE_FOLDER_ID= 

## Segurança

- Nunca compartilhe `config/google-token.json` nem as chaves do `.env` publicamente.
- Pra revogar acesso: https://myaccount.google.com/permissions
- Currículos no Drive ficam com link "qualquer pessoa com o link pode ver".

## Versão Atual: 1.0
