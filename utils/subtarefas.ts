import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db } from './firebase';

/**
 * SUBTAREFAS de um conteudo - as etapas de producao de UM post.
 *
 * POR QUE ELAS EXISTEM: o quadro de produção acompanha CONTEÚDOS, e um conteúdo
 * nao e uma tarefa - e um pacote delas. "Carrossel institucional" passa por
 * roteiro, design, revisao e agendamento, e cada etapa tem um responsavel
 * diferente. Antes a unica forma de registrar isso era criar um card solto no
 * quadro, que nascia sem post na agenda e virava lixo: card que ninguem sabia de
 * onde veio e que nao movia nada.
 *
 * A SUBTAREFA NAO MEXE NO STATUS DO POST. O status do conteudo continua sendo o
 * do calendario (Pendente, Em andamento, Concluido...), decidido por quem move o
 * card. Subtarefa concluida e progresso interno, nao promocao automatica: um post
 * com design pronto e revisao pendente nao esta "Concluido", e deixar o sistema
 * decidir isso sozinho produziria status errado na frente do cliente.
 *
 * COLECAO PLANA, com eventId como campo, em vez de subcolecao dentro do evento.
 * O quadro precisa do progresso de TODOS os cards ao mesmo tempo ("3 de 5"); com
 * subcolecao isso seria uma assinatura por card na tela.
 */

export type SubtarefaStatus = 'aberta' | 'fazendo' | 'feita';

export interface Subtarefa {
    id: string;
    /** Conteudo a que pertence. Subtarefa nunca existe solta. */
    eventId: string;
    titulo: string;
    status: SubtarefaStatus;
    /** Uid do responsavel. Null = ninguem pegou ainda. */
    responsavelUid?: string | null;
    criadoEm: Date;
    criadoPor?: string | null;
}

export const SUBTAREFA_STATUS: { id: SubtarefaStatus; label: string; cor: string; ponto: string }[] = [
    { id: 'aberta', label: 'A fazer', cor: 'text-zinc-400 bg-white/5 border-white/10', ponto: 'bg-zinc-500' },
    { id: 'fazendo', label: 'Fazendo', cor: 'text-[#FABE01] bg-[#FABE01]/10 border-[#FABE01]/25', ponto: 'bg-[#FABE01]' },
    { id: 'feita', label: 'Feita', cor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', ponto: 'bg-emerald-500' }
];

export const subtarefaStatusInfo = (status: SubtarefaStatus) =>
    SUBTAREFA_STATUS.find(s => s.id === status) || SUBTAREFA_STATUS[0];

/** Proximo status no ciclo. Um clique avanca a etapa, sem abrir menu. */
export const proximoStatus = (status: SubtarefaStatus): SubtarefaStatus =>
    status === 'aberta' ? 'fazendo' : status === 'fazendo' ? 'feita' : 'aberta';

const ref = (empresaId: string) =>
    db.collection('empresas').doc(empresaId).collection('subtarefas');

const parse = (doc: firebase.firestore.QueryDocumentSnapshot): Subtarefa => {
    const data = doc.data();
    return {
        ...data,
        id: doc.id,
        criadoEm: (data.criadoEm as firebase.firestore.Timestamp | undefined)?.toDate() || new Date()
    } as Subtarefa;
};

/**
 * Assina TODAS as subtarefas do cliente.
 *
 * Sem orderBy: ordenar no servidor por `criadoEm` obrigaria indice quando
 * combinado com filtro por eventId, e o volume aqui e de dezenas por cliente.
 */
export function subscribeSubtarefas(
    empresaId: string,
    onData: (subtarefas: Subtarefa[]) => void,
    onError?: () => void
): () => void {
    return ref(empresaId).onSnapshot(
        snapshot => onData(
            snapshot.docs.map(parse).sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime())
        ),
        erro => {
            console.error('Erro ao carregar subtarefas:', erro);
            onError?.();
        }
    );
}

export async function criarSubtarefa(
    empresaId: string,
    eventId: string,
    titulo: string,
    criadoPor?: string | null,
    responsavelUid?: string | null
): Promise<void> {
    await ref(empresaId).add({
        eventId,
        titulo: titulo.trim(),
        status: 'aberta' as SubtarefaStatus,
        responsavelUid: responsavelUid || null,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        criadoPor: criadoPor || null
    });
}

export async function atualizarSubtarefa(
    empresaId: string,
    id: string,
    patch: Partial<Pick<Subtarefa, 'titulo' | 'status' | 'responsavelUid'>>
): Promise<void> {
    await ref(empresaId).doc(id).update(patch);
}

export async function removerSubtarefa(empresaId: string, id: string): Promise<void> {
    await ref(empresaId).doc(id).delete();
}

/** Progresso de um conteudo: quantas etapas fechadas de quantas. */
export function progresso(subtarefas: Subtarefa[]): { feitas: number; total: number; pct: number } {
    const total = subtarefas.length;
    const feitas = subtarefas.filter(s => s.status === 'feita').length;
    return { feitas, total, pct: total === 0 ? 0 : Math.round((feitas / total) * 100) };
}
