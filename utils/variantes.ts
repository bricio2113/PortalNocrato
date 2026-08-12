import { CalendarEvent, VarianteConteudo, EventMetrics } from '../types';

/**
 * Teste A/B de um conteudo.
 *
 * REGRA CENTRAL, da qual tudo aqui depende: a variante PRINCIPAL e o proprio evento.
 * `event.variantes` guarda so as secundarias. Nao existe campo "qual e a principal" -
 * um id apontando para a principal seria uma segunda fonte de verdade, e o dia em que
 * ele apontasse para uma variante apagada o post ficaria sem versao nenhuma.
 *
 * O ganho dessa escolha e o que NAO precisou mudar: grade do calendario, previa do
 * feed, miniatura, aprovacao do cliente e contagem de pendencia continuam lendo
 * `copy` e `midias` do evento. Nenhuma dessas telas sabe que variante existe.
 */

/** Rotulos na ordem em que sao oferecidos. A principal e sempre "A". */
export const ROTULOS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Campos que uma variante carrega - o que muda de versao para versao. */
export interface ConteudoVariavel {
    copy?: string;
    midias?: CalendarEvent['midias'];
    pastaMidia?: string[] | null;
    previewUrl?: string;
    metrics?: EventMetrics;
}

export const ehTesteAB = (event: Pick<CalendarEvent, 'variantes'>) =>
    Boolean(event.variantes && event.variantes.length > 0);

/** Rotulo da principal. Fixo: ela e a primeira posicao, sempre. */
export const ROTULO_PRINCIPAL = 'A';

/**
 * A versao que o cliente escolheu, quando ela NAO e a principal.
 *
 * E o unico estado do teste A/B que precisa de aviso na tela: o cliente aprovou a
 * B e o que vai publicado e a A. O cliente nao pode promover (as regras so deixam
 * ele escrever campos de aprovacao, e promover reescreve legenda e midia), entao
 * sem um aviso a agencia publicaria a peca que ele nao escolheu.
 */
export const escolhaForaDaPrincipal = (
    event: Pick<CalendarEvent, 'approvalVersao' | 'variantes'>
): string | null =>
    ehTesteAB(event) && event.approvalVersao && event.approvalVersao !== ROTULO_PRINCIPAL
        ? event.approvalVersao
        : null;

/** Quantas versoes o post tem, contando a principal. */
export const totalVersoes = (event: Pick<CalendarEvent, 'variantes'>) =>
    1 + (event.variantes?.length || 0);

