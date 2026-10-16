# Hefestus Financeiro 1.6.0 — Etapa Em acabamento

O fluxo de produção passa a ser:

**Orçamento → Aprovado → Imprimindo → Em acabamento → Entregue**

## No painel financeiro

- A coluna **Em acabamento** aparece antes de **Entregue** no quadro de pedidos.
- Em um pedido que está **Imprimindo**, o botão de próxima etapa agora é **Em acabamento**. Dentro dessa etapa, o botão seguinte é **Entregue**.
- A nova etapa também está no formulário de criação/edição e no filtro **Etapa**.
- Colocar um pedido **Em acabamento** não cria uma receita. O valor continua entrando no saldo somente na primeira mudança para **Entregue**. Voltar a etapa e entregar novamente não duplica o lançamento.

## No acompanhamento do cliente

O link existente mostra as cinco etapas, com **Em acabamento** destacada enquanto o pedido estiver nessa situação. A entrega passa a ser a quinta etapa. A previsão de entrega continua visível.

Não é necessário gerar ou enviar outro link. O cliente pode tocar em **Atualizar acompanhamento**; a página também consulta a etapa periodicamente quando está aberta. Se a página já estava aberta antes da publicação desta versão, recarregue-a para carregar a nova linha de etapas.

## Atualizar no Render

1. Extraia **hefestus-financeiro-v1.6.zip**. No VS Code, abra a pasta `hefestus-financeiro`.
2. Copie os arquivos desta versão para o projeto/repositório já conectado ao seu serviço Render, mantendo a estrutura. Preserve seu `.env` local e as variáveis do Render. Não envie `.env` ou `node_modules` ao GitHub.
3. Faça commit e push para a branch usada pelo serviço. Aguarde o deploy automático ou escolha **Manual Deploy → Deploy latest commit**, conforme a [documentação do Render](https://render.com/docs/deploys).
4. Na inicialização, o sistema atualiza automaticamente a restrição de etapas em `hm_orders`, preservando pedidos, lançamentos, comprovantes e links existentes. Não é necessário recriar o banco nem mudar as variáveis. O usuário do banco precisa poder alterar a tabela, como nas migrações anteriores.
5. Aguarde o deploy ficar ativo, atualize a página e confira **v1.6.0** no rodapé. No iPhone, feche e abra novamente o app pelo ícone; se necessário, atualize a página no Safari.
6. Em um pedido, passe de **Imprimindo** para **Em acabamento** e abra o link do cliente para conferir a nova etapa. Verifique que o saldo só muda ao entregar.

O ZIP inclui o sistema completo, com os anexos de comprovantes da versão 1.5.1 e os demais recursos anteriores.

## Validação

Os 33 testes automatizados passaram, incluindo o fluxo com acabamento sem receita, entrega com crédito único e retorno da nova etapa no acompanhamento público. A interface foi verificada no Chrome com Express e um banco substituto em memória: avanço, edição, filtro, recarga, link do cliente e larguras de 320, 390, 768, 1280 e 1440 px.

A conexão/migração no seu Neon, o deploy no Render e um iPhone físico não foram testados neste ambiente. A atualização precisa ser publicada no seu serviço para aparecer no sistema em uso.
