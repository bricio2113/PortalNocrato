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
import { needsClientAction, needsAgencyAction, getClientStage, ClientStage } from './eventState';
import { registrar } from './historico';
import { slaAtual } from './sla';

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

    // Historico DEPOIS da escrita principal, e sem await bloqueante: registrar()
    // nunca lanca, e a aprovacao nao pode falhar por causa de um registro de
    // auditoria. A regra exige que `por` seja o e-mail de quem escreve, entao
    // sem `by` nao ha o que registrar.
    if (by) {
        void registrar(empresaId, {
            eventId, tipo: 'aprovacao', para: state,
            por: by, porNome: byName || null,
            // Quem chama setApproval na interface e sempre o cliente - a agencia
            // ve o estado e nao vota (ver EventDetailModal).
            porPapel: 'cliente'
        });
    }
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
    /**
     * SLA estourado com a bola na AGENCIA - producao vencida ou ajuste passado
     * de 2 dias uteis. INTERNO: nao exibir no portal do cliente (ver utils/sla).
     */
    atrasados: number;
    /** SLA estourado com a bola no CLIENTE: janela de revisao fechou sem decisao. */
    atrasadosCliente: number;
    /**
     * Atraso ANTIGO - passou de 30 dias da data de publicacao.
     *
     * Separado de `atrasados` porque nao e a mesma coisa. Desde que o prazo
     * passou a ser a data de publicacao, todo post de meses atras que ninguem
     * marcou como Postado ou Cancelado conta como atrasado - e tecnicamente e,
     * mas nao e trabalho de hoje: e cadastro para limpar. Somar os dois num
     * numero so produzia "306 atrasados" no painel, que nao informa nada e
     * dessensibiliza para o atraso que importa.
     */
    atrasadosAntigos: number;
    /** Quantos conteudos em cada estagio visivel ao cliente. */
    porEstagio: Record<ClientStage, number>;
    /**
     * Proximas entregas, ordenadas. Ate tres por cliente - o painel junta os de
     * todos e corta na tela; guardar mais aqui nao servia para nada.
     */
    proximas: { id: string; title: string; date: Date; type?: string }[];
}

/**
 * Zero de tudo.
 *
 * Existe para quem precisa de um estado inicial nao-nulo nao ter que enumerar os
 * campos na mao - foi o que quebrou ao acrescentar contadores novos: cada lugar
 * que montava o objeto literal virou um erro de compilacao, e um deles poderia
 * ter passado com um campo faltando.
 */
export const CONTAGEM_VAZIA: PendingCounts = {
    aguardandoCliente: 0, aguardandoAgencia: 0, total: 0, noMes: 0, publicados: 0,
    semCapa: 0, atrasados: 0, atrasadosCliente: 0, atrasadosAntigos: 0,
    porEstagio: { em_producao: 0, aguardando_voce: 0, aprovado: 0, publicado: 0, cancelado: 0 },
    proximas: []
};

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
            let atrasados = 0;
            let atrasadosCliente = 0;
            let atrasadosAntigos = 0;
            const porEstagio: Record<ClientStage, number> = {
                em_producao: 0, aguardando_voce: 0, aprovado: 0, publicado: 0, cancelado: 0
            };
            const futuras: { id: string; title: string; date: Date; type?: string }[] = [];
            const LIMITE_ANTIGO = 30 * 86400000;

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const event = { status: data.status, approval: data.approval };
                if (needsClientAction(event)) aguardandoCliente++;
                if (needsAgencyAction(event)) aguardandoAgencia++;
                porEstagio[getClientStage(event)]++;
                if (data.status === 'Postado') publicados++;
                if (!data.previewUrl && !data.coverUrl) semCapa++;

                const date = (data.date as firebase.firestore.Timestamp | undefined)?.toDate();
                if (date && date.getMonth() === agora.getMonth() && date.getFullYear() === agora.getFullYear()) {
                    noMes++;
                }

                // SLA. Contado aqui, e nao numa segunda leitura, porque a
                // colecao ja esta na mao. O relogio que vale depende do estagio:
                // ajuste vence producao, e producao para quando o post esta com
                // o cliente - ver utils/sla.ts.
                const sla = slaAtual({
                    status: data.status,
                    approval: data.approval,
                    approvalAt: (data.approvalAt as firebase.firestore.Timestamp | undefined)?.toDate() || null,
                    date: date || new Date(),
                    type: data.type
                }, agora);
                if (sla) {
                    if (sla.estourado) {
                        const antigo = sla.limite ? agora.getTime() - sla.limite.getTime() > LIMITE_ANTIGO : false;
                        if (antigo) atrasadosAntigos++;
                        else if (sla.dono === 'agencia') atrasados++;
                        else atrasadosCliente++;
                    }
                }

                // Proxima entrega: o que ainda vai sair, e nao foi cancelado.
                if (date && date >= agora && data.status !== 'Cancelado' && data.status !== 'Postado') {
                    futuras.push({ id: doc.id, title: data.title || '(sem título)', date, type: data.type });
                }
            });

            futuras.sort((a, b) => a.date.getTime() - b.date.getTime());

            onData({
                aguardandoCliente, aguardandoAgencia,
                total: snapshot.size, noMes, publicados, semCapa,
                atrasados, atrasadosCliente, atrasadosAntigos,
                porEstagio, proximas: futuras.slice(0, 3)
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
