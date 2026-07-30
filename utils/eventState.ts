// Traducao entre o vocabulario interno da agencia e o que o cliente precisa
// saber.
//
// A agencia trabalha com sete status (Pendente, Agendado, Em andamento,
// Editado, Concluido, Postado, Cancelado). Para quem contrata a agencia, quase
// todos significam a mesma coisa: "ainda nao e comigo". O cliente decide entre
// tres estados - preciso olhar, ja aprovei, ja foi publicado.

import { ApprovalState, CalendarEvent, EventStatus } from '../types';

export type ClientStage = 'em_producao' | 'aguardando_voce' | 'aprovado' | 'publicado' | 'cancelado';

export interface StageStyle {
    label: string;
    /** Frase curta explicando o que se espera do cliente. */
    hint: string;
    bg: string;
    text: string;
    border: string;
    dot: string;
}

export const CLIENT_STAGES: Record<ClientStage, StageStyle> = {
    em_producao: {
        label: 'Em produção',
        hint: 'A equipe está preparando este conteúdo.',
        bg: 'bg-white/5', text: 'text-zinc-400', border: 'border-white/10', dot: 'bg-zinc-500'
    },
    aguardando_voce: {
        label: 'Aguardando você',
        hint: 'Revise e aprove, ou peça um ajuste.',
        bg: 'bg-[#FABE01]/10', text: 'text-[#FABE01]', border: 'border-[#FABE01]/30', dot: 'bg-[#FABE01]'
    },
    aprovado: {
        label: 'Aprovado',
        hint: 'Liberado para publicação.',
        bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500'
    },
    publicado: {
        label: 'Publicado',
        hint: 'No ar.',
        bg: 'bg-green-600/10', text: 'text-green-400', border: 'border-green-600/30', dot: 'bg-green-600'
    },
    cancelado: {
        label: 'Cancelado',
        hint: 'Este conteúdo não será publicado.',
        bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-500'
    }
};

/** Aprovacao ausente conta como 'aguardando' - posts anteriores a este campo. */
export function getApproval(event: Pick<CalendarEvent, 'approval'>): ApprovalState {
    return event.approval || 'aguardando';
}

/**
 * Estagio visivel ao cliente, combinando status de producao e aprovacao.
 *
 * Regra: publicado e cancelado vencem tudo (sao fatos). Depois, so pedimos
 * atencao do cliente quando a agencia declarou o material pronto - cobrar
 * aprovacao de algo em producao seria pedir opiniao sobre rascunho.
 */
export function getClientStage(event: Pick<CalendarEvent, 'status' | 'approval'>): ClientStage {
    if (event.status === 'Postado') return 'publicado';
    if (event.status === 'Cancelado') return 'cancelado';

    const approval = getApproval(event);
    if (approval === 'aprovado') return 'aprovado';

    const readyForReview: EventStatus[] = ['Concluído', 'Editado', 'Agendado'];
    if (readyForReview.includes(event.status)) return 'aguardando_voce';

    // 'ajuste_solicitado' com o post de volta em producao: a bola esta com a
    // agencia, nao com o cliente.
    return 'em_producao';
}

/** Posts que dependem de uma acao do cliente agora. Alimenta os contadores. */
export function needsClientAction(event: Pick<CalendarEvent, 'status' | 'approval'>): boolean {
    return getClientStage(event) === 'aguardando_voce';
}

/** Posts em que o cliente pediu ajuste e a agencia ainda nao resolveu. */
export function needsAgencyAction(event: Pick<CalendarEvent, 'status' | 'approval'>): boolean {
    if (event.status === 'Postado' || event.status === 'Cancelado') return false;
    return getApproval(event) === 'ajuste_solicitado';
}
