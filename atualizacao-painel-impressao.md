# Atualização do painel e da impressão — 15/09/2026

## Implementação

- Painel com largura ampliada, ações operacionais na Visão Geral, navegação ativa e acesso a Lotes e Configurações no celular.
- Tabelas de placas, lotes, clientes, estabelecimentos do cliente e vendas apresentadas como cartões com etiquetas de coluna em telas pequenas.
- Ativação com etapas Placa → Cliente → Estabelecimento → Google → NFC → Venda, progresso e retorno. NFC oferece a URL persistida para copiar e gravar no NFC Tools.
- Trocar cliente limpa a seleção de estabelecimento. Editar destino limpa a conferência anterior. Respostas que exigem conferência manual retornam à etapa Google.
- Template `balcao-v2`: corte de 100 × 100 mm, sangria de 3 mm, página de 106 × 106 mm, azul/branco, Google e cinco estrelas, NFC, “ou”, QR de 35 mm com quatro módulos de margem branca.
- Identificação operacional usa o código persistido (`PL-000001`), sem renumerar unidades existentes.
- Exportação utiliza o padrão atual também para lotes antigos, preservando seus códigos, tokens e URLs. Os metadados históricos do lote não são regravados. ZIP inclui PDFs individuais, multipágina, A4 e CSV. Atalho para quantidade 30 e contadores de total/disponíveis/ativas.
- PDFs continuam em RGB, sem declaração de PDF/X ou CMYK. Imprimir em escala 100%; acabamento e perfil de cor precisam ser conferidos com a gráfica.
- Comando de testes ajustado para sintaxe compatível com Windows e Unix, mantendo Node test runner, condição react-server e tsx.

## Preservação e auditoria

Nenhuma migração de banco, troca de autenticação, alteração de segredo ou contratação de serviço. Permanecem SQL/pg, jose, Zod, validação de destino, bloqueio transacional, histórico e endpoint `/p/[token]`. A exportação preserva o bloqueio de produção e a marca d’água de demonstração quando a origem não está liberada.

Pontos preexistentes encontrados, sem mudança de regra nesta entrega:

- A ativação HTTP exige usuário, mas não contém uma verificação explícita de propriedade dos IDs de cliente/estabelecimento recebidos. A restrição de consultas da interface não equivale a essa autorização. Requer revisão de escopo por entidade.
- A venda tem chave idempotente; repetir uma ativação já persistida pode retornar “já ativa” antes de chegar à venda. Não foi declarado suporte a replay integral da ativação.
- O sequencial de lotes/placas usa `count(*) + 1`; criações concorrentes podem ser rejeitadas pela constraint de unicidade. Nenhuma alteração nas transações existentes foi feita.

## Verificação realizada

- `npx tsc --noEmit`: aprovado, código de saída 0, após geração dos tipos pelo Next.
- `npm test`: executado; o ambiente bloqueou subprocessos (`spawn EPERM`). Não é uma execução aprovada da suíte padrão.
- Execução alternativa sem subprocessos, transpilando TypeScript em memória: 11 testes passaram (QR, destino, rate limit e impressão). Nenhum mock foi aplicado às funções testadas.
- Integração PostgreSQL: tentativa separada parou em `DATABASE_URL não configurada`. Ausência de banco local, não bug comprovado.
- `npm run build`: compilação Turbopack aprovada; processo completo terminou com código 1 em `Running TypeScript` por `spawn EPERM`. Não foi declarado build completo aprovado.
- Amostra: PDF com 30 páginas de 106 mm; 30 QR Codes decodificados das páginas renderizadas e comparados com suas URLs distintas. Primeira página inspecionada visualmente. Testes adicionais confirmaram PDF individual e A4 com 15 folhas para 30 placas.
- Visão Geral renderizada com os componentes reais e dados de demonstração, conferida no navegador em desktop e 390 px. Isso não testa sessão, banco, gravação de venda ou wizard ponta a ponta.
- Produção existente respondeu com a tela de login. Ainda não valida as mudanças deste commit.

## Pendências externas

Autenticação Git para push; conexão Vercel com acesso ao projeto `tagsnfc`; build completo e verificação autenticada em produção. A conexão reconheceu o time, mas retornou lista de projetos vazia, 404 no projeto e 403 nos deploys. `SESSION_SECRET`/`SETUP_TOKEN` não foram alterados; sua presença em produção não pôde ser verificada.
