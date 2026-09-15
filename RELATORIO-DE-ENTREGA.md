# Relatório de entrega

Este relatório documenta, de forma honesta, o que foi implementado e
verificado de fato nesta entrega, o que foi adaptado em relação ao pedido
original (e por quê), e o que continua pendente — sobretudo tudo que exige
hardware físico, uma conta/credencial que não estava disponível no ambiente,
ou uma decisão de negócio do usuário (como contratar um banco de dados
pago). Nada abaixo foi "declarado pronto por simulação": onde não houve
teste real, isso está dito explicitamente.

## 1. O que foi implementado

Sistema completo (não protótipo) cobrindo as 18 seções da especificação
original: modelo de dados, autenticação/autorização por papel, CRM de
clientes/estabelecimentos, produção de lotes com estados de produção e
comerciais separados, geração real de QR e arquivos de impressão (PDF
individual, multipágina, imposição A4, CSV, ZIP), o fluxo de ativação em
campo (mobile-first, pensado para iPhone), vendas com pagamentos parciais,
métricas de acesso (sem inflar linguagem — nunca chama clique de "avaliação
confirmada"), histórico/auditoria de alterações, e o portão que bloqueia
exportação "pronta para produção" enquanto a origem pública não for um
domínio real validado.

## 2. Adaptações de arquitetura (e por que foram necessárias)

| Proposto | Usado | Motivo |
|---|---|---|
| Prisma | SQL puro + `pg` | Download de binários do Prisma bloqueado pela política de rede do ambiente (`binaries.prisma.sh` retorna `connect_rejected`, confirmado diretamente, não presumido). Migrações continuam versionadas em `db/migrations/*.sql`, aplicadas por um runner próprio. |
| Supabase Auth | Sessão própria (tabela `sessoes`, cookie httpOnly) | Nenhuma conta/projeto Supabase estava disponível no ambiente. Autorização por papel é sempre revalidada no servidor, nunca só na UI. |

Ambas as adaptações estão também comentadas no próprio código, no arquivo
onde cada uma se aplica (`src/lib/db/pool.ts`, `src/lib/auth/sessao.ts`).
Nenhuma outra parte da stack pedida (Next.js/TypeScript/Tailwind, deploy
Vercel) precisou ser trocada.

## 3. O que foi testado de verdade (evidência real, não simulada)

**Suíte automatizada (`npm test`, runner nativo do Node) — 14/14 testes
passando na última execução:**

- Ativação bem-sucedida persiste cliente, destino e venda corretamente.
- Impede ativação de uma placa já ativa (dupla ativação sequencial).
- **Impede ativação concorrente da mesma placa**: duas requisições disparadas
  ao mesmo tempo via `Promise.allSettled` contra o banco real — exatamente
  uma tem sucesso, a outra falha (usa `SELECT ... FOR UPDATE` + checagem
  otimista por versão). Isso prova o requisito de "nunca permitir duas
  vendas para a mesma unidade por corrida".
- Venda com a mesma chave de idempotência não duplica (proteção contra
  duplo toque/retry no botão de confirmar ativação).
- Pagamento parcial calcula a situação (pendente/parcial/quitada)
  corretamente; substituição de placa preserva o histórico de ambas
  (antiga e nova).
- Validação de destino: bloqueia `javascript:`, bloqueia URL não-HTTPS,
  bloqueia endereço loopback/interno (proteção SSRF), bloqueia `localhost`,
  aceita formato confirmado (`g.page`), exige conferência manual explícita
  para domínio Google não totalmente reconhecido (nunca finge ter
  confirmado), rejeita domínio desconhecido.
- QR gerado decodifica exatamente para a URL original (round-trip real de
  geração → decodificação com `jsQR`, não apenas inspeção visual).
- Rate limiting bloqueia corretamente após exceder o limite na janela de
  tempo configurada.

**Verificação manual via HTTP real (`curl`, contra o servidor de
desenvolvimento rodando):**

- `GET /p/<token-inexistente>` → `404` (confirmado nesta sessão).
- `POST /api/ativacao` sem sessão → `401` (confirmado nesta sessão; este foi
  originalmente um bug real — a rota devolvia `500` para requisição não
  autenticada — corrigido criando `src/lib/api-utils.ts`, que captura
  `ErroAutorizacao` e devolve o status HTTP correto; o mesmo padrão foi
  aplicado às 5 rotas de API).
- Todas as rotas do painel exigem sessão válida; um usuário com papel
  `VENDEDOR` é bloqueado no servidor ao tentar acessar rotas restritas a
  `ADMIN`, mesmo com um cookie de sessão válido (não é só a UI escondendo o
  link).
- Geração de PDF verificada abrindo os arquivos gerados (dimensões
  conferidas via `MediaBox`, contagem de páginas, e inspeção visual do
  cartão renderizado — título, 5 estrelas, ícone de NFC, QR vetorial,
  marcas de corte).
- `npx tsc --noEmit` limpo e `npm run build` concluído com sucesso,
  compilando as 21 rotas da aplicação sem erro, após a correção acima (sem
  regressão).

**O que isso NÃO prova** (limitação da verificação manual via `curl`): não
foi possível testar o Server Action de login via `curl` puro, porque Server
Actions do Next.js exigem uma codificação especial (`Next-Action`) gerada
pelo runtime do lado do cliente — uma requisição `POST` de formulário comum
não a invoca. Para testar fluxos que dependem de uma sessão autenticada via
`curl`, uma sessão foi inserida diretamente no banco (contornando o HTTP) só
para obter um token de sessão válido — o login em si, pela UI real do
navegador, não foi exercitado neste ambiente porque não há um navegador
disponível aqui para automatizar o preenchimento do formulário.

## 4. O que continua pendente de verificação manual/física

Estes itens **não podem ser verdadeiramente comprovados por simulação** e a
especificação original foi explícita em não declará-los concluídos sem
teste real:

- **Gravação e leitura de uma tag NFC física** com o app NFC Tools no
  iPhone, incluindo confirmar que o Safari realmente não permite escrever
  na tag pela própria página web (o sistema já assume isso e não tenta).
- **Impressão física real** dos PDFs (papel, sangria, corte) — os PDFs foram
  verificados digitalmente (dimensões, vetorização, decodificação do QR),
  mas não impressos numa impressora real.
- **Teste em um iPhone/Safari real**: a câmera do leitor de QR
  (`getUserMedia`), o fluxo de ativação completo em uma tela pequena, e o
  botão "copiar para NFC" precisam ser testados no dispositivo real —
  este ambiente não tem um iPhone físico disponível.
- **Login pela UI real do navegador** (ver limitação da seção 3 acima).
- **Banco de dados de produção**: nenhuma instância hospedada foi
  provisionada. Isso exigiria uma credencial/decisão do usuário e, seguindo
  a instrução recebida de não presumir contratação de recursos pagos, não
  foi assumido nenhum provedor específico nem criada nenhuma conta.
- **Publicação (deploy) real**: como consequência do item anterior, nenhuma
  URL pública foi publicada. Qualquer afirmação de "está no ar em
  `https://...`" seria falsa — este relatório não faz essa afirmação porque
  isso não aconteceu.
- **Rate limiting em múltiplas instâncias**: a implementação atual é em
  memória de processo (documentado no próprio código,
  `src/lib/rate-limit.ts`); protege uma instância só. Um deploy serverless
  com múltiplas instâncias simultâneas exigiria um armazenamento
  compartilhado (ex.: Upstash Redis), não incluído por não haver essa
  credencial disponível.

## 5. Publicação: GitHub e Vercel — bloqueio real encontrado e por quê

**GitHub: bloqueado, com motivo exato identificado (não presumido).** O
código está pronto e commitado localmente (ver histórico do git no
workspace). A identidade da conta (`siasgod`) foi confirmada com sucesso
via API (`GET /user`). Porém, tanto a criação de um repositório novo
(`POST /user/repos`) quanto o `git push` para um repositório já existente
falharam com um erro explícito do proxy da sessão, não um erro genérico:

```
access denied by the git proxy: siasgod/tags-nfc is not in this session's
authorized repository set, so the proxy will not inject a credential for it.
To fix, add the repository to the session's sources.
```

Ou seja: o acesso ao GitHub nesta sessão é restrito a um conjunto de
repositórios pré-autorizados, e nenhum repositório está autorizado ainda
para esta tarefa. Este ambiente (Cowork) não expõe uma ferramenta para
autorizar um novo repositório a partir daqui (isso existe em outros
contextos, como o Claude Code ligado ao GitHub Actions, mas não nesta
sessão). **Não é um problema de credencial inválida nem de permissão da
conta — é uma restrição de qual repositório esta sessão específica pode
tocar.** Para destravar, uma de duas ações fora deste ambiente:

1. Conectar/autorizar um repositório GitHub a esta sessão/tarefa (se a
   interface do Claude oferecer essa opção para conversas como esta); ou
2. Baixar o código (arquivo `.zip` entregue junto com este relatório) e
   você mesmo criar o repositório e fazer o primeiro `git push` — o
   histórico de commit local já está pronto, só falta um remoto acessível.

**Vercel: conta confirmada, deploy não executado.** O time
`haxixegoods-projects` (plano **hobby**, gratuito) está de fato conectado e
acessível por esta sessão — confirmado via `list_teams` — e não tem ainda
nenhum projeto chamado `tags-nfc` (`list_projects` conferido). O caminho
natural (`create_git_project`, ligando o projeto Vercel ao repositório do
GitHub para deploy automático a cada push) depende do bloqueio do GitHub
acima. Existe uma alternativa que não depende de GitHub — enviar os
arquivos do projeto diretamente para a Vercel — mas ela não foi executada
nesta entrega por dois motivos honestos: (a) o preview resultante rodaria
sem nenhum banco de dados configurado (nenhuma credencial de Postgres de
produção está disponível, e a instrução recebida foi explícita em não
presumir contratação de um banco hospedado em nome do usuário), então quase
todas as páginas do painel simplesmente falhariam ao carregar — um "link
publicado" nessas condições informaria pouco e poderia parecer mais pronto
do que está; (b) enviar as ~90 fontes do projeto inline nesta sessão é
tecnicamente possível, mas arriscado de fazer corretamente em uma única
chamada sem introduzir um erro de transcrição. Preferiu-se não arriscar um
deploy malfeito ou uma URL que pareça "no ar" sem estar de fato
utilizável. Assim que o banco de produção existir e/ou o repositório GitHub
estiver acessível, este é o próximo passo direto: `create_git_project`
(com repositório) ou reexecutar o deploy direto por arquivo, se preferido.

**Nenhuma URL pública foi publicada nesta entrega.** Qualquer afirmação
diferente desta seria falsa.

## 6. Dados sensíveis

`.env` (valores reais de desenvolvimento) nunca foi commitado — está no
`.gitignore` desde o início. `.env.example` documenta todas as variáveis
necessárias sem nenhum valor real. As credenciais de demonstração
(`npm run db:seed`) são claramente rotuladas como tal e não têm relação com
nenhum dado real de operação.
