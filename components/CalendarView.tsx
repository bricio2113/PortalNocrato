

import React, { useState, useMemo, useEffect } from 'react';
import { CalendarEvent } from '../types';
import { INITIAL_EVENTS } from '../constants';
import EventDetailModal from './EventDetailModal';
import { db } from '../utils/firebase';
// Fix: Import firebase for Timestamp type and use v8 Firestore API
// Fix: Use compat imports for Firebase v8 API
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const ChevronLeftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
);

const ChevronRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
);

const PageIcon = ({ eventType }: { eventType: string }) => {
    const color = eventType === 'POST' ? 'text-gray-500 dark:text-gray-400' : 'text-purple-500 dark:text-purple-400';
    return (
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5 flex-shrink-0 ${color}`}>
            <path d="M5.16666 3.83331H10.8333M5.16666 6.49998H10.8333M5.16666 9.16665H8.49999M2.5 13.5V2.49998C2.5 2.40794 2.53774 2.31952 2.60555 2.25171C2.67336 2.1839 2.76178 2.14616 2.85382 2.14616H10.518L13.5 5.1281V13.5C13.5 13.592 13.4623 13.6805 13.3945 13.7483C13.3266 13.8161 13.2382 13.8538 13.1462 13.8538H2.85382C2.76178 13.8538 2.67336 13.8161 2.60555 13.7483C2.53774 13.6805 2.5 13.592 2.5 13.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
        </svg>
    );
};

interface CalendarViewProps {
    empresaId: string;
}

const CalendarView: React.FC<CalendarViewProps> = ({ empresaId }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [postsDoCalendario, setPostsDoCalendario] = useState<any[]>([]);

    const salvarPostPermanentemente = async (id: string, titulo: string, conteudo: string, data_agendada: Date) => {
        try {
            // Fix: Use Firebase v8 collection/doc/set methods
            const postDocRef = db.collection('empresas').doc(empresaId).collection('Agenciaapk').doc(id);
            await postDocRef.set({
                titulo: titulo,
                conteudo: conteudo,
                data_agendada: data_agendada,
            });
            console.log("Post salvo com sucesso na coleção Agenciaapk!");
        } catch (error) {
            console.error("Erro ao salvar post na coleção Agenciaapk: ", error);
        }
    };

    const atualizarPostPermanentemente = async (id: string, titulo: string, conteudo: string, data_agendada: Date) => {
        try {
            // Fix: Use Firebase v8 collection/doc/update methods
            const postDocRef = db.collection('empresas').doc(empresaId).collection('Agenciaapk').doc(id);
            await postDocRef.update({
                titulo: titulo,
                conteudo: conteudo,
                data_agendada: data_agendada,
            });
            console.log("Post atualizado com sucesso na coleção Agenciaapk!");
        } catch (error) {
            console.error("Erro ao atualizar post na coleção Agenciaapk: ", error);
        }
    };

    const carregarPostsDoFirestore = async () => {
        try {
            // Fix: Use Firebase v8 collection/get methods
            const postsCollection = db.collection('empresas').doc(empresaId).collection('Agenciaapk');
            const querySnapshot = await postsCollection.get();
            const posts = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            return posts;
        } catch (error) {
            console.error("Erro ao carregar posts do Firestore: ", error);
            return [];
        }
    };

    useEffect(() => {
        if (!empresaId) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch events
                // Fix: Use Firebase v8 collection/get methods
                const eventsCollection = db.collection('empresas').doc(empresaId).collection('events');
                const querySnapshot = await eventsCollection.get();

                let eventsData: CalendarEvent[] = [];

                if (querySnapshot.empty) {
                    // Fix: Use Firebase v8 collection.add method
                    const seedingPromises = INITIAL_EVENTS.map(event => eventsCollection.add(event));
                    await Promise.all(seedingPromises);
                    const newSnapshot = await eventsCollection.get();
                     eventsData = newSnapshot.docs.map(docSnapshot => {
                        const data = docSnapshot.data();
                        return {
                            ...data,
                            id: docSnapshot.id,
                            // Fix: Use firebase.firestore.Timestamp
                            date: (data.date as firebase.firestore.Timestamp).toDate(),
                        } as CalendarEvent;
                    });
                } else {
                     eventsData = querySnapshot.docs.map(docSnapshot => {
                         const data = docSnapshot.data();
                        return {
                            ...data,
                            id: docSnapshot.id,
                            // Fix: Use firebase.firestore.Timestamp
                            date: (data.date as firebase.firestore.Timestamp).toDate(),
                        } as CalendarEvent;
                    });
                }
                 setEvents(eventsData.sort((a, b) => a.date.getTime() - b.date.getTime()));

                // Fetch posts from Agenciaapk
                const posts = await carregarPostsDoFirestore();
                setPostsDoCalendario(posts);

            } catch (error) {
                console.error("Error fetching data: ", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [empresaId]);

    const handleAddNewEventClick = () => {
        const newEventTemplate: CalendarEvent = {
            id: '',
            date: new Date(),
            title: 'Nova Tarefa',
            type: 'POST',
            status: 'Pendente',
            proprietario: null,
            plataforma: 'Instagram',
            url: '',
            copy: '',
            description: '',
        };
        setSelectedEvent(newEventTemplate);
    };

    const handleCreateEventForDate = (date: Date) => {
        const newEventTemplate: CalendarEvent = {
            id: '',
            date: date,
            title: '',
            type: 'POST',
            status: 'Pendente',
            proprietario: null,
            plataforma: 'Instagram',
            url: '',
            copy: '',
            description: '',
        };
        setSelectedEvent(newEventTemplate);
    };
    
    const handleSaveEvent = async (eventData: CalendarEvent) => {
        if (eventData.id) {
            // Update
            try {
                // Update in 'events' collection
                // Fix: Use Firebase v8 collection/doc/update methods
                const eventDocRef = db.collection('empresas').doc(empresaId).collection('events').doc(eventData.id);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id, ...dataToUpdate } = eventData;
                await eventDocRef.update(dataToUpdate);

                // Also update in 'Agenciaapk' collection
                await atualizarPostPermanentemente(eventData.id, eventData.title, eventData.copy || '', eventData.date);

                setEvents(events.map(e => e.id === eventData.id ? eventData : e));
            } catch (error) {
                console.error("Error updating event: ", error);
            }
        } else {
            // Create
            try {
                // Create in 'events' collection first to get the ID
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id, ...dataToCreate } = eventData;
                // Fix: Use Firebase v8 collection/add methods
                const eventsCollection = db.collection('empresas').doc(empresaId).collection('events');
                const docRef = await eventsCollection.add(dataToCreate);
                
                const newEventId = docRef.id;

                // Create in 'Agenciaapk' collection with the same ID
                await salvarPostPermanentemente(newEventId, eventData.title, eventData.copy || '', eventData.date);

                const newEvent: CalendarEvent = {
                    id: newEventId,
                    ...dataToCreate,
                };
                setEvents(prevEvents => [...prevEvents, newEvent].sort((a, b) => a.date.getTime() - b.date.getTime()));
            } catch (error) {
                console.error("Error creating event: ", error);
            }
        }
        setSelectedEvent(null);
    };

    const handleDeleteEvent = async (eventId: string) => {
        try {
            // Sequentially delete from both collections to ensure the operation is complete
            // Fix: Use Firebase v8 collection/doc/delete methods
            const eventDocRef = db.collection('empresas').doc(empresaId).collection('events').doc(eventId);
            await eventDocRef.delete();
            
            const postDocRef = db.collection('empresas').doc(empresaId).collection('Agenciaapk').doc(eventId);
            await postDocRef.delete();

            // Update the state only after successful deletion from both collections
            setEvents(prevEvents => prevEvents.filter(e => e.id !== eventId));
            setSelectedEvent(null);
        } catch (error) {
            console.error("Error deleting event from collections: ", error);
            alert('Ocorreu um erro ao remover o evento. Por favor, tente novamente.');
        }
    };

    const calendarDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const lastDayOfPrevMonth = new Date(year, month, 0);

        const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
        const daysInMonth = lastDayOfMonth.getDate();
        const daysInPrevMonth = lastDayOfPrevMonth.getDate();

        const days = [];

        for (let i = startDayOfWeek; i > 0; i--) {
            days.push({
                date: new Date(year, month - 1, daysInPrevMonth - i + 1),
                isCurrentMonth: false,
            });
        }
        
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({
                date: new Date(year, month, i),
                isCurrentMonth: true,
            });
        }

        const totalDays = days.length;
        const remainingDays = (Math.ceil(totalDays / 7) * 7) - totalDays;
        
        for (let i = 1; i <= remainingDays; i++) {
            days.push({
                date: new Date(year, month + 1, i),
                isCurrentMonth: false,
            });
        }
        
        return days;

    }, [currentDate]);


    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleGoToToday = () => {
        setCurrentDate(new Date());
    };
    
    const todayForDisplay = new Date();

    return (
        <>
            <header className="mb-8">
                <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white cursor-default select-none">Calendário de Conteúdo</h1>
                    <p className="text-slate-800 dark:text-slate-300 mt-1 text-sm sm:text-base cursor-default select-none">Visualize e gerencie todos os seus posts e eventos.</p>
                </div>
            </header>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-2 sm:p-4 relative">
                <header className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4 sm:gap-0">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 capitalize order-1 sm:order-none">
                        {currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                    </h2>
                    <div className="flex items-center space-x-1 sm:space-x-3 order-2 sm:order-none w-full sm:w-auto justify-between sm:justify-end">
                        <button
                            onClick={handleAddNewEventClick}
                            className="bg-blue-600 text-white py-2 px-3 sm:px-4 rounded-md shadow-sm hover:bg-blue-700 font-semibold transition-colors flex items-center text-xs sm:text-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-0 sm:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            <span className="hidden sm:inline">Adicionar Tarefa</span>
                        </button>
                        <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-md">
                            <button onClick={handlePrevMonth} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors rounded-l-md">
                                <ChevronLeftIcon />
                            </button>
                            <button onClick={handleGoToToday} className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border-x border-slate-200 dark:border-slate-700 transition-colors">
                                Hoje
                            </button>
                            <button onClick={handleNextMonth} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors rounded-r-md">
                                <ChevronRightIcon />
                            </button>
                        </div>
                    </div>
                </header>
                {isLoading ? (
                    <div className="flex justify-center items-center h-96">
                        <p className="text-slate-500 dark:text-slate-400">Carregando calendário...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-7 border-t border-l border-slate-200 dark:border-slate-700">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
                            <div key={index} className="text-center py-2 bg-white dark:bg-slate-800 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase border-b border-r border-slate-200 dark:border-slate-700">{day}</div>
                        ))}
                        {calendarDays.map((dayInfo) => {
                            const { date, isCurrentMonth } = dayInfo;
                            const dayEvents = events.filter(e => e.date.toDateString() === date.toDateString());
                            const isToday = date.toDateString() === todayForDisplay.toDateString();

                            return (
                                <div key={date.toISOString()} className="group relative bg-white dark:bg-slate-900/50 p-1 h-28 sm:p-2 sm:h-36 flex flex-col border-b border-r border-slate-200 dark:border-slate-700">
                                    <button
                                        onClick={() => handleCreateEventForDate(date)}
                                        className="absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-blue-100 dark:hover:bg-slate-600 hover:text-blue-600 transition-opacity z-10"
                                        aria-label={`Adicionar evento para ${date.toLocaleDateString('pt-BR')}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                    </button>
                                     <time dateTime={date.toISOString()} className={`text-xs sm:text-sm self-end font-medium ${
                                        isToday ? 'bg-red-500 text-white rounded-full w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center' : 'w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center'
                                    } ${!isCurrentMonth ? 'text-slate-300 dark:text-slate-600' : 'text-slate-600 dark:text-slate-300'}`}>
                                        {date.getDate()}
                                    </time>
                                    <div className="mt-1 flex-1 overflow-y-auto space-y-1">
                                        {dayEvents.map(event => (
                                            <div 
                                                key={event.id} 
                                                onClick={() => setSelectedEvent(event)}
                                                className="flex items-center text-[10px] sm:text-xs p-1 rounded border border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700"
                                            >
                                                <PageIcon eventType={event.type} />
                                                <span className="truncate text-slate-700 dark:text-slate-200 font-medium">{event.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
                {selectedEvent && (
                    <EventDetailModal
                        event={selectedEvent}
                        onSave={handleSaveEvent}
                        onDelete={handleDeleteEvent}
                        onClose={() => setSelectedEvent(null)}
                    />
                )}
            </div>
        </>
    );
};

export default CalendarView;