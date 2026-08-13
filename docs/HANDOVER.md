# Handover — PortalNocrato

Escrito para quem vai **reconstruir** o portal (multi-tenant, outra stack) usando o app
atual apenas como base.

**O que este documento é:** o registro do que o app aprendeu — as regras de domínio que
não aparecem no schema, as decisões e o motivo delas, e as armadilhas que custaram bug.
É o que se perde quando se recomeça lendo só os componentes.

**O que ele não é:** especificação da implementação atual, nem defesa dela. Onde eu
mudaria de rumo, está escrito na seção *O que eu faria diferente*.

Referência de código: o "por quê" de cada decisão está no comentário junto dela. Este
documento aponta os lugares; o detalhe fica no arquivo.

---

## 1. O produto em uma página

Portal de cliente de agência de social media. Dois lados da mesa:

| Papel | Como é definido hoje | Vê |
|---|---|---|
| **admin** | e-mail em lista fixa (`constants.ts` + `firestore.rules` + `storage.rules`) | tudo, e gerencia pessoas/clientes/permissões |
| **colaborador** | `usuarios/{uid}.role == 'agencia'` | trabalha em **todos** os clientes; não mexe em acesso |
| **cliente** | `role != 'agencia'`, com `empresaId` apontando para a empresa dele | apenas a própria empresa |

O objeto central é a **publicação** (`CalendarEvent`): título, data/hora, tipo (Carrossel,
Reels, Story, Estático, Tráfego…), plataforma, legenda, peças de mídia, status interno,
aprovação do cliente, responsáveis, subtarefas, métricas e versões A/B.

O fluxo real, na ordem em que acontece:

```
agência cria o conteúdo na agenda
  → produz (subtarefas, responsáveis, prazos internos)
  → sobe a peça pronta (mídia na pasta do cliente)
  → cliente vê a prévia do feed e APROVA ou PEDE AJUSTE
  → ajuste volta para a agência com SLA
  → aprovado → publicado → métricas preenchidas
```

**Divisão bruto/entrega** (decisão de produto, não técnica): material bruto —
captação, ensaio, arquivo aberto, o que o cliente manda para editar — vive no **Google
Drive**; o portal guarda a **entrega pronta**, que é o que o cliente vê, aprova e recebe.
O Drive entra como atalho dentro da árvore de pastas, não como "jeito antigo". Espelhar
os dois é armadilha, não feature faltando: pede servidor, OAuth por pessoa e resolução de
conflito, e divergiria em silêncio — o pior tipo de falha, porque ninguém percebe até
aprovar a versão errada.

---

## 2. Regras de domínio que não estão no schema

São as que, se você reconstruir só pelas telas, vai redescobrir por bug.

### 2.1 Status interno ≠ estágio do cliente

A agência trabalha com sete status (`Pendente, Agendado, Em andamento, Editado,
Concluído, Postado, Cancelado`). Para quem contrata, quase todos significam a mesma
coisa: "ainda não é comigo". O cliente tem **cinco** estágios derivados de
`status + approval` (`utils/eventState.ts`):

`em_producao · aguardando_voce · aprovado · publicado · cancelado`

Dois detalhes que valem portar:

- O rótulo é **ação, não estado**: "Precisa da sua aprovação", não "Aguardando você" —
  o segundo descreve o sistema esperando e o cliente lia o selo sem entender que a
  decisão era dele.
- O **mesmo** estágio é dito de forma diferente para cada lado (`stageView(stage, papel)`).
  A primeira versão vazou a frase em segunda pessoa para o painel da agência, onde
  "aguardando você" acusava a própria equipe de segurar um post que estava com o cliente.

### 2.2 Um relógio por post, com dono

`utils/sla.ts` — a ideia central é que **um post tem sempre um prazo rodando, e o dono
dele muda de lado**. Em vez de três selos competindo na tela, uma função devolve o único
prazo que vale agora e de quem é a bola. Precedência:

1. **encerrado** — publicado, cancelado ou aprovado: não há prazo;
2. **ajuste** — cliente pediu mudança: agência tem 2 **dias úteis** do pedido;
3. **aprovação** — material pronto esperando o cliente: o prazo dele é a janela de revisão;
4. **produção** — vale a **data de publicação**: peça não pronta no dia de publicar está atrasada.

