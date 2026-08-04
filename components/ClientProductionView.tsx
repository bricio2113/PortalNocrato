import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../utils/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import {
    Loader2, Layout, ArrowRight, ArrowLeft, GripVertical, Search, X,
    AlertTriangle, Filter, Layers, Clock, ListChecks, Trash2, CalendarPlus
} from 'lucide-react';
import EventDetailModal from './EventDetailModal';
import { AvatarGroup } from './AvatarBubble';
import { CalendarEvent, UserProfile, EventStatus } from '../types';
import { FORMATO_OPTIONS } from '../constants';
import { getTypeStyles, STATUS_ACCENTS } from '../utils/eventStyles';
import { stripUndefined } from '../utils/firestore';
import { slaAtual, slaClasses } from '../utils/sla';
import { Subtarefa, subscribeSubtarefas, progresso } from '../utils/subtarefas';
import { lerEquipeAgencia, indexarPorUid, pessoasDeUids } from '../utils/equipe';
import { registrarMudancas } from '../utils/historico';

/** Sobra do modelo antigo: card de quadro que nunca teve post na agenda. */
interface CardOrfao {
    id: string;
    title: string;
}

interface ColumnDef {
    id: string;
    title: string;
    accentColor: string;
}

// Colunas sincronizadas rigorosamente com os Status do Calendário
const COLUMNS: ColumnDef[] = [
    'Pendente', 'Agendado', 'Em andamento', 'Editado', 'Concluído', 'Postado', 'Cancelado'
].map(id => ({ id, title: id, accentColor: STATUS_ACCENTS[id] || 'bg-zinc-500' }));

interface ClientProductionViewProps {
    empresaId: string;
    userEmail?: string | null;
    userName?: string | null;
    /** Leva para o calendario - o unico lugar onde conteudo nasce. */
    onIrParaCalendario?: () => void;
}

/**
 * QUADRO DE PRODUCAO - acompanhamento dos conteudos da agenda.
 *
 * O QUE MUDOU E DE ONDE ELE LE. Antes existia a colecao `kanban_tasks`, um
 * ESPELHO de events/: criar um post no calendario criava um card, mover o card
 * gravava nos dois lugares, e o quadro tambem deixava criar card do zero. Esse
 * ultimo caminho produzia card sem post - sem legenda, sem data de publicacao,
 * sem aprovacao, sem prazo -, e a tela precisava de um aviso amarelo explicando
 * ao usuario que aquele card que ELE acabou de criar nao servia para nada. Duas
 * fontes para o mesmo status tambem divergem: bastava uma das duas escritas
 * falhar.
 *
 * Agora o quadro LE events/ direto. Uma fonte, uma escrita ao mover, e nao existe
 * mais o conceito de card sem conteudo: CONTEUDO NASCE NO CALENDARIO, sempre.
 *
 * O que o quadro acrescenta ao calendario e o que ele faz melhor: ver o status de
 * tudo em colunas, com prazo, responsavel e progresso das subtarefas a vista.
 */
