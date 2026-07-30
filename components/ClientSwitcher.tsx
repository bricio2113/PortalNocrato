import React, { useRef, useMemo } from 'react';
import { PendingCounts } from '../utils/posts';
import { ChevronRight, ChevronLeft, Search, X } from 'lucide-react';

export interface SwitcherEmpresa {
    id: string;
    nome: string;
}

interface ClientSwitcherProps {
    empresas: SwitcherEmpresa[];
    selectedId: string | null;
    onSelect: (empresaId: string) => void;
    /** Pendencias por empresa, para acender o anel. */
    pendingByEmpresa: Record<string, PendingCounts>;
    search: string;
    onSearchChange: (value: string) => void;
}

const initials = (nome: string) => {
    const parts = nome.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return nome.slice(0, 2).toUpperCase();
};

/**
 * Seletor de cliente no formato de stories.
 *
 * Substitui o vai e volta Painel -> Acessar Calendario -> Voltar -> outro
 * cliente, que era o caminho para trocar de contexto.
 *
 * O anel nao e enfeite: aceso significa que aquele cliente tem algo esperando a
 * agencia (ajuste pedido). E a mesma convencao do Instagram - anel colorido quer
 * dizer "tem novidade aqui" - aproveitada para carregar informacao real.
 */
const ClientSwitcher: React.FC<ClientSwitcherProps> = ({
    empresas, selectedId, onSelect, pendingByEmpresa, search, onSearchChange
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return empresas;
        return empresas.filter(e => e.nome.toLowerCase().includes(term));
    }, [empresas, search]);

    const scrollBy = (delta: number) => {
        scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
    };

    return (
        <div className="border-b border-white/5 bg-[#111111]">
            <div className="flex items-center gap-3 px-4 sm:px-8 py-4">

                {/* A busca aparece a partir de ~12 clientes: abaixo disso a fila
                    de circulos ja e navegavel e o campo so rouba espaco. */}
                {empresas.length >= 12 && (
                    <div className="relative w-40 sm:w-52 shrink-0">
                        <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Buscar cliente"
                            aria-label="Buscar cliente"
                            className="w-full bg-[#1A1A1A] border border-white/10 rounded-full py-1.5 pl-8 pr-7 text-xs text-white placeholder:text-zinc-600 focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] outline-none transition-all"
                        />
                        {search && (
                            <button
                                onClick={() => onSearchChange('')}
                                aria-label="Limpar busca de cliente"
                                className="absolute right-2 top-1.5 text-zinc-500 hover:text-white"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                )}

                <button
                    onClick={() => scrollBy(-320)}
                    aria-label="Ver clientes anteriores"
                    className="hidden md:flex shrink-0 w-7 h-7 items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>

                <div
                    ref={scrollRef}
                    className="flex-1 flex items-start gap-4 overflow-x-auto custom-scrollbar pb-1"
                >
                    {filtered.length === 0 ? (
                        <p className="text-zinc-500 text-sm py-4">Nenhum cliente corresponde à busca.</p>
                    ) : (
                        filtered.map(empresa => {
                            const isSelected = empresa.id === selectedId;
                            const pending = pendingByEmpresa[empresa.id]?.aguardandoAgencia || 0;
                            const hasPending = pending > 0;

                            return (
                                <button
                                    key={empresa.id}
                                    onClick={() => onSelect(empresa.id)}
                                    aria-pressed={isSelected}
                                    aria-label={
                                        hasPending
                                            ? `${empresa.nome}, ${pending} ajuste(s) pedido(s)`
                                            : empresa.nome
                                    }
                                    className="group shrink-0 w-[76px] flex flex-col items-center gap-1.5 focus:outline-none"
                                >
                                    <span
                                        className={`relative w-16 h-16 rounded-full p-[2px] transition-all ${
                                            hasPending
                                                ? 'bg-gradient-to-tr from-[#FABE01] to-[#DE7928]'
                                                : isSelected
                                                    ? 'bg-white/40'
                                                    : 'bg-white/10 group-hover:bg-white/25'
                                        }`}
                                    >
                                        <span className="block w-full h-full rounded-full bg-[#111111] p-[2px]">
                                            <span className={`w-full h-full rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                                                isSelected ? 'bg-[#FABE01] text-black' : 'bg-[#1A1A1A] text-zinc-300 group-hover:text-white'
                                            }`}>
                                                {initials(empresa.nome)}
                                            </span>
                                        </span>

                                        {hasPending && (
                                            <span className="absolute -bottom-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-amber-500 text-black text-[10px] font-bold ring-2 ring-[#111111]">
                                                {pending > 9 ? '9+' : pending}
                                            </span>
                                        )}
                                    </span>

                                    <span className={`w-full text-[11px] leading-tight text-center truncate transition-colors ${
                                        isSelected ? 'text-[#FABE01] font-bold' : 'text-zinc-500 group-hover:text-zinc-300'
                                    }`}>
                                        {empresa.nome}
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>

                <button
                    onClick={() => scrollBy(320)}
                    aria-label="Ver mais clientes"
                    className="hidden md:flex shrink-0 w-7 h-7 items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default ClientSwitcher;
