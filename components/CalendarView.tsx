import React, { useState, useMemo, useEffect } from 'react';
import { CalendarEvent } from '../types';
import { INITIAL_EVENTS } from '../constants';
import EventDetailModal from './EventDetailModal';
import { db } from '../utils/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

// Ícones Lucide
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Loader2, FileText, Instagram } from 'lucide-react';

interface CalendarViewProps {
    empresaId: string;
}

const CalendarView: React.FC<CalendarViewProps> = ({ empresaId }) => {
    // --- ESTADOS ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [postsDoCalendario, setPostsDoCalendario] = useState<any[]>([]);

    // --- FUNÇÕES AUXILIARES DE DATA ---
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
        const startDayOfWeek = firstDayOfMonth.getDay(); // 0 (Domingo) a 6 (Sábado)

        const daysInMonth = getDaysInMonth(year, month);
        const days = [];

        // Preencher dias vazios do mês anterior
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(null);
        }

        // Adicionar dias do mês atual
        days.push(...daysInMonth);

        return days;
    };

    const calendarDays = useMemo(() => generateCalendarGrid(), [currentDate]);

    // --- FIREBASE LOGIC ---
    const salvarPostPermanentemente = async (id: string, titulo: string, conteudo: string, data_agendada: Date) => {
        try {
            await db.collection('empresas').doc(empresaId).collection('Agenciaapk').doc(id).set({
                titulo, conteudo, data_agendada
            });
        } catch (error) { console.error("Erro ao salvar post:", error); }
    };

    const atualizarPostPermanentemente = async (id: string, titulo: string, conteudo: string, data_agendada: Date) => {
        try {
            await db.collection('empresas').doc(empresaId).collection('Agenciaapk').doc(id).update({
                titulo, conteudo, data_agendada
            });
        } catch (error) { console.error("Erro ao atualizar post:", error); }
    };

    useEffect(() => {
        if (!empresaId) return;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const eventsCollection = db.collection('empresas').doc(empresaId).collection('events');
                const querySnapshot = await eventsCollection.get();
                let eventsData: CalendarEvent[] = [];

                if (querySnapshot.empty) {
                    const seedingPromises = INITIAL_EVENTS.map(event => eventsCollection.add(event));
                    await Promise.all(seedingPromises);
                    const newSnapshot = await eventsCollection.get();
                    eventsData = newSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, date: (doc.data().date as firebase.firestore.Timestamp).toDate() } as CalendarEvent));
                } else {
                    eventsData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, date: (doc.data().date as firebase.firestore.Timestamp).toDate() } as CalendarEvent));
                }
                setEvents(eventsData.sort((a, b) => a.date.getTime() - b.date.getTime()));

                const postsSnapshot = await db.collection('empresas').doc(empresaId).collection('Agenciaapk').get();
                setPostsDoCalendario(postsSnapshot.docs.map(d => ({id: d.id, ...d.data()})));

            } catch (error) { console.error(error); } finally { setIsLoading(false); }
        };
        fetchData();
    }, [empresaId]);

    // --- HANDLERS ---
    const handleAddNewEventClick = () => {
        setSelectedEvent({
            id: '', date: new Date(), title: 'Nova Publicação', type: 'POST', status: 'Pendente',
            proprietario: null, plataforma: 'Instagram', url: '', copy: '', description: ''
        });
    };

    const handleCreateEventForDate = (date: Date) => {
        setSelectedEvent({
            id: '', date: date, title: '', type: 'POST', status: 'Pendente',
            proprietario: null, plataforma: 'Instagram', url: '', copy: '', description: ''
        });
    };

    const handleSaveEvent = async (eventData: CalendarEvent) => {
        if (eventData.id) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id, ...data } = eventData;
                await db.collection('empresas').doc(empresaId).collection('events').doc(eventData.id).update(data);
                await atualizarPostPermanentemente(eventData.id, eventData.title, eventData.copy || '', eventData.date);
                setEvents(prev => prev.map(e => e.id === eventData.id ? eventData : e));
            } catch (e) { console.error(e); }
        } else {
            try {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id, ...data } = eventData;
                const docRef = await db.collection('empresas').doc(empresaId).collection('events').add(data);
                await salvarPostPermanentemente(docRef.id, eventData.title, eventData.copy || '', eventData.date);
                setEvents(prev => [...prev, { ...eventData, id: docRef.id }]);
            } catch (e) { console.error(e); }
        }
        setSelectedEvent(null);
    };

    const handleDeleteEvent = async (eventId: string) => {
        try {
            await db.collection('empresas').doc(empresaId).collection('events').doc(eventId).delete();
            await db.collection('empresas').doc(empresaId).collection('Agenciaapk').doc(eventId).delete();
            setEvents(prev => prev.filter(e => e.id !== eventId));
            setSelectedEvent(null);
        } catch (e) { alert('Erro ao excluir.'); }
    };

    const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const handleToday = () => setCurrentDate(new Date());

    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    };

    // --- RENDER ---
    return (
        <div className="text-zinc-100 font-sans selection:bg-[#FABE01] selection:text-black">

            {/* HEADER DA PÁGINA */}
            <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <CalendarIcon className="w-8 h-8 text-[#FABE01]" />
                        Calendário Editorial
                    </h1>
                    <p className="text-zinc-400 mt-2 text-sm max-w-xl">
                        Planeje, agende e visualize todas as suas publicações em um único lugar.
                    </p>
                </div>

                <button
                    onClick={handleAddNewEventClick}
                    className="bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-bold py-2.5 px-6 rounded-sm shadow-[0_0_20px_rgba(250,190,1,0.2)] transition-all flex items-center gap-2 text-sm uppercase tracking-wide"
                >
                    <Plus className="w-5 h-5" />
                    Novo Agendamento
                </button>
            </header>

            {/* CARD DO CALENDÁRIO */}
            <div className="bg-[#111111] rounded-sm border border-white/5 shadow-2xl overflow-hidden">

                {/* CONTROLES DO MÊS */}
                <header className="flex flex-col sm:flex-row justify-between items-center p-6 border-b border-white/5 bg-black/20 gap-4">
                    <h2 className="text-xl font-bold text-white capitalize flex items-center gap-2">
                        {currentDate.toLocaleString('pt-BR', { month: 'long' })}
                        <span className="text-zinc-500 font-normal">{currentDate.getFullYear()}</span>
                    </h2>

                    <div className="flex items-center bg-[#1A1A1A] rounded-sm border border-white/10 p-1">
                        <button onClick={handlePrevMonth} className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-sm transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button onClick={handleToday} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-[#FABE01] border-x border-white/5 mx-1 transition-colors">
                            Hoje
                        </button>
                        <button onClick={handleNextMonth} className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-sm transition-colors">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {isLoading ? (
                    <div className="h-96 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-10 h-10 text-[#FABE01] animate-spin" />
                        <p className="text-zinc-500 text-sm animate-pulse">Carregando agendamentos...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-7 bg-[#1A1A1A]">
                        {/* DIAS DA SEMANA */}
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                            <div key={day} className="py-3 text-center text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-r border-white/5 bg-[#111111]">
                                {day}
                            </div>
                        ))}

                        {/* GRID DE DIAS */}
                        {calendarDays.map((date, index) => {
                            if (!date) {
                                // Dias vazios (padding)
                                return <div key={`empty-${index}`} className="bg-[#111111]/50 border-b border-r border-white/5 min-h-[140px]" />;
                            }

                            const dayEvents = events.filter(e => e.date.toDateString() === date.toDateString());
                            const isTodayDate = isToday(date);

                            return (
                                <div
                                    key={date.toISOString()}
                                    className={`group relative min-h-[140px] p-2 border-b border-r border-white/5 flex flex-col transition-colors
                                        ${isTodayDate ? 'bg-[#FABE01]/5' : 'bg-[#111111] hover:bg-[#1A1A1A]'}
                                    `}
                                >
                                    {/* CABEÇALHO DO DIA */}
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full
                                            ${isTodayDate ? 'bg-[#FABE01] text-black shadow-[0_0_10px_rgba(250,190,1,0.5)]' : 'text-zinc-500 group-hover:text-zinc-300'}
                                        `}>
                                            {date.getDate()}
                                        </span>

                                        {/* Botão Add (Só aparece no hover) */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleCreateEventForDate(date); }}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-[#FABE01] hover:bg-[#FABE01]/10 rounded-sm transition-all"
                                            title="Adicionar Post"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* LISTA DE EVENTOS (Corrigido: sem scroll horizontal) */}
                                    <div className="flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden custom-scrollbar">
                                        {dayEvents.map(event => (
                                            <div
                                                key={event.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedEvent(event);
                                                }}
                                                className={`
                                                    cursor-pointer p-1.5 rounded-sm text-xs font-medium border-l-2 transition-colors
                                                    ${event.type === 'POST'
                                                    ? 'bg-blue-500/10 border-blue-500 text-blue-200 hover:bg-blue-500/20'
                                                    : 'bg-purple-500/10 border-purple-500 text-purple-200 hover:bg-purple-500/20'
                                                }
                                                `}
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    {event.plataforma === 'Instagram' ? (
                                                        <Instagram className="w-3 h-3 opacity-70 shrink-0" />
                                                    ) : (
                                                        <FileText className="w-3 h-3 opacity-70 shrink-0" />
                                                    )}
                                                    <span className="truncate">{event.title || '(Sem título)'}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* MODAL DE DETALHES */}
            {selectedEvent && (
                <EventDetailModal
                    event={selectedEvent}
                    onSave={handleSaveEvent}
                    onDelete={handleDeleteEvent}
                    onClose={() => setSelectedEvent(null)}
                />
            )}
        </div>
    );
};

export default CalendarView;