import React, { useState } from 'react';
import { db } from '../utils/firebase';
import { CalendarEvent, UserProfile } from '../types';
import {
    Subtarefa, SubtarefaStatus, SUBTAREFA_STATUS, subtarefaStatusInfo, proximoStatus,
    criarSubtarefa, atualizarSubtarefa, removerSubtarefa, progresso
} from '../utils/subtarefas';
import { slaAtual, slaClasses, slaTipoLabel } from '../utils/sla';
import { getTypeStyles } from '../utils/eventStyles';
import { getDisplayName } from '../utils/avatar';
import { AvatarBubble, AvatarGroup } from './AvatarBubble';
import { formatTime } from '../utils/date';
import {
    X, Plus, Trash2, Loader2, ListChecks, Users, CalendarClock, Pencil,
    AlertTriangle, Clock, Check
} from 'lucide-react';

interface ContentTaskModalProps {
    event: CalendarEvent;
    empresaId: string;
    equipe: UserProfile[];
    subtarefas: Subtarefa[];
    autorEmail?: string | null;
    /** Abre o editor de conteudo (legenda, midia, links). */
    onAbrirConteudo: () => void;
    onClose: () => void;
}

/**
 * FICHA DE PRODUCAO de um conteudo - o card do quadro, aberto.
 *
 * Aqui vive o que e trabalho: quem cuida do conteudo e em que etapa cada parte
 * esta. O que e CONTEUDO - legenda, arquivos, links, aprovacao - continua no
 * editor do calendario, alcancavel pelo botao do rodape. A separacao evita a
 * tela unica gigante que tenta ser as duas coisas e nao e boa em nenhuma.
 *
 * SUBTAREFA NAO PROMOVE O POST. Marcar todas as etapas como feitas nao move o
 * card de coluna: o status que o cliente ve e decisao de quem move, nao efeito
 * colateral de uma caixa marcada. Automatizar isso poria "Concluído" na frente do
 * cliente antes de alguem ter conferido.
 */