const ClientProductionView: React.FC<ClientProductionViewProps> = ({
    empresaId, userEmail, userName, onIrParaCalendario
}) => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [subtarefas, setSubtarefas] = useState<Subtarefa[]>([]);
    const [equipe, setEquipe] = useState<UserProfile[]>([]);
    const [orfaos, setOrfaos] = useState<CardOrfao[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    /**
     * Post aberto, e em qual aba.
     *
     * UM modal so. Antes eram dois - a ficha de producao e o editor de conteudo -
     * e o botao que levava de um ao outro FECHAVA o primeiro, sem volta. Agora o
     * quadro abre o mesmo modal do calendario, direto na aba de gestao.
     */
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [modalError, setModalError] = useState('');
    const [boardError, setBoardError] = useState('');
    const [notice, setNotice] = useState('');

    // Filtros. Sem eles as sete colunas somam ~2400px de rolagem horizontal e
    // achar um post especifico depende de varrer o quadro com o olho.
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('todos');
    const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
    /** Mostra so o que tem prazo estourado ou vencendo. */
    const [soAtencao, setSoAtencao] = useState(false);

    useEffect(() => {
        if (!empresaId) return;
        // Tempo real: com dois membros da equipe no mesmo quadro, um movia o
        // card e o outro so descobria recarregando.
        setIsLoading(true);
        const unsubscribe = db.collection('empresas').doc(empresaId).collection('events')
            .onSnapshot(
                snapshot => {
                    setEvents(snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            ...data,
                            id: doc.id,
                            date: (data.date as firebase.firestore.Timestamp | undefined)?.toDate() || new Date(),
                            prazoProducao: (data.prazoProducao as firebase.firestore.Timestamp | undefined)?.toDate() || null,
                            approvalAt: (data.approvalAt as firebase.firestore.Timestamp | undefined)?.toDate() || null
                        } as CalendarEvent;
                    }));
                    setIsLoading(false);
                },
                error => {
                    console.error('Erro ao buscar publicações:', error);
                    setBoardError('Não foi possível carregar o quadro. Verifique sua conexão e recarregue a página.');
                    setIsLoading(false);
                }
            );
        return unsubscribe;
    }, [empresaId]);

    useEffect(() => {
        if (!empresaId) return;
        return subscribeSubtarefas(empresaId, setSubtarefas);
    }, [empresaId]);

    useEffect(() => {
        lerEquipeAgencia().then(setEquipe).catch(console.error);
    }, []);

    /**
     * Sobras do modelo antigo.
     *
     * Uma leitura, so para nao APAGAR CALADO o que alguem digitou: o card de
     * quadro sem post na agenda deixou de aparecer, e sem esta faixa ele
     * simplesmente teria desaparecido da tela do usuario sem explicacao. Os cards
     * QUE TINHAM post nao entram aqui - o post e a fonte, nada se perde.
     */
    useEffect(() => {
        if (!empresaId) return;
        let vivo = true;
        db.collection('empresas').doc(empresaId).collection('kanban_tasks').get()
            .then(snap => {
                if (!vivo) return;
                setOrfaos(snap.docs
                    .filter(d => !d.data().eventId)
                    .map(d => ({ id: d.id, title: d.data().title || 'sem título' })));
            })
            .catch(() => { /* colecao pode nao existir - nao e erro */ });
        return () => { vivo = false; };
    }, [empresaId]);

    const showNotice = (msg: string) => {
        setNotice(msg);
        setTimeout(() => setNotice(''), 5000);
    };

    const indice = useMemo(() => indexarPorUid(equipe), [equipe]);

    /** Subtarefas agrupadas por conteudo, para o card mostrar "3 de 5". */
    const subsPorEvento = useMemo(() => {
        return subtarefas.reduce((acc, s) => {
            (acc[s.eventId] = acc[s.eventId] || []).push(s);
            return acc;
        }, {} as Record<string, Subtarefa[]>);
    }, [subtarefas]);

    const visibleEvents = useMemo(() => {
        const term = search.trim().toLowerCase();
        return events.filter(event => {
            if (typeFilter !== 'todos') {
                const tipo = event.type || 'Sem formato';
                if (tipo !== typeFilter) return false;
            }
            if (term && !(event.title || '').toLowerCase().includes(term)) return false;
            if (soAtencao) {
                const sla = slaAtual(event);
                if (!sla || (sla.tone !== 'atrasado' && sla.tone !== 'hoje')) return false;
            }
            return true;
        });
    }, [events, search, typeFilter, soAtencao]);

    const isFiltering = search.trim() !== '' || typeFilter !== 'todos' || soAtencao;

    const availableTypes = useMemo(() => {
        const present = new Set<string>(events.map(e => e.type || 'Sem formato'));
        const ordered = FORMATO_OPTIONS.filter(f => present.has(f)) as string[];
        if (present.has('Sem formato')) ordered.push('Sem formato');
        return ordered;
    }, [events]);

    const clearFilters = () => { setSearch(''); setTypeFilter('todos'); setSoAtencao(false); };

    /**
     * Mover = mudar o status DO POST. Uma escrita, uma fonte.
     *
     * A escrita otimista continua: o Firestore leva um instante para confirmar e
     * sem ela o card volta para a coluna de origem por meio segundo.
     */
    const moveEvent = async (eventId: string, novoStatus: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const antes = events.find(ev => ev.id === eventId);
        if (!antes || antes.status === novoStatus) return;

        setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, status: novoStatus as EventStatus } : ev));
        try {
            await db.collection('empresas').doc(empresaId).collection('events').doc(eventId)
                .update({ status: novoStatus });
            // O cliente le o andamento; mover no quadro e uma mudanca de status
            // como qualquer outra e precisa aparecer lá.
            registrarMudancas(
                empresaId, antes, { ...antes, status: novoStatus as EventStatus },
                userEmail || auth.currentUser?.email || '', userName || null, 'agencia'
            );
        } catch (error) {
            console.error('Erro ao mover:', error);
            setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, status: antes.status } : ev));
            showNotice('Não foi possível mover o card. O status anterior foi restaurado.');
        }
    };

    const handleDragStart = (e: React.DragEvent, eventId: string) => {
        e.dataTransfer.setData('eventId', eventId);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => { (e.target as HTMLElement).classList.add('opacity-50'); }, 0);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        (e.target as HTMLElement).classList.remove('opacity-50');
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, status: string) => {
        e.preventDefault();
        const eventId = e.dataTransfer.getData('eventId');
        if (eventId) moveEvent(eventId, status);
    };

    const removerOrfao = async (id: string) => {
        try {
            await db.collection('empresas').doc(empresaId).collection('kanban_tasks').doc(id).delete();
            setOrfaos(prev => prev.filter(o => o.id !== id));
        } catch (e) {
            console.error(e);
            showNotice('Não foi possível excluir o card antigo.');
        }
    };

    const handleSaveEvent = async (eventData: CalendarEvent) => {
        if (isSaving) return;
        setIsSaving(true);
        setModalError('');
        try {
            const { id, ...data } = eventData;
            await db.collection('empresas').doc(empresaId).collection('events').doc(id).update(stripUndefined(data));
            setSelectedEvent(null);
        } catch (error) {
            console.error('Erro ao salvar evento:', error);
            setModalError('Não foi possível salvar. Confira sua conexão e tente de novo.');
            return;
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteEvent = async (eventId: string) => {
        if (isSaving) return;
        setIsSaving(true);
        setModalError('');
        try {
            await db.collection('empresas').doc(empresaId).collection('events').doc(eventId).delete();
            // O espelho em Agenciaapk tambem precisa sair, senao o post continua
            // gravado la depois de excluido na agenda.
            await db.collection('empresas').doc(empresaId).collection('Agenciaapk').doc(eventId).delete().catch(() => {});
            setSelectedEvent(null);
        } catch (error) {
            console.error('Erro ao excluir evento:', error);
            setModalError('Não foi possível excluir. Tente novamente.');
            return;
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-96 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-10 h-10 text-[#FABE01] animate-spin" />
                <p className="text-zinc-500 text-sm">Carregando quadro...</p>
            </div>
        );
    }

    if (boardError) {
        return (
            <div className="h-96 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <AlertTriangle className="w-10 h-10 text-red-400" />
                <p className="text-zinc-300 max-w-md">{boardError}</p>
            </div>
        );
    }

    const controle = "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors";

    return (
        <div className="text-zinc-100 font-sans flex flex-col relative min-h-[70vh] lg:h-[calc(100dvh-13rem)]">
            <header className="mb-5 shrink-0 flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
                        <span className="w-1.5 h-7 rounded-full bg-[#FABE01] shrink-0" />
                        Produção
                    </h1>
                    <p className="text-zinc-400 mt-1.5 text-sm">
                        O status de cada conteúdo da agenda. Arraste para mudar; clique para ver subtarefas e
                        responsáveis.
                    </p>
                </div>
                {/* O caminho de criar aponta para o calendario, o unico lugar onde
                    conteudo nasce - em vez do "Adicionar Card" que criava um card
                    sem post e sem serventia. */}
                {onIrParaCalendario && (
                    <button
                        onClick={onIrParaCalendario}
                        className="shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-full bg-[#FABE01] text-black hover:bg-[#FABE01]/90 transition-colors"
                    >
                        <CalendarPlus className="w-4 h-4" /> Novo conteúdo
                    </button>
                )}
            </header>

            {/* SOBRAS DO MODELO ANTIGO. */}
            {orfaos.length > 0 && (
                <div className="shrink-0 mb-4 bg-amber-500/5 border border-amber-500/20 rounded-card p-4">
                    <p className="text-xs text-amber-400 font-semibold mb-1 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {orfaos.length} card{orfaos.length > 1 ? 's' : ''} do modelo antigo
                    </p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
                        Foram criados direto na produção, sem post na agenda — por isso não têm data, legenda nem
                        prazo, e não aparecem mais no quadro. Recrie no calendário o que ainda importa e apague o resto.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {orfaos.map(o => (
                            <span key={o.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full pl-3 pr-1.5 py-1 text-xs text-zinc-200">
                                {o.title}
                                <button
                                    onClick={() => removerOrfao(o.id)}
                                    aria-label={`Excluir card antigo ${o.title}`}
                                    className="p-1 rounded-full text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* BARRA DE FILTROS */}
            <div className="shrink-0 mb-4 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="relative w-full lg:max-w-xs">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por título..."
                        aria-label="Buscar conteúdos por título"
                        className="w-full bg-[#1A1A1A] border border-white/10 rounded-control py-2 pl-9 pr-9 text-sm text-white placeholder:text-zinc-600 focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] outline-none transition-all"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} aria-label="Limpar busca" className="absolute right-2 top-2 p-0.5 text-zinc-500 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <button
                    onClick={() => setSoAtencao(v => !v)}
                    aria-pressed={soAtencao}
                    className={`${controle} ${soAtencao
                        ? 'bg-red-500/15 text-red-400 border-red-500/30'
                        : 'text-zinc-400 border-white/10 hover:text-zinc-200'}`}
                >
                    <Clock className="w-3.5 h-3.5" /> Prazo estourando
                </button>

                {availableTypes.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 lg:pb-0">
                        <Filter className="w-4 h-4 text-zinc-500 shrink-0" />
                        <button
                            onClick={() => setTypeFilter('todos')}
                            className={`${controle} uppercase tracking-wide ${
                                typeFilter === 'todos'
                                    ? 'bg-white/10 text-white border-white/20'
                                    : 'text-zinc-500 border-white/5 hover:text-zinc-300'
                            }`}
                        >
                            Todos
                        </button>
                        {availableTypes.map(type => {
                            const styles = getTypeStyles(type === 'Sem formato' ? '' : type);
                            const active = typeFilter === type;
                            return (
                                <button
                                    key={type}
                                    onClick={() => setTypeFilter(active ? 'todos' : type)}
                                    aria-pressed={active}
                                    className={`${controle} uppercase tracking-wide ${
                                        active
                                            ? `${styles.bg} ${styles.text} ${styles.border}`
                                            : 'text-zinc-500 border-white/5 hover:text-zinc-300'
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${styles.dot}`} />
                                    {type}
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="flex items-center gap-3 lg:ml-auto shrink-0">
                    <label className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={hideEmptyColumns}
                            onChange={(e) => setHideEmptyColumns(e.target.checked)}
                            className="accent-[#FABE01]"
                        />
                        <Layers className="w-3.5 h-3.5" />
                        Ocultar colunas vazias
                    </label>
                    {isFiltering && (
                        <button onClick={clearFilters} className="text-xs font-bold text-[#FABE01] hover:underline shrink-0">
                            Limpar filtros
                        </button>
                    )}
                </div>
            </div>

            {isFiltering && (
                <p className="shrink-0 mb-3 text-xs text-zinc-500">
                    Exibindo <span className="text-white font-bold">{visibleEvents.length}</span> de {events.length} conteúdos
                </p>
            )}

            {notice && (
                <div className="shrink-0 mb-3 flex items-start gap-2 text-sm text-[#FABE01] border border-[#FABE01]/20 bg-[#FABE01]/5 rounded-control px-4 py-3">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="flex-1">{notice}</span>
                    <button onClick={() => setNotice('')} aria-label="Fechar aviso" className="text-[#FABE01]/60 hover:text-[#FABE01] shrink-0">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {events.length === 0 && (
                <div className="shrink-0 py-14 px-6 text-center border border-dashed border-white/10 rounded-card">
                    <Layout className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-300 font-bold mb-1">Nenhum conteúdo na agenda</p>
                    <p className="text-zinc-500 text-sm max-w-md mx-auto leading-relaxed">
                        O quadro acompanha o que existe no Calendário Editorial. Crie a publicação lá e ela aparece
                        aqui na hora.
                    </p>
                    {onIrParaCalendario && (
                        <button
                            onClick={onIrParaCalendario}
                            className="mt-6 inline-flex items-center gap-2 bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-semibold text-sm px-5 py-2.5 rounded-full transition-colors"
                        >
                            <CalendarPlus className="w-4 h-4" /> Ir para o calendário
                        </button>
                    )}
                </div>
            )}

            {isFiltering && visibleEvents.length === 0 && events.length > 0 && (
                <div className="shrink-0 py-14 px-6 text-center border border-dashed border-white/10 rounded-card">
                    <Search className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-300 font-bold mb-1">Nenhum conteúdo corresponde ao filtro</p>
                    <button onClick={clearFilters} className="mt-4 inline-flex items-center gap-2 bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-bold text-sm px-5 py-2.5 rounded-control uppercase tracking-wide transition-colors">
                        Limpar filtros
                    </button>
                </div>
            )}

            <div className={`flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar pb-4 ${events.length === 0 || (isFiltering && visibleEvents.length === 0) ? 'hidden' : ''}`}>
                <div className="flex gap-5 h-full items-start min-w-max px-1">
                    {COLUMNS.map((col, colIndex) => {
                        const columnEvents = visibleEvents.filter(e => e.status === col.id);
                        // Colunas vazias so somem por escolha explicita: escondê-las
                        // sempre tiraria o destino do arraste.
                        if (hideEmptyColumns && columnEvents.length === 0) return null;
                        return (
                            <div
                                key={col.id}
                                className="w-[85vw] max-w-[320px] sm:w-[330px] sm:max-w-none shrink-0 bg-[#1A1A1A] rounded-card flex flex-col max-h-full border border-white/5"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, col.id)}
                            >
                                <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${col.accentColor}`} />
                                        <h3 className="font-bold text-white text-sm tracking-tight truncate">{col.title}</h3>
                                    </div>
                                    <span className="bg-white/5 text-zinc-400 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0">
                                        {columnEvents.length}
                                    </span>
                                </div>

                                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
                                    {columnEvents.length === 0 && (
                                        <p className="text-[11px] text-zinc-600 text-center py-6">
                                            Arraste um conteúdo para cá
                                        </p>
                                    )}

                                    {columnEvents.map(event => {
                                        const styles = getTypeStyles(event.type);
                                        const sla = slaAtual(event);
                                        const subs = subsPorEvento[event.id] || [];
                                        const prog = progresso(subs);
                                        const responsaveis = pessoasDeUids(event.responsaveis, indice);
                                        return (
                                            <div
                                                key={event.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, event.id)}
                                                onDragEnd={handleDragEnd}
                                                onClick={() => setSelectedEvent(event)}
                                                className={`bg-[#111111] border border-white/10 border-l-[3px] ${styles.border} p-3.5 rounded-card hover:border-[#FABE01]/50 transition-colors group cursor-pointer`}
                                            >
                                                <div className="flex items-start gap-2 mb-2.5">
                                                    <GripVertical className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5 hidden group-hover:block cursor-grab" />
                                                    <p className="text-sm font-medium text-white leading-snug break-words flex-1">
                                                        {event.title}
                                                    </p>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-chip uppercase tracking-widest ${styles.label}`}>
                                                        {event.type || 'Sem formato'}
                                                    </span>
                                                    {/* PRAZO no lugar da etiqueta "na agenda": agora
                                                        TODO card esta na agenda, entao dizer isso nao
                                                        informa nada. O que informa e quanto falta. */}
                                                    {sla && (
                                                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-chip border flex items-center gap-1 ${slaClasses(sla.tone)}`}>
                                                            <Clock className="w-2.5 h-2.5" /> {sla.label}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2.5">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                                                            {event.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                        </span>
                                                        {prog.total > 0 && (
                                                            <span
                                                                title={`${prog.feitas} de ${prog.total} subtarefas concluídas`}
                                                                className={`text-[10px] flex items-center gap-1 shrink-0 ${
                                                                    prog.feitas === prog.total ? 'text-emerald-400' : 'text-zinc-400'
                                                                }`}
                                                            >
                                                                <ListChecks className="w-3 h-3" />
                                                                {prog.feitas}/{prog.total}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <AvatarGroup pessoas={responsaveis} tamanho="xs" limite={3} anelClasse="ring-[#111111]" />
                                                        <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                            {colIndex > 0 && (
                                                                <button onClick={(e) => moveEvent(event.id, COLUMNS[colIndex - 1].id, e)} className="p-1 text-zinc-400 hover:text-[#FABE01] bg-white/5 hover:bg-white/10 rounded-control transition-colors" title="Mover para esquerda">
                                                                    <ArrowLeft className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                            {colIndex < COLUMNS.length - 1 && (
                                                                <button onClick={(e) => moveEvent(event.id, COLUMNS[colIndex + 1].id, e)} className="p-1 text-zinc-400 hover:text-[#FABE01] bg-white/5 hover:bg-white/10 rounded-control transition-colors" title="Mover para direita">
                                                                    <ArrowRight className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {selectedEvent && (
                <EventDetailModal
                    event={selectedEvent}
                    onSave={handleSaveEvent}
                    onDelete={handleDeleteEvent}
                    onClose={() => { setSelectedEvent(null); setModalError(''); }}
                    // O quadro e sobre producao: abre onde o trabalho e dividido.
                    abaInicial="gestao"
                    isSaving={isSaving}
                    errorMessage={modalError}
                    empresaId={empresaId}
                    userRole="agencia"
                    // Cai para o e-mail da sessao quando o pai nao passa: o quadro
                    // tambem e aberto de contextos que nao carregam o perfil.
                    userEmail={userEmail || auth.currentUser?.email}
                    userName={userName}
                />
            )}
        </div>
    );
};

export default ClientProductionView;