export function novaVariante(existentes: VarianteConteudo[]): VarianteConteudo {
    // O rotulo e o primeiro livre, e nao "existentes.length + 1": apagar a C e criar
    // outra devolveria "D" e o post ficaria com A, B, D - numeracao com buraco, que
    // faz a equipe procurar a variante que nao existe.
    const usados = new Set(['A', ...existentes.map(v => v.rotulo)]);
    const rotulo = ROTULOS.find(r => !usados.has(r)) || `V${existentes.length + 2}`;
    return {
        // `crypto.randomUUID` nao existe em contexto nao seguro (http na rede local).
        id: `v${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
        rotulo,
        copy: '',
        midias: [],
        pastaMidia: null
    };
}

/**
 * Tira as chaves com valor `undefined`.
 *
 * O Firestore recusa `undefined` ("Unsupported field value") e o `stripUndefined`
 * do projeto atua num nivel so - nao alcanca a variante, que vive DENTRO de um
 * array. E aqui o caso e o comum, nao o raro: `previewUrl` e `metrics` estao
 * ausentes na maioria dos posts, entao promover a primeira variante de um post sem
 * previa e sem numeros falharia na gravacao. O mock do harness aceita `undefined`,
 * ou seja, esse defeito passaria por todas as verificacoes de interface.
 */
const semVazios = <T extends object>(obj: T): T =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

/** Deixa a variante gravavel: sem `undefined` em nenhuma chave. */
export const varianteGravavel = (v: VarianteConteudo): VarianteConteudo => semVazios(v);

/** Extrai da principal o que e conteudo variavel. */
export const conteudoDaPrincipal = (event: CalendarEvent): ConteudoVariavel => ({
    copy: event.copy,
    midias: event.midias,
    pastaMidia: event.pastaMidia,
    previewUrl: event.previewUrl,
    metrics: event.metrics
});

/**
 * Promove uma secundaria a principal, TROCANDO o conteudo das duas.
 *
 * Nao e "mover para o inicio da lista": a principal nao esta na lista. O conteudo da
 * variante sobe para os campos do evento e o que estava lá desce para a posicao dela,
 * mantendo o rotulo de cada uma no lugar - depois da troca, "A" continua sendo o nome
 * da principal, porque e isso que a equipe le no chip.
 *
 * Devolve APENAS os campos que mudam, para o chamador gravar um patch e nao um
 * documento inteiro.
 */
export function promoverVariante(
    event: CalendarEvent,
    varianteId: string
): Partial<CalendarEvent> | null {
    const lista = event.variantes || [];
    const indice = lista.findIndex(v => v.id === varianteId);
    if (indice === -1) return null;

    const escolhida = lista[indice];
    const principal = conteudoDaPrincipal(event);

    const novas = [...lista];
    novas[indice] = semVazios({
        ...escolhida,
        // O rotulo NAO viaja: ele descreve a posicao ("A" e a principal), nao o
        // conteudo. Trocar os rotulos junto faria a variante A virar B e a B virar A
        // a cada promocao, e ninguem acompanharia a conversa sobre "a versao B".
        rotulo: escolhida.rotulo,
        // Cada campo variavel recebe valor, mesmo vazio - `|| ''` e `|| {}` em vez de
        // deixar a chave de fora. O patch vai num `update()`: chave ausente NAO limpa,
        // mantem o que estava. Promover uma variante sem previa deixaria a previa da
        // outra versao no post, e o feed mostraria a imagem da versao que acabou de
        // descer. Vale igual aqui dentro: a variante recebe a previa da principal.
        copy: principal.copy || '',
        midias: principal.midias || [],
        pastaMidia: principal.pastaMidia || null,
        previewUrl: principal.previewUrl || '',
        metrics: principal.metrics || {}
    });

    /**
     * A ESCOLHA DO CLIENTE ANDA JUNTO.
     *
     * `approvalVersao` guarda uma posicao ("aprovei a B") e promover troca o conteudo
     * de posicao - a peca que estava na B passa a ser a principal. Sem remapear, a
     * tela continuaria dizendo "aprovado - versao B" apontando para o conteudo que o
     * cliente NAO escolheu, e o aviso de "escolha ainda nao aplicada" apareceria
     * justamente depois de a escolha ter sido aplicada.
     */
    const escolha = event.approvalVersao;
    const novaEscolha =
        escolha === ROTULO_PRINCIPAL ? escolhida.rotulo
        : escolha === escolhida.rotulo ? ROTULO_PRINCIPAL
        : null;

    return semVazios({
        copy: escolhida.copy || '',
        midias: escolhida.midias || [],
        pastaMidia: escolhida.pastaMidia || null,
        previewUrl: escolhida.previewUrl || '',
        metrics: escolhida.metrics || {},
        ...(novaEscolha ? { approvalVersao: novaEscolha } : {}),
        variantes: novas
    });
}

/**
 * Junta as variantes do RASCUNHO com as GRAVADAS, campo por campo.
 *
 * As duas metades tem donos diferentes, de proposito:
 *
 *   texto digitado (copy, previewUrl) -> rascunho, gravado no "Salvar"
 *   estrutura e arquivo (midias, pastaMidia, metrics) -> gravado na hora
 *
 * Sem esta juncao, salvar a legenda de uma variante reescreveria a lista inteira com
 * o array do rascunho - e levaria embora a midia que alguem subiu naquela variante
 * depois de o modal abrir. E o mesmo defeito que apagava responsavel, um nivel mais
 * fundo. Casa por ID, nao por indice: promover ou remover variante muda a ordem.
 */
export function mesclarVariantes(
    gravadas: VarianteConteudo[],
    rascunho: VarianteConteudo[]
): VarianteConteudo[] {
    const porId = new Map(rascunho.map(v => [v.id, v]));
    return gravadas.map(g => {
        const r = porId.get(g.id);
        if (!r) return varianteGravavel(g);
        // `?? ''` e nao `r.copy`: a variante entra num array, e `undefined` dentro de
        // array o Firestore recusa - o `stripUndefined` de quem grava so olha o
        // primeiro nivel e nao alcanca aqui.
        return varianteGravavel({ ...g, rotulo: r.rotulo, copy: r.copy ?? '', previewUrl: r.previewUrl ?? '' });
    });
}

/**
 * Qual versao teve mais interacao.
 *
 * Interacao, e nao alcance: alcance depende de quanto se pagou por cada variante, e
 * comparar alcance premiaria a que recebeu mais verba. Sem numero em nenhuma das
 * versoes, devolve null - e a tela mostra "sem resultado ainda" em vez de eleger uma
 * vencedora no escuro.
 */
export function versaoComMaisInteracao(
    event: CalendarEvent
): { rotulo: string; interacoes: number } | null {
    const todas = [
        { rotulo: 'A', metrics: event.metrics },
        ...(event.variantes || []).map(v => ({ rotulo: v.rotulo, metrics: v.metrics }))
    ];
    const comNumero = todas
        .map(t => ({ rotulo: t.rotulo, interacoes: t.metrics?.interacoes ?? null }))
        .filter((t): t is { rotulo: string; interacoes: number } => t.interacoes !== null);
    if (comNumero.length < 2) return null;
    return comNumero.reduce((melhor, atual) => (atual.interacoes > melhor.interacoes ? atual : melhor));
}
