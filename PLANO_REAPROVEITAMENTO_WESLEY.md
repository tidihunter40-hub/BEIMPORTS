# Plano técnico — BE IMPORTS a partir da arquitetura Wesley

## Situação verificada

O projeto Wesley está acessível em `C:\Users\bangu\OneDrive\Documents\WESLEY LOJA DE CAMISA\wesllen-imports`. A inspeção foi somente de leitura. Não foram abertas credenciais, dados de clientes ou produtos cadastrados. O projeto Wesley não foi alterado nem publicado.

O código usa Node.js com módulos ES, páginas HTML/CSS/JavaScript, uma API própria, implantação Vercel e persistência Supabase em produção. Há armazenamento local para desenvolvimento. A BE IMPORTS já tem uma base visual independente em `BE IMPORTS\be-imports-site`, criada com o logotipo e as fotos fornecidas. Essa base ainda é institucional; as funções comerciais listadas abaixo são a próxima etapa.

## O que reaproveitar

| Recurso | Base Wesley | Adaptação para BE IMPORTS |
| --- | --- | --- |
| Catálogo | `server.js`, `publication.js`, `public/app.js`, `public/shop.js` | Manter modelo de publicação e busca, retirar produtos iniciais e regras de futebol. Iniciar catálogo real vazio. |
| Categorias | `productCategories` no catálogo, filtros em `public/shop.js` | Criar Camisas, Bermudas, Bonés, Perfumes, Fones de ouvido, Roupas e Acessórios. Exibir Ofertas como filtro de produtos em promoção, sem duplicar a categoria principal. Remover `categories`/`teams.js`, que representam clubes. |
| Página de produto | `public/produto.html`, `public/shop.js` | Reaproveitar galeria, preços, quantidade e seleção de variante; adaptar campos por tipo de produto. Não exigir time ou personalização de futebol. |
| Carrinho | `public/carrinho.html`, `public/shop.js`, `order.js` | Isolar a chave do navegador (`be-imports-cart`), recalcular preços e disponibilidade no servidor e usar conteúdo BE. |
| Pedido por WhatsApp | `order.js`, rota `/api/quotes` | Gerar orçamento com o número próprio da BE IMPORTS e abrir mensagem pronta. O cliente ainda envia a mensagem; não há pagamento online. |
| Painel administrativo | `public/admin.*`, rotas `/api/admin/*` | Reaproveitar gestão de produtos, categorias, banners, promoções e configurações. Excluir tela e regras de times. Criar hash de senha, cookie e sessões exclusivos da BE. |
| Upload de imagens | `/api/admin/upload`, `supabase-store.js` | Manter validação PNG/JPEG/WebP e limite de 5 MB; enviar ao bucket próprio da BE IMPORTS. Não copiar uploads Wesley. |
| Carrossel | `public/hero-carousel.*` | Manter controles, pausa, comportamento responsivo e suporte a slides de imagem/vídeo. Substituir todos os slides e textos Wesley; fachada real deve abrir a página. Hoje vídeos são configurados por URL HTTPS, sem upload de vídeo no painel. |
| Frete | `shipping.js`, `address.js`, rotas de cotação | Adaptar CEP de origem, medidas e conta/token próprios da BE. Manter o frete desativado até configuração; recotar no servidor antes do orçamento. |
| Estoque | `stock.js`, `public/sizes.js`, migração de vendas | Manter checagem no servidor e baixa na confirmação da venda, com proteção contra confirmação duplicada. Usar variantes opcionais por produto; tamanhos só para vestuário aplicável. |
| PWA | `public/manifest.webmanifest`, `public/sw.js`, `public/pwa.js` | Criar ícones e cores BE, novos nomes de cache e textos. Preservar API, painel, pedidos e uploads fora do cache offline. |
| Responsividade | `public/shop.css`, `public/cart.css`, `public/admin.css` | Aproveitar padrões de layout e interação; redesenhar componentes para azul-marinho, dourado e branco, sem copiar a identidade visual Wesley. |

## Isolamento obrigatório

1. Manter a BE IMPORTS somente na pasta e em um repositório próprios. Copiar para ela apenas módulos de código revisados; nunca importar arquivos em execução da pasta Wesley.
2. Criar um projeto Supabase exclusivo da BE IMPORTS, com tabelas de catálogo, orçamentos e vendas próprias, além de bucket de imagens próprio. Não apontar qualquer variável da BE para o projeto Supabase Wesley.
3. Criar credenciais administrativas, segredo do servidor, cookie de sessão, chave de carrinho, manifesto PWA e nomes de cache exclusivos.
4. Criar um projeto de hospedagem e variáveis de ambiente separados. Não reutilizar tokens de frete, WhatsApp, domínio, URL de Storage nem configurações de Wesley.
5. Inicializar somente as oito categorias solicitadas e catálogo vazio. Não copiar produtos, imagens de produtos, pedidos ou clientes Wesley.

## Ordem de implementação

1. Consolidar a base visual BE já criada como nova Home: fachada protagonista, logotipo oficial, paleta fornecida, menus e cards responsivos.
2. Adaptar modelo do catálogo, categorias, filtros e página individual; adicionar variantes quando necessárias sem pressupor que todo produto tem tamanho.
3. Integrar carrinho, validação de estoque, orçamento pelo WhatsApp e frete opcional com recotação no servidor.
4. Adaptar painel, autenticação, uploads, banners e carrossel; criar projeto Supabase e migrações exclusivas BE.
5. Gerar ícones/manifesto PWA da BE e validar desktop/mobile, fluxo de compra, publicação de produto, upload, estoque, frete e segurança. Publicar somente a BE IMPORTS depois de configurar seus recursos próprios.

## Dados da BE necessários antes de ativar vendas

- Número WhatsApp individual da loja, CEP de origem e política de entrega. O endereço e os horários públicos foram registrados em [FONTES_INSTAGRAM_BE_IMPORTS.md](FONTES_INSTAGRAM_BE_IMPORTS.md).
- Fotos reais, nomes, descrições, preços, disponibilidade e variantes dos produtos.
- Projeto Supabase BE e credenciais privadas BE; conta/token Melhor Envio BE se o frete automático for ativado.
- Vídeos próprios ou URLs HTTPS dos vídeos para o carrossel, se desejados.

Até esses dados existirem, a vitrine e as integrações devem permanecer sem produtos ou valores fictícios.
