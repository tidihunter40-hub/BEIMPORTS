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

## Dados e publicação na Vercel

1. Crie um **projeto Supabase exclusivo da BE IMPORTS** e execute `supabase/001_be_imports.sql` no SQL Editor. Não use o banco da loja Wesley.
2. Configure `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `ADMIN_PASSWORD_HASH` no projeto Vercel da BE IMPORTS. `PUBLIC_SITE_URL` é opcional; se definido, deve apontar para a origem pública em que o painel será usado.
3. Defina `be-imports-site` como diretório raiz do projeto Vercel. O `vercel.json` encaminha as rotas à API e inclui os recursos estáticos.
4. Revise as categorias no painel e publique os produtos reais: nome, categoria, foto, preço e estoque. O painel aceita até 8 fotos adicionais e um link de vídeo do YouTube por produto. Somente itens em estado **Publicado** aparecem publicamente. O preço anterior só vira oferta quando for maior que o preço atual.
5. Insira o número comercial do WhatsApp, com DDI e DDD, nas informações da loja. Até isso ocorrer, o site mostra o Instagram como contato e não cria links `wa.me` falsos.
6. Execute `npm run build` e `npm test`, confira as rotas e dados no ambiente de destino, depois implante na Vercel.

Não há catálogo real, número de WhatsApp individual ou projeto Vercel/Supabase BE configurado nesta pasta. Portanto, esta versão **não está publicada**. O endereço, horário e Instagram iniciais seguem o registro público em `../FONTES_INSTAGRAM_BE_IMPORTS.md`; confirme-os com a loja antes da publicação.

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
