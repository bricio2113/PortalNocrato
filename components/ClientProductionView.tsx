import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../utils/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import {
    Loader2, Plus, Trash2, Layout,
    ArrowRight, ArrowLeft, GripVertical, Search, X,
    Link2, AlertTriangle, Filter, Layers
} from 'lucide-react';
import EventDetailModal from './EventDetailModal';
import { CalendarEvent } from '../types';
import { FORMATO_OPTIONS } from '../constants';
import { getTypeStyles, STATUS_ACCENTS } from '../utils/eventStyles';
import { stripUndefined } from '../utils/firestore';

interface KanbanTask {
    id: string;
    title: string;
    status: string;
    createdAt: Date;
    eventId?: string;
    /** Formato herdado do evento. Cards antigos e manuais nao tem. */
    type?: string;
    plataforma?: string;
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
}

const ClientProductionView: React.FC<ClientProductionViewProps> = ({ empresaId, userEmail, userName }) => {
    const [tasks, setTasks] = useState<KanbanTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

    // Carregar UM evento nao pode desmontar o quadro inteiro; por isso este
    // estado e separado do isLoading da lista.
    const [isOpeningCard, setIsOpeningCard] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [modalError, setModalError] = useState('');
    const [boardError, setBoardError] = useState('');
    const [notice, setNotice] = useState('');

    // Filtros. Sem eles as sete colunas somam ~2400px de rolagem horizontal e
    // achar um post especifico depende de varrer o quadro com o olho.
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('todos');
    const [hideEmptyColumns, setHideEmptyColumns] = useState(false);

    useEffect(() => {
        if (!empresaId) return;
        // Tempo real: com dois membros da equipe no mesmo quadro, um movia o
        // card e o outro so descobria recarregando.
        setIsLoading(true);

        const unsubscribe = db.collection('empresas').doc(empresaId).collection('kanban_tasks')
            .orderBy('createdAt', 'desc')
            .onSnapshot(
                snapshot => {
                    setTasks(snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        createdAt: doc.data().createdAt?.toDate() || new Date()
                    } as KanbanTask)));
                    setIsLoading(false);
                },
                error => {
                    console.error("Erro ao buscar tarefas Kanban:", error);
                    setBoardError('Não foi possível carregar o quadro. Verifique sua conexão e recarregue a página.');
                    setIsLoading(false);
                }
            );

        return unsubscribe;
    }, [empresaId]);

    // Mensagem efemera para acoes que nao tem onde aparecer no card.
    const showNotice = (msg: string) => {
        setNotice(msg);
        setTimeout(() => setNotice(''), 5000);
    };

    const visibleTasks = useMemo(() => {
        const term = search.trim().toLowerCase();
        return tasks.filter(task => {
            if (typeFilter !== 'todos') {
                // Cards sem formato (manuais ou anteriores a esta versao) caem em
                // "Sem formato" em vez de desaparecerem sem explicacao.
                const taskType = task.type || 'Sem formato';
                if (taskType !== typeFilter) return false;
            }
            if (term && !task.title.toLowerCase().includes(term)) return false;
            return true;
        });
    }, [tasks, search, typeFilter]);

    const isFiltering = search.trim() !== '' || typeFilter !== 'todos';

    // Formatos realmente presentes no quadro. Oferecer filtro para formato que
    // nao existe ali so gera resultado vazio.
    const availableTypes = useMemo(() => {
        const present = new Set(tasks.map(t => t.type || 'Sem formato'));
        const ordered = FORMATO_OPTIONS.filter(f => present.has(f)) as string[];
        if (present.has('Sem formato')) ordered.push('Sem formato');
        return ordered;
    }, [tasks]);

    const clearFilters = () => { setSearch(''); setTypeFilter('todos'); };

    const handleAddTask = async (e: React.FormEvent, status: string) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;
        const newTask = {
            title: newTaskTitle.trim(),
            status: status,
            createdAt: new Date()
        };
        try {
            await db.collection('empresas').doc(empresaId).collection('kanban_tasks').add(newTask);
            setAddingToColumn(null);
            setNewTaskTitle('');
        } catch (error) {
            console.error("Erro ao adicionar tarefa:", error);
            showNotice('Não foi possível adicionar o card. Tente novamente.');
        }
    };

    const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("Excluir este card?")) return;
        try {
            await db.collection('empresas').doc(empresaId).collection('kanban_tasks').doc(taskId).delete();
        } catch (error) {
            console.error("Erro ao excluir:", error);
            showNotice('Não foi possível excluir o card.');
        }
    };

    const moveTask = async (taskId: string, newStatus: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const taskToMove = tasks.find(t => t.id === taskId);
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
        
        try {
            await db.collection('empresas').doc(empresaId).collection('kanban_tasks').doc(taskId).update({ status: newStatus });
            // Se o card está vinculado à agenda, atualizamos a base do calendário
            if (taskToMove && taskToMove.eventId) {
                await db.collection('empresas').doc(empresaId).collection('events').doc(taskToMove.eventId).update({ status: newStatus });
            }
        } catch (error) {
            console.error("Erro ao mover:", error);
            // Desfaz o movimento otimista usando o status capturado antes da
            // troca, e avisa - antes o card voltava sozinho sem explicacao.
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: taskToMove?.status || 'Pendente' } : t));
            showNotice('Não foi possível mover o card. O status anterior foi restaurado.');
        }
    };

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        e.dataTransfer.setData('taskId', taskId);
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
        const taskId = e.dataTransfer.getData('taskId');
        if (taskId) moveTask(taskId, status);
    };

    const handleTaskClick = async (task: KanbanTask) => {
        if (!task.eventId) {
            // Era um alert() nativo que travava a pagina para dar um recado.
            showNotice('Este card foi criado direto na produção e não tem post na agenda. Crie-o no Calendário para editar legenda e links.');
            return;
        }

        // Antes usava setIsLoading, o mesmo estado da carga inicial: clicar num
        // card fazia o quadro inteiro desaparecer e voltar.
        setIsOpeningCard(true);
        setModalError('');
        try {
            const eventDoc = await db.collection('empresas').doc(empresaId).collection('events').doc(task.eventId).get();
            if (eventDoc.exists) {
                const data = eventDoc.data();
                setSelectedEvent({
                    id: eventDoc.id,
                    ...data,
                    date: data?.date?.toDate() || new Date()
                } as CalendarEvent);
            } else {
                showNotice('O post correspondente não existe mais na agenda. Você pode excluir este card.');
            }
        } catch (error) {
            console.error("Erro ao buscar evento:", error);
            showNotice('Não foi possível abrir o post. Tente novamente.');
        } finally {
            setIsOpeningCard(false);
        }
    };

    // Mesma correcao do calendario: erro nao pode fechar o modal em silencio,
    // senao o usuario acredita que salvou.
    const handleSaveEvent = async (eventData: CalendarEvent) => {
        if (isSaving) return;
        setIsSaving(true);
        setModalError('');
        try {
            const { id, ...data } = eventData;
            await db.collection('empresas').doc(empresaId).collection('events').doc(id).update(stripUndefined(data));

            const task = tasks.find(t => t.eventId === id);
            if (task) {
                // Inclui type/plataforma para o card nao ficar com o formato antigo
                // depois de o post mudar de formato.
                await db.collection('empresas').doc(empresaId).collection('kanban_tasks').doc(task.id).update({
                    title: eventData.title,
                    status: eventData.status,
                    type: eventData.type,
                    plataforma: eventData.plataforma
                });
                setTasks(prev => prev.map(t => t.id === task.id
                    ? { ...t, title: eventData.title, status: eventData.status, type: eventData.type, plataforma: eventData.plataforma }
                    : t));
            }
            setSelectedEvent(null);
        } catch (error) {
            console.error("Erro ao salvar evento:", error);
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
            const task = tasks.find(t => t.eventId === eventId);
            if (task) {
                await db.collection('empresas').doc(empresaId).collection('kanban_tasks').doc(task.id).delete();
                setTasks(prev => prev.filter(t => t.id !== task.id));
            }
            setSelectedEvent(null);
        } catch (error) {
            console.error("Erro ao excluir evento:", error);
            setModalError('Não foi possível excluir. Tente novamente.');
            return;
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading && !selectedEvent) {
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

    return (
        <div className="text-zinc-100 font-sans flex flex-col relative min-h-[70vh] lg:h-[calc(100dvh-13rem)]">
            <header className="mb-6 shrink-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                    <Layout className="w-8 h-8 text-[#FABE01]" />
                    Quadro de Tarefas
                </h1>
                <p className="text-zinc-400 mt-2 text-sm">
                    Acompanhe e movimente o status. Clique nos cards da agenda para editar o conteúdo e legenda.
                </p>
            </header>

            {/* BARRA DE FILTROS */}
            <div className="shrink-0 mb-4 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="relative w-full lg:max-w-xs">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por título..."
                        aria-label="Buscar cards por título"
                        className="w-full bg-[#1A1A1A] border border-white/10 rounded-control py-2 pl-9 pr-9 text-sm text-white placeholder:text-zinc-600 focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] outline-none transition-all"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} aria-label="Limpar busca" className="absolute right-2 top-2 p-0.5 text-zinc-500 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Filtro por formato, com a mesma cor usada no card e na agenda. */}
                {availableTypes.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 lg:pb-0">
                        <Filter className="w-4 h-4 text-zinc-500 shrink-0" />
                        <button
                            onClick={() => setTypeFilter('todos')}
                            className={`shrink-0 px-3 py-1.5 rounded-control text-xs font-bold uppercase tracking-wide border transition-colors ${
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
                                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-bold uppercase tracking-wide border transition-colors ${
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
                    {/* Com sete colunas fixas, esconder as vazias encurta bastante a
                        rolagem horizontal quando o quadro esta filtrado. */}
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
                    Exibindo <span className="text-white font-bold">{visibleTasks.length}</span> de {tasks.length} cards
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

            {tasks.length === 0 && (
                <div className="shrink-0 py-14 px-6 text-center border border-dashed border-white/10 rounded-card">
                    <Layout className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-300 font-bold mb-1">O quadro ainda está vazio</p>
                    <p className="text-zinc-500 text-sm max-w-md mx-auto leading-relaxed">
                        Publicações criadas no Calendário Editorial aparecem aqui automaticamente. Você também pode adicionar um card direto em qualquer coluna.
                    </p>
                </div>
            )}

            {isFiltering && visibleTasks.length === 0 && tasks.length > 0 && (
                <div className="shrink-0 py-14 px-6 text-center border border-dashed border-white/10 rounded-card">
                    <Search className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-300 font-bold mb-1">Nenhum card corresponde ao filtro</p>
                    <button onClick={clearFilters} className="mt-4 inline-flex items-center gap-2 bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-bold text-sm px-5 py-2.5 rounded-control uppercase tracking-wide transition-colors">
                        Limpar filtros
                    </button>
                </div>
            )}

            <div className={`flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar pb-4 ${tasks.length === 0 || (isFiltering && visibleTasks.length === 0) ? 'hidden' : ''}`}>
                <div className="flex gap-6 h-full items-start min-w-max px-1">
                    {COLUMNS.map((col, colIndex) => {
                        const columnTasks = visibleTasks.filter(t => t.status === col.id);
                        // Colunas vazias so somem por escolha explicita: escondê-las
                        // sempre tiraria o destino do arraste.
                        if (hideEmptyColumns && columnTasks.length === 0) return null;
                        return (
                            <div key={col.id} className="w-[85vw] max-w-[320px] sm:w-[340px] sm:max-w-none shrink-0 bg-[#1A1A1A] rounded-card flex flex-col max-h-full border border-white/5" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, col.id)}>
                                <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#111111]/50 rounded-t-card">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full ${col.accentColor}`} />
                                        <h3 className="font-bold text-white tracking-wide truncate">{col.title}</h3>
                                    </div>
                                    <span className="bg-white/10 text-zinc-300 text-xs font-bold px-2 py-1 rounded-full">{columnTasks.length}</span>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                                    {columnTasks.map(task => {
                                        const styles = getTypeStyles(task.type);
                                        const hasType = Boolean(task.type);
                                        return (
                                        <div
                                            key={task.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, task.id)}
                                            onDragEnd={handleDragEnd}
                                            onClick={() => handleTaskClick(task)}
                                            // Faixa lateral na cor do formato: da para reconhecer
                                            // Reel / Post / Story de relance, sem ler a etiqueta.
                                            className={`bg-[#111111] border border-white/10 border-l-4 ${hasType ? styles.border : 'border-l-zinc-700'} p-4 rounded-card shadow-sm hover:border-[#FABE01]/50 transition-colors group cursor-grab active:cursor-grabbing`}
                                        >
                                            <div className="flex items-start gap-2 mb-3">
                                                <GripVertical className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5 hidden group-hover:block" />
                                                <p className="text-sm font-medium text-white leading-relaxed break-words flex-1">
                                                    {task.title}
                                                </p>
                                                <button onClick={(e) => handleDeleteTask(task.id, e)} className="text-zinc-600 hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0" title="Excluir card" aria-label={`Excluir card ${task.title}`}>
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {/* ETIQUETAS: formato, plataforma e vinculo com a agenda */}
                                            <div className="flex flex-wrap items-center gap-1.5 mb-3">
                                                {hasType ? (
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-control uppercase tracking-widest ${styles.label}`}>
                                                        {task.type}
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-control uppercase tracking-widest bg-white/5 text-zinc-500">
                                                        Sem formato
                                                    </span>
                                                )}
                                                {task.plataforma && (
                                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-control uppercase tracking-wider bg-white/5 text-zinc-400">
                                                        {task.plataforma}
                                                    </span>
                                                )}
                                                {/* Distingue card com post na agenda de card criado a mao:
                                                    antes so descobria clicando e levando um alert(). */}
                                                {task.eventId ? (
                                                    <span className="flex items-center gap-1 text-[9px] font-medium text-zinc-500" title="Vinculado a um post do calendário">
                                                        <Link2 className="w-3 h-3" /> Na agenda
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-medium text-zinc-600" title="Card criado direto na produção">
                                                        Só produção
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-auto">
                                                <div className="text-[10px] text-zinc-600 font-mono">
                                                    {task.createdAt.toLocaleDateString('pt-BR')}
                                                </div>
                                                <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    {colIndex > 0 && (
                                                        <button onClick={(e) => moveTask(task.id, COLUMNS[colIndex - 1].id, e)} className="p-1.5 text-zinc-400 hover:text-[#FABE01] bg-white/5 hover:bg-white/10 rounded-control transition-colors" title="Mover para esquerda">
                                                            <ArrowLeft className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {colIndex < COLUMNS.length - 1 && (
                                                        <button onClick={(e) => moveTask(task.id, COLUMNS[colIndex + 1].id, e)} className="p-1.5 text-zinc-400 hover:text-[#FABE01] bg-white/5 hover:bg-white/10 rounded-control transition-colors" title="Mover para direita">
                                                            <ArrowRight className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        );
                                    })}

                                    {addingToColumn === col.id ? (
                                        <form onSubmit={(e) => handleAddTask(e, col.id)} className="bg-[#111111] border border-[#FABE01] p-3 rounded-control shadow-lg animate-in fade-in zoom-in-95">
                                            <textarea autoFocus value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="O que precisa ser feito?" className="w-full bg-transparent text-sm text-white resize-none outline-none border-none p-0 mb-3 placeholder:text-zinc-600" rows={3} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddTask(e as any, col.id); } }} />
                                            <div className="flex items-center justify-between">
                                                <button type="button" onClick={() => { setAddingToColumn(null); setNewTaskTitle(''); }} className="text-xs font-bold text-zinc-500 hover:text-white px-2 py-1">Cancelar</button>
                                                <button type="submit" disabled={!newTaskTitle.trim()} className="bg-[#FABE01] text-black text-xs font-bold px-3 py-1.5 rounded-control disabled:opacity-50">Adicionar</button>
                                            </div>
                                        </form>
                                    ) : (
                                        <button onClick={() => setAddingToColumn(col.id)} className="w-full py-3 flex items-center justify-center gap-2 text-sm font-medium text-zinc-500 hover:text-white hover:bg-white/5 rounded-control transition-colors border border-dashed border-transparent hover:border-white/20">
                                            <Plus className="w-4 h-4" /> Adicionar Card
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            {/* Feedback de "abrindo card" sem desmontar o quadro. */}
            {isOpeningCard && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#1A1A1A] border border-white/10 rounded-full px-4 py-2 shadow-2xl">
                    <Loader2 className="w-4 h-4 text-[#FABE01] animate-spin" />
                    <span className="text-xs text-zinc-300 font-medium">Abrindo publicação...</span>
                </div>
            )}

            {selectedEvent && (
                <EventDetailModal
                    event={selectedEvent}
                    onSave={handleSaveEvent}
                    onDelete={handleDeleteEvent}
                    onClose={() => { setSelectedEvent(null); setModalError(''); }}
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