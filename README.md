# Hefestus Maker — Financeiro

Sistema de entradas e saídas com acesso por senha, PostgreSQL no Neon e servidor Node.js no Render. O projeto é separado do site institucional entregue anteriormente.

## O que está incluído

- Login administrativo único e sessões de 12 horas persistidas no PostgreSQL.
- Cadastro de entrada e saída: valor, data, descrição da impressão ou despesa, peso opcional e cliente/fornecedor opcional.
- Edição, exclusão com confirmação, filtros por período/tipo/busca, paginação e totais dos registros filtrados.
- Valores guardados em centavos inteiros. O peso não calcula automaticamente o preço: você informa o valor efetivamente recebido ou pago.
- Histórico técnico em `hm_audit`; exclusões preservam o registro original com `deleted_at` e o retiram dos totais. O histórico não tem tela própria nesta versão.
- Proteção de sessão, CSRF, limite de login, consultas parametrizadas e controle de versão para evitar alterações simultâneas silenciosas.
- Interface em português, adaptada para celular e computador.

O sistema controla movimentações de caixa. Não emite notas fiscais, não integra bancos e não substitui a contabilidade. Registre somente valores efetivamente recebidos ou pagos. O saldo exibido é **o saldo dos lançamentos filtrados**, sem saldo anterior implícito. Clique em **Limpar** para ver todas as datas. Se necessário, registre o saldo inicial como um lançamento identificado.

## 1. Extrair e abrir no VS Code

Extraia o ZIP e abra a pasta `hefestus-financeiro` no VS Code. O arquivo `package.json` deve estar na raiz da pasta. Este sistema precisa de servidor e banco: abrir `public/index.html` com duplo clique não executa a aplicação.

## 2. Criar o banco no Neon

1. Acesse https://console.neon.tech e crie um projeto PostgreSQL exclusivo para este sistema.
2. No painel do projeto, abra **Connect**. Selecione seu banco e usuário e habilite a conexão **pooled** quando disponível.
3. Copie a **connection string**, no formato `postgresql://USUARIO:SENHA@HOST/neondb?sslmode=require`.
4. Guarde essa informação no campo `DATABASE_URL` do Render ou no `.env` local. Ela contém uma senha: não coloque no GitHub nem no JavaScript público.

As tabelas `hm_entries`, `hm_audit`, `hm_sessions` e `hm_login_limits` são criadas automaticamente na primeira inicialização. O usuário do banco precisa ter permissão de criar essas tabelas. A conexão externa usa TLS com verificação do certificado. Não é necessário rodar o SQL manualmente.

## 3. Publicar o código no GitHub

Crie um repositório, preferencialmente privado, e envie o conteúdo da pasta do projeto. Inclua `src`, `public`, `test`, `package.json`, `render.yaml`, `.gitignore`, `.env.example` e este guia. Não envie `.env` nem `node_modules`.

No terminal do VS Code, após instalar o Git e criar o repositório vazio:

```bash
git init
git add .
git commit -m "Sistema financeiro Hefestus Maker"
git branch -M main
git remote add origin URL_DO_SEU_REPOSITORIO
git push -u origin main
```

Substitua `URL_DO_SEU_REPOSITORIO` pela URL fornecida pelo GitHub. Se usar o envio pelo navegador, mantenha `package.json` e `render.yaml` na raiz do repositório.

## 4. Hospedar no Render

### Opção A — Blueprint pronto

1. Acesse https://dashboard.render.com e escolha **New > Blueprint**.
2. Conecte o repositório do GitHub. O Render lerá o `render.yaml` incluído.
3. Informe as variáveis solicitadas:
   - `DATABASE_URL`: conexão copiada do Neon.
   - `ADMIN_PASSWORD`: uma senha exclusiva, de 12 a 256 caracteres, escolhida por você.
4. O usuário padrão é `admin`; você pode alterar `ADMIN_USER` nas configurações.
5. Revise o plano selecionado e confirme a criação. Aguarde o deploy ficar ativo e abra a URL `.onrender.com` exibida.

### Opção B — Web Service manual

Escolha **New > Web Service**, conecte o repositório e use:

| Configuração | Valor |
|---|---|
| Runtime | Node |
| Build Command | `npm install --omit=dev --ignore-scripts` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Root Directory | Em branco, se `package.json` estiver na raiz |

