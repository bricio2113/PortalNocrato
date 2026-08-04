import React from 'react';
import { UserProfile } from '../types';
import { getDisplayName, getInitials, isSafeImageSrc } from '../utils/avatar';
import { UserPlus } from 'lucide-react';

const TAMANHOS = {
    xs: 'w-5 h-5 text-[8px]',
    sm: 'w-6 h-6 text-[9px]',
    md: 'w-8 h-8 text-[11px]'
} as const;

export type TamanhoAvatar = keyof typeof TAMANHOS;

/**
 * Rosto de uma pessoa em miniatura.
 *
 * Foto quando ha, iniciais quando nao ha - nunca um circulo vazio. Circulo vazio
 * num quadro de producao le como "carregando" e faz a equipe esperar por algo
 * que nao vem.
 */
export const AvatarBubble: React.FC<{
    pessoa: UserProfile;
    tamanho?: TamanhoAvatar;
    /** Anel para separar rostos sobrepostos do fundo. */
    anel?: boolean;
    /**
     * Cor do anel. Tem que ser a cor do FUNDO onde a pilha esta, senao o anel
     * aparece como um circulo claro em volta do rosto em vez de recortar o rosto
     * de tras - foi o que aconteceu no card do quadro, que e mais escuro que o
     * padrao e mostrava dois rostos colados num borrao.
     */
    anelClasse?: string;
}> = ({ pessoa, tamanho = 'sm', anel = true, anelClasse = 'ring-[#1A1A1A]' }) => {
    const nome = getDisplayName(pessoa);
    const classes = `${TAMANHOS[tamanho]} rounded-full shrink-0 object-cover ${anel ? `ring-2 ${anelClasse}` : ''}`;

    return isSafeImageSrc(pessoa.fotoUrl) ? (
        <img src={pessoa.fotoUrl!} alt={nome} title={nome} className={classes} />
    ) : (
        <span
            title={nome}
            className={`${classes} bg-white/10 text-zinc-300 font-bold flex items-center justify-center`}
        >
            {getInitials(pessoa)}
        </span>
    );
};

/**
 * Pilha de rostos, com "+N" quando passa do limite.
 *
 * O ESTADO VAZIO NAO E VAZIO: sem ninguem atribuido aparece um circulo tracejado
 * com o icone de adicionar. Um espaco em branco nao diz "falta alguem aqui" -
 * conteudo sem responsavel e justamente o que precisa saltar aos olhos no quadro.
 */
export const AvatarGroup: React.FC<{
    pessoas: UserProfile[];
    tamanho?: TamanhoAvatar;
    limite?: number;
    /** Torna a pilha clicavel, para abrir a atribuicao. */
    onClick?: () => void;
    vazioLabel?: string;
    /** Cor do fundo onde a pilha vive. Ver AvatarBubble. */
    anelClasse?: string;
}> = ({ pessoas, tamanho = 'sm', limite = 3, onClick, vazioLabel = 'Sem responsável', anelClasse = 'ring-[#1A1A1A]' }) => {
    const visiveis = pessoas.slice(0, limite);
    const resto = pessoas.length - visiveis.length;

    const conteudo = pessoas.length === 0 ? (
        <span
            title={vazioLabel}
            className={`${TAMANHOS[tamanho]} rounded-full border border-dashed border-white/20 text-zinc-500 flex items-center justify-center`}
        >
            <UserPlus className="w-3 h-3" />
        </span>
    ) : (
        <>
            {visiveis.map(p => <AvatarBubble key={p.id} pessoa={p} tamanho={tamanho} anelClasse={anelClasse} />)}
            {resto > 0 && (
                <span className={`${TAMANHOS[tamanho]} rounded-full bg-white/10 text-zinc-300 font-bold flex items-center justify-center ring-2 ${anelClasse}`}>
                    +{resto}
                </span>
            )}
        </>
    );

    const classe = `flex items-center ${tamanho === 'xs' ? '-space-x-1' : '-space-x-1.5'}`;

    return onClick ? (
        <button
            onClick={e => { e.stopPropagation(); onClick(); }}
            aria-label="Definir responsáveis"
            className={`${classe} rounded-full hover:opacity-80 transition-opacity`}
        >
            {conteudo}
        </button>
    ) : (
        <div className={classe}>{conteudo}</div>
    );
};