O item 4 **só conta em produção**. Antes o atraso continuava correndo enquanto o post
estava com o cliente, e a tela acusava a agência de "5 dias atrasado" por uma demora que
não era dela.

Dias **úteis** para o SLA da agência (dar 2 dias para um ajuste pedido sexta à noite é dar
zero); dias **corridos** para a janela do cliente (é ancorada na data de publicação, e o
feed não tira fim de semana). Feriado não entra — exigiria calendário nacional mantido à
mão.

### 2.3 Janela de revisão: 1 dia para imagem, 2 para vídeo

Vídeo pede mais porque reeditar e renderizar não cabe em um dia. A janela é **derivada**
da data e do formato, nunca gravada: campo gravado exigiria recálculo a cada mudança de
data ou de tipo, e um esquecimento ali mente na tela.

Ela é anunciada **enquanto está aberta**, não só quando fecha — uma janela que o cliente
descobre no instante em que perde o direito parece punição; anunciada antes, é combinado.

Fora da janela, o botão de ajuste **sai** em vez de ficar apagado, e a tela oferece as três
saídas reais (remarcar, cancelar, trocar por outro conteúdo) como **conversa**, não escrita
direta: essas três mexem no calendário e quem produziu a peça precisa participar.

### 2.4 Aprovação é do cliente, e só dele

A agência vê o estado e **não vota**. O cliente escreve **somente** campos de aprovação
(`approval, approvalBy, approvalByName, approvalAt, approvalVersao`) — a regra usa
`diff().affectedKeys().hasOnly(...)`, o que impede mudar data, legenda ou métrica na
mesma requisição.

Quem aprovou fica gravado no documento (nome copiado, não resolvido na leitura): numa
discussão sobre "ninguém aprovou isso", quem e quando importam. O nome é **copiado**
porque as regras não deixam o cliente ler os documentos da equipe — resolver na leitura
mostraria e-mail cru ou vazio no portal dele.

### 2.5 Teste A/B: a versão principal **é** o post

Um conteúdo pode ter versões (legenda e peça diferentes). O modelo que eu manteria:

- `copy`, `midias`, `previewUrl`, `metrics` do post **são** a versão principal;
  `variantes[]` guarda só as secundárias.
- Não existe campo "qual é a principal". Um id apontando para ela seria segunda fonte de
  verdade, e o dia em que apontasse para uma variante apagada o post ficaria sem versão.
- **Promover troca o conteúdo de lugar**, e o rótulo fica onde está: "B" descreve a
  posição, não o conteúdo. Se viajasse junto, a variante A viraria B a cada promoção e a
  conversa da equipe sobre "a versão B" mudaria de dono sozinha.
- Duas variantes **não** são duas entregas: como dois registros, virariam dois cards na
  agenda, contariam duas vezes na pendência e exigiriam sincronizar data e status.

O ganho: calendário, prévia do feed, miniatura, portal do cliente e contagem de pendência
**não sabem** que variante existe — leem `copy` e `midias` como sempre.

O cliente vê as versões e aprova **uma** (`approvalVersao`). Regras que não são óbvias:

- a escolha **não promove**: promover reescreve legenda e mídia, e o cliente não pode
  fazer isso. A agência é avisada de que a escolha ainda não é a principal e aplica com um
  clique. Aplicar em silêncio ao abrir o modal seria reescrever conteúdo porque alguém
  olhou a tela;
- pedir ajuste **apaga** a escolha: recusa não escolhe versão, e manter a anterior faria a
  agência promover uma peça recém-recusada;
- `approvalVersao` aponta para **posição**, então promover **remapeia** o marcador (A ↔ B).
  Sem isso a tela diria "aprovado — versão B" apontando para a peça recusada, e o aviso
  apareceria justamente depois de a escolha ter sido aplicada;
- comparação de resultado usa **interação, não alcance**: alcance depende de verba e
  premiaria a versão que recebeu mais dinheiro.

### 2.6 Mídia e pastas

