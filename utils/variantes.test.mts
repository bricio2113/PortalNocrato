/**
 * Teste da logica de variantes (teste A/B).
 *
 *   npx tsx utils/variantes.test.mts
 *
 * Funcoes puras que mexem em dado que o usuario escreveu - legenda, arquivo, metrica
 * e a escolha do cliente. Errar aqui nao quebra a tela: TROCA o conteudo de lugar em
 * silencio, e a pessoa descobre quando o post sai publicado com a legenda da outra
 * versao. Por isso teste, e nao so verificacao de interface.
 */
import {
    novaVariante, promoverVariante, mesclarVariantes, versaoComMaisInteracao,
    ehTesteAB, totalVersoes, escolhaForaDaPrincipal
} from './variantes.js';
import type { CalendarEvent, VarianteConteudo } from '../types.js';

let falhas = 0;
const ok = (cond: boolean, msg: string) => {
    console.log(`${cond ? '✓' : '✗'} ${msg}`);
    if (!cond) falhas++;
};

const base = (extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
    id: 'ev1', title: 'Post', date: new Date('2026-08-20T12:00:00'),
    type: 'Post', status: 'Pendente', plataforma: 'Instagram',
    ...extra
});

const v = (id: string, rotulo: string, extra: Partial<VarianteConteudo> = {}): VarianteConteudo =>
    ({ id, rotulo, copy: '', midias: [], pastaMidia: null, ...extra });

// --- 1. post sem variante e post normal ---------------------------------
ok(!ehTesteAB(base()), 'post sem variantes NAO e teste A/B');
ok(!ehTesteAB(base({ variantes: [] })), 'lista vazia tambem nao e teste A/B');
ok(totalVersoes(base()) === 1, 'post normal tem uma versao');
ok(totalVersoes(base({ variantes: [v('1', 'B')] })) === 2, 'com uma secundaria, duas versoes');

// --- 2. rotulo do primeiro livre, sem buraco ----------------------------
ok(novaVariante([]).rotulo === 'B', 'primeira secundaria vira B (A e a principal)');
ok(novaVariante([v('1', 'B')]).rotulo === 'C', 'depois de B vem C');
// Apagar a C e criar outra tem que devolver C, nao D: numeracao com buraco faz a
// equipe procurar a variante que nao existe.
ok(novaVariante([v('1', 'B'), v('3', 'D')]).rotulo === 'C', 'preenche o buraco (B, D -> C)');

// --- 3. promover TROCA o conteudo, e o rotulo fica ----------------------
{
    const event = base({
        copy: 'legenda da principal',
        midias: [{ url: 'a.jpg', path: 'pa', contentType: 'image/jpeg', bytes: 1 }],
        variantes: [v('vb', 'B', {
            copy: 'legenda da B',
            midias: [{ url: 'b.jpg', path: 'pb', contentType: 'image/jpeg', bytes: 2 }]
        })]
    });
    const patch = promoverVariante(event, 'vb')!;

    ok(patch.copy === 'legenda da B', 'a legenda da B sobe para a principal');
    ok(patch.midias?.[0].path === 'pb', 'a midia da B sobe junto');
    ok(patch.variantes?.[0].copy === 'legenda da principal', 'e a antiga principal desce para a variante');
    ok(patch.variantes?.[0].midias?.[0].path === 'pa', 'com a midia dela');
    ok(patch.variantes?.[0].rotulo === 'B', 'o rotulo B FICA na variante - ele descreve a posicao, nao o conteudo');
    ok(patch.variantes?.length === 1, 'nao cria nem perde variante na troca');
}

