import React, { useState, useRef, useEffect } from 'react';
import { getDisplayName, getInitials, isSafeImageSrc } from '../utils/avatar';
import { Mail, MoreVertical, Building2 } from 'lucide-react';

export interface PersonCardData {
    id: string;
    email: string;
    nome?: string | null;
    sobrenome?: string | null;
    fotoUrl?: string | null;
    cargo?: string | null;
}

export interface PersonCardAcao {
    label: string;
    onClick: () => void;
    /** Vermelho e separado das outras, para acao destrutiva. */
    destrutiva?: boolean;
}

interface PersonCardProps {
    pessoa: PersonCardData;
    /** Selo do canto: "Admin", "Colaborador", "Ativo", "Sem empresa". */
    selo: { texto: string; cor: string };
    /** Linha abaixo do nome: cargo, ou a empresa no caso do cliente. */
    subtitulo?: string | null;
    /** Ate dois pares rotulo/valor. Nao passe o que a secao ja diz. */
    campos?: { rotulo: string; valor: string; alerta?: boolean }[];
    /** Marca "você" no proprio cartao. */
    ehVoce?: boolean;
    acoes?: PersonCardAcao[];
    /** Aviso em destaque, tipo vinculo quebrado. */
    aviso?: { texto: string; tom: 'atencao' | 'erro' };
    /** Contorno destacado quando algo exige acao. */
    borda?: 'normal' | 'atencao' | 'erro';
    children?: React.ReactNode;
}

const BORDAS = {
    normal: 'border-white/5 hover:border-white/15',
    atencao: 'border-[#FABE01]/25 hover:border-[#FABE01]/50',
    erro: 'border-red-500/30 hover:border-red-500/60'
};

/**
 * Cartao de PESSOA - equipe ou acesso de cliente.
 *
 * Substitui o cartao anterior, que tinha dois problemas somados:
 *
 * 1. REPETIA informacao que a secao ja dizia. No cartao de um cliente aparecia
 *    "Permissão: Cliente" embaixo do titulo "Clientes", e o nome da empresa
 *    saia duas vezes - no subtitulo e no campo Empresa.
 *
 * 2. PAREDE DE AMARELO. Cada cartao trazia um botao dourado "Editar", e nove
 *    cartoes na tela viravam nove blocos gritando com o mesmo peso. Acao
 *    secundaria com peso de acao primaria e ruido.
 *
 * As acoes agora vivem num menu de tres pontos. O cartao fica limpo e o que se
 * le e a PESSOA, nao os botoes. Quem procura acao vai no menu; quem esta
 * varrendo a lista nao e atrapalhado por ela.
 */
const PersonCard: React.FC<PersonCardProps> = ({
    pessoa, selo, subtitulo, campos = [], ehVoce, acoes = [], aviso, borda = 'normal', children
}) => {
    const [menuAberto, setMenuAberto] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Fecha ao clicar fora e no Esc. Sem isto o menu fica aberto para sempre
    // enquanto o usuario clica em outro lugar da tela - e com nove cartoes,
    // varios menus abertos ao mesmo tempo.
    useEffect(() => {
        if (!menuAberto) return;
        const fora = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAberto(false);
        };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuAberto(false); };
        document.addEventListener('mousedown', fora);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('mousedown', fora);
            document.removeEventListener('keydown', esc);
        };
    }, [menuAberto]);

    const temFoto = isSafeImageSrc(pessoa.fotoUrl);
    const nome = getDisplayName(pessoa);

    return (
        <div className={`relative bg-[#1A1A1A] border rounded-card p-5 flex flex-col transition-colors ${BORDAS[borda]}`}>
            {/* TOPO: selo a esquerda, menu a direita. O nome fica no centro, e
                nao disputa espaco horizontal com nada. */}
            <div className="flex items-start justify-between gap-2 mb-3">
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${selo.cor}`}>
                    {selo.texto}
                </span>

                {acoes.length > 0 && (
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setMenuAberto(v => !v)}
                            aria-label={`Ações de ${nome}`}
                            aria-expanded={menuAberto}
                            className="p-1.5 -m-1.5 rounded-full text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            <MoreVertical className="w-4 h-4" />
                        </button>

                        {menuAberto && (
                            <div className="absolute right-0 top-8 z-20 w-48 bg-[#1A1A1A] border border-white/10 rounded-control shadow-card overflow-hidden py-1">
                                {acoes.map((acao, i) => (
                                    <button
                                        key={acao.label}
                                        onClick={() => { setMenuAberto(false); acao.onClick(); }}
                                        className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                                            acao.destrutiva
                                                ? 'text-red-400 hover:bg-red-400/10'
                                                : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                                        } ${acao.destrutiva && i > 0 ? 'border-t border-white/5 mt-1 pt-2.5' : ''}`}
                                    >
                                        {acao.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* IDENTIDADE centralizada. Avatar de 64px em vez de 44: numa lista de
                pessoas, o rosto e o que identifica mais rapido que o nome. */}
            <div className="flex flex-col items-center text-center mb-4">
                {temFoto ? (
                    <img src={pessoa.fotoUrl!} alt="" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                    <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 font-bold text-lg">
                        {getInitials(pessoa)}
                    </div>
                )}
                <div className="flex items-center gap-1.5 mt-3 max-w-full">
                    <p className="font-bold text-white truncate">{nome}</p>
                    {ehVoce && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#FABE01] shrink-0">você</span>
                    )}
                </div>
                {subtitulo && (
                    <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-full">{subtitulo}</p>
                )}
            </div>

            {/* CONTATO em poco proprio: o e-mail e longo e competia com o nome na
                mesma coluna de texto. */}
            <div className="flex items-center gap-2 bg-[#111111] border border-white/5 rounded-control px-3 py-2.5 min-w-0 mb-2">
                <Mail className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                <span className="text-xs text-zinc-400 truncate" title={pessoa.email}>{pessoa.email}</span>
            </div>

            {campos.length > 0 && (
                <div className={`grid gap-px bg-white/5 rounded-control overflow-hidden ${campos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {campos.map(campo => (
                        <div key={campo.rotulo} className="bg-[#111111] px-3 py-2.5 min-w-0">
                            <p className="text-[10px] text-zinc-600 mb-0.5">{campo.rotulo}</p>
                            <p className={`text-xs truncate ${campo.alerta ? 'text-red-400' : 'text-zinc-200'}`} title={campo.valor}>
                                {campo.valor}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {aviso && (
                <p className={`text-[11px] mt-3 leading-relaxed ${aviso.tom === 'erro' ? 'text-red-400/90' : 'text-amber-400/90'}`}>
                    {aviso.texto}
                </p>
            )}

            {/* Espaco para controles em modo de edicao. */}
            {children && <div className="mt-3 pt-3 border-t border-white/5">{children}</div>}
        </div>
    );
};

export default PersonCard;

/** Selo de acesso pendente, reaproveitado nas duas listas. */
export const SELO_SEM_EMPRESA = { texto: 'Sem empresa', cor: 'bg-amber-500/15 text-amber-400' };
export const SELO_ATIVO = { texto: 'Ativo', cor: 'bg-emerald-500/15 text-emerald-400' };
export const SELO_ADMIN = { texto: 'Admin', cor: 'bg-[#FABE01]/15 text-[#FABE01]' };
export const SELO_COLABORADOR = { texto: 'Colaborador', cor: 'bg-white/5 text-zinc-400' };
export const SELO_ORFAO = { texto: 'Vínculo quebrado', cor: 'bg-red-500/15 text-red-400' };

/** Icone reaproveitado por quem monta o campo de empresa. */
export { Building2 as IconeEmpresa };
