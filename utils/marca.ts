import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db } from './firebase';

/**
 * ESTUDO DE MARCA do cliente - o que direciona a criacao.
 *
 * Vive em `empresas/{id}/marca/estudo`: UM documento, nao uma subcolecao por
 * secao. O estudo e lido inteiro sempre que alguem abre a tela (nao existe "ver so
 * as personas"), entao uma colecao seria varias leituras para montar uma pagina, e
 * uma escrita parcial poderia deixar tom e estrategia de versoes diferentes.
 *
 * TRABALHO CONJUNTO. Cliente e agencia leem E escrevem - e a unica coisa do portal
 * assim. O cliente conhece o publico e a promessa; a agencia sabe traduzir isso em
 * conteudo. Um formulario que so a agencia editasse viraria transcricao de reuniao
 * desatualizada, e um que so o cliente editasse nao seria usado.
 *
 * POR ISSO O DOCUMENTO GUARDA QUEM ALTEROU: com duas mãos escrevendo no mesmo
 * texto, "quem mudou isso e quando" e a diferenca entre colaboracao e confusao.
 */

export interface Persona {
    /** Id local, so para a lista da tela ter chave estavel. */
    id: string;
    nome: string;
    /** Quem e: idade, rotina, contexto. */
    quemE: string;
    /** O que dói. E o que faz a pessoa procurar o cliente. */
    dores: string;
    /** O que ela procura / o resultado que quer. */
    procura: string;
    /** O que a segura na hora de decidir. */
    objecoes: string;
    /** Onde ela está: redes, grupos, indicacao. */
    canais: string;
}

export interface TomDaMarca {
    /** O que a marca e, em uma frase. */
    oQueE: string;
    /** Arquetipo (ver ARQUETIPOS). Vazio = nao definido. */
    arquetipo: string;
    /** Por que este arquetipo - o rotulo sozinho nao orienta ninguem. */
    arquetipoPorque: string;
    tomDeVoz: string;
    personalidade: string;
    /** Como quer ser vista VISUALMENTE. */
    visual: string;
    /** Como quer ser vista TEXTUALMENTE. */
    textual: string;
}

export interface EstrategiaConteudo {
    comoPostar: string;
    promessas: string;
    gatilhos: string;
    palavrasChave: string;
    /** O que NAO fazer. Costuma ser mais acionavel que o resto. */
    evitar: string;
}

export interface EstudoMarca {
    personas: Persona[];
    tom: TomDaMarca;
    estrategia: EstrategiaConteudo;
    atualizadoEm?: Date | null;
    atualizadoPor?: string | null;
}

/**
 * Os 12 arquetipos de marca.
 *
 * Lista fechada de proposito, como os cargos: arquetipo digitado a mao ("moderno",
 * "premium") nao e arquetipo, e a serventia dele e justamente ser um vocabulario
 * que a equipe inteira le do mesmo jeito. A descricao ao lado existe para quem nao
 * decora os doze.
 */
export const ARQUETIPOS: { id: string; descricao: string }[] = [
    { id: 'Inocente', descricao: 'simplicidade, otimismo, pureza' },
    { id: 'Sábio', descricao: 'conhecimento, análise, verdade' },
    { id: 'Explorador', descricao: 'liberdade, descoberta, autenticidade' },
    { id: 'Fora da Lei', descricao: 'ruptura, provocação, mudança' },
    { id: 'Mago', descricao: 'transformação, visão, quase impossível' },
    { id: 'Herói', descricao: 'coragem, disciplina, superação' },
    { id: 'Amante', descricao: 'intimidade, beleza, desejo' },
    { id: 'Bobo da Corte', descricao: 'humor, leveza, presente' },
    { id: 'Pessoa Comum', descricao: 'pertencimento, honestidade, pé no chão' },
    { id: 'Cuidador', descricao: 'proteção, serviço, generosidade' },
    { id: 'Governante', descricao: 'controle, prestígio, ordem' },
    { id: 'Criador', descricao: 'imaginação, expressão, originalidade' }
];

export const ESTUDO_VAZIO: EstudoMarca = {
    personas: [],
    tom: { oQueE: '', arquetipo: '', arquetipoPorque: '', tomDeVoz: '', personalidade: '', visual: '', textual: '' },
    estrategia: { comoPostar: '', promessas: '', gatilhos: '', palavrasChave: '', evitar: '' }
};

export const personaVazia = (): Persona => ({
    // `crypto.randomUUID` nao existe em contexto nao seguro (http em rede local);
    // o par tempo+aleatorio serve para o mesmo fim, que e ter chave de lista.
    id: `p${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
    nome: '', quemE: '', dores: '', procura: '', objecoes: '', canais: ''
});

const ref = (empresaId: string) =>
    db.collection('empresas').doc(empresaId).collection('marca').doc('estudo');

/**
 * Assina o estudo.
 *
 * Assinatura, e nao leitura unica: duas pessoas editam este documento, e quem esta
 * com a tela aberta precisa saber que a versao no servidor mudou - senao o proximo
 * "Salvar" apaga o que a outra escreveu sem ninguem perceber.
 *
 * Documento ausente devolve o estudo VAZIO, nao null: "cliente sem estudo ainda" e
 * o estado inicial de todos, e a tela e a mesma - campos em branco para preencher.
 */
export function subscribeEstudo(
    empresaId: string,
    onData: (estudo: EstudoMarca) => void,
    onError?: () => void
): () => void {
    return ref(empresaId).onSnapshot(
        (doc: firebase.firestore.DocumentSnapshot) => {
            if (!doc.exists) { onData({ ...ESTUDO_VAZIO }); return; }
            const data = doc.data() || {};
            onData({
                personas: Array.isArray(data.personas) ? data.personas as Persona[] : [],
                tom: { ...ESTUDO_VAZIO.tom, ...(data.tom as object || {}) },
                estrategia: { ...ESTUDO_VAZIO.estrategia, ...(data.estrategia as object || {}) },
                atualizadoEm: (data.atualizadoEm as firebase.firestore.Timestamp | undefined)?.toDate() || null,
                atualizadoPor: (data.atualizadoPor as string) || null
            });
        },
        erro => {
            console.error('Erro ao carregar o estudo de marca:', erro);
            onError?.();
        }
    );
}

/** Grava o estudo inteiro. Ver o cabecalho: escrita parcial dessincronizaria as secoes. */
export async function salvarEstudo(
    empresaId: string,
    estudo: EstudoMarca,
    autorEmail?: string | null
): Promise<void> {
    await ref(empresaId).set({
        personas: estudo.personas,
        tom: estudo.tom,
        estrategia: estudo.estrategia,
        atualizadoEm: new Date(),
        atualizadoPor: autorEmail || null
    });
}

/** Quantos campos do estudo estao preenchidos - alimenta o "X% preenchido". */
export function preenchimento(estudo: EstudoMarca): { feitos: number; total: number; pct: number } {
    const campos = [
        ...Object.values(estudo.tom),
        ...Object.values(estudo.estrategia)
    ];
    // A persona conta como UM campo cada, e nao por sub-campo: uma persona bem
    // descrita vale mais que seis campos rasos, e contar por sub-campo faria o
    // percentual despencar so por adicionar persona nova.
    const total = campos.length + Math.max(1, estudo.personas.length);
    const feitos = campos.filter(v => (v || '').trim().length > 0).length
        + estudo.personas.filter(p => p.nome.trim() || p.dores.trim()).length;
    return { feitos, total, pct: Math.round((feitos / total) * 100) };
}
