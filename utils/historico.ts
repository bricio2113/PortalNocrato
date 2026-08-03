import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db } from './firebase';
import { CalendarEvent } from '../types';

/**
 * Historico de uma publicacao - o "andamento".
 *
 * O portal mostrava um ESTADO: um selo dizendo "aguardando você". Estado sem
 * passado nao responde a pergunta que faz o cliente abrir o portal - "e o meu
 * post?". Ele quer ver que saiu de producao terca, foi para aprovacao quarta, e
 * que o ajuste que ele pediu foi atendido na quinta.
 *
 * SO ESCRITA, NUNCA EDICAO. Nao existe allow update nas regras: a serventia de
 * um historico e ser prova, e prova que se edita nao serve. Um registro errado
 * se corrige com um registro novo.
 *
 * O NOME DO AUTOR E COPIADO para dentro do registro (`porNome`), em vez de ser
 * resolvido na leitura. Motivo: as regras nao deixam o cliente ler os documentos
 * de usuarios/ da agencia, entao "quem fez" apareceria como e-mail cru - ou
 * vazio - no portal dele. Mesma razao do authorName em post_comments.
 */

export type HistoricoTipo =
    | 'criado'
    | 'status'
    | 'data'
    | 'aprovacao'
    | 'midia'
    | 'prazo';

export interface HistoricoEntrada {
    id: string;
    eventId: string;
    tipo: HistoricoTipo;
    /** Valor anterior, quando faz sentido. */
    de?: string | null;
    /** Valor novo. */
    para?: string | null;
    por: string;
    porNome?: string | null;
    /** 'agencia' | 'cliente' - o portal precisa distinguir de que lado veio. */
    porPapel: 'agencia' | 'cliente';
    em: Date;
}

const ref = (empresaId: string) =>
    db.collection('empresas').doc(empresaId).collection('historico');

/**
 * Grava uma entrada.
 *
 * NUNCA lanca. Historico e informacao acessoria: se ele falhar, a acao principal
 * - salvar o post, aprovar - nao pode falhar junto. Um `await` que rejeita aqui
 * derrubaria o salvamento inteiro por causa de um registro de auditoria.
 */
export async function registrar(
    empresaId: string,
    entrada: Omit<HistoricoEntrada, 'id' | 'em'>
): Promise<void> {
    try {
        await ref(empresaId).add({ ...entrada, em: new Date() });
    } catch (erro) {
        console.error('Falha ao registrar histórico:', erro);
    }
}

/**
 * Compara o post antes e depois e grava o que mudou.
 *
 * Uma entrada por CAMPO, nao uma entrada "editado": "editado por Maria" nao diz
 * nada a quem le. O cliente quer saber que a DATA mudou, e de quando para
 * quando.
 *
 * `prazoProducao` e registrado tambem, mas o portal do cliente nao mostra esse
 * tipo - ver o filtro em subscribeHistorico.
 */
export async function registrarMudancas(
    empresaId: string,
    antes: CalendarEvent | null,
    depois: CalendarEvent,
    por: string,
    porNome: string | null,
    porPapel: 'agencia' | 'cliente'
): Promise<void> {
    const base = { eventId: depois.id, por, porNome, porPapel };

    if (!antes) {
        await registrar(empresaId, { ...base, tipo: 'criado', para: depois.title || null });
        return;
    }

    if (antes.status !== depois.status) {
        await registrar(empresaId, { ...base, tipo: 'status', de: antes.status, para: depois.status });
    }

    // Compara o instante inteiro, nao so o dia: mudar de 09h para 18h no mesmo
    // dia e uma mudanca que o cliente precisa ver.
    if (antes.date.getTime() !== depois.date.getTime()) {
        await registrar(empresaId, {
            ...base, tipo: 'data',
            de: antes.date.toISOString(),
            para: depois.date.toISOString()
        });
    }

    const prazoAntes = antes.prazoProducao?.getTime() || null;
    const prazoDepois = depois.prazoProducao?.getTime() || null;
    if (prazoAntes !== prazoDepois) {
        await registrar(empresaId, {
            ...base, tipo: 'prazo',
            de: antes.prazoProducao?.toISOString() || null,
            para: depois.prazoProducao?.toISOString() || null
        });
    }

    const midiasAntes = antes.midias?.length || 0;
    const midiasDepois = depois.midias?.length || 0;
    if (midiasAntes !== midiasDepois) {
        await registrar(empresaId, {
            ...base, tipo: 'midia',
            de: String(midiasAntes), para: String(midiasDepois)
        });
    }
}

/** Tipos que o CLIENTE nao ve: prazo de producao e assunto interno. */
const OCULTOS_DO_CLIENTE: HistoricoTipo[] = ['prazo'];

/**
 * Assina o historico de UM post.
 *
 * `papel` filtra na leitura, nao nas regras: o prazo de producao nao e segredo
 * de seguranca - e ruido para o cliente. Segredo de verdade nao entra nesta
 * colecao (vai para _financeiro).
 */
export function subscribeHistorico(
    empresaId: string,
    eventId: string,
    papel: 'agencia' | 'cliente',
    onData: (entradas: HistoricoEntrada[]) => void,
    onError?: () => void
): () => void {
    return ref(empresaId)
        .where('eventId', '==', eventId)
        .onSnapshot(
            snapshot => {
                const entradas = snapshot.docs
                    .map(doc => {
                        const data = doc.data();
                        return {
                            ...data,
                            id: doc.id,
                            em: (data.em as firebase.firestore.Timestamp | undefined)?.toDate() || new Date()
                        } as HistoricoEntrada;
                    })
                    .filter(e => papel === 'agencia' || !OCULTOS_DO_CLIENTE.includes(e.tipo))
                    // Ordenado no cliente, e nao com orderBy: um where + orderBy
                    // em campos diferentes exige indice composto no Firestore, e
                    // sem ele a consulta falha em producao. Sao poucas entradas
                    // por post.
                    .sort((a, b) => a.em.getTime() - b.em.getTime());
                onData(entradas);
            },
            erro => {
                console.error('Erro ao carregar histórico:', erro);
                onError?.();
            }
        );
}