// Promover DUAS VEZES tem que voltar ao estado original - se nao voltar, algum campo
// esta sendo perdido no caminho.
{
    const original = base({ copy: 'A', previewUrl: 'a.png', variantes: [v('vb', 'B', { copy: 'B', previewUrl: 'b.png' })] });
    const ida = { ...original, ...promoverVariante(original, 'vb')! };
    const volta = { ...ida, ...promoverVariante(ida, 'vb')! };
    ok(volta.copy === 'A' && volta.variantes?.[0].copy === 'B', 'promover duas vezes volta ao original');
    ok(volta.previewUrl === 'a.png' && volta.variantes?.[0].previewUrl === 'b.png', 'a previa tambem volta');
}

ok(promoverVariante(base({ variantes: [] }), 'nao-existe') === null,
    'promover id inexistente devolve null em vez de estragar o post');

// --- 3b. NADA de `undefined`, e nada de campo omitido ---------------------
// O caso COMUM: post sem previa e sem metrica. O Firestore recusa `undefined`
// (inclusive dentro de array, onde o stripUndefined do projeto nao chega) e o mock
// do harness aceita - ou seja, isto so aparece em producao.
{
    const seco = base({ copy: 'A', variantes: [v('vb', 'B', { copy: 'B' })] });
    const patch = promoverVariante(seco, 'vb')!;
    const cru = [
        ...Object.entries(patch),
        ...(patch.variantes || []).flatMap(x => Object.entries(x))
    ];
    ok(cru.every(([, valor]) => valor !== undefined),
        `nenhum campo vai como undefined: ${cru.filter(([, x]) => x === undefined).map(([k]) => k).join(',') || 'ok'}`);

    // E o campo tem que VIR, mesmo vazio: o patch entra num update(), onde chave
    // ausente nao limpa - a previa da versao que desceu ficaria no post.
    ok('previewUrl' in patch && patch.previewUrl === '',
        'promover sem prévia LIMPA a prévia em vez de omitir o campo');
    ok('metrics' in patch && Object.keys(patch.metrics || {}).length === 0,
        'e zera a métrica, que era da outra versão');
}

// O merge tambem alimenta o array gravado - e o mesmo risco.
{
    const juntas = mesclarVariantes(
        [v('vb', 'B', { copy: 'gravada' })],
        [{ id: 'vb', rotulo: 'B' } as VarianteConteudo]   // rascunho sem copy nem previewUrl
    );
    ok(Object.values(juntas[0]).every(x => x !== undefined),
        'o merge não devolve variante com campo undefined');
}

// --- 3c. a escolha do cliente anda junto na promocao --------------------
// `approvalVersao` aponta para uma POSICAO ("aprovei a B") e promover troca o
// conteudo de posicao. Errar aqui e o pior defeito possivel deste recurso: a tela
// diria "aprovado - versao B" apontando para a peca que o cliente RECUSOU.
{
    const comEscolha = base({
        copy: 'da principal', approvalVersao: 'B',
        variantes: [v('vb', 'B', { copy: 'da B' })]
    });
    const patch = promoverVariante(comEscolha, 'vb')!;
    ok(patch.approvalVersao === 'A',
        `a escolha do cliente segue o conteudo dele: ${patch.approvalVersao}`);

    // E vale ao contrario: se o aprovado era a principal e outra versao sobe, o
    // conteudo aprovado desceu para a posicao dela.
    const aprovouA = base({ approvalVersao: 'A', variantes: [v('vb', 'B')] });
    ok(promoverVariante(aprovouA, 'vb')!.approvalVersao === 'B',
        'e o conteudo que desce leva a aprovacao com ele');

    // Escolha em OUTRA versao (aprovou a C, promoveram a B): nenhuma das duas
    // posicoes mexidas e a dela, entao o campo nao pode ser tocado.
    const aprovouC = base({ approvalVersao: 'C', variantes: [v('vb', 'B'), v('vc', 'C')] });
    ok(!('approvalVersao' in promoverVariante(aprovouC, 'vb')!),
        'promover outra versao nao encosta na escolha do cliente');

    // Post sem escolha nenhuma: nada de `approvalVersao: undefined` no patch, que o
    // Firestore recusaria.
    ok(!('approvalVersao' in promoverVariante(base({ variantes: [v('vb', 'B')] }), 'vb')!),
        'sem escolha, o campo nem entra na gravacao');
}

