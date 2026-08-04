import { CalendarEvent } from '../types';
import { getClientStage, getApproval } from './eventState';

/**
 * SLAs do fluxo de conteudo.
 *
 * Um post tem SEMPRE UM relogio rodando, e o dono dele muda de lado conforme o
 * estagio. Esta e a ideia central do arquivo: em vez de tres selos competindo
 * na tela, `slaAtual()` devolve o unico prazo que vale agora e de quem e a bola.
 *
 * Precedencia (a primeira que casar ganha):
 *
 *   1. encerrado    - publicado, cancelado ou aprovado: nao ha prazo.
 *   2. ajuste       - o cliente pediu mudanca. A agencia tem SLA.ajusteAgencia
 *                     dias uteis contados da hora do pedido.
 *   3. aprovacao    - material pronto, esperando o cliente. O prazo dele e a
 *                     janela de revisao (ver abaixo), nao um numero solto.
 *   4. producao     - ainda em producao. Vale a DATA DE PUBLICACAO: se a peca
 *                     nao esta pronta no dia de publicar, esta atrasada.
 *
 * O ITEM 4 SO CONTA EM PRODUCAO. Antes o atraso continuava correndo enquanto o
 * post estava com o cliente esperando aprovacao - a tela acusava a agencia de
 * "5 dias atrasado" por uma demora que nao era dela. Prazo tem dono.
 *
 * DIAS UTEIS x DIAS CORRIDOS:
 * o SLA da agencia conta em dias UTEIS - dar 2 dias para um ajuste pedido na
 * sexta a noite e dar zero. A janela do cliente conta em dias CORRIDOS, porque
 * ela e ancorada na data de publicacao, e o feed nao tira fim de semana.
 */

export const SLA = {
    /** Dias uteis que a agencia tem para resolver um ajuste pedido pelo cliente. */
    ajusteAgencia: 2,
    /** Dias corridos antes da publicacao ate quando o cliente pode pedir ajuste. */
    janelaRevisaoImagem: 1,
    /** Video exige mais: reeditar e renderizar nao cabe em um dia. */
    janelaRevisaoVideo: 2
} as const;

const DIA_MS = 86400000;
const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diasEntre = (de: Date, ate: Date) =>
    Math.round((inicioDoDia(ate).getTime() - inicioDoDia(de).getTime()) / DIA_MS);

/** Sabado e domingo. Feriado nao entra: exigiria calendario nacional mantido a mao. */
const ehFimDeSemana = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/** Soma dias uteis, pulando fim de semana. */
export function somarDiasUteis(inicio: Date, dias: number): Date {
    const out = new Date(inicio);
    let restantes = dias;
    while (restantes > 0) {
        out.setDate(out.getDate() + 1);
        if (!ehFimDeSemana(out)) restantes--;
    }
    return out;
}

/** Video/Reel precisa de janela maior que imagem. */
export function ehVideo(type?: string | null): boolean {
    const t = (type || '').toUpperCase();
    return t.includes('REEL') || t.includes('VÍDEO') || t.includes('VIDEO');
}

// --- JANELA DE REVISAO DO CLIENTE ----------------------------------------

export interface JanelaRevisao {
    /** Ultimo instante em que o cliente ainda pode pedir ajuste. */
    limite: Date;
    aberta: boolean;
    /** Dias corridos restantes. Negativo quando ja fechou. */
    dias: number;
    /** Dias de antecedencia exigidos por este formato. */
    antecedencia: number;
}

/**
 * Ate quando o cliente pode pedir ajuste.
 *
 * Derivada da data de publicacao e do formato - nao e um campo gravado. Um
 * campo teria que ser recalculado a cada vez que a data ou o formato do post
 * mudasse, e um esquecimento ali produziria uma janela mentindo na tela.
 */
export function janelaRevisao(
    event: Pick<CalendarEvent, 'date' | 'type'>,
    agora: Date = new Date()
): JanelaRevisao {
    const antecedencia = ehVideo(event.type) ? SLA.janelaRevisaoVideo : SLA.janelaRevisaoImagem;
    const limite = new Date(inicioDoDia(event.date).getTime() - antecedencia * DIA_MS);
    const dias = diasEntre(agora, limite);
    return { limite, aberta: dias >= 0, dias, antecedencia };
}

// --- SLA CORRENTE ---------------------------------------------------------

export type SlaTipo = 'producao' | 'ajuste' | 'aprovacao';
export type SlaDono = 'agencia' | 'cliente';
/**
 * `sem_prazo` sumiu junto com o campo prazoProducao: TODO post em producao tem
 * prazo agora, porque o prazo e a data de publicacao e ela e obrigatoria.
 */
export type SlaTone = 'atrasado' | 'hoje' | 'proximo' | 'tranquilo';

export interface SlaState {
    tipo: SlaTipo;
    dono: SlaDono;
    /** Sempre presente hoje; o tipo aceita null por compatibilidade. */
    limite: Date | null;
    /** Dias restantes. Negativo = estourado. Zero quando nao ha limite. */
    dias: number;
    estourado: boolean;
    label: string;
    tone: SlaTone;
}

const TONE_CLASSES: Record<SlaTone, string> = {
    atrasado: 'bg-red-500/15 text-red-400 border-red-500/30',
    hoje: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    proximo: 'bg-[#FABE01]/15 text-[#FABE01] border-[#FABE01]/30',
    tranquilo: 'bg-white/5 text-zinc-400 border-white/10'
};

