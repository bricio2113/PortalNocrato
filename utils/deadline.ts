import { CalendarEvent } from '../types';

/**
 * Prazo de PRODUCAO - interno da agencia.
 *
 * Nao confundir com a data de publicacao. A data de publicacao e um
 * compromisso com o cliente e aparece para ele; o prazo de producao e quando a
 * peca precisa estar pronta internamente, e e informacao de operacao.
 *
 * POR QUE ISTO NAO APARECE PARA O CLIENTE:
 * "atrasado 3 dias" e uma metrica de gestao da equipe. Mostrar ao cliente que
 * a agencia esta atrasada na producao de um post que ainda vai sair no prazo
 * cria um problema que nao existe. O que o cliente ve e o estagio
 * (em producao / aguardando voce / aprovado / publicado) e a data de
 * publicacao - nada sobre a cozinha.
 *
 * Quem chama estas funcoes precisa estar dentro de um caminho de agencia.
 */

export type DeadlineTone = 'atrasado' | 'hoje' | 'proximo' | 'tranquilo' | 'concluido';

export interface DeadlineState {
    /** Dias inteiros de diferenca. Negativo = atrasado. */
    dias: number;
    atrasado: boolean;
    /** Texto curto para selo: "2 dias atrasado", "vence hoje", "em 5 dias". */
    label: string;
    tone: DeadlineTone;
}

const TONE_CLASSES: Record<DeadlineTone, string> = {
    atrasado: 'bg-red-500/15 text-red-400 border-red-500/30',
    hoje: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    proximo: 'bg-[#FABE01]/15 text-[#FABE01] border-[#FABE01]/30',
    tranquilo: 'bg-white/5 text-zinc-400 border-white/10',
    concluido: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
};

export const deadlineClasses = (tone: DeadlineTone) => TONE_CLASSES[tone];

/** Meia-noite local, para contar dias inteiros em vez de horas. */
const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Estagios em que o prazo de producao ja nao importa: a peca saiu das maos da
 * equipe. Continuar contando atraso depois de aprovado marcaria de vermelho um
 * trabalho que ficou pronto.
 */
const PRODUCAO_ENCERRADA = ['Postado', 'Cancelado', 'Concluído'];

export function isProducaoEncerrada(event: Pick<CalendarEvent, 'status' | 'approval'>): boolean {
    return PRODUCAO_ENCERRADA.includes(event.status) || event.approval === 'aprovado';
}

/**
 * Situacao do prazo. `null` quando nao ha prazo definido - a ausencia e um
 * estado legitimo, e inventar um prazo padrao encheria o painel de atrasos
 * falsos no dia em que este campo nascer.
 */
export function deadlineState(
    event: Pick<CalendarEvent, 'status' | 'approval' | 'prazoProducao'>,
    agora: Date = new Date()
): DeadlineState | null {
    if (!event.prazoProducao) return null;

    if (isProducaoEncerrada(event)) {
        return { dias: 0, atrasado: false, label: 'produção concluída', tone: 'concluido' };
    }

    const dias = Math.round(
        (inicioDoDia(event.prazoProducao).getTime() - inicioDoDia(agora).getTime()) / 86400000
    );

    if (dias < 0) {
        const n = Math.abs(dias);
        return { dias, atrasado: true, label: `${n} ${n === 1 ? 'dia' : 'dias'} atrasado`, tone: 'atrasado' };
    }
    if (dias === 0) return { dias, atrasado: false, label: 'vence hoje', tone: 'hoje' };
    if (dias <= 2) return { dias, atrasado: false, label: `em ${dias} ${dias === 1 ? 'dia' : 'dias'}`, tone: 'proximo' };
    return { dias, atrasado: false, label: `em ${dias} dias`, tone: 'tranquilo' };
}

export interface DeadlineSummary {
    /** Producao vencida e ainda nas maos da equipe. */
    atrasados: number;
    /** Vence hoje. */
    hoje: number;
    /** Vence em ate 2 dias. */
    proximos: number;
    /** Tem prazo definido e producao em aberto. */
    comPrazo: number;
    /** Producao em aberto SEM prazo - o ponto cego da operacao. */
    semPrazo: number;
}

/**
 * Resumo para o painel. `semPrazo` existe porque um post sem prazo nunca
 * aparece como atrasado: sem este numero a operacao pareceria em dia
 * simplesmente por ninguem ter preenchido o campo.
 */
export function summarizeDeadlines(events: CalendarEvent[], agora: Date = new Date()): DeadlineSummary {
    const resumo: DeadlineSummary = { atrasados: 0, hoje: 0, proximos: 0, comPrazo: 0, semPrazo: 0 };

    for (const event of events) {
        if (isProducaoEncerrada(event)) continue;
        if (!event.prazoProducao) { resumo.semPrazo++; continue; }

        resumo.comPrazo++;
        const estado = deadlineState(event, agora);
        if (!estado) continue;
        if (estado.tone === 'atrasado') resumo.atrasados++;
        else if (estado.tone === 'hoje') resumo.hoje++;
        else if (estado.tone === 'proximo') resumo.proximos++;
    }

    return resumo;
}
