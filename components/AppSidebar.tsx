import React from 'react';
import { Menu, X } from 'lucide-react';
// @ts-ignore
import favicon from '../assets/favicon.png';

/**
 * Casca de navegacao lateral, usada pelas tres areas do portal: o painel da
 * agencia, o espaco de trabalho de um cliente e o portal do cliente.
 *
 * Antes cada uma tinha a propria copia do drawer - overlay, translate-x,
 * z-index, botao de fechar - e elas ja tinham divergido: o painel da agencia
 * nem lateral era, usava abas no topo que sumiam ao rolar. Uma casca so
 * garante que abrir o menu funcione igual em qualquer tela.
 *
 * No desktop o painel FLUTUA: fica solto do fundo com margem e raio proprio,
 * em vez de colado na borda da janela. E o que separa visualmente a navegacao
 * do conteudo sem precisar de mais uma linha divisoria.
 */

export interface NavEntry {
    id: string;
    label: string;
    icon: React.ElementType;
    /** Quantidade pendente. Zero ou ausente nao desenha o selo. */
    badge?: number;
    /** Ambar = alguem esta esperando a gente. Dourado = informativo. */
    badgeTone?: 'gold' | 'amber';
}

export interface NavGroup {
    /** Titulo do grupo, como "Geral" e "Gestao". Opcional. */
    title?: string;
    items: NavEntry[];
}

const NavPill: React.FC<{ entry: NavEntry; isActive: boolean; onClick: () => void }> = ({ entry, isActive, onClick }) => {
    const badge = entry.badge || 0;
    return (
        <button
            onClick={onClick}
            aria-current={isActive ? 'page' : undefined}
            className={`group flex items-center w-full gap-3 px-3 py-2.5 text-sm rounded-control transition-colors ${
                isActive
                    ? 'bg-[#FABE01] text-black font-semibold'
                    : 'text-zinc-400 font-medium hover:text-white hover:bg-white/5'
            }`}
        >
            <entry.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-black' : 'text-zinc-500 group-hover:text-white'}`} />
            <span className="flex-1 text-left truncate">{entry.label}</span>
            {badge > 0 && (
                <span
                    className={`shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                        isActive
                            ? 'bg-black/20 text-black'
                            : entry.badgeTone === 'amber'
                                ? 'bg-amber-500 text-black'
                                : 'bg-[#FABE01] text-black'
                    }`}
                    aria-label={`${badge} item(ns) aguardando você`}
                >
                    {badge > 9 ? '9+' : badge}
                </span>
            )}
        </button>
    );
};

export const AppSidebar: React.FC<{
    groups: NavGroup[];
    activeId: string;
    onSelect: (id: string) => void;
    isOpen: boolean;
    onClose: () => void;
    /** Marca no topo. Sem isto usa o logo da Nocrato. */
    brand?: React.ReactNode;
    /** Bloco entre a marca e a navegacao: voltar ao painel, cartao da empresa. */
    aboveNav?: React.ReactNode;
    /** Rodape fixo: perfil do usuario, sair, suporte. */
    footer?: React.ReactNode;
}> = ({ groups, activeId, onSelect, isOpen, onClose, brand, aboveNav, footer }) => (
    <>
        <div
            className={`fixed inset-0 bg-black/80 z-40 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
                isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            onClick={onClose}
            aria-hidden="true"
        />

        <aside
            className={`
                fixed md:sticky top-0 left-0 z-50 w-[17rem] shrink-0
                h-[100dvh] md:h-[calc(100dvh-1.5rem)] md:my-3 md:ml-3
                bg-[#1A1A1A] border border-white/5 md:rounded-card md:shadow-card
                flex flex-col transform transition-transform duration-300 ease-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}
        >
            <div className="h-16 flex items-center justify-between px-4 shrink-0">
                {brand || (
                    <div className="flex items-center gap-2.5">
                        <img src={favicon} alt="Nocrato" className="h-7 w-auto brightness-0 invert" />
                        <div className="flex flex-col leading-none">
                            <span className="text-base font-bold text-white tracking-tight">Nocrato</span>
                            <span className="text-[9px] text-[#FABE01] uppercase tracking-[0.2em] font-bold mt-1">Portal</span>
                        </div>
                    </div>
                )}
                <button
                    onClick={onClose}
                    className="md:hidden p-2 -mr-2 text-zinc-400 hover:text-white transition-colors"
                    aria-label="Fechar menu"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {aboveNav && <div className="px-3 pb-3 shrink-0">{aboveNav}</div>}

            <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3 space-y-6">
                {groups.map((group, i) => (
                    <div key={group.title || i} className="space-y-1">
                        {group.title && (
                            <p className="px-3 pb-1.5 text-[11px] font-semibold text-zinc-600 tracking-wide">
                                {group.title}
                            </p>
                        )}
                        {group.items.map(entry => (
                            <NavPill
                                key={entry.id}
                                entry={entry}
                                isActive={activeId === entry.id}
                                onClick={() => onSelect(entry.id)}
                            />
                        ))}
                    </div>
                ))}
            </nav>

            {footer && <div className="shrink-0 p-3 border-t border-white/5">{footer}</div>}
        </aside>
    </>
);

/**
 * Barra superior do mobile. So aparece abaixo de md, onde a lateral vira
 * gaveta e alguem precisa poder abri-la.
 */
export const MobileTopBar: React.FC<{
    title?: React.ReactNode;
    onOpenMenu: () => void;
    right?: React.ReactNode;
}> = ({ title, onOpenMenu, right }) => (
    <header className="md:hidden sticky top-0 z-30 bg-[#111111]/90 backdrop-blur-md border-b border-white/5 px-4 h-14 flex items-center justify-between gap-3">
        <button onClick={onOpenMenu} className="p-2 -ml-2 text-white shrink-0" aria-label="Abrir menu de navegação">
            <Menu className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0 text-center">
            {typeof title === 'string'
                ? <span className="text-sm font-semibold text-white truncate block">{title}</span>
                : title}
        </div>
        <div className="shrink-0 w-9 flex justify-end">{right}</div>
    </header>
);

export default AppSidebar;