- **Ordem do array é a ordem do carrossel.** Nunca reordenar sem o usuário pedir.
- A **capa** é gerada da primeira peça. Ao reordenar, precisa ser regerada — senão a grade
  mostra a peça que *era* a capa, a interface mentindo sobre o próprio post. Só quando a
  posição 1 muda e é imagem: vídeo pediria o arquivo inteiro em memória. Falha devolve
  nulo e a capa antiga fica (degradação visual, não perda).
- Pastas do cliente novo, por **tipo de entrega**: `Carrossel · Estático · Reels ·
  Criativo · Contratos e Documentos`. O anterior (`Imagens/Vídeos/Identidade
  Visual/Referências`) era vocabulário de **acervo** — descreve o que se guarda antes de
  produzir, que é exatamente o que ficou no Drive. "Contratos e Documentos" é exceção
  deliberada: não é peça, mas também não é bruto.
- URL de atalho externo é validada **na entrada** e na leitura. Sem a validação na
  entrada, dava para gravar `javascript:` num link que a tela renderiza para o cliente
  clicar.

### 2.7 Dinheiro

Sempre **centavos inteiros**. Nunca float.

---

## 3. Inventário de dados (Firestore)

Tudo sob `empresas/{empresaId}` — onde **empresa = cliente da agência**, e o id é o slug
do nome.

| Coleção | Guarda | Nota |
|---|---|---|
| `usuarios/{uid}` | papel, vínculo (`empresaId`), nome, cargo, telefone | `_financeiro/` em subcoleção |
| `empresas/{id}` | ficha do cliente (segmento, contato, contrato) | leitura/escrita administrativa |
| `…/events` | publicações — o objeto central | cliente lê tudo, escreve só aprovação |
| `…/post_comments` | conversa por post | não se edita: o histórico é a prova |
| `…/historico` | andamento (criado, status, data, aprovação, mídia, prazo) | **só escrita**, nunca update/delete |
| `…/subtarefas` | etapas de produção, com dono e prazo | **interno**: cliente não lê |
| `…/covers` | miniatura por post (~40 KB, data URI) | coleção própria por custo (ver §5) |
| `…/marca` | estudo de marca (personas, tom, estratégia) | editado pelos **dois** lados |
| `…/drive_links` | atalhos do Drive, com `caminho` da pasta | doc antigo sem `caminho` cai na raiz |
| `…/relatorios` | relatório mensal | entregue ao cliente, não editado por ele |
| `…/tasks`, `…/kanban_tasks` | resquícios do modelo antigo | dado preservado, telas removidas |
| `…/_financeiro`, `…/_meta` | valores e marca de seed | `_meta/seed` evita dado de exemplo reaparecer |
| `configuracoes/{docId}` | preferências | |
| `Agenciaapk` | legado | não portar sem olhar o conteúdo |

**Storage:** `empresas/{id}/posts/{eventId}/**` (peças do post) e
`empresas/{id}/materiais/**` (árvore de pastas). Não existe "criar pasta" no Cloud
Storage: pasta é prefixo, e a criação grava um marcador vazio `.pasta` — sem nenhum
objeto com aquele prefixo a pasta desaparece ao recarregar. Apagar pasta é recursivo à
mão; não há "delete prefix".

---

## 4. Decisões que eu manteria

**Dono de campo.** A regra mais importante do app:

> texto digitado → rascunho, gravado no "Salvar"
> estrutura e arquivo → gravam na hora

Criar/remover/promover versão, mídia, ordem do carrossel, responsáveis e subtarefas
gravam no ato e voltam por assinatura. Legenda, título e prévia esperam o botão. **Um
campo nunca pode ter dois donos** — ver §5.1.

**Estado derivado, não gravado.** Estágio do cliente, SLA, janela de revisão e progresso
de subtarefa são calculados. Campo gravado precisa ser recalculado a cada mudança e um
esquecimento mente na tela.

**Vocabulário por leitor.** O mesmo dado, dito para quem lê (agência x cliente). Não é
tradução de i18n: é qual frase serve para a decisão daquela pessoa.

**Nome do autor copiado** no registro (comentário, aprovação, histórico), porque quem lê
pode não ter permissão para resolver o autor.

**Histórico só-escrita.** A serventia de um histórico é ser prova, e prova que se edita
não serve. Registro errado se corrige com registro novo.

