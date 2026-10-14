# Hefestus Financeiro 1.2.1 — abertura como app no iPhone

Esta atualização adiciona manifest com `display: standalone`, configurações Apple para janela independente e ícones PNG em 180, 192 e 512 pixels. Inclui todos os recursos da versão 1.2, como categorias, pedidos e o novo PDF.

## 1. Atualizar o sistema publicado

Substitua os arquivos no mesmo repositório GitHub, preservando `.env` e `.git`. Envie a alteração e aguarde o deploy no mesmo serviço do Render (ou use Manual Deploy > Deploy latest commit). Não são necessárias novas dependências, novas variáveis ou alterações de banco em relação à versão 1.2.

Após o deploy, abra `https://SEU-DOMINIO/manifest.webmanifest` e confira se aparece `"display": "standalone"`. O diretório `public/icons` e o arquivo `public/pwa.js` também precisam estar publicados. Utilize a URL HTTPS final do sistema, a mesma configurada em APP_URL quando houver domínio próprio.

## 2. Reinstalar o ícone no iPhone

1. Remova o atalho antigo da Tela de Início. Isso não apaga os registros do Neon.
2. Abra o **Safari** e entre na URL HTTPS do financeiro. Não abra pelo navegador interno do WhatsApp ou Instagram.
3. Recarregue a página após a publicação. A tela de login agora possui a orientação “Instalar no iPhone”.
4. Toque em **Compartilhar** (pode estar no menu de mais opções), depois **Adicionar à Tela de Início**.
5. Ative **Abrir como App da Web**, se a opção aparecer, e toque em **Adicionar**.
6. Feche o Safari e abra o **novo ícone Hefestus**. Faça login novamente se solicitado.

A janela deve abrir sem a barra de endereço do Safari. Horário, bateria, sinal e indicador inferior do iPhone continuam normais. Abrir a URL diretamente dentro do Safari continua mostrando a barra, mesmo com esta atualização. Links externos ou visualizações de arquivos podem abrir outra janela com controles próprios.

## Conexão e compatibilidade

O sistema continua online, com Render e Neon. Esta atualização não adiciona cache offline, notificações ou acesso nativo ao aparelho. É necessário acesso à internet para carregar o painel, consultar e salvar dados. A experiência final de instalação precisa ser conferida em seu iPhone; não houve teste em um aparelho iOS físico neste chat.

Fontes oficiais:
- https://support.apple.com/pt-br/guide/iphone/iphea86e5236/ios
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display
