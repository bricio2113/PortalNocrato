// Cores por formato de publicacao.
//
// Fonte unica para o calendario e para o quadro de producao. Estava so dentro
// do CalendarView, entao o Kanban nao tinha como pintar os cards com o mesmo
// criterio - o mesmo post aparecia verde na agenda e cinza na producao.
//
// A paleta reaproveita as cores de estado que o projeto ja usa; nada de
// tipografia ou cor nova de marca.

export interface TypeStyle {
    /** Fundo tenue, para preencher blocos. */
    bg: string;
    /** Borda de acento, usada na faixa lateral do card. */
    border: string;
    /** Cor do texto sobre o fundo tenue. */
    text: string;
    /** Combinacao solida para a etiqueta do formato. */
    label: string;
    /** Bolinha compacta, para legendas e filtros. */
    dot: string;
}

const REEL: TypeStyle = {
    bg: 'bg-blue-500/10', border: 'border-blue-500', text: 'text-blue-300',
    label: 'bg-blue-500 text-black', dot: 'bg-blue-500'
};

const POST: TypeStyle = {
    bg: 'bg-emerald-500/10', border: 'border-emerald-500', text: 'text-emerald-300',
    label: 'bg-emerald-500 text-black', dot: 'bg-emerald-500'
};

const STORY: TypeStyle = {
    bg: 'bg-[#FABE01]/10', border: 'border-[#FABE01]', text: 'text-[#FABE01]',
    label: 'bg-[#FABE01] text-black', dot: 'bg-[#FABE01]'
};

const TRAFEGO: TypeStyle = {
    bg: 'bg-red-500/10', border: 'border-red-500', text: 'text-red-300',
    label: 'bg-red-500 text-white', dot: 'bg-red-500'
};

const OUTRO: TypeStyle = {
    bg: 'bg-purple-500/10', border: 'border-purple-500', text: 'text-purple-300',
    label: 'bg-purple-500 text-white', dot: 'bg-purple-500'
};

/**
 * Estilo do formato. Normaliza em caixa alta porque documentos antigos foram
 * gravados como 'POST'/'STORY' pelo union anterior de types.ts.
 */
export function getTypeStyles(type?: string | null): TypeStyle {
    const t = (type || '').toUpperCase();
    if (t.includes('REEL') || t.includes('VÍDEO') || t.includes('VIDEO')) return REEL;
    if (t.includes('POST') || t.includes('CARROSSEL') || t.includes('ESTÁTICO')) return POST;
    if (t.includes('STORY') || t.includes('CRIATIVO')) return STORY;
    if (t.includes('TRÁFEGO') || t.includes('TRAFEGO')) return TRAFEGO;
    return OUTRO;
}

// Cores de coluna do quadro, derivadas do status. Ficavam embutidas na
// definicao das colunas; expostas aqui para o card poder marcar o proprio
// status quando o quadro esta filtrado.
export const STATUS_ACCENTS: Record<string, string> = {
    'Pendente': 'bg-zinc-500',
    'Agendado': 'bg-blue-400',
    'Em andamento': 'bg-amber-500',
    'Editado': 'bg-purple-500',
    'Concluído': 'bg-emerald-500',
    'Postado': 'bg-green-600',
    'Cancelado': 'bg-red-500'
};
