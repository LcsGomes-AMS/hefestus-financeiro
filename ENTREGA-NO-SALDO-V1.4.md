# Hefestus Financeiro 1.4 — entrega gera receita

## Como funciona

Ao mudar um pedido para **Entregue**, o valor total informado no pedido gera uma **Entrada** em **Lançamentos**. O saldo e o gráfico são atualizados após a operação.

Exemplo: pedido **Hogwarts Wizard World**, valor **R$ 120,00**. Ao tocar em **Entregue**, o financeiro recebe uma entrada de **R$ 120,00**, com a descrição, o cliente e o peso do pedido, na categoria **Impressão 3D**. A data da entrada é a data da operação no fuso de São Paulo. O prazo previsto do pedido não é usado como data do recebimento.

A regra considera o valor total como recebido ao entregar. É obrigatório informar um valor positivo antes de marcar como entregue. Também funciona ao escolher **Entregue** na edição ou ao cadastrar um pedido já entregue.

## Proteção contra duplicação

- Cada pedido pode gerar somente uma receita automática, mesmo com cliques repetidos, reenvios ou duas abas tentando entregar ao mesmo tempo.
- Voltar para outra etapa e marcar **Entregue** novamente não cria outro lançamento.
- O pedido só fica entregue se o lançamento e a auditoria também forem gravados. Se ocorrer falha, a mudança de etapa é desfeita para você tentar novamente.
- O cartão mostra a receita vinculada; o lançamento mostra uma referência ao pedido.

Pedidos que **já estavam entregues antes desta atualização não recebem lançamentos retroativos**. Salvar uma edição mantendo a etapa Entregue não cria uma receita para esses pedidos. Confira o histórico financeiro antes de qualquer lançamento manual ou reabertura de etapa.

Entradas manuais antigas não têm vínculo com o pedido e não podem ser identificadas automaticamente como pagamento dele. Se você já lançou manualmente o valor de um pedido em produção, confira e ajuste esse registro antes de usar a entrega automática para evitar contar o recebimento duas vezes.

## Correções depois da entrega

Depois de criada, a receita é um registro financeiro próprio. Alterar o valor, o cliente ou a descrição do pedido não modifica o lançamento original. Para corrigir o financeiro, edite ou exclua a entrada na seção **Lançamentos**. O cartão mostra o valor atual do lançamento vinculado ou informa se ele foi excluído.

Excluir o pedido ou mudar a etapa depois da entrega não estorna o valor. A regra de exclusão de pedidos continua preservando os lançamentos financeiros. Se a receita vinculada for excluída manualmente, entregar novamente o mesmo pedido não a recria; faça qualquer correção de caixa explicitamente em Lançamentos.

O saldo exibido continua sendo o dos **filtros aplicados**. Se a entrada de hoje não aparecer, confira o período, o tipo e a busca ou use **Limpar**. A exportação Excel/PDF e os gráficos usam a entrada normalmente; os valores não são somados diretamente dos pedidos, evitando contar a receita duas vezes.

## Atualizar no Render

1. Extraia o ZIP e substitua os arquivos no mesmo repositório do sistema, preservando `.git` e seu `.env` privado.
2. Faça commit e envie ao GitHub:

   ```bash
   git add .
   git commit -m "Registrar entrada financeira na entrega do pedido - v1.4"
   git push
   ```

3. Aguarde o deploy automático no mesmo serviço do Render ou escolha **Manual Deploy > Deploy latest commit**.
4. Mantenha as variáveis e os comandos de build/start. Esta atualização não exige novas dependências ou credenciais.
5. O servidor acrescenta automaticamente `order_id` em `hm_entries`, com vínculo ao pedido e índice único. As entradas antigas continuam sem vínculo e são preservadas. Não há atualização automática de valores antigos.
6. Quando ficar Live, recarregue a página; no iPhone, feche e reabra o app. Confira **v1.4** no rodapé.

O usuário da conexão Neon precisa ter permissão para alterar `hm_entries`, criar índice e referenciar `hm_orders`. Não recrie o banco para atualizar. O pacote completo mantém o acompanhamento, a exclusão de pedidos, os relatórios e o modo app do iPhone.

## Conferir após publicar

- Crie um pedido de teste com valor e etapa Imprimindo, e depois marque Entregue.
- Confira uma única entrada com o mesmo valor e a data atual, além da atualização do saldo nos filtros correspondentes.
- Recarregue a página e volte/avance a etapa; a receita deve continuar única.
- Se fizer testes no caixa real, exclua a entrada de teste explicitamente em Lançamentos, além de excluir o pedido.

## Verificações locais

Os 24 testes passaram, cobrindo receita na entrega, centavos exatos, concorrência, rollback, reenvio, criação já entregue, ausência de valor, registros antigos, exclusão e recursos anteriores. O teste de navegador usou a interface e a API Express reais com um repositório transacional substituto em memória; confirmou R$ 120,00 ao entregar, ausência de duplicação, falha sem alteração de etapa e saldo de R$ 160,10 após outra entrega de R$ 40,10. O layout foi conferido em 320, 390, 768 e 1440 pixels.

Os testes não executam um PostgreSQL real. A migração e a operação ainda precisam ser verificadas no Neon da sua instalação. A publicação no Render não foi feita por este chat.
