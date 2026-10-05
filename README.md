# Dashboard Kione — Bach Ads (GitHub Pages + atualização automática)

O site fica no **GitHub Pages** e se atualiza sozinho a cada 2 horas:
o GitHub Actions busca os dados no Meta Ads, gera `public/data.json` e publica o site.
O cliente só abre o link (`https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`). Você não envia arquivo nenhum.

```
public/index.html         dashboard (lê o data.json)
public/data.json          dados (gerado a cada execução; o do zip serve só para teste local)
scripts/update-data.mjs   busca os dados na API do Meta
scripts/accounts.json     contas de anúncios e tipo de resultado de cada uma
.github/workflows/update-dashboard.yml   agenda (a cada 2 h) + publicação
```

## Passo a passo (uma vez só)

### 1. Criar o token do Meta (não expira)
1. Business Manager → **Configurações do negócio → Usuários → Usuários do sistema → Adicionar**
   (função: Administrador ou Funcionário).
2. **Adicionar ativos** → Contas de anúncios → selecione as 5 contas da Kione com permissão
   **Ver desempenho** (ou superior).
3. **Gerar novo token** → app do seu negócio → expiração **Nunca** → permissão **`ads_read`**.
4. Copie o token. Ele fica só nos *secrets* do GitHub e nunca vai para o navegador do cliente.

### 2. Criar o repositório no GitHub
1. Crie um repositório novo (ex.: `kione-dashboard`) e envie esta pasta:
   ```
   git init && git add . && git commit -m "dashboard kione"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/kione-dashboard.git
   git push -u origin main
   ```
2. **Atenção ao plano:** no plano gratuito, o GitHub Pages só funciona em repositório **público**.
   Repositório privado com Pages exige plano pago (Pro, Team ou Enterprise).
   O token do Meta continua seguro em qualquer caso, porque fica nos *secrets*.

### 3. Configurar o GitHub
1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → New repository secret**:
   `META_ACCESS_TOKEN` = o token do passo 1.

### 4. Conferir os números antes de liberar ao cliente
No seu computador (Node 20+):
```
META_ACCESS_TOKEN=SEU_TOKEN node scripts/update-data.mjs --debug-actions
```
- Mostra gasto e resultados por conta e **todos os tipos de ação** que o Meta devolveu.
- Compare com o painel atual. Se algum resultado vier zerado ou diferente (mais provável em
  **Acelera Distribuidor / visitas ao perfil**), ajuste `actionTypes` em `scripts/accounts.json`
  usando um dos nomes listados pelo `--debug-actions`.

### 5. Publicar
- A primeira publicação roda sozinha após o `git push`. Para rodar de novo:
  **Actions → Atualizar dashboard Kione → Run workflow**.
- Em 1–2 minutos o link aparece em **Settings → Pages** (e no resumo da execução). Envie esse link ao cliente uma única vez.

## Manutenção
- **Frequência:** altere o `cron` no workflow (ex.: `'0 * * * *'` = de hora em hora). O GitHub pode atrasar execuções agendadas em alguns minutos.
- **Atualizar na hora:** Actions → Run workflow.
- **Nova conta de anúncios:** adicione em `scripts/accounts.json` e em `A` no começo do `<script>` do `index.html`.
- **Período inicial:** variável `START_DATE` (padrão `2026-09-01`).
- **Se o token for revogado:** a execução falha e o site continua com os últimos dados publicados. Gere outro token e atualize o secret.
- **Repositório sem atividade:** o GitHub pausa agendamentos de repositórios sem nenhuma atividade por 60 dias. Se isso acontecer, é só reativar em Actions.

## Privacidade
O link do GitHub Pages é **público** para quem tiver o endereço (a página tem `noindex` para o Google não listar, mas isso não impede o acesso). Os dados do `data.json` não são versionados no repositório, mas ficam visíveis no site. Se precisar de login para o cliente, a alternativa é Cloudflare Pages com Cloudflare Access, ou Firebase com Authentication.
