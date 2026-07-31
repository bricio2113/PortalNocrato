import React, { useState, useMemo, useEffect } from 'react';
import { CalendarEvent } from '../types';
import EventDetailModal from './EventDetailModal';
import { db } from '../utils/firebase';
import { getTypeStyles } from '../utils/eventStyles';
import { getClientStage, CLIENT_STAGES } from '../utils/eventState';
import { stripUndefined } from '../utils/firestore';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Loader2, FileText, Instagram, LayoutList, Grid3x3, AlertTriangle } from 'lucide-react';

interface CalendarViewProps {
    empresaId: string;
    userRole?: 'agencia' | 'cliente';
    userEmail?: string | null;
    userName?: string | null;
}

// A grade mensal precisa de 1200px para caber sete colunas legiveis, o que no
// celular vira rolagem horizontal - ruim como primeira impressao. Em telas
// pequenas a lista abre por padrao; o usuario ainda pode trocar para a grade.
const prefersListView = () => typeof window !== 'undefined' && window.innerWidth < 768;

const CalendarView: React.FC<CalendarViewProps> = ({ empresaId, userRole = 'agencia', userEmail, userName }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => (prefersListView() ? 'list' : 'grid'));

    const getDaysInMonth = (year: number, month: number) => {
        const date = new Date(year, month, 1);
        const days = [];
        while (date.getMonth() === month) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return days;
    };

    const generateCalendarGrid = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const startDayOfWeek = firstDayOfMonth.getDay();
        const daysInMonth = getDaysInMonth(year, month);
        const days = [];
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(null);
        }
        days.push(...daysInMonth);
        return days;
    };

    const calendarDays = useMemo(() => generateCalendarGrid(), [currentDate]);

    // Copia de leitura em `Agenciaapk`. Usa set+merge, nao update: o update
    // falhava para todo evento criado antes desta colecao existir, porque
    // update() exige documento presente.
    //
    // Este espelho e uma segunda fonte de verdade do mesmo post e nao tem
    // nenhum leitor no app; ver nota no relatorio sobre remove-lo.
    const espelharPost = async (id: string, titulo: string, conteudo: string, data_agendada: Date) => {
        try {
            await db.collection('empresas').doc(empresaId).collection('Agenciaapk').doc(id)
                .set({ titulo, conteudo, data_agendada }, { merge: true });
        } catch (error) { console.error('Falha ao espelhar post:', error); }
    };

    // Tempo real em vez de leitura unica.
    //
    // Com .get() a agencia e o cliente trabalhavam sobre fotografias diferentes
    // do mesmo calendario: quem tinha a aba aberta nao via a publicacao nova, e
    // dois editores sobrescreviam um ao outro sem aviso.
    //
    // O seed de posts de exemplo foi REMOVIDO daqui de proposito. Duas razoes:
    // as novas regras nao deixam o cliente criar evento, entao para ele o seed
    // so produziria erro de permissao; e semear post ficticio no calendario de
    // um cliente pagante passa descuido - ou pior, ele acredita que esta
    // realmente agendado. O empty state ja orienta a proxima acao.
    useEffect(() => {
        if (!empresaId) return;
        setIsLoading(true);
        setLoadError('');

        const unsubscribe = db.collection('empresas').doc(empresaId).collection('events')
            .onSnapshot(
                snapshot => {
                    const eventsData = snapshot.docs.map(doc => {
                        const data = doc.data();
                        // Spread condicional em vez de `metrics: ... : undefined`.
                        //
                        // A forma antiga CRIAVA a chave com undefined, que viajava
                        // no spread do update() e derrubava a gravacao inteira com
                        // "Unsupported field value: undefined" - todo post que
                        //  nunca teve metrica falhava ao salvar.
                        return {
                            ...data,
                            id: doc.id,
                            date: (data.date as firebase.firestore.Timestamp)?.toDate() || new Date(),
                            approvalAt: (data.approvalAt as firebase.firestore.Timestamp | undefined)?.toDate() || null,
                            coverResolvedAt: (data.coverResolvedAt as firebase.firestore.Timestamp | undefined)?.toDate() || null,
                            ...(data.metrics
                                ? {
                                    metrics: {
                                        ...data.metrics,
                                        atualizadoEm: (data.metrics.atualizadoEm as firebase.firestore.Timestamp | undefined)?.toDate() || null
                                    }
                                }
                                : {})
                        } as CalendarEvent;
                    });
                    setEvents(eventsData.sort((a, b) => a.date.getTime() - b.date.getTime()));
                    setIsLoading(false);
                },
                error => {
                    console.error(error);
                    setLoadError('Não foi possível carregar os agendamentos. Verifique sua conexão e tente novamente.');
                    setIsLoading(false);
                }
            );

        return unsubscribe;
    }, [empresaId]);

    // Atalho local: o estagio combina status e aprovacao, e e consultado em dois
    // lugares da renderizacao.
    const stageOf = (event: CalendarEvent) => getClientStage(event);

    const handleAddNewEventClick = () => {
        setSelectedEvent({ id: '', date: new Date(), title: 'Nova Publicação', type: 'Post', status: 'Pendente', proprietario: null, plataforma: 'Instagram', url: '', finalUrl: '', copy: '', description: '' });
    };

    const handleCreateEventForDate = (date: Date) => {
        setSelectedEvent({ id: '', date: date, title: '', type: 'Post', status: 'Pendente', proprietario: null, plataforma: 'Instagram', url: '', finalUrl: '', copy: '', description: '' });
    };

    // Erros aqui eram apenas logados no console e o modal fechava de qualquer
    // forma - o usuario via a tela fechar e presumia que gravou. Agora a falha
    // mantem o modal aberto com a mensagem, para nao perder o que foi digitado.
    const handleSaveEvent = async (eventData: CalendarEvent) => {
        if (isSaving) return; // evita duplicar o evento com dois cliques
        setIsSaving(true);
        setSaveError('');

        if (eventData.id) {
            try {
                const { id, ...data } = eventData;
                await db.collection('empresas').doc(empresaId).collection('events').doc(eventData.id).update(stripUndefined(data));
                await espelharPost(eventData.id, eventData.title, eventData.copy || '', eventData.date);
                // Sem setEvents: o onSnapshot ja reflete a escrita, inclusive
                // pelo cache local do Firestore. Duplicar aqui podia inserir
                // dois itens com o mesmo id por um instante.

                // Sincroniza titulo e status com o card do Kanban.
                //
                // O vinculo e SEMPRE por eventId. Casar por titulo corromperia
                // posts homonimos ("Story institucional" etc.), que sao a regra
                // numa agencia, nao a excecao.
                const tasksRef = db.collection('empresas').doc(empresaId).collection('kanban_tasks');
                const tasksSnapshot = await tasksRef.where('eventId', '==', eventData.id).get();

                if (tasksSnapshot.empty) {
                    // Evento anterior ao Kanban: cria o card que faltava em vez
                    // de sequestrar o de outro post.
                    await tasksRef.add({
                        title: eventData.title || 'Nova Publicação',
                        status: eventData.status,
                        createdAt: new Date(),
                        eventId: eventData.id,
                        type: eventData.type,
                        plataforma: eventData.plataforma
                    });
                } else {
                    // type e plataforma tambem viajam para o card: sem eles o
                    // quadro de producao nao tem como colorir nem filtrar por
                    // formato, e o card fica dessincronizado se o formato muda.
                    await Promise.all(tasksSnapshot.docs.map(doc => doc.ref.update({
                        title: eventData.title || 'Nova Publicação',
                        status: eventData.status,
                        type: eventData.type,
                        plataforma: eventData.plataforma
                    })));
                }
            } catch (e) {
                console.error(e);
                setSaveError('Não foi possível salvar as alterações. Confira sua conexão e tente de novo.');
                setIsSaving(false);
                return;
            }
        } else {
            try {
                const { id, ...data } = eventData;
                const docRef = await db.collection('empresas').doc(empresaId).collection('events').add(stripUndefined(data));
                await espelharPost(docRef.id, eventData.title, eventData.copy || '', eventData.date);

                // Cria o Card no Kanban com o status exato do modal
                await db.collection('empresas').doc(empresaId).collection('kanban_tasks').add({
                    title: eventData.title || 'Nova Publicação',
                    status: eventData.status,
                    createdAt: new Date(),
                    eventId: docRef.id,
                    type: eventData.type,
                    plataforma: eventData.plataforma
                });
            } catch (e) {
                console.error(e);
                setSaveError('Não foi possível criar o agendamento. Confira sua conexão e tente de novo.');
                setIsSaving(false);
                return;
            }
        }

        setIsSaving(false);
        setSelectedEvent(null);
    };

    const handleDeleteEvent = async (eventId: string) => {
        if (isSaving) return;
        setIsSaving(true);
        setSaveError('');
        try {
            const empresaRef = db.collection('empresas').doc(empresaId);

            await empresaRef.collection('events').doc(eventId).delete();
            await empresaRef.collection('Agenciaapk').doc(eventId).delete();

            // Sem isto o card continua no quadro apontando para um evento que
            // nao existe mais, e clicar nele so mostra "evento nao encontrado".
            const orphanTasks = await empresaRef.collection('kanban_tasks').where('eventId', '==', eventId).get();
            await Promise.all(orphanTasks.docs.map(doc => doc.ref.delete()));

            setSelectedEvent(null);
        } catch (e) {
            console.error(e);
            // alert() nativo travava a pagina e nao combinava com o resto da UI.
            setSaveError('Não foi possível excluir. Tente novamente.');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const handleToday = () => setCurrentDate(new Date());

    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    };

    const getEventsForMonth = () => {
        return events.filter(e => e.date.getMonth() === currentDate.getMonth() && e.date.getFullYear() === currentDate.getFullYear());
    };

    return (
        <div className="text-zinc-100 font-sans selection:bg-[#FABE01] selection:text-black">
            <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                        <CalendarIcon className="w-8 h-8 text-[#FABE01] shrink-0" />
                        Calendário Editorial
                    </h1>
                    <p className="text-zinc-400 mt-2 text-sm max-w-xl">
                        Planeje, agende e visualize todas as suas publicações.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="flex bg-[#1A1A1A] p-1 rounded-sm border border-white/10 w-full sm:w-auto">
                        <button onClick={() => setViewMode('grid')} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-sm transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><Grid3x3 className="w-4 h-4" /> <span className="sm:hidden md:inline">Grade</span></button>
                        <button onClick={() => setViewMode('list')} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-sm transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><LayoutList className="w-4 h-4" /> <span className="sm:hidden md:inline">Lista</span></button>
                    </div>
                    <button onClick={handleAddNewEventClick} className="bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-bold py-2.5 px-6 rounded-sm shadow-[0_0_20px_rgba(250,190,1,0.2)] transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wide w-full sm:w-auto">
                        <Plus className="w-5 h-5" /> Novo
                    </button>
                </div>
            </header>

            <div className="bg-[#111111] rounded-sm border border-white/5 shadow-2xl overflow-hidden">
                <header className="flex flex-col sm:flex-row justify-between items-center p-4 md:p-6 border-b border-white/5 bg-black/20 gap-4">
                    <h2 className="text-lg md:text-xl font-bold text-white capitalize flex items-center gap-2">
                        {currentDate.toLocaleString('pt-BR', { month: 'long' })}
                        <span className="text-zinc-500 font-normal">{currentDate.getFullYear()}</span>
                    </h2>
                    <div className="flex items-center bg-[#1A1A1A] rounded-sm border border-white/10 p-1 w-full sm:w-auto justify-between sm:justify-start">
                        <button onClick={handlePrevMonth} className="p-3 md:p-2 text-zinc-400 hover:text-white rounded-sm"><ChevronLeft className="w-5 h-5" /></button>
                        <button onClick={handleToday} className="px-6 md:px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-[#FABE01] border-x border-white/5 mx-1">Hoje</button>
                        <button onClick={handleNextMonth} className="p-3 md:p-2 text-zinc-400 hover:text-white rounded-sm"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                </header>

                {isLoading ? (
                    <div className="h-96 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-10 h-10 text-[#FABE01] animate-spin" />
                        <p className="text-zinc-500 text-sm">Carregando agendamentos...</p>
                    </div>
                ) : loadError ? (
                    <div className="h-96 flex flex-col items-center justify-center gap-4 px-6 text-center">
                        <AlertTriangle className="w-10 h-10 text-red-400" />
                        <p className="text-zinc-300 font-medium max-w-md">{loadError}</p>
                    </div>
                ) : (
                    <>
                        {viewMode === 'grid' && (
                            <div className="overflow-x-auto">
                                <div className="grid grid-cols-7 bg-[#1A1A1A] min-w-[840px] lg:min-w-[1100px]">
                                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                                        <div key={day} className="py-3 text-center text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-r border-white/5 bg-[#111111]">{day}</div>
                                    ))}
                                    {calendarDays.map((date, index) => {
                                        if (!date) return <div key={`empty-${index}`} className="bg-[#111111]/50 border-b border-r border-white/5 min-h-[96px] sm:min-h-[140px]" />;
                                        const dayEvents = events.filter(e => e.date.toDateString() === date.toDateString());
                                        const isTodayDate = isToday(date);
                                        return (
                                            <div key={date.toISOString()} className={`group relative min-h-[96px] sm:min-h-[140px] p-1.5 sm:p-2 border-b border-r border-white/5 flex flex-col transition-colors ${isTodayDate ? 'bg-[#FABE01]/5' : 'bg-[#111111] hover:bg-[#1A1A1A]'}`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isTodayDate ? 'bg-[#FABE01] text-black shadow-[0_0_10px_rgba(250,190,1,0.5)]' : 'text-zinc-500 group-hover:text-zinc-300'}`}>{date.getDate()}</span>
                                                    <button onClick={(e) => { e.stopPropagation(); handleCreateEventForDate(date); }} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 text-zinc-500 hover:text-[#FABE01] hover:bg-[#FABE01]/10 rounded-sm transition-all"><Plus className="w-4 h-4" /></button>
                                                </div>
                                                <div className="flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden custom-scrollbar">
                                                    {dayEvents.map(event => {
                                                        const styles = getTypeStyles(event.type);
                                                        return (
                                                            <div key={event.id} onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }} className={`cursor-pointer p-2 rounded-sm text-xs font-medium border-l-2 transition-colors h-auto ${styles.bg} ${styles.border} ${styles.text}`}>
                                                                <div className="flex items-start gap-1.5">
                                                                    <div className="mt-0.5 shrink-0">{event.plataforma === 'Instagram' ? <Instagram className="w-3 h-3 opacity-70" /> : <FileText className="w-3 h-3 opacity-70" />}</div>
                                                                    <div className="flex flex-col gap-1 w-full">
                                                                        <span className="leading-tight break-words whitespace-normal text-[11px]">{event.title || '(Sem título)'}</span>
                                                                        <div className="flex items-center gap-1 flex-wrap">
                                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-widest ${styles.label}`}>{event.type}</span>
                                                                            {/* Estagio direto no card: sem isso o contador do menu
                                                                                dizia "3 pendentes" e o usuario tinha que abrir post
                                                                                por post para descobrir quais. */}
                                                                            {stageOf(event) !== 'em_producao' && (
                                                                                <span
                                                                                    className={`w-2 h-2 rounded-full shrink-0 ${CLIENT_STAGES[stageOf(event)].dot}`}
                                                                                    title={CLIENT_STAGES[stageOf(event)].label}
                                                                                />
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
                        )}
                        {viewMode === 'list' && (
                            <div className="p-4 sm:p-6 min-h-[400px]">
                                {getEventsForMonth().length === 0 ? (
                                    // Empty state que aponta a proxima acao, em vez de so informar
                                    // que nao ha nada.
                                    <div className="text-center py-14 px-6 border border-dashed border-white/10 rounded-sm">
                                        <CalendarIcon className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                                        <p className="text-zinc-300 font-bold mb-1">
                                            Nada agendado em {currentDate.toLocaleString('pt-BR', { month: 'long' })}
                                        </p>
                                        <p className="text-zinc-500 text-sm max-w-sm mx-auto leading-relaxed">
                                            Crie a primeira publicação do mês ou use as setas acima para navegar até outro período.
                                        </p>
                                        <button
                                            onClick={handleAddNewEventClick}
                                            className="mt-6 inline-flex items-center gap-2 bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-bold text-sm px-5 py-2.5 rounded-sm uppercase tracking-wide transition-colors"
                                        >
                                            <Plus className="w-4 h-4" /> Criar publicação
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {calendarDays.filter(d => d !== null).map(date => {
                                            if (!date) return null;
                                            const dayEvents = events.filter(e => e.date.toDateString() === date.toDateString());
                                            if (dayEvents.length === 0) return null;
                                            return (
                                                <div key={date.toISOString()} className="bg-[#1A1A1A] border border-white/5 rounded-sm overflow-hidden">
                                                    <div className={`px-4 py-2 text-sm font-bold flex items-center justify-between ${isToday(date) ? 'bg-[#FABE01] text-black' : 'bg-black/40 text-zinc-400'}`}>
                                                        <span>{date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                                                        <button onClick={() => handleCreateEventForDate(date)} className="p-1 hover:bg-white/20 rounded-sm"><Plus className="w-4 h-4" /></button>
                                                    </div>
                                                    <div className="divide-y divide-white/5">
                                                        {dayEvents.map(event => {
                                                            const styles = getTypeStyles(event.type);
                                                            return (
                                                                <div key={event.id} onClick={() => setSelectedEvent(event)} className="p-4 hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-4">
                                                                    <div className={`p-2 rounded-full ${styles.bg} ${styles.text}`}>
                                                                        {event.plataforma === 'Instagram' ? <Instagram className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                                            <h4 className="text-white font-medium text-sm">{event.title || '(Sem título)'}</h4>
                                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-widest ${styles.label}`}>{event.type}</span>
                                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider border ${CLIENT_STAGES[stageOf(event)].bg} ${CLIENT_STAGES[stageOf(event)].text} ${CLIENT_STAGES[stageOf(event)].border}`}>
                                                                                {CLIENT_STAGES[stageOf(event)].label}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                                                                            {event.proprietario && <span>{event.proprietario}</span>}
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
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
            {selectedEvent && (
                <EventDetailModal
                    event={selectedEvent}
                    onSave={handleSaveEvent}
                    onDelete={handleDeleteEvent}
                    onClose={() => { setSelectedEvent(null); setSaveError(''); }}
                    isSaving={isSaving}
                    errorMessage={saveError}
                    empresaId={empresaId}
                    userRole={userRole}
                    userEmail={userEmail}
                />
            )}
        </div>
    );
};

export default CalendarView;