import React from 'react';

/**
 * Primitivas visuais do portal.
 *
 * Existem porque o mesmo padrao estava reescrito a mao em cada tela: o card de
 * numero aparecia em tres versoes diferentes (painel, espaco do cliente e
 * relatorios), cada uma com um padding e um peso de fonte proprio. Centralizar
 * aqui e o que permite trocar a linguagem de forma da aplicacao inteira sem
 * cacar classe por classe.
 *
 * Nada aqui inventa cor ou fonte: usa o dourado #FABE01, os cinzas zinc e a
 * Inter que o projeto ja tinha. O que muda e o RAIO, o espaco e a hierarquia.
 */

// --- CABECALHO DE PAGINA ---------------------------------------------------

/**
 * Saudacao pelo horario, como nos paineis modernos.
 *
 * "Bom dia, Pedro" em vez de "Painel Administrativo" custa nada e faz a tela
 * abrir falando com quem chegou, em vez de se anunciar.
 */
export const greeting = (name?: string | null): string => {
    const h = new Date().getHours();
    const periodo = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const primeiro = (name || '').trim().split(/\s+/)[0];
    return primeiro ? `${periodo}, ${primeiro}` : periodo;
};

export const PageHeader: React.FC<{
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    /** Botoes e filtros alinhados a direita no desktop, embaixo no mobile. */
    actions?: React.ReactNode;
}> = ({ title, subtitle, actions }) => (
    <header className="mb-6 sm:mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight truncate">{title}</h1>
            {subtitle && <p className="text-zinc-500 text-sm mt-1.5 leading-relaxed">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
);

// --- CONTROLE SEGMENTADO ---------------------------------------------------

export interface SegmentOption<T extends string> {
    id: T;
    label: string;
    /** Rotulo curto para telas estreitas. Sem ele usa o `label`. */
    short?: string;
    icon?: React.ElementType;
}

/**
 * Grupo de opcoes em capsula. Substitui as abas sublinhadas em CAPS.
 *
 * Rola na horizontal no mobile em vez de espremer: com quatro opcoes o texto
 * ficava cortado em 360px de largura.
 */
export function SegmentedTabs<T extends string>({ options, value, onChange, size = 'md' }: {
    options: SegmentOption<T>[];
    value: T;
    onChange: (id: T) => void;
    size?: 'sm' | 'md';
}) {
    const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
    return (
        <div
            role="tablist"
            className="inline-flex items-center gap-1 p-1 bg-white/[0.04] border border-white/5 rounded-full max-w-full overflow-x-auto custom-scrollbar"
        >
            {options.map(opt => {
                const isActive = opt.id === value;
                const Icon = opt.icon;
                return (
                    <button
                        key={opt.id}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(opt.id)}
                        className={`flex items-center gap-2 shrink-0 rounded-full font-semibold whitespace-nowrap transition-colors ${pad} ${
                            isActive
                                ? 'bg-[#FABE01] text-black'
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        {Icon && <Icon className="w-4 h-4 shrink-0" />}
                        {opt.short ? (
                            <>
                                <span className="sm:hidden">{opt.short}</span>
                                <span className="hidden sm:inline">{opt.label}</span>
                            </>
                        ) : opt.label}
                    </button>
                );
            })}
        </div>
    );
}

// --- CARTAO DE NUMERO ------------------------------------------------------

/**
 * Tons de um numero. `attention` e `positive` existem para o painel dizer
 * sozinho o que exige acao - um "3" cinza e um "3" ambar carregam informacao
 * diferente, e antes tudo era branco.
 */
export type StatTone = 'default' | 'attention' | 'positive' | 'brand';

const TONE: Record<StatTone, { value: string; chip: string }> = {
    default: { value: 'text-white', chip: 'bg-white/5 text-zinc-400' },
    attention: { value: 'text-amber-400', chip: 'bg-amber-500/10 text-amber-400' },
    positive: { value: 'text-emerald-400', chip: 'bg-emerald-500/10 text-emerald-400' },
    brand: { value: 'text-[#FABE01]', chip: 'bg-[#FABE01]/10 text-[#FABE01]' }
};

export const StatTile: React.FC<{
    label: string;
    value: number | string;
    icon?: React.ElementType;
    tone?: StatTone;
    hint?: string;
    onClick?: () => void;
}> = ({ label, value, icon: Icon, tone = 'default', hint, onClick }) => {
    const t = TONE[tone];
    const Wrapper: any = onClick ? 'button' : 'div';
    return (
        <Wrapper
            onClick={onClick}
            className={`bg-[#1A1A1A] border border-white/5 rounded-card p-4 sm:p-5 shadow-card text-left w-full transition-colors ${
                onClick ? 'hover:border-[#FABE01]/40 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#FABE01]' : ''
            }`}
        >
            <div className="flex items-start justify-between gap-3 mb-3">
                {/* Rotulo em caixa normal: o CAPS + tracking em toda etiqueta
                    deixava a tela gritando por igual e nada se destacava. */}
                <span className="text-sm text-zinc-400 font-medium leading-snug">{label}</span>
                {Icon && (
                    <span className={`w-9 h-9 shrink-0 rounded-chip flex items-center justify-center ${t.chip}`}>
                        <Icon className="w-[18px] h-[18px]" />
                    </span>
                )}
            </div>
            <p className={`text-3xl font-bold tracking-tight ${t.value}`}>{value}</p>
            {hint && <p className="text-xs text-zinc-600 mt-1.5 leading-snug">{hint}</p>}
        </Wrapper>
    );
};

// --- SUPERFICIES -----------------------------------------------------------

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
    <div className={`bg-[#1A1A1A] border border-white/5 rounded-card shadow-card ${className}`}>{children}</div>
);

export const EmptyState: React.FC<{
    icon: React.ElementType;
    title: string;
    description: string;
    action?: React.ReactNode;
}> = ({ icon: Icon, title, description, action }) => (
    <div className="col-span-full py-14 px-6 text-center border border-dashed border-white/10 rounded-card">
        <span className="w-14 h-14 mx-auto mb-4 rounded-card bg-white/[0.03] flex items-center justify-center">
            <Icon className="w-7 h-7 text-zinc-600" />
        </span>
        <p className="text-white font-bold mb-1">{title}</p>
        <p className="text-zinc-500 text-sm max-w-md mx-auto leading-relaxed">{description}</p>
        {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
);