export const slaClasses = (tone: SlaTone) => TONE_CLASSES[tone];

const TIPO_LABEL: Record<SlaTipo, string> = {
    producao: 'produção',
    ajuste: 'ajuste',
    aprovacao: 'aprovação'
};

export const slaTipoLabel = (tipo: SlaTipo) => TIPO_LABEL[tipo];

/** Traduz dias restantes em tom e texto. */
function descrever(dias: number): { label: string; tone: SlaTone } {
    if (dias < 0) {
        const n = Math.abs(dias);
        return { label: `${n} ${n === 1 ? 'dia' : 'dias'} atrasado`, tone: 'atrasado' };
    }
    if (dias === 0) return { label: 'vence hoje', tone: 'hoje' };
    if (dias <= 2) return { label: `em ${dias} ${dias === 1 ? 'dia' : 'dias'}`, tone: 'proximo' };
    return { label: `em ${dias} dias`, tone: 'tranquilo' };
}

/** O post saiu do fluxo: nao ha mais prazo de ninguem. */
export function slaEncerrado(event: Pick<CalendarEvent, 'status' | 'approval'>): boolean {
    const estagio = getClientStage(event);
    return estagio === 'publicado' || estagio === 'cancelado' || estagio === 'aprovado';
}

/**
 * O unico prazo que vale agora. `null` quando o post saiu do fluxo.
 */
export function slaAtual(
    event: Pick<CalendarEvent, 'status' | 'approval' | 'approvalAt' | 'date' | 'type'>,
    agora: Date = new Date()
): SlaState | null {
    if (slaEncerrado(event)) return null;

    // 2. AJUSTE PEDIDO - vence o prazo de producao de proposito: quando o
    // cliente pede mudanca, o relogio que importa e o do ajuste, nao o prazo
    // original que provavelmente ja passou.
    if (getApproval(event) === 'ajuste_solicitado') {
        // Sem approvalAt (posts anteriores ao campo) nao ha de quando contar;
        // tratamos como pedido hoje em vez de inventar atraso retroativo.
        const desde = event.approvalAt || agora;
        const limite = somarDiasUteis(desde, SLA.ajusteAgencia);
        const dias = diasEntre(agora, limite);
        const { label, tone } = descrever(dias);
        return { tipo: 'ajuste', dono: 'agencia', limite, dias, estourado: dias < 0, label, tone };
    }

    // 3. ESPERANDO O CLIENTE - o prazo dele e a janela de revisao.
    if (getClientStage(event) === 'aguardando_voce') {
        const janela = janelaRevisao(event, agora);
        const { label, tone } = descrever(janela.dias);
        return {
            tipo: 'aprovacao', dono: 'cliente', limite: janela.limite,
            dias: janela.dias, estourado: janela.dias < 0, label, tone
        };
    }

    // 4. EM PRODUCAO. O PRAZO E A DATA DE PUBLICACAO.
    //
    // Antes existia um campo separado, `prazoProducao`, digitado a mao em cada
    // post. Duas consequencias ruins: quem esquecia de preencher ganhava um post
    // que NUNCA aparecia como atrasado - o "ponto cego" que a visao geral tinha
    // que contar num tile proprio -, e quem preenchia mantinha duas datas para a
    // mesma peca, livres para divergir. A data combinada com o cliente ja e o
    // prazo: se o conteudo nao esta pronto no dia de publicar, esta atrasado.
    const dias = diasEntre(agora, event.date);
    const { label, tone } = descrever(dias);
    return {
        tipo: 'producao', dono: 'agencia', limite: event.date, dias, estourado: dias < 0,
        // Atraso de producao ganha frase propria: "3 dias atrasado" nao dizia
        // atrasado em QUE, e no quadro convivia com o atraso de ajuste e o do
        // cliente, que sao outra coisa.
        label: dias < 0 ? `${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'} atrasado para a publicação` : label,
        tone
    };
}

// --- RESUMO PARA O PAINEL -----------------------------------------------

export interface SlaSummary {
    /** Estourado e a bola e da AGENCIA: producao ou ajuste. Fila de trabalho. */
    atrasadoAgencia: number;
    /** Estourado e a bola e do CLIENTE: janela de revisao fechada sem decisao. */
    atrasadoCliente: number;
    /** Vence hoje ou em ate 2 dias, de qualquer dono. */
    proximos: number;
    /** Ajustes pedidos e ainda em aberto. */
    ajustesAbertos: number;
}

export function summarizeSla(events: CalendarEvent[], agora: Date = new Date()): SlaSummary {
    const r: SlaSummary = {
        atrasadoAgencia: 0, atrasadoCliente: 0, proximos: 0, ajustesAbertos: 0
    };

    for (const event of events) {
        const sla = slaAtual(event, agora);
        if (!sla) continue;

        if (sla.tipo === 'ajuste') r.ajustesAbertos++;

        if (sla.estourado) {
            if (sla.dono === 'agencia') r.atrasadoAgencia++;
            else r.atrasadoCliente++;
        } else if (sla.tone === 'hoje' || sla.tone === 'proximo') {
            r.proximos++;
        }
    }

    return r;
}
