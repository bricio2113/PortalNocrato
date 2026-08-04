import React, { useEffect, useMemo } from 'react';
import { UserProfile } from '../types';
import { Subtarefa, subtarefaStatusInfo } from '../utils/subtarefas';
import { AvatarBubble } from './AvatarBubble';
import { X, ListChecks, ArrowRight, UserPlus } from 'lucide-react';

export interface TarefaAberta {
    empresaId: string;
    empresaNome: string;
    tarefa: Subtarefa;
}

interface TarefasAbertasModalProps {
    itens: TarefaAberta[];
    /** uid -> pessoa, para o rosto do responsavel. */
    indice: Record<string, UserProfile>;
    /** Abre o conteudo a que a tarefa pertence. */
    onAbrir: (empresaId: string, empresaNome: string, eventId: string) => void;
    onFechar: () => void;
}

/**
 * Quais tarefas estao abertas - e o caminho para cada uma.
 *
 * O numero "Tarefas abertas" no topo do painel era um beco: dizia 7 e nao dizia
 * quais, nem de quem, nem onde. Para chegar em uma era preciso adivinhar o cliente,
 * entrar nele, abrir o quadro e procurar. E o mesmo defeito que "Precisa de atenção"
 * tinha antes de virar lista clicavel.
 *
 * A ORDEM E DE COBRANCA, nao alfabetica: primeiro o que nao tem responsavel - tarefa
 * sem dono e a que ninguem vai fazer -, depois o que esta em andamento, depois o
 * resto. Quem abre esta lista quer saber onde intervir.
 *
 * Clicar abre O CONTEUDO da tarefa, na aba de gestao, e nao uma tela de tarefa: a
 * subtarefa nao existe solta, ela e uma etapa de um post. E la que se muda status,
 * responsavel e prazo.
 */
const TarefasAbertasModal: React.FC<TarefasAbertasModalProps> = ({
    itens, indice, onAbrir, onFechar
}) => {
    useEffect(() => {
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
        document.addEventListener('keydown', esc);
        return () => document.removeEventListener('keydown', esc);
    }, [onFechar]);

    const ordenados = useMemo(() => {
        const peso = (t: TarefaAberta) => {
            if (!t.tarefa.responsavelUid) return 0;
            return t.tarefa.status === 'fazendo' ? 1 : 2;
        };
        return [...itens].sort((a, b) =>
            peso(a) - peso(b) || a.empresaNome.localeCompare(b.empresaNome, 'pt-BR'));
    }, [itens]);

    const semDono = itens.filter(t => !t.tarefa.responsavelUid).length;

    return (
        <div
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4"
            onClick={onFechar}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Tarefas abertas"
                onClick={e => e.stopPropagation()}
                className="w-full sm:max-w-xl bg-[#1A1A1A] border-t sm:border border-white/10 rounded-t-card sm:rounded-card shadow-card flex flex-col max-h-[85dvh] overflow-hidden"
            >
                <header className="shrink-0 flex items-start gap-3 px-5 py-4 border-b border-white/5">
                    <span className="w-9 h-9 shrink-0 rounded-chip bg-[#FABE01]/10 text-[#FABE01] flex items-center justify-center">
                        <ListChecks className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base font-bold text-white tracking-tight">
                            Tarefas abertas <span className="text-zinc-500 font-semibold">· {itens.length}</span>
                        </h2>
                        <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                            {semDono > 0
                                ? `${semDono} sem responsável — essas vêm primeiro.`
                                : 'Todas com responsável. Clique para abrir o conteúdo.'}
                        </p>
                    </div>
                    <button
                        onClick={onFechar}
                        aria-label="Fechar"
                        className="shrink-0 p-2 -mr-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {ordenados.length === 0 ? (
                        <p className="text-xs text-zinc-500 text-center py-10 px-6 leading-relaxed">
                            Nenhuma tarefa aberta. As etapas de cada conteúdo aparecem aqui enquanto
                            não estão feitas.
                        </p>
                    ) : (
                        <ul className="space-y-1">
                            {ordenados.map(({ empresaId, empresaNome, tarefa }) => {
                                const info = subtarefaStatusInfo(tarefa.status);
                                const pessoa = tarefa.responsavelUid ? indice[tarefa.responsavelUid] : null;
                                return (
                                    <li key={`${empresaId}-${tarefa.id}`}>
                                        <button
                                            onClick={() => onAbrir(empresaId, empresaNome, tarefa.eventId)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-control hover:bg-white/[0.04] transition-colors text-left group"
                                        >
                                            {/* Rosto, ou o vazio ASSUMIDO: circulo tracejado
                                                diz "falta alguem aqui", enquanto um espaco em
                                                branco nao diz nada. */}
                                            {pessoa ? (
                                                <AvatarBubble pessoa={pessoa} tamanho="sm" anelClasse="ring-[#1A1A1A]" />
                                            ) : (
                                                <span className="w-7 h-7 shrink-0 rounded-full border border-dashed border-amber-500/50 text-amber-400 flex items-center justify-center">
                                                    <UserPlus className="w-3 h-3" />
                                                </span>
                                            )}

                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[13px] font-semibold text-white truncate group-hover:text-[#FABE01] transition-colors">
                                                    {tarefa.titulo}
                                                </span>
                                                <span className="block text-[11px] text-zinc-500 truncate">
                                                    {empresaNome}
                                                    {pessoa ? ` · ${pessoa.nome || pessoa.email}` : ' · sem responsável'}
                                                </span>
                                            </span>

                                            <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-chip border ${info.cor}`}>
                                                {info.label}
                                            </span>
                                            <ArrowRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-[#FABE01] shrink-0 transition-colors" />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <footer className="shrink-0 px-5 py-3 border-t border-white/5">
                    <p className="text-[10px] text-zinc-600 leading-relaxed">
                        A tarefa abre dentro do conteúdo dela, na aba Gestão — é lá que se muda
                        status e responsável.
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default TarefasAbertasModal;