**Nada de botão desabilitado sem explicação.** Ou o botão sai, ou a tela diz por quê —
um botão apagado sem motivo vira reclamação no WhatsApp.

**Textos que ensinam o fluxo.** Três exemplos que valem portar quase literalmente:
"Bruto no Drive" (em vez de "links do cadastro **antigo**", que mandava a equipe apagar
exatamente o que deve manter); "o bruto deste conteúdo… a peça pronta sobe acima" (em vez
de "**alternativa**: use quando o material ficar no Drive"); e "As entregas prontas do
cliente. O bruto fica no Drive." (em vez de "tudo do cliente em um lugar só").

---

## 5. Armadilhas que custaram bug

### 5.1 Campo com dois donos apagava dado

Responsáveis eram gravados na hora **e** viviam no rascunho do modal. O "Salvar"
reenviava a lista velha por cima da atribuição recém-feita, em silêncio. Sintoma que o
time relatou: "marquei o segundo responsável e o primeiro desapareceu".

Correção: assinatura ao vivo do campo + o payload do Salvar **omite** o campo. O mesmo
padrão reapareceu um nível mais fundo nas variantes (legenda no rascunho, mídia gravada),
resolvido com merge **por id** — nunca por índice, porque promover e remover mudam a ordem.

### 5.2 `undefined` dentro de array

O Firestore recusa `undefined` em **qualquer** profundidade; um utilitário de limpeza que
olha só o primeiro nível não alcança um objeto dentro de array. Como `previewUrl` e
`metrics` faltam na maioria dos posts, isso quebrava o **caminho comum**. E o mock aceitava
`undefined`, então passava por todas as verificações para falhar em produção.

Duas lições: limpar em profundidade no ponto de gravação, e **o mock tem que ser tão
rígido quanto o banco**.

### 5.3 Patch em `update()` não limpa campo ausente

Promover uma versão sem prévia tem que gravar `''`, não omitir a chave — senão a prévia da
versão que acabou de descer fica no post e o feed mostra a imagem errada.

### 5.4 Peça que falhou ficava quebrada para sempre

O estado de erro da prévia era indexado por posição e só resetava ao trocar de post.
Trocar as peças de lugar mantinha o erro na posição antiga: "não foi possível carregar" na
lâmina 1 para sempre. Chave de erro tem que ser o **arquivo**, não a posição — e cabe um
"tentar de novo".

### 5.5 Custo empurrou a miniatura para fora do documento

A contagem de pendências lê a coleção de eventos inteira. Com a miniatura (~40 KB) dentro
do evento, cada contagem arrastava dezenas de MB por abertura do painel. Numa reescrita
relacional isso deixa de ser problema de modelagem — mas **o padrão de leitura em leque
continua sendo o que define a conta**.

### 5.6 Consulta por cliente não escala

"O que esta pessoa fez" faz **uma consulta por cliente**, com teto de 40 no código. Com
banco relacional é um `JOIN`. Já era dívida reconhecida.

### 5.7 Layout mentindo em silêncio

- CSS gerado por varredura do código: reaproveitar CSS antigo faz a classe nova não
  existir e o elemento é medido com **0 de altura, sem erro nenhum**.
- `<p>` com `flex` transforma cada pedaço de texto em item do container: um `<strong>` no
  meio da frase se separa dela com o gap. Só aparece medindo o texto renderizado.
- Elemento com `role="tab"` **não** é encontrado por seletor de botão. Custou três
  investigações de "a interface não tem esse botão" que eram teste errado.

---

## 6. O que eu faria diferente

Na ordem de impacto para o objetivo multi-tenant.

**1. Agência precisa ser tenant, não papel.** Hoje `role: 'agencia'` dá acesso a **todos**
os clientes, e não existe "de qual agência você é". No modelo novo: `agencias` →
`usuarios (agencia_id, role)` → `clientes (agencia_id, slug)` com unicidade **composta**
(hoje o id do cliente é slug global: duas agências com um cliente "Studio X" colidem).
Toda tabela leva `agencia_id`, toda policy compara com o tenant da **sessão** — nunca com
valor enviado pelo cliente. E um **teste automatizado de vazamento entre tenants** (logar
como A, tentar tudo de B) escrito **antes** do porte: revisão visual não pega isso.

