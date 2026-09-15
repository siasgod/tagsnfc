# TAGS NFC — Gestão de placas físicas de avaliação (QR + NFC)

Sistema para produzir, vender e ativar placas físicas (10×10cm, QR impresso +
tag NFC regravável) que levam o cliente final direto para a tela de avaliação
do Google de um estabelecimento. Cada placa tem uma URL pública permanente
(`/p/TOKEN`); a ativação em campo (feita pelo iPhone, na hora da venda) é o
que define para qual estabelecimento/link de avaliação aquela URL aponta.

Este README cobre: como rodar localmente, como criar o primeiro
administrador, o guia operacional (produzir → gravar NFC → vender → ativar →
substituir) e as adaptações de arquitetura feitas em relação à proposta
original. O relatório de entrega (o que foi testado de fato, e o que
continua pendente de verificação manual/física) está em
[`RELATORIO-DE-ENTREGA.md`](./RELATORIO-DE-ENTREGA.md) — leia-o antes de
levar qualquer coisa para produção.

## Sumário

- [Arquitetura e adaptações em relação à proposta original](#arquitetura-e-adaptações-em-relação-à-proposta-original)
- [Rodando localmente](#rodando-localmente)
- [Primeiro administrador](#primeiro-administrador)
- [Dados de demonstração](#dados-de-demonstração)
- [Guia operacional](#guia-operacional)
- [Banco de dados em produção](#banco-de-dados-em-produção)
- [Publicação (deploy)](#publicação-deploy)
- [Testes](#testes)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Limitações conhecidas](#limitações-conhecidas)

## Arquitetura e adaptações em relação à proposta original

A proposta original sugeria Supabase (Postgres + Auth) e Prisma. O ambiente
de implementação não tinha uma conta/projeto Supabase disponível, e o
download dos binários do Prisma (`binaries.prisma.sh`) está bloqueado pela
política de rede do ambiente (confirmado via teste direto, não suposição).
Duas adaptações foram feitas, documentadas em código no ponto onde cada uma
importa:

1. **Prisma → SQL puro + `pg`.** As migrações vivem em `db/migrations/*.sql`
   e são aplicadas por um runner próprio (`scripts/migrate.ts`), que
   registra o que já rodou numa tabela `_migrations` e roda cada arquivo
   dentro de uma transação. O acesso a dados usa o driver `pg` diretamente
   (`src/lib/db/pool.ts` e `src/lib/db/repo/*.ts`). Isso é portável para
   qualquer Postgres, inclusive um projeto Supabase futuro — não é preciso
   trocar de banco para usar Supabase depois, só apontar `DATABASE_URL` para
   ele.
2. **Supabase Auth → sessão própria no banco.** Login cria uma linha em
   `sessoes` (token de sessão com hash SHA-256 armazenado, nunca o token em
   texto puro) e um cookie `httpOnly`, `secure` (em produção) e
   `sameSite=lax`. Autorização por papel (`ADMIN`/`VENDEDOR`) é checada no
   servidor em cada ação/rota sensível (`src/lib/auth/autorizacao.ts`), não
   apenas escondendo botões na UI. O middleware (`src/proxy.ts` — no Next.js
   16 o arquivo se chama `proxy.ts`, não `middleware.ts`) faz só uma checagem
   otimista de "existe cookie de sessão" para redirecionar cedo; a
   autorização de verdade é sempre revalidada no servidor.

Fora essas duas trocas, a stack é a proposta originalmente: Next.js
(App Router) + TypeScript + Tailwind, pensado para publicar na Vercel.

## Rodando localmente

Pré-requisitos: Node.js 20+, um PostgreSQL 14+ acessível (local ou remoto).

```bash
npm install
cp .env.example .env
# edite .env: pelo menos DATABASE_URL precisa apontar para um Postgres real

npm run db:migrate   # cria o schema
npm run dev           # http://localhost:3000
```

Enquanto `NEXT_PUBLIC_ORIGEM_PUBLICA` for `http://localhost:3000` (o padrão
do `.env.example`), o sistema trata isso como ambiente de desenvolvimento e
**bloqueia exportação "pronta para produção"** dos PDFs de impressão —
qualquer exportação sai marcada como demonstração, com marca d'água. Isso é
proposital (seção 3/11 da especificação original): impede que alguém imprima
e cole em uma loja um QR que aponta para `localhost`.

## Primeiro administrador

Não existe cadastro público. O primeiro usuário é criado uma única vez pela
rota `/painel/setup`, que só funciona enquanto a tabela `usuarios` estiver
vazia **e** o token enviado bater com a variável de ambiente `SETUP_TOKEN`:

1. Defina um `SETUP_TOKEN` forte e aleatório no `.env` (ex.:
   `openssl rand -hex 24`).
2. Acesse `/painel/setup`, informe nome, e-mail, senha e o token.
3. Depois de criado o primeiro admin, essa rota sempre recusa novos cadastros
   — mesmo com o token certo — porque a checagem é "já existe algum usuário?"
   e não "esse token específico já foi usado". Depois de usar, troque ou
   remova `SETUP_TOKEN` do ambiente.
4. Novos usuários (admin ou vendedor) são criados de dentro do painel, por um
   admin já autenticado, em Configurações → Usuários.

Alternativa por linha de comando (útil se `/painel/setup` não for viável,
por exemplo antes do primeiro deploy): `npm run db:criar-admin`.

## Dados de demonstração

`npm run db:seed` cria um conjunto de dados de teste, todos prefixados
`[DEMO]` para nunca serem confundidos com dados reais de operação:

- Admin: `demo.admin@exemplo.com` / `DemoSenha123`
- Vendedor: `demo.vendedor@exemplo.com` / `DemoSenha123`
- Um cliente e estabelecimento de demonstração
- Um lote `LOTE-0001` com 3 placas, incluindo `PL-000001` já ativada com uma
  venda e um pagamento parcial registrados

**Troque essas senhas (ou não rode o seed) antes de qualquer uso real.** O
seed é opcional e claramente separado do fluxo de produção normal — nada no
sistema depende dele para funcionar.

## Guia operacional

**Produzir um lote.** Painel → Lotes → Novo lote → informe a quantidade.
Cada placa recebe um código sequencial legível (`PL-000001`, ...) e um token
público aleatório e não adivinhável — o token nunca é reaproveitado, mesmo
que a placa seja substituída ou desativada depois.

**Gerar os arquivos de impressão.** Na página do lote: PDF individual, PDF
multipágina (uma placa por página) ou imposição em A4 (várias placas por
folha, respeitando sangria configurável — 3mm por padrão — e marcas de
corte). Todos os QR codes são gerados por biblioteca real (`qrcode`), nunca
por geração de imagem por IA, e embutidos como vetor no PDF (não como
imagem rasterizada), então imprimem nítidos em qualquer tamanho.

**Gravar a tag NFC.** O painel mostra a URL completa que deve ir na tag e um
botão "copiar para NFC". A gravação em si acontece no app NFC Tools do
iPhone (fora deste sistema) — o painel não escreve na tag pelo Safari, isso
não é possível pela Web NFC API no iOS. Depois de gravar, marque manualmente
"gravação confirmada" e, depois de testar com o próprio celular, "leitura
confirmada". Essas duas caixas são independentes e nenhuma delas é marcada
automaticamente por ter copiado o link.

**Vender e ativar (no estabelecimento, pelo iPhone).** Painel → Ativar
placa:

1. Escaneie o QR da placa (câmera, via `getUserMedia` + decodificação no
   próprio navegador) ou digite o código/token manualmente.
2. O sistema mostra o estado atual da placa. Se já estiver ativa, é preciso
   uma ação explícita separada para trocar o vínculo — ativar de novo "sem
   querer" não sobrescreve nada.
3. Selecione um cliente existente ou cadastre um novo; o mesmo para o
   estabelecimento.
4. Informe o link de avaliação do Google. O sistema valida o formato e a
   segurança do destino (bloqueia `javascript:`/`data:`, exige HTTPS, resolve
   e confere links curtos como `maps.app.goo.gl` até um domínio final
   permitido, com limite de redirecionamentos). Formatos que não dá para
   confirmar automaticamente pedem uma conferência manual explícita antes de
   ativar — o sistema nunca finge ter confirmado um link que não conferiu.
5. Confirme se é venda, demonstração ou bonificação (as duas últimas exigem
   justificativa) e o valor.
6. Confirme a ativação. Só depois que o servidor persistir tudo (placa,
   cliente/estabelecimento, venda) é que a tela mostra sucesso — nunca antes.
   Um duplo toque no botão de confirmar não gera uma segunda venda: cada
   tentativa carrega uma chave de idempotência gerada uma única vez no
   início do formulário.

**Substituir uma placa.** Se uma placa for perdida ou danificada, use
"substituir" na página da placa: a placa antiga é marcada como substituída
e desativada (seu token nunca é reaproveitado), uma nova placa é criada com
um vínculo herdado, e o histórico de ambas preserva o encadeamento completo
— nada é apagado.

## Banco de dados em produção

**Isto não foi provisionado nesta entrega.** Não havia credenciais de um
banco Postgres hospedado (Supabase ou outro) disponíveis no ambiente de
implementação, e a instrução recebida foi explícita em não presumir a
contratação de nenhum recurso pago em nome do usuário. Para publicar de
verdade:

1. Provisione um Postgres gerenciado (Supabase, Neon, Vercel Postgres, RDS,
   etc. — qualquer um serve, já que o acesso é via `pg`/SQL padrão).
2. Configure `DATABASE_URL` com a string de conexão real (com SSL, se o
   provedor exigir).
3. Rode `npm run db:migrate` apontando para esse banco.
4. Crie o primeiro admin (`/painel/setup` ou `npm run db:criar-admin`).

## Publicação (deploy)

O projeto está pronto para deploy na Vercel (build Next.js padrão, sem
etapas customizadas). **Nenhum deploy real foi publicado nesta entrega** —
o acesso ao GitHub desta sessão está restrito a um conjunto de
repositórios pré-autorizados que ainda não inclui nenhum repositório desta
tarefa (erro exato do proxy: "not in this session's authorized repository
set"), e a alternativa de deploy direto por arquivo não foi acionada porque
rodaria sem banco de dados de produção configurado. Ver
[`RELATORIO-DE-ENTREGA.md`](./RELATORIO-DE-ENTREGA.md), seção 5, para o
detalhamento exato desse bloqueio, o que já está confirmado do lado da
Vercel (conta/time conectado, plano gratuito), e os dois caminhos possíveis
para destravar.

Variáveis de ambiente necessárias na Vercel (mesmas do `.env.example`):
`DATABASE_URL`, `NEXT_PUBLIC_ORIGEM_PUBLICA` (o domínio público real, ex.
`https://seudominio.com`), `NEXT_PUBLIC_AMBIENTE=producao`, `SESSION_SECRET`
(um valor novo, não o de desenvolvimento), `SETUP_TOKEN` (temporário, para
criar o primeiro admin em produção e depois trocado/removido).

## Testes

```bash
npm test
```

Roda a suíte automatizada (`tests/*.test.ts`, runner nativo do Node) contra
o banco apontado por `DATABASE_URL` — inclui um teste real de concorrência
(duas ativações simultâneas da mesma placa via `Promise.allSettled`, uma
delas deve falhar). Veja o relatório de entrega para a lista completa dos
testes e do que ainda depende de verificação manual/física (impressão real,
gravação/leitura de NFC físico, teste em iPhone/Safari real).

## Estrutura do projeto

```
db/migrations/          Migrações SQL (schema completo)
scripts/                 Runner de migração, seed, criação de admin, verificação de QR
src/app/p/[token]/       Rota pública de redirecionamento
src/app/painel/          Painel autenticado (App Router, route groups (publico)/(privado))
src/app/api/             Rotas JSON para o assistente de ativação e exportação
src/lib/auth/            Sessão e autorização por papel
src/lib/db/repo/         Acesso a dados (SQL puro via pg), por entidade
src/lib/validacao/       Validação/segurança do link de destino (SSRF, formatos Google)
src/lib/pdf/             Desenho do cartão e geração dos PDFs de impressão
src/lib/qrcode/          Geração real de QR Code
src/lib/exportacao/      CSV, ZIP e o "portão" de liberação para exportação de produção
tests/                   Suíte de testes automatizados
```

## Limitações conhecidas

Ver [`RELATORIO-DE-ENTREGA.md`](./RELATORIO-DE-ENTREGA.md) para a lista
completa e honesta do que foi testado de verdade versus o que continua
pendente de verificação manual — inclui, por exemplo, o rate limiting em
memória (protege uma instância só; múltiplas instâncias em produção
precisariam de um armazenamento compartilhado como Redis) e a ausência de
qualquer teste físico com NFC/impressora/iPhone real.
