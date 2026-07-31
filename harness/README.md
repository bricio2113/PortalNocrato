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

O `audit.mjs` sobe um servidor estático, abre cada tela em 360px e 390px e
reporta:

- **overflow horizontal**, com o elemento culpado e quantos pixels excedem
- **erros de JavaScript** na tela
- alvos de toque menores que 32px

Screenshots de cada tela ficam em `dist-harness/shot-*.png`.

## Limite

O mock não valida regras do Firestore, permissão nem escrita — só layout e
renderização. Aprovação, comentários e relatórios continuam precisando de teste
manual contra o Firebase real.