**2. Admin por e-mail em lista fixa foi decisão consciente — e não sobrevive ao SaaS.**
O motivo era real (`isAdmin: true` no banco exigiria regra protegendo aquele campo, e um
esquecimento devolve escalação de privilégio). Mas a lista vive em **três** arquivos e
promover alguém exige deploy. No modelo novo: papel na tabela, com a escrita do papel
protegida por policy, e `platform_admin` separado de `admin do tenant`.

**3. Tema por tenant não é campo de config.** A cor da marca aparece **370 vezes** literal
no código do app, em 40 arquivos. Se cada agência terá a própria identidade, os tokens de cor precisam nascer
como variável desde a primeira tela — retrofit é caro e some em revisão.

**4. Métricas e relatório merecem tabela, não documento.** Relatório mensal, financeiro e
"o que esta pessoa fez" são perguntas de `SUM`/`GROUP BY`/`JOIN`. Foi onde o modelo de
documentos doeu mais.

**5. Contadores de pendência como visão materializada**, não varredura da coleção a cada
abertura de painel. Custo por leitura é o que fica caro em escala.

**6. Servidor para o que não pode viver no navegador.** Hoje não existe, e isso forçou:
criar conta de colaborador com **instância secundária do SDK** no cliente; nenhuma tarefa
agendada (resumo de SLA, prazo estourando); e-mail transacional só o do provedor de auth;
e a chave da API do Drive sem lugar seguro para morar. Um serviço fino resolve os quatro.

**7. Feriado no cálculo de dias úteis.** Foi deixado de fora por exigir calendário mantido
à mão. Com servidor, é uma tabela.

---

## 7. O que vale reaproveitar como método

O que mais protegeu este app não foi tipagem, foi **medir em vez de inferir**:

| Ferramenta | O que responde |
|---|---|
| `harness/audit.mjs` | abre cada tela em 360 e 390 px e reporta overflow horizontal, erro de JS e alvo de toque menor que 32 px |
| `harness/verifica-midia.mjs` | **197 checagens de comportamento**: clica, grava e confere o que a tela mostra e o que foi gravado |
| `harness/mockFirebase.ts` | banco falso com filtro real, assinatura por documento, árvore de Storage e **recusa a `undefined` como o banco recusa** |
| `utils/sla.test.mts` | 16 asserções de prazo (dia útil, janela, precedência) |
| `utils/variantes.test.mts` | 38 asserções de A/B (rótulo, promoção, merge, vencedora) |

Três regras que valem mais que as ferramentas:

1. **Lógica pura que mexe em dado do usuário ganha teste, não verificação de tela.** Errar
   ali não quebra a interface: troca conteúdo de lugar em silêncio, e a pessoa descobre
   quando o post sai publicado com a legenda errada.
2. **A checagem afirma o que o usuário vê**, não o que o código faz. Foi assim que um bug
   de layout meu apareceu — o texto renderizado não era o texto do código.
3. **Lacuna no mock esconde bug real.** Enquanto o filtro era no-op e não havia assinatura
   por documento, comportamento ao vivo passava tanto certo quanto errado. Toda vez que
   escolhi "corrigir o mock" em vez de "corrigir o teste", apareceu um defeito de verdade.

O investimento não se perde ao trocar de stack: as checagens descrevem **comportamento de
tela**. O que muda é o mock e as asserções que inspecionam o formato de gravação.

---

## 8. Pendências operacionais do app atual

- **`firestore.rules` e `storage.rules` são publicados à mão no console.** Esquecer
  quebra funcionalidade em silêncio (foi o que aconteceu com `subtarefas`, `marca`,
  `configuracoes` e `approvalVersao`). Na stack nova isso tem que ser migration aplicada
  por CI — no dia em que outra agência paga, deixa de ser chateação e passa a ser
  incidente.
- **Cloud Storage real nunca foi exercitado por verificação automática**: upload,
  listagem, exclusão e reordenação são conferidos contra o Storage falso.
- **Chave da API do Drive não pode entrar no repositório** (é público). Hoje só de
  variável de ambiente; na stack nova, do lado do servidor.
- A lista de e-mails admin precisa ser mudada em três arquivos ao mesmo tempo.
