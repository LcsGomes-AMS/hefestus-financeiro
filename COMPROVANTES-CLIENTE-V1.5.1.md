# Hefestus Financeiro 1.5.1 — Comprovantes enviados pelo cliente

## Como usar

1. Entre no sistema e vá até **Pedidos de impressão**.
2. No cartão do pedido, clique em **Comprovantes**.
3. Escolha a imagem ou o PDF recebido pelo WhatsApp, e-mail ou outro canal.
4. Clique em **Salvar comprovante** e aguarde a confirmação.
5. Use **Visualizar** para uma imagem ou **Abrir PDF** para o documento. **Baixar** recupera o arquivo. **Remover** pede confirmação antes de excluir o anexo.

É possível guardar até **10 comprovantes por pedido**, com **5 MB por arquivo**, nos formatos **PDF, JPG, PNG e WebP**. O reenvio do mesmo arquivo para o mesmo pedido não cria outra cópia.

No iPhone, salve primeiro o comprovante recebido em Fotos ou Arquivos. Abra o sistema pelo ícone instalado, entre no pedido e selecione o arquivo. Se estiver em HEIC, converta-o para JPG ou PNG antes de enviar. Para salvar o anexo, o app precisa estar conectado à internet e com a sessão ativa.

Anexar ou remover um comprovante **não altera o saldo, o valor nem a etapa do pedido**. A receita continua sendo registrada na primeira mudança para **Entregue**, conforme a versão 1.4. Confira o pagamento antes de registrar o recebimento: guardar o arquivo não valida a transferência.

## Onde os arquivos ficam

O conteúdo original é salvo no **PostgreSQL do Neon**, em `hm_order_proofs.file_data` (`BYTEA`), com nome, formato, tamanho, data e pedido. Nenhum anexo depende do disco temporário do Render. Recarregar a página ou reiniciar o servidor não apaga os arquivos salvos no banco.

Somente a sessão administrativa pode listar, visualizar, baixar ou remover comprovantes. O link de acompanhamento do cliente não expõe esses arquivos. Excluir o pedido oculta seus anexos junto com o pedido; os dados continuam preservados na exclusão lógica. Remover um comprovante pelo botão próprio exclui esse arquivo do banco.

## Atualizar a instalação no Render

1. Extraia **hefestus-financeiro-v1.5.1.zip** e abra a pasta `hefestus-financeiro` no VS Code.
2. No projeto/repositório já usado pelo Render, substitua os arquivos desta versão, mantendo a mesma estrutura. Mantenha seu `.env` local e as variáveis já cadastradas no Render. Não envie `.env` ao GitHub.
3. Envie as alterações ao mesmo repositório e à mesma branch conectados ao serviço. Se usar Git no VS Code, revise as alterações e faça commit/push.
4. O Render pode publicar automaticamente conforme a configuração de Auto-Deploy. Para publicar manualmente, abra o serviço e escolha **Manual Deploy → Deploy latest commit**. Consulte a [documentação oficial de deploys do Render](https://render.com/docs/deploys).
5. Aguarde a publicação terminar. Não é necessário criar outro serviço, outro banco, nem novas variáveis. A inicialização cria `hm_order_proofs` automaticamente; o usuário do banco precisa ter permissão para criar a tabela e o índice.
6. Reabra o sistema e confira **v1.5.1** no rodapé. No iPhone, feche e abra novamente pelo ícone. Se necessário, atualize a página no Safari.
7. Em um pedido, anexe um arquivo, feche a janela e abra **Comprovantes** novamente para confirmar que ele ficou salvo. Confira também a visualização e o download.

Inclui os recursos anteriores: relatórios Excel/PDF, gráficos, pedidos, acompanhamento, exclusão de pedidos, receita ao entregar e modo app no iPhone. Esta versão usa anexos de comprovantes; o botão que gerava um novo comprovante PDF não faz parte dela. Os relatórios financeiros em PDF continuam disponíveis.

## Arquivos principais da alteração

- `src/payment-proofs.js`: upload binário, consultas, leitura e exclusão protegidos por sessão/CSRF.
- `src/schema.sql`: tabela de anexos e limites no banco.
- `src/app.js`: registro das rotas após a autenticação.
- `public/payment-proofs.js`, `features.js`, `index.html`, `styles.css`: botão, formulário e lista de comprovantes.
- `test/payment-proofs.test.js`: validações, limites, concorrência, isolamento por pedido e proteção das rotas.

## Verificação desta entrega

Passaram **32 testes automatizados**, incluindo os recursos anteriores. A interface foi exercitada no Chrome em larguras de 320, 390, 768 e 1440 px: imagem/PDF, visualização, repetição, recarga, exclusão com confirmação e expiração da sessão, sem mudar saldo ou etapa. Os testes usaram Express e um banco substituto em memória. A migração/conexão com seu Neon, a publicação no Render e o comportamento em um iPhone físico precisam ser conferidos na sua instalação; não foram executados neste ambiente.
