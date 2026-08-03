import React from 'react';
import { getDisplayName, getInitials, isSafeImageSrc } from '../utils/avatar';
import { Mail, ChevronRight, Building2 } from 'lucide-react';

export interface PersonCardData {
    id: string;
    email: string;
    nome?: string | null;
    sobrenome?: string | null;
    fotoUrl?: string | null;
    cargo?: string | null;
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
    /** Abre a ficha da pessoa. O cartao INTEIRO e a area de clique. */
    onAbrir: () => void;
    /** Aviso em destaque, tipo vinculo quebrado. */
    aviso?: { texto: string; tom: 'atencao' | 'erro' };
    /** Contorno destacado quando algo exige acao. */
    borda?: 'normal' | 'atencao' | 'erro';
}

const BORDAS = {
    normal: 'border-white/5 hover:border-white/15',
    atencao: 'border-[#FABE01]/25 hover:border-[#FABE01]/50',
    erro: 'border-red-500/30 hover:border-red-500/60'
};

/**
 * Cartao de PESSOA - equipe ou acesso de cliente.
 *
 * E PORTA DE ENTRADA, nao ficha. Nove cartoes precisam caber na tela, e cada
 * campo acrescentado aqui encolhe os outros - foi assim que o cartao anterior
 * acumulou "Permissão: Cliente" embaixo do titulo "Clientes" e o nome da
 * empresa duas vezes. Aqui ficam rosto, nome e situacao; o resto vive em
 * PersonDetailModal.
 *
 * O MENU DE TRES PONTOS SAIU. Ele escondia "redefinir senha" atras de um clique
 * sem rotulo e disputava o clique com o proprio cartao - dois alvos no mesmo
 * canto, um deles invisivel. As acoes agora ficam no rodape da ficha, escritas.
 */
const PersonCard: React.FC<PersonCardProps> = ({
    pessoa, selo, subtitulo, campos = [], ehVoce, onAbrir, aviso, borda = 'normal'
}) => {
    const temFoto = isSafeImageSrc(pessoa.fotoUrl);
    const nome = getDisplayName(pessoa);

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onAbrir}
            onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); }
            }}
            aria-label={`Abrir ficha de ${nome}`}
            className={`group relative bg-[#1A1A1A] border rounded-card p-5 flex flex-col text-left cursor-pointer transition-colors outline-none focus-visible:border-[#FABE01] ${BORDAS[borda]}`}
        >
            {/* TOPO: selo a esquerda, seta a direita. A seta e o unico sinal de que
                o cartao abre algo - sem ela o clique e adivinhacao. */}
            <div className="flex items-start justify-between gap-2 mb-3">
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${selo.cor}`}>
                    {selo.texto}
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-[#FABE01] transition-colors shrink-0" />
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
