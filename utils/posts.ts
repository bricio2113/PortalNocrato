// Escritas e assinaturas ligadas a uma publicacao: aprovacao, comentarios e
// metricas.
//
// Os comentarios ficam em empresas/{id}/post_comments com um campo eventId, e
// nao em empresas/{id}/events/{eventId}/comments. Motivo: a regra de seguranca
// libera exatamente empresas/{id}/{subcolecao}/{doc} - dois segmentos. Uma
// colecao mais profunda cairia no `match /{document=**} { allow ... if false }`
// e toda leitura seria negada.

import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db } from './firebase';
import { ApprovalState, EventMetrics, PostComment } from '../types';
import { needsClientAction, needsAgencyAction } from './eventState';

const empresaRef = (empresaId: string) => db.collection('empresas').doc(empresaId);

// --- APROVACAO ---

/**
 * Grava a decisao do cliente. `by` fica no documento para o historico: numa
 * discussao sobre "ninguem aprovou isso", quem e quando importam.
 */
export async function setApproval(
    empresaId: string,
    eventId: string,
    state: ApprovalState,
    by: string | null,
    byName?: string | null
): Promise<void> {
    await empresaRef(empresaId).collection('events').doc(eventId).update({
        approval: state,
        approvalBy: by,
        approvalByName: byName || null,
        approvalAt: new Date()
    });
}

// --- METRICAS ---

export async function saveMetrics(
    empresaId: string,
    eventId: string,
    metrics: EventMetrics
): Promise<void> {
    await empresaRef(empresaId).collection('events').doc(eventId).update({
        metrics: { ...metrics, atualizadoEm: new Date() }
    });
}

// --- COMENTARIOS ---

export async function addComment(
    empresaId: string,
    eventId: string,
    authorEmail: string,
    authorRole: 'agencia' | 'cliente',
    text: string,
    authorName?: string | null
): Promise<void> {
    await empresaRef(empresaId).collection('post_comments').add({
        eventId,
        authorEmail,
        // Copiado no ato: o cliente nao tem permissao de ler usuarios/{uid} da
        // agencia, entao sem isto a conversa mostraria e-mail cru para ele.
        authorName: authorName || null,
        authorRole,
        text: text.trim(),
        createdAt: new Date()
    });
}

export async function deleteComment(empresaId: string, commentId: string): Promise<void> {
    await empresaRef(empresaId).collection('post_comments').doc(commentId).delete();
}

/**
 * Assina os comentarios de uma publicacao.
 *
 * A ordenacao acontece no cliente de proposito: um orderBy combinado com o
 * where('eventId') exigiria indice composto no Firestore, e o app quebraria em
 * producao com "The query requires an index" ate alguem criar na mao.
 */
export function subscribeComments(
    empresaId: string,
    eventId: string,
    onData: (comments: PostComment[]) => void,
    onError?: (error: Error) => void
): () => void {
    return empresaRef(empresaId).collection('post_comments')
        .where('eventId', '==', eventId)
        .onSnapshot(
            snapshot => {
                const comments = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        eventId: data.eventId,
                        authorEmail: data.authorEmail || 'desconhecido',
                        authorName: data.authorName || null,
                        authorRole: data.authorRole === 'agencia' ? 'agencia' : 'cliente',
                        text: data.text || '',
                        createdAt: (data.createdAt as firebase.firestore.Timestamp | undefined)?.toDate() || new Date()
                    } as PostComment;
                });
                comments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
                onData(comments);
            },
            error => {
                console.error('Erro ao assinar comentários:', error);
                onError?.(error);
            }
        );
}

// --- CONTADORES DE PENDENCIA (notificacao in-app) ---

export interface PendingCounts {
    /** Posts esperando decisao do cliente. */
    aguardandoCliente: number;
    /** Posts em que o cliente pediu ajuste e a agencia ainda nao resolveu. */
    aguardandoAgencia: number;
    /** Total de publicacoes da empresa. */
    total: number;
    /** Publicacoes no mes corrente. */
    noMes: number;
    publicados: number;
    /** Sem capa manual nem resolvida: a previa do feed fica vazia. */
    semCapa: number;
}

/**
 * Assina os contadores de pendencia de uma empresa.
 *
 * Le a colecao inteira de events porque a decisao de "esta pendente" combina
 * status e approval, e o Firestore nao consulta logica composta assim sem
 * indice dedicado. Para o volume de um portal de agencia (dezenas de posts por
 * empresa) sai mais barato do que manter contadores denormalizados em sincronia.
 */
export function subscribePendingCounts(
    empresaId: string,
    onData: (counts: PendingCounts) => void
): () => void {
    return empresaRef(empresaId).collection('events').onSnapshot(
        snapshot => {
            const agora = new Date();
            let aguardandoCliente = 0;
            let aguardandoAgencia = 0;
            let noMes = 0;
            let publicados = 0;
            let semCapa = 0;

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const event = { status: data.status, approval: data.approval };
                if (needsClientAction(event)) aguardandoCliente++;
                if (needsAgencyAction(event)) aguardandoAgencia++;
                if (data.status === 'Postado') publicados++;
                if (!data.previewUrl && !data.coverUrl) semCapa++;

                const date = (data.date as firebase.firestore.Timestamp | undefined)?.toDate();
                if (date && date.getMonth() === agora.getMonth() && date.getFullYear() === agora.getFullYear()) {
                    noMes++;
                }
            });

            onData({
                aguardandoCliente, aguardandoAgencia,
                total: snapshot.size, noMes, publicados, semCapa
            });
        },
        error => console.error('Erro ao contar pendências:', error)
    );
}

/** Quantos comentarios existem por eventId, para o selo no card. */
export function subscribeCommentCounts(
    empresaId: string,
    onData: (counts: Record<string, number>) => void
): () => void {
    return empresaRef(empresaId).collection('post_comments').onSnapshot(
        snapshot => {
            const counts: Record<string, number> = {};
            snapshot.docs.forEach(doc => {
                const eventId = doc.data().eventId;
                if (eventId) counts[eventId] = (counts[eventId] || 0) + 1;
            });
            onData(counts);
        },
        error => console.error('Erro ao contar comentários:', error)
    );
}
