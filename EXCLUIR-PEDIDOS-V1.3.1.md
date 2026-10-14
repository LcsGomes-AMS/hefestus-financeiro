# Hefestus Financeiro 1.3.1 — excluir pedidos

## Como usar

1. Vá até **Pedidos de impressão** e encontre o cartão do pedido.
2. Clique em **Excluir pedido**.
3. Confira a descrição na janela e confirme em **Excluir pedido**. Para desistir, clique em **Cancelar**.

O pedido sai do quadro e das buscas. O link de acompanhamento do cliente é desativado automaticamente na mesma operação. Se o cliente já estiver com a página aberta, ela mostrará a indisponibilidade na próxima consulta manual ou automática.

Os lançamentos financeiros existentes continuam como estão. Se for necessário registrar um estorno, ajuste o financeiro separadamente conforme a movimentação realizada.

A exclusão é lógica: o registro permanece no PostgreSQL com `deleted_at` preenchido. Esta versão não inclui uma lixeira ou botão de restauração. O pedido excluído não pode ser editado, ter a etapa alterada ou receber outro link pelos endpoints normais do sistema. Se outra aba tiver alterado o pedido antes da confirmação, atualize o quadro e confira os dados antes de tentar novamente.

## Atualizar no Render

1. Extraia o ZIP e copie o conteúdo da pasta `hefestus-financeiro` para o mesmo repositório do sistema, substituindo os arquivos. Preserve `.git` e seu `.env` privado.
2. Faça o commit e envie ao GitHub:

   ```bash
   git add .
   git commit -m "Excluir pedidos com confirmação e desativação do link"
   git push
   ```

3. Aguarde o deploy automático no mesmo serviço do Render ou escolha **Manual Deploy > Deploy latest commit**.
4. Mantenha as variáveis e comandos de instalação existentes. Não há novas dependências nesta versão.
5. Na inicialização, o servidor acrescenta a coluna `deleted_at` em `hm_orders`, preservando os registros atuais. O usuário PostgreSQL precisa ter permissão para alterar essa tabela. Não recrie o banco.
6. Recarregue a página. No iPhone, feche o app e abra novamente pelo ícone. Confira **v1.3.1** no rodapé.

## Conferir depois da atualização

- Crie um pedido de teste e gere seu link de acompanhamento.
- Abra a exclusão e cancele: o pedido e o link devem continuar funcionando.
- Confirme a exclusão: o pedido deve desaparecer e o link deve ficar indisponível na próxima consulta.
- Confira que os lançamentos financeiros continuam iguais.

## Verificação da entrega

Os 17 testes locais passaram. Incluem confirmação dos requisitos de sessão/CSRF na API, exclusão lógica, conflito entre versões, revogação do link e bloqueio de alterações posteriores. Os testes de API utilizam Express com requisições injetadas e um repositório em memória; não substituem a verificação do SQL no Neon real.

No navegador foram conferidos cancelamento, confirmação, erro de gravação sem remover o pedido, retirada do cartão após sucesso, invalidação do acompanhamento e layout no celular. O deploy no Render e a migração no Neon da sua conta ainda precisam ser executados.
