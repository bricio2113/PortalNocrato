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
        // ACAO, nao estado. "Aguardando você" descreve o sistema esperando; nao
        // diz o que a pessoa tem que fazer, e o cliente lia o selo sem entender
        // que a decisao era dele.
        label: 'Precisa da sua aprovação',
        hint: 'Veja a peça ao lado e aprove, ou peça um ajuste.',
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

/**
 * O MESMO estagio, dito para quem esta lendo.
 *
 * `CLIENT_STAGES` foi escrito na segunda pessoa, para o portal do cliente - e
 * vazou para o painel da agencia, onde "Aguardando você" acusava a propria
 * equipe de estar segurando um post que esta, na verdade, esperando o cliente.
 * O estado e um so; o que muda e de que lado da mesa a frase e lida.
 */
export function stageView(
    stage: ClientStage,
    papel: 'agencia' | 'cliente'
): { label: string; hint: string } {
    const base = CLIENT_STAGES[stage];
    if (papel === 'cliente') return { label: base.label, hint: base.hint };

    switch (stage) {
        case 'aguardando_voce':
            return {
                label: 'Aguardando o cliente',
                hint: 'Entregue. O cliente precisa revisar e decidir.'
            };
        case 'em_producao':
            return { label: 'Em produção', hint: 'Com a equipe. O cliente ainda não vê para aprovar.' };
        case 'aprovado':
            return { label: 'Aprovado pelo cliente', hint: 'Liberado para publicar.' };
        default:
            return { label: base.label, hint: base.hint };
    }
}

/**
 * Palavra curta para o card do calendario, onde nao cabe a frase inteira.
 *
 * Substitui a BOLINHA que existia ali: um circulo de 8px com o estado so no
 * `title` nao comunica nada de relance e nada nenhum no celular, onde nao ha
 * hover. Cor sozinha tambem exige decorar a legenda. Uma palavra resolve as
 * duas coisas, e cabe.
 */
export function stageCurto(
    stage: ClientStage,
    papel: 'agencia' | 'cliente'
): { texto: string; classe: string } | null {
    switch (stage) {
        case 'aguardando_voce':
            return papel === 'cliente'
                // Verbo, nao estado: para o cliente isto e uma tarefa dele.
                ? { texto: 'revisar', classe: 'bg-[#FABE01] text-black font-bold' }
                : { texto: 'c/ cliente', classe: 'bg-[#FABE01]/15 text-[#FABE01]' };
        case 'aprovado':
            return { texto: 'aprovado', classe: 'bg-emerald-500/15 text-emerald-400' };
        case 'publicado':
            return { texto: 'no ar', classe: 'bg-green-600/15 text-green-400' };
        case 'cancelado':
            return { texto: 'cancelado', classe: 'bg-red-500/15 text-red-400' };
        // Em producao nao ganha etiqueta: e o estado padrao da maioria dos posts,
        // e etiquetar todo mundo faz nenhuma etiqueta chamar atencao.
        default:
            return null;
    }
}

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
