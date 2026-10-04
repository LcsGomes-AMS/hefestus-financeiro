# Atualizar para a versão 1.1 no Render

Esta versão acrescenta relatórios Excel/PDF, gráficos mensais e pedidos. Use o **mesmo serviço no Render e a mesma DATABASE_URL do Neon**. Não crie outro banco para atualizar.

## Passo a passo

1. Extraia `hefestus-financeiro-v1.1.zip` no computador.
2. Abra a pasta do seu repositório GitHub no VS Code. Copie o conteúdo da pasta `hefestus-financeiro` do ZIP para essa pasta, substituindo os arquivos antigos. Preserve sua pasta `.git`, seu `.env` local e qualquer personalização que queira manter. O `package.json` precisa continuar na mesma pasta que o Render usa como raiz.
3. No terminal dessa pasta, rode:

   ```bash
   npm install --ignore-scripts
   npm test
   git add .
   git commit -m "Relatórios, gráficos mensais e pedidos — versão 1.1"
   git push
   ```

   Isso atualiza também o `package-lock.json`, caso você já tenha um. Não envie `.env` nem `node_modules`.

4. Abra o **mesmo Web Service** no painel do Render. Confira em **Settings**:

   - Build Command: `npm install --omit=dev --ignore-scripts`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`

   Se seu build usa `npm ci`, ele também funciona **desde que o package-lock.json atualizado no passo 3 tenha sido enviado**. Caso contrário, use o comando `npm install` acima.

5. Mantenha as variáveis `DATABASE_URL`, `ADMIN_USER`, `ADMIN_PASSWORD` e demais configurações existentes. Esta atualização não exige novas variáveis.
6. Se o deploy automático não começar após o `git push`, escolha **Manual Deploy > Deploy latest commit** no Render. Aguarde o status **Live**.
7. Abra o sistema e atualize a página com **Ctrl + F5**. Faça login normalmente.

Se você usa o site do GitHub em vez de Git local, envie e substitua os arquivos do ZIP no repositório e confirme o commit. Nesse caso, configure o build do Render com `npm install --omit=dev --ignore-scripts` para atualizar as dependências durante a compilação.

## O que acontece no banco

O servidor executa a inicialização SQL automaticamente dentro de uma transação. Ela adiciona apenas `hm_orders` e seu índice, usando `CREATE TABLE IF NOT EXISTS`. As tabelas e os registros de lançamentos, sessões e auditoria existentes são preservados. Reinicializar o servidor não recria nem esvazia seus dados.

Não precisa colar SQL no Neon. O usuário da conexão precisa ter permissão para criar tabelas, como na primeira instalação. Mantenha um ponto de restauração ou backup do projeto Neon conforme a política da empresa antes de atualizar.

## Conferência depois do deploy

- Abra `/api/health` na URL do seu sistema; deve retornar `{"ok":true}`.
- Confira que os lançamentos anteriores e o saldo continuam presentes.
- Escolha um ano no gráfico. Clique em um mês e confira o início/fim do mês nos filtros; os campos tipo e busca são limpos para mostrar todo o mês.
- Baixe Excel e PDF. Eles devem corresponder aos **filtros aplicados**, inclusive registros de outras páginas.
- Crie um pedido de teste, avance pelas quatro etapas e recarregue a página para confirmar a persistência.

## Como usar as novidades

### Relatórios

Na seção Lançamentos, clique em **Excel (.xlsx)** ou **PDF**. O relatório inclui data, tipo, descrição, cliente/fornecedor, peso, valor e totais, com registro dos filtros e horário de geração. O limite é de 5.000 lançamentos por exportação; acima disso, refine o período. Registros excluídos não entram no relatório.

O Excel mantém valores numéricos e textos protegidos contra interpretação como fórmulas. O PDF usa uma fonte padrão com suporte a acentos em português; símbolos fora desse conjunto, como alguns emojis, aparecem como `?`. Os dados completos continuam disponíveis no Excel e no banco.

### Gráfico mensal

O gráfico mostra entradas, saídas e resultado dos 12 meses do ano escolhido. Ele considera **todos os lançamentos ativos daquele ano**, independente dos filtros da tabela. O resultado pode ser negativo e aparece abaixo da linha zero. Passe o mouse ou foque um mês pelo teclado para consultar os três valores; clique para filtrar a tabela. O resumo e os relatórios continuam seguindo os filtros da tabela.

### Pedidos

Registre descrição, cliente opcional, valor previsto opcional, peso opcional e prazo opcional. As etapas são **Orçamento → Aprovado → Imprimindo → Entregue**. Use o botão da próxima etapa para avançar ou **Editar** para ajustar campos e etapa, inclusive voltar.

O quadro exibe até 40 pedidos por página e permite buscar por descrição/cliente e filtrar por etapa. Os números das colunas referem-se à página atual. Cada alteração é gravada no PostgreSQL. Pedidos não geram entrada financeira automaticamente: registre o recebimento em **Novo lançamento** quando o pagamento ocorrer.

## Se ocorrer algum problema

- **Dependência ausente / erro de lockfile:** confira o Build Command e o envio de `package.json` e do lockfile atualizado.
- **Falha ao criar tabela:** confira a permissão do usuário da `DATABASE_URL` e os logs do serviço.
- **Origem inválida:** preserve a URL de produção em `APP_URL`, se configurada; não use localhost no Render.
- **Versão antiga na tela:** confira que o último commit foi publicado e recarregue com Ctrl + F5.
- **Outro usuário alterou o pedido:** faça uma nova busca para atualizar o quadro e abra a edição novamente.

## Verificações desta entrega

Testes locais passaram para validação, autenticação, geração real de XLSX/PDF e validação de pedidos. A planilha também foi aberta e lida por uma biblioteca independente. Os fluxos do navegador foram verificados com respostas de API simuladas, incluindo downloads, clique no gráfico, criação/edição/avanço dos pedidos e layout em 320, 390, 768 e 1440 pixels. A execução SQL no seu Neon e o deploy no seu Render continuam dependendo da configuração e conferência nas suas contas; esta entrega não fez alterações nelas.

Referência oficial para o deploy manual: https://render.com/docs/deploys