// --- 3d. quando avisar que a escolha nao foi aplicada -------------------
{
    ok(escolhaForaDaPrincipal({ approvalVersao: 'B', variantes: [v('vb', 'B')] }) === 'B',
        'cliente aprovou a B e a principal e outra: precisa de aviso');
    ok(escolhaForaDaPrincipal({ approvalVersao: 'A', variantes: [v('vb', 'B')] }) === null,
        'cliente aprovou a principal: nada a aplicar');
    ok(escolhaForaDaPrincipal({ variantes: [v('vb', 'B')] }) === null,
        'ainda sem decisao do cliente: nada a avisar');
    // Dado velho: campo sobrou de quando havia variante, e o A/B foi desligado.
    ok(escolhaForaDaPrincipal({ approvalVersao: 'B', variantes: [] }) === null,
        'post que deixou de ser A/B nao fica pedindo para promover uma versao que nao existe');
}

// --- 4. merge: cada metade com o seu dono -------------------------------
{
    const gravadas = [v('vb', 'B', {
        copy: 'legenda VELHA',
        midias: [{ url: 'nova.jpg', path: 'p-nova', contentType: 'image/jpeg', bytes: 3 }],
        metrics: { interacoes: 10 }
    })];
    const rascunho = [v('vb', 'B', { copy: 'legenda NOVA digitada', midias: [] })];
    const juntas = mesclarVariantes(gravadas, rascunho);

    ok(juntas[0].copy === 'legenda NOVA digitada', 'a legenda vem do rascunho (foi digitada)');
    ok(juntas[0].midias?.[0].path === 'p-nova', 'a MIDIA vem do gravado - senao o upload feito com o modal aberto seria perdido');
    ok(juntas[0].metrics?.interacoes === 10, 'a metrica tambem vem do gravado');
}

{
    // Casa por ID: se casasse por indice, promover (que reordena) levaria a legenda
    // de uma variante para outra.
    const gravadas = [v('vc', 'C', { copy: 'do C' }), v('vb', 'B', { copy: 'do B' })];
    const rascunho = [v('vb', 'B', { copy: 'B editada' }), v('vc', 'C', { copy: 'C editada' })];
    const juntas = mesclarVariantes(gravadas, rascunho);
    ok(juntas[0].id === 'vc' && juntas[0].copy === 'C editada', 'casa por id, nao por posicao');
    ok(juntas[1].id === 'vb' && juntas[1].copy === 'B editada', 'e a outra tambem');
}

{
    const juntas = mesclarVariantes([v('vb', 'B', { copy: 'gravada' })], []);
    ok(juntas[0].copy === 'gravada', 'variante que nao esta no rascunho fica como esta');
}

// --- 5. comparacao de resultado ----------------------------------------
{
    ok(versaoComMaisInteracao(base({ metrics: { interacoes: 50 } })) === null,
        'sem variante nao ha comparacao');
    ok(versaoComMaisInteracao(base({
        metrics: { interacoes: 50 },
        variantes: [v('vb', 'B')]
    })) === null, 'com numero em so uma das versoes, nao elege vencedora');

    const disputa = base({
        metrics: { interacoes: 50 },
        variantes: [v('vb', 'B', { metrics: { interacoes: 120 } })]
    });
    ok(versaoComMaisInteracao(disputa)?.rotulo === 'B', 'a de mais interacao ganha');

    // Alcance maior NAO ganha: alcance depende de verba, interacao depende da peca.
    const verba = base({
        metrics: { alcance: 100000, interacoes: 30 },
        variantes: [v('vb', 'B', { metrics: { alcance: 500, interacoes: 90 } })]
    });
    ok(versaoComMaisInteracao(verba)?.rotulo === 'B', 'alcance alto nao compra a vitoria');
}

console.log(falhas === 0 ? '\ntodos passaram' : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
