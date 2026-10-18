# BE IMPORTS — loja online

Site em HTML, CSS e JavaScript com API Node para catálogo e painel. O início reproduz a composição da referência BE IMPORTS com a fotografia tratada da fachada, duas faixas de cabeçalho e navegação funcional. As páginas comerciais usam azul-marinho `#1B2742`, dourado `#B5A06B` e branco. As fotos originais da fachada e o logotipo permanecem em `assets/`. As imagens de `assets/categorias/` são ilustrações de navegação; fotografias de produtos publicados vêm exclusivamente do painel da loja.

## Rodar localmente

Requer Node.js 20 ou superior. Não há dependências externas de npm.

```powershell
npm run build
npm test
npm start
```

Abra `http://127.0.0.1:3000`. Para ativar o painel local em `/admin`, gere um hash com `npm run admin:hash` e defina `ADMIN_PASSWORD_HASH` no ambiente antes de iniciar o servidor. Sem Supabase, o painel grava em `data/catalog.json`, que é ignorado pelo Git.

## Preparação para publicação na Vercel

1. Importe o repositório GitHub `tidihunter40-hub/BEIMPORTS` na Vercel, selecione **Other** como framework e `be-imports-site` como **Root Directory**. O `vercel.json` desta pasta encaminha as rotas à API e define `assets` como Output Directory, uma pasta existente que contém somente imagens públicas; o build apenas verifica a sintaxe. Use `npm run build` como Build Command.
2. Use um **projeto Supabase exclusivo da BE IMPORTS**. Se a tabela e o bucket ainda não existirem, a aplicação de `supabase/001_be_imports.sql` exige autorização do proprietário. Não use o banco da loja Wesley.
3. Configure `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `ADMIN_PASSWORD_HASH` como variáveis da Vercel no ambiente que será implantado. Guarde a secret key e o hash apenas nas configurações da Vercel, nunca no Git. `PUBLIC_SITE_URL` é opcional; se usado, deve corresponder exatamente à origem da implantação. Deixe-o vazio em previews com domínios variáveis.
4. **Antes de publicar o catálogo atual**, migre com autorização os dados de `data/catalog.json` e as fotos em `uploads/` para a tabela e o bucket da BE IMPORTS no Supabase, substituindo as referências `/uploads/...` pelas URLs públicas do bucket. Esses arquivos locais são ignorados pelo Git e pela Vercel. Confira produtos, categorias, preços, estoque e fotos após a migração.
5. Execute `npm run build` e `npm test`, depois confira em uma implantação de teste `/`, `/api/catalog`, `/admin`, o login, o envio de foto e o checkout. O painel envia as fotos diretamente ao Storage por uma URL temporária emitida após a autenticação, preservando o limite de 5 MB sem exceder o limite de requisição das Functions.
6. Confirme endereço, horário, Instagram e número comercial do WhatsApp, com DDI e DDD, antes de publicar em produção. Até o número ser cadastrado, o site mostra o Instagram como contato. Somente produtos em estado **Publicado** aparecem publicamente.

O catálogo e as fotos locais ainda precisam da etapa 4 para aparecerem na Vercel. A preparação descrita aqui não executa a migração nem inicia uma implantação. Depois de conectar o GitHub à Vercel, novos pushes na branch de produção podem iniciar implantações automaticamente. O endereço, horário e Instagram iniciais seguem o registro em `../FONTES_INSTAGRAM_BE_IMPORTS.md`; confirme-os com a loja antes da publicação.

## Funcionalidade

- Rotas: `/`, `/produtos`, `/categorias`, `/ofertas`, `/nossa-loja`, `/contato`, `/produto/:slug`, `/carrinho`, `/admin`.
- Navegação ativa dourada, inclusive após recarregar; menu responsivo com submenu de categorias.
- Sete categorias de produtos iniciais (Camisas, Bermudas, Bonés, Perfumes, Fones de ouvido, Roupas e Acessórios), com imagem opcional. Ofertas é a oitava opção de navegação e reúne produtos com preço anterior válido. O painel permite criar, editar, renomear e excluir categorias sem produtos associados.
- Página Produtos com hero original, categorias interativas e coleção. Filtros por categoria, nome, preço e disponibilidade, com estado na URL; ordenação padrão pelo menor preço efetivo.
- Ofertas baseadas apenas em preço anterior válido, com percentual calculado.
- Página individual com galeria de fotos e vídeo, seleção de tamanho e quantidade, e carrinho local independente da Wesley.
- `POST /api/checkout` confere no servidor preço, publicação, tamanho e estoque antes de preparar o link de WhatsApp. O subtotal é confirmado, enquanto frete e total final ficam **a combinar**. O pedido não reserva nem reduz estoque; a loja confirma disponibilidade e pagamento na conversa.
- Painel protegido por senha com cadastro/edição de categorias e produtos, upload PNG/JPEG/WebP até 5 MB por imagem, fotos adicionais, vídeo do YouTube, estoque, preço promocional, publicação e informações da loja.
- Manifesto PWA e service worker com cache apenas do shell público. Dados de catálogo, admin e uploads não são armazenados offline.
- Dados locais para desenvolvimento e Supabase exclusivo para produção. O catálogo público nunca inclui rascunhos.

Não há pagamento online nem cotação automática de frete nesta versão. Para oferecer frete calculado, a BE IMPORTS precisa configurar sua própria origem, dimensões dos produtos e conta de transportadora. Nenhuma credencial ou dado da Wesley é usado.
