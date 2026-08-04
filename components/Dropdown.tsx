import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface OpcaoDropdown<T extends string> {
    valor: T;
    label: string;
    /** Rende à esquerda: ponto de cor, avatar, ícone. */
    adorno?: React.ReactNode;
    /** Linha menor abaixo do label. */
    detalhe?: string;
}

interface DropdownProps<T extends string> {
    valor: T;
    opcoes: OpcaoDropdown<T>[];
    onSelect: (valor: T) => void;
    /** Texto quando nada casa com o valor atual. */
    vazio?: string;
    ariaLabel: string;
    /** Encolhe o gatilho: usado dentro de linhas de lista. */
    compacto?: boolean;
    className?: string;
    disabled?: boolean;
}

/**
 * Seletor com a cara do app.
 *
 * O `<select>` nativo abre uma lista desenhada pelo SISTEMA OPERACIONAL - branca,
 * com a fonte do sistema, sem os avatares e sem as cores de status. Num app
 * escuro isso e um retangulo branco no meio da tela, e foi exatamente a
 * reclamacao: dava para escolher, mas nao dava para VER o que se estava
 * escolhendo. Aqui a lista e HTML comum, entao a opcao pode carregar rosto, cor
 * e explicacao.
 *
 * Fecha ao clicar fora e no Esc, e devolve o foco ao gatilho depois de escolher -
 * sem isso o teclado fica perdido no meio do documento.
 */
export function Dropdown<T extends string>({
    valor, opcoes, onSelect, vazio = 'selecionar', ariaLabel, compacto, className = '', disabled
}: DropdownProps<T>) {
    const [aberto, setAberto] = useState(false);
    const caixaRef = useRef<HTMLDivElement>(null);
    const gatilhoRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!aberto) return;
        const fora = (e: MouseEvent) => {
            if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) setAberto(false);
        };
        const esc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { setAberto(false); gatilhoRef.current?.focus(); }
        };
        document.addEventListener('mousedown', fora);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('mousedown', fora);
            document.removeEventListener('keydown', esc);
        };
    }, [aberto]);

    const atual = opcoes.find(o => o.valor === valor);

    return (
        <div className={`relative ${className}`} ref={caixaRef}>
            <button
                ref={gatilhoRef}
                type="button"
                disabled={disabled}
                onClick={() => setAberto(v => !v)}
                aria-label={ariaLabel}
                aria-expanded={aberto}
                aria-haspopup="listbox"
                className={`w-full flex items-center gap-2 rounded-control border border-white/10 bg-black/40 text-left transition-colors hover:border-white/20 focus:outline-none focus:border-[#FABE01] disabled:opacity-50 disabled:cursor-not-allowed ${
                    compacto ? 'px-2 py-1.5 text-xs' : 'px-3 py-2.5 text-sm'
                }`}
            >
                {atual?.adorno}
                <span className={`flex-1 min-w-0 truncate ${atual ? 'text-zinc-100' : 'text-zinc-500'}`}>
                    {atual?.label || vazio}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-zinc-500 transition-transform ${aberto ? 'rotate-180' : ''}`} />
            </button>

            {aberto && (
                <ul
                    role="listbox"
                    // z alto e posicao absoluta: dentro de um modal com rolagem, a
                    // lista precisa passar por cima das linhas de baixo.
                    className="absolute z-30 right-0 mt-1 min-w-full w-max max-w-[16rem] max-h-64 overflow-y-auto custom-scrollbar bg-[#1A1A1A] border border-white/15 rounded-control shadow-[0_16px_40px_rgba(0,0,0,0.6)] py-1"
                >
                    {opcoes.map(opcao => {
                        const selecionada = opcao.valor === valor;
                        return (
                            <li key={opcao.valor}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={selecionada}
                                    onClick={() => {
                                        setAberto(false);
                                        gatilhoRef.current?.focus();
                                        onSelect(opcao.valor);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                                        selecionada ? 'bg-white/[0.07] text-white' : 'text-zinc-300 hover:bg-white/5'
                                    }`}
                                >
                                    {opcao.adorno}
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate">{opcao.label}</span>
                                        {opcao.detalhe && (
                                            <span className="block text-[10px] text-zinc-500 truncate">{opcao.detalhe}</span>
                                        )}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

export default Dropdown;
