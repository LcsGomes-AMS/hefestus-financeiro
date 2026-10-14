# Hefestus Financeiro 1.3 — acompanhamento do cliente

## Como usar

1. No financeiro, encontre o pedido em **Pedidos de impressão** e clique em **Acompanhamento**.
2. Clique em **Gerar link privado**. O link vale por 90 dias.
3. Use **Copiar link** e compartilhe com o cliente pelo canal que você utiliza. Nenhuma mensagem é enviada automaticamente pelo sistema.
4. O cliente abre o link no navegador e vê a etapa atual, previsão de entrega e data da última atualização. Ele não precisa fazer login.
5. Atualize a etapa ou o prazo pelo pedido no seu financeiro. O cliente verá a mudança ao atualizar a consulta; a página aberta e visível também consulta automaticamente a cada minuto.

As etapas são Orçamento, Aprovado, Imprimindo e Entregue. O prazo vem do campo **Prazo** do pedido e representa uma previsão, não confirmação de entrega. Se ainda não foi definido, aparece **A combinar**. O link não oferece rastreamento de transportadora.

## Renovar e desativar

- **Renovar link** gera um novo endereço por 90 dias e invalida o anterior imediatamente.
- **Desativar link** impede novas consultas por esse endereço. Você pode gerar outro quando necessário.
- O link completo fica disponível para copiar na sessão em que foi gerado. Se você sair, atualizar a página ou abrir em outro aparelho, poderá renovar para obter outro link. O sistema guarda apenas o hash do segredo no banco, por isso não recupera o endereço antigo.
- Se outra aba alterar o link, feche e abra novamente a janela de acompanhamento para carregar o estado atual.

O endereço dá acesso a quem o possui: compartilhe apenas com o cliente. Não há PIN adicional. A consulta pública mostra somente uma referência curta do pedido, etapa, prazo e data de atualização. Valores, cliente/fornecedor, descrições internas e registros financeiros ficam restritos ao painel administrativo.

## Atualização no Render

1. Extraia o ZIP e copie o conteúdo da pasta `hefestus-financeiro` para o mesmo repositório do sistema. Preserve `.git` e seu `.env` privado. O pacote contém a versão completa com as funções anteriores e o modo app do iPhone.
2. Envie as alterações ao GitHub. No terminal, se já usa Git:

   ```bash
   git add .
   git commit -m "Acompanhamento de pedidos para clientes - v1.3"
   git push
   ```

3. No mesmo serviço do Render, aguarde o deploy automático ou escolha **Manual Deploy > Deploy latest commit**.
4. Mantenha `DATABASE_URL`, `ADMIN_USER` e `ADMIN_PASSWORD`. Não há novas dependências ou variáveis em relação à versão 1.2.1.
5. Confira se `APP_URL`, quando definida, corresponde à URL HTTPS final do sistema. Caso não esteja definida, o Render fornece `RENDER_EXTERNAL_URL`, usada pelo sistema para gerar os links.
6. Aguarde o status Live e recarregue o painel. Se estiver usando o ícone no iPhone, feche a janela do app e abra novamente.

Na inicialização, a migração acrescenta as colunas `tracking_token_hash`, `tracking_expires_at`, `tracking_version` e um índice em `hm_orders`. Ela preserva pedidos e lançamentos. O usuário do Neon precisa ter permissão para alterar a tabela e criar o índice. Não recrie o banco nem o serviço para instalar a atualização.

## Conferir depois de publicar

1. Abra `/api/health` e confirme `{"ok":true}`.
2. Gere um link em um pedido de teste e abra-o em uma janela anônima ou em outro celular, sem login.
3. Altere a etapa e o prazo no financeiro. Atualize a página do cliente e confira os novos dados.
4. Renove o link e confira que o antigo fica indisponível.
5. Desative o novo link e confira que também fica indisponível.

Copie o endereço completo, incluindo `#` e o texto depois dele. Esse fragmento contém o segredo de acesso. A página pública envia o segredo em um cabeçalho da requisição, para não colocá-lo na URL HTTP registrada pelos logs comuns do servidor. Não configure ferramentas externas para registrar cabeçalhos sensíveis.

## Detalhes da implementação

- Rota do cliente: `/acompanhar#SEGREDO`.
- Consulta pública: `GET /api/public/tracking`, com cabeçalho `X-Tracking-Token`.
- Gestão: `GET`, `POST` e `DELETE /api/orders/:id/tracking`, com login e CSRF para alterações.
- Tokens: 32 bytes aleatórios; somente SHA-256 persistido no PostgreSQL.
- Respostas públicas sem cache e sem indexação; página sem analytics nem recursos externos.
- Limite de 60 consultas por minuto por IP e instância para a consulta pública. Ao expirar ou revogar, novas consultas são recusadas. Informações já visualizadas ou copiadas por um destinatário não são apagadas do aparelho dele.
- A versão do link é independente da versão do pedido, evitando que gerar um endereço altere a etapa ou cause conflito numa edição normal.
- O financeiro continua online. A página pública também precisa de internet.

## Testes e limites

Os 14 testes locais passaram, incluindo autenticação, CSRF, isolamento da rota pública, hash de token, expiração, renovação, revogação, proteção contra ações simultâneas e relatórios existentes. As requisições de teste são injetadas no Express sem abrir conexões de rede.

O navegador foi testado com as telas reais e a lógica de acompanhamento usando um banco substituto em memória: gerar/copiar, abrir sem login, atualizar status/prazo, renovar, desativar, link incompleto e layout em 320, 390, 768 e 1440 pixels. A migração e as consultas ainda precisam ser conferidas no seu PostgreSQL real; o deploy no seu Render não foi executado neste chat.
