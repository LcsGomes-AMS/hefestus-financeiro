# Versão 1.2 - PDF no formato da referência

O relatório passa a ter logo e nome da Hefestus Maker, período, data de geração, resumo de receitas/gastos/saldo, gastos por categoria com percentuais, tabela verde de receitas, tabela vermelha de gastos, linhas alternadas e número da página.

Inclui um novo campo **Categoria** opcional ao criar ou editar lançamentos. Você pode escolher uma sugestão ou digitar outra categoria. Lançamentos anteriores recebem **Sem categoria**; edite-os para organizá-los. Nenhum valor, pedido ou lançamento é apagado. Percentuais são calculados sobre os gastos dos filtros aplicados. Os relatórios continuam seguindo os filtros da tabela e incluindo todas as páginas de resultados.

Cliente/fornecedor e peso, quando informados, aparecem abaixo da descrição. Descrições longas podem continuar na página seguinte. Os cabeçalhos e a marca se repetem nas páginas. O modelo de exemplo separado usa dados fictícios; esses dados não são inseridos no banco.

## Atualizar no Render

1. Copie o conteúdo de `hefestus-financeiro` para o mesmo repositório do sistema, substituindo os arquivos. Preserve `.git` e seu `.env` privado.
2. Envie as alterações ao GitHub. Se usar o terminal:

   ```bash
   git add .
   git commit -m "PDF com resumo, categorias e tabelas - v1.2"
   git push
   ```

3. No mesmo serviço Render, aguarde o deploy automático ou use **Manual Deploy > Deploy latest commit**.
4. Mantenha `DATABASE_URL`, `ADMIN_USER`, `ADMIN_PASSWORD` e os comandos atuais. Não há novas dependências nem novas variáveis nesta versão em relação à v1.1.
5. Na inicialização, o servidor acrescenta automaticamente a coluna `category` em `hm_entries`, sem recriar a tabela. O usuário do Neon precisa ter permissão para alterar essa tabela. Não execute SQL de limpeza nem crie outro banco.
6. Quando ficar Live, recarregue com Ctrl + F5, edite a categoria de um lançamento e baixe o PDF para conferir.

Se ainda usa a versão 1.0, use também as instruções de instalação de dependências de `ATUALIZAR-RENDER.md`; o ZIP contém o sistema completo.

## Arquivos modificados

- `src/report-pdf.js`: novo desenho do PDF.
- `src/reports.js`: usa o novo gerador; Excel preservado.
- `src/schema.sql`, `src/app.js`, `src/features.js`, `src/validation.js`: persistência e leitura da categoria.
- `public/index.html`, `public/app.js`, `public/styles.css`: campo de categoria e exibição no painel.
- `package.json`: versão 1.2.0.

## Verificações

Geração de PDFs real, relatórios de várias páginas, conjunto vazio, preservação de texto longo, XLSX e validações passaram nos testes locais. O PDF foi renderizado e conferido visualmente. Nesta execução, o teste HTTP de autenticação não pôde concluir devido a bloqueio da conexão local; a lógica de autenticação não foi alterada. A atualização no banco Neon e a publicação no Render não foram executadas a partir deste chat.