const ContentTaskModal: React.FC<ContentTaskModalProps> = ({
    event, empresaId, equipe, subtarefas, autorEmail, onAbrirConteudo, onClose
}) => {
    const [novo, setNovo] = useState('');
    const [criando, setCriando] = useState(false);
    const [erro, setErro] = useState('');
    const [editandoResponsaveis, setEditandoResponsaveis] = useState(false);
    const [salvandoResp, setSalvandoResp] = useState(false);

    const styles = getTypeStyles(event.type);
    const sla = slaAtual(event);
    const prog = progresso(subtarefas);
    const indice = equipe.reduce((acc, p) => { acc[p.id] = p; return acc; }, {} as Record<string, UserProfile>);
    const responsaveis = (event.responsaveis || []).map(uid => indice[uid]).filter(Boolean);

    const adicionar = async () => {
        const titulo = novo.trim();
        if (!titulo) return;
        setCriando(true);
        setErro('');
        try {
            await criarSubtarefa(empresaId, event.id, titulo, autorEmail);
            setNovo('');
        } catch (e) {
            console.error(e);
            setErro('Não foi possível criar a subtarefa.');
        } finally {
            setCriando(false);
        }
    };

    const ciclarStatus = async (sub: Subtarefa) => {
        try {
            await atualizarSubtarefa(empresaId, sub.id, { status: proximoStatus(sub.status) });
        } catch (e) {
            console.error(e);
            setErro('Não foi possível mudar o status da subtarefa.');
        }
    };

    const atribuir = async (sub: Subtarefa, uid: string) => {
        try {
            await atualizarSubtarefa(empresaId, sub.id, { responsavelUid: uid || null });
        } catch (e) {
            console.error(e);
            setErro('Não foi possível atribuir a subtarefa.');
        }
    };

    const alternarResponsavel = async (uid: string) => {
        const atuais = event.responsaveis || [];
        const novos = atuais.includes(uid) ? atuais.filter(u => u !== uid) : [...atuais, uid];
        setSalvandoResp(true);
        setErro('');
        try {
            // Grava no proprio evento: responsavel e propriedade do CONTEUDO, nao
            // do card. Assim ele sobrevive a qualquer mudanca de quadro e aparece
            // igual no calendario.
            await db.collection('empresas').doc(empresaId).collection('events').doc(event.id)
                .update({ responsaveis: novos });
        } catch (e) {
            console.error(e);
            setErro('Não foi possível salvar os responsáveis.');
        } finally {
            setSalvandoResp(false);
        }
    };

    const hora = formatTime(event.date);

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md sm:p-4 animate-in fade-in">
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`Produção de ${event.title}`}
                className="relative w-full sm:max-w-2xl bg-white/[0.09] backdrop-blur-2xl border-t sm:border border-white/20 rounded-t-card sm:rounded-card shadow-[0_24px_80px_rgba(0,0,0,0.55)] flex flex-col max-h-[94dvh] overflow-hidden"
            >
                <header className="shrink-0 flex items-start gap-3 px-5 sm:px-6 py-4 border-b border-white/10 bg-white/[0.03]">
                    <span className={`w-1 self-stretch rounded-full shrink-0 ${styles.dot}`} />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-chip uppercase tracking-widest ${styles.label}`}>
                                {event.type || 'Sem formato'}
                            </span>
                            {event.plataforma && (
                                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-chip uppercase tracking-wider bg-white/5 text-zinc-400">
                                    {event.plataforma}
                                </span>
                            )}
                            <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                                <CalendarClock className="w-3 h-3" />
                                {event.date.toLocaleDateString('pt-BR')}{hora ? ` · ${hora}` : ''}
                            </span>
                        </div>
                        <h2 className="text-lg font-bold text-white tracking-tight leading-snug break-words">
                            {event.title}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Fechar"
                        className="p-2 -mt-1 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-6 space-y-4">
                    {/* SITUACAO: status atual e o unico prazo que vale agora. */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-black/25 border border-white/10 rounded-card px-4 py-3">
                            <p className="text-[11px] text-zinc-400 mb-1">Status do conteúdo</p>
                            <p className="text-sm font-semibold text-white">{event.status}</p>
                            <p className="text-[10px] text-zinc-500 mt-1">Muda ao arrastar o card no quadro.</p>
                        </div>
                        <div className="bg-black/25 border border-white/10 rounded-card px-4 py-3">
                            <p className="text-[11px] text-zinc-400 mb-1">Prazo</p>
                            {sla ? (
                                <>
                                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${slaClasses(sla.tone)}`}>
                                        <Clock className="w-3 h-3" /> {sla.label}
                                    </span>
                                    <p className="text-[10px] text-zinc-500 mt-1.5">
                                        {slaTipoLabel(sla.tipo)} · com {sla.dono === 'agencia' ? 'a equipe' : 'o cliente'}
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm font-semibold text-zinc-400">Sem prazo em aberto</p>
                                    <p className="text-[10px] text-zinc-500 mt-1">O conteúdo saiu do fluxo.</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* RESPONSAVEIS pelo conteudo inteiro. */}
                    <section className="bg-black/25 border border-white/10 rounded-card p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Users className="w-4 h-4 text-[#FABE01]" />
                            <h3 className="text-sm font-bold text-white">Responsáveis</h3>
                            <button
                                onClick={() => setEditandoResponsaveis(v => !v)}
                                className="ml-auto text-[11px] font-semibold text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-full flex items-center gap-1 transition-colors"
                            >
                                <Pencil className="w-3 h-3" /> {editandoResponsaveis ? 'Fechar' : 'Definir'}
                            </button>
                        </div>

                        {editandoResponsaveis ? (
                            <div className="flex flex-wrap gap-1.5">
                                {equipe.length === 0 && (
                                    <p className="text-xs text-zinc-400">Ninguém na equipe da agência ainda.</p>
                                )}
                                {equipe.map(pessoa => {
                                    const marcado = (event.responsaveis || []).includes(pessoa.id);
                                    return (
                                        <button
                                            key={pessoa.id}
                                            onClick={() => alternarResponsavel(pessoa.id)}
                                            disabled={salvandoResp}
                                            aria-pressed={marcado}
                                            className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-xs transition-colors disabled:opacity-50 ${
                                                marcado
                                                    ? 'bg-[#FABE01]/15 border-[#FABE01]/40 text-white'
                                                    : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                                            }`}
                                        >
                                            <AvatarBubble pessoa={pessoa} tamanho="xs" anel={false} />
                                            {getDisplayName(pessoa)}
                                            {marcado && <Check className="w-3 h-3 text-[#FABE01]" />}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : responsaveis.length === 0 ? (
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Ninguém atribuído. Conteúdo sem responsável é o que trava a produção sem ninguém notar.
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {responsaveis.map(p => (
                                    <span key={p.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full pl-1.5 pr-3 py-1 text-xs text-zinc-200">
                                        <AvatarBubble pessoa={p} tamanho="xs" anel={false} />
                                        {getDisplayName(p)}
                                    </span>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* SUBTAREFAS. */}
                    <section className="bg-black/25 border border-white/10 rounded-card p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <ListChecks className="w-4 h-4 text-[#FABE01]" />
                            <h3 className="text-sm font-bold text-white">Subtarefas</h3>
                            {prog.total > 0 && (
                                <span className="text-[11px] font-semibold text-zinc-300 bg-white/5 px-2 py-0.5 rounded-full">
                                    {prog.feitas} de {prog.total}
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-zinc-500 mb-3 leading-relaxed">
                            As etapas deste conteúdo. Concluir todas não muda o status do post — isso continua sendo
                            decisão de quem move o card.
                        </p>

                        {prog.total > 0 && (
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-4">
                                <div
                                    className="h-full bg-[#FABE01] rounded-full transition-all"
                                    style={{ width: `${prog.pct}%` }}
                                />
                            </div>
                        )}

                        <ul className="space-y-2">
                            {subtarefas.map(sub => {
                                const info = subtarefaStatusInfo(sub.status);
                                const resp = sub.responsavelUid ? indice[sub.responsavelUid] : undefined;
                                return (
                                    <li key={sub.id} className="flex items-center gap-2 bg-[#111111]/60 border border-white/5 rounded-control px-3 py-2.5">
                                        {/* Um clique avanca a etapa. Ciclo de tres, sem menu:
                                            trocar status e a acao mais repetida aqui. */}
                                        <button
                                            onClick={() => ciclarStatus(sub)}
                                            title={`${info.label} — clique para avançar`}
                                            className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border transition-colors ${info.cor}`}
                                        >
                                            {info.label}
                                        </button>

                                        <span className={`flex-1 min-w-0 text-sm break-words ${
                                            sub.status === 'feita' ? 'text-zinc-500 line-through' : 'text-zinc-100'
                                        }`}>
                                            {sub.titulo}
                                        </span>

                                        {/* Atribuicao por select: o rosto aparece ao lado, entao
                                            da para varrer a lista e ver o que esta sem dono. */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {resp && <AvatarBubble pessoa={resp} tamanho="xs" anel={false} />}
                                            <select
                                                value={sub.responsavelUid || ''}
                                                onChange={e => atribuir(sub, e.target.value)}
                                                aria-label={`Responsável por ${sub.titulo}`}
                                                className="max-w-[7.5rem] bg-black/40 border border-white/10 text-zinc-300 text-[11px] rounded-control px-1.5 py-1 outline-none focus:border-[#FABE01]"
                                            >
                                                <option value="">sem dono</option>
                                                {equipe.map(p => (
                                                    <option key={p.id} value={p.id}>{getDisplayName(p)}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => removerSubtarefa(empresaId, sub.id).catch(console.error)}
                                                aria-label={`Excluir ${sub.titulo}`}
                                                className="p-1 rounded-full text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>

                        <div className="flex gap-2 mt-3">
                            <input
                                value={novo}
                                onChange={e => setNovo(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } }}
                                placeholder="Nova subtarefa. Ex: Roteiro do reel"
                                className="min-w-0 flex-1 bg-black/40 border border-white/10 rounded-control px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all"
                            />
                            <button
                                onClick={adicionar}
                                disabled={!novo.trim() || criando}
                                className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-control bg-white/5 text-zinc-200 hover:bg-white/10 transition-colors disabled:opacity-30"
                            >
                                {criando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                Adicionar
                            </button>
                        </div>

                        {erro && (
                            <p className="text-red-400 text-xs mt-3 flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {erro}
                            </p>
                        )}
                    </section>
                </div>

                <footer className="shrink-0 border-t border-white/10 bg-white/[0.03] p-4 sm:px-6 flex items-center gap-2">
                    <AvatarGroup pessoas={responsaveis} tamanho="sm" />
                    <button
                        onClick={onAbrirConteudo}
                        className="ml-auto px-4 py-2.5 text-xs font-semibold rounded-control bg-[#FABE01] text-black hover:bg-[#FABE01]/90 transition-colors"
                    >
                        Abrir conteúdo
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default ContentTaskModal;
