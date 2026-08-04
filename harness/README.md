# Harness visual

Renderiza as telas do app com o Firebase mockado, para **medir** o layout em vez
de inferir do código. Foi assim que apareceram problemas que leitura de código
não pega: abas empilhando na vertical, o modal abrindo já rolado até a conversa
e ações que só existiam no hover.

## Por que existe

Duas coisas impedem simplesmente abrir o app:

1. Toda tela além do login depende do Firebase. O mock (`mockFirebase.ts`)
   devolve dados de exemplo com o mesmo formato do Firestore — inclusive
   `Timestamp` com `.toDate()`, senão os componentes quebram.
2. O `index.html` carrega o Tailwind de `cdn.tailwindcss.com` em tempo de
   execução. Em ambiente sem acesso ao CDN a página renderiza sem estilo, e
   qualquer medição vira lixo. O harness gera o CSS localmente.

## Como rodar

```bash
npm i -D playwright tailwindcss@3          # não estão no package.json de propósito:
                                            # não devem entrar no build de produção
npx tailwindcss -c harness/tailwind.config.cjs -i harness/tw.css -o harness/generated.css --minify
npx vite build --config vite.harness.config.ts
cp harness/generated.css dist-harness/harness/generated.css
node harness/audit.mjs
```

> **Rode o passo do `tailwindcss` toda vez que mexer em classe.** O CSS é
> gerado varrendo o código; reaproveitar um `generated.css` antigo faz a classe
> nova simplesmente não existir, e o elemento é medido com 0 de altura sem erro
> nenhum. Já aconteceu: uma faixa de capa `aspect-[4/3]` mediu 0px e parecia bug
> no componente — era só o CSS velho.

O `audit.mjs` sobe um servidor estático, abre cada tela em 360px e 390px e
reporta:

- **overflow horizontal**, com o elemento culpado e quantos pixels excedem
- **erros de JavaScript** na tela
- alvos de toque menores que 32px

Screenshots de cada tela ficam em `dist-harness/shot-*.png`.

## Verificação de comportamento

```bash
node harness/verifica-midia.mjs
```

O `audit.mjs` mede layout; este script exercita **comportamento**: abre a
publicação nova, escolhe pasta pelos dois caminhos (criar subpasta com o título
do conteúdo / usar uma pasta existente), sobe um PNG de verdade e confere no
`__writes` e na `__arvore` do mock que o arquivo foi para o caminho certo — e que
ele **aparece na tela de Arquivos & Materiais**, que é a promessa da interface.
Também cobre o cadastro de cliente (nasce com as pastas padrão) e o telefone do
próprio perfil.

Existe porque o campo de mídia sumiu da publicação nova sem nada acusar: ele
estava atrás de `!isCreating` e nenhuma tela do harness renderizava um post sem
id. As telas `modal-novo` e `midia-e-pastas` fecham esse buraco.

## Limite

O mock não valida regras do Firestore, permissão nem escrita — só layout e
renderização. Aprovação, comentários e relatórios continuam precisando de teste
manual contra o Firebase real.