Em **Environment**, configure:

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22.16.0` ou versão 22 mais recente compatível |
| `DATABASE_URL` | Sua conexão privada do Neon |
| `ADMIN_USER` | `admin` ou seu usuário escolhido |
| `ADMIN_PASSWORD` | Sua senha exclusiva com pelo menos 12 caracteres |

O Render fornece `PORT` e `RENDER_EXTERNAL_URL` automaticamente. **Não copie `APP_URL=http://localhost:3000` para o Render.** Para domínio próprio, defina `APP_URL=https://seu-dominio.com` e acesse por essa URL. A proteção de origem permite uma URL por instalação.

O `render.yaml` seleciona o plano `free`; a disponibilidade, limites e condições devem ser conferidos no seu painel. Serviços gratuitos podem suspender por inatividade, deixando o primeiro acesso mais lento. Os dados ficam no Neon, independentemente de reinícios do Render. O projeto não cria um banco pago no Render.

## 5. Conferir após a publicação

1. Abra `/api/health` na URL publicada: deve retornar `{"ok":true}`.
2. Entre com `ADMIN_USER` e `ADMIN_PASSWORD`.
3. Crie uma entrada de R$ 40,00, com descrição e peso de 100 g, e uma saída de R$ 10,00. Com ambas no período selecionado, o saldo deve ser R$ 30,00.
4. Recarregue a página: os registros devem permanecer. Edite um valor, teste a busca e a exclusão.
5. Saia e confira que os dados exigem um novo login.
6. Exclua os registros de teste antes de começar a usar o caixa real.

## Executar localmente

Instale Node.js 22.16 ou superior. Dentro da pasta do projeto:

```bash
npm install --ignore-scripts
```

Copie `.env.example` para `.env` (no PowerShell: `Copy-Item .env.example .env`). Edite `DATABASE_URL` e `ADMIN_PASSWORD`. Depois:

```bash
npm test
npm start
```

Abra **http://localhost:3000**. Use essa URL exata, pois `APP_URL` valida a origem das operações. `npm run dev` reinicia o servidor ao editar arquivos. O arquivo `.env` fica apenas no computador e é ignorado pelo Git. Após instalar, guarde o `package-lock.json` gerado no repositório; pode então trocar o build do Render por `npm ci --omit=dev --ignore-scripts`.

## Uso e manutenção

- **Novo lançamento:** selecione entrada/saída, informe valor e data e descreva a impressão ou despesa. Peso e cliente/fornecedor são opcionais. Use `1250,50`, sem separador de milhar.
- **Filtros:** o padrão é do primeiro dia do mês até hoje, no fuso de São Paulo. Os botões de edição não removem os filtros aplicados.
- **Sessão:** expira após 12 horas. Trocar `ADMIN_PASSWORD` ou `ADMIN_USER` e reiniciar o serviço invalida sessões anteriores.
- **Conflito de edição:** se outra aba alterou o lançamento, atualize a lista e abra a edição novamente.
- **Recuperar senha:** altere `ADMIN_PASSWORD` no Render e faça um novo deploy. Não existe cadastro público nem recuperação por e-mail.
- **Backup:** configure a política de backup/restauração do seu projeto Neon de acordo com o plano e a necessidade da empresa. O histórico de alterações não substitui backup.
- **Auditoria:** `hm_audit.snapshot` registra a versão de cada criação, edição e exclusão. Não exponha essa tabela publicamente.

## Estrutura

```text
public/              interface, estilos, JavaScript e logo
src/app.js           API, login, sessões e operações
src/db.js            conexão TLS e inicialização do banco
src/schema.sql       tabelas e índices PostgreSQL
src/validation.js    validação e conversão monetária
src/server.js        inicialização do servidor
test/                testes locais de validação e autenticação
render.yaml          configuração de hospedagem
.env.example         modelo das variáveis privadas
```

## Verificações e limites da entrega

Os testes locais cobrem validação monetária, datas, filtros, login, sessão, CSRF e limite de tentativas. O teste de autenticação usa um banco substituto em memória; ele não comprova a execução SQL no Neon. A interface é verificada com respostas de API simuladas. A instalação completa das dependências, a conexão real ao Neon e o deploy no Render precisam ser validados com as suas contas: nenhuma credencial real está incluída e a entrega não está publicada.

## Referências oficiais

- Render / Node + Express: https://render.com/docs/deploy-node-express-app
- Render / Blueprint: https://render.com/docs/blueprint-spec
- Neon / conexão: https://neon.com/docs/connect/connect-from-any-app

