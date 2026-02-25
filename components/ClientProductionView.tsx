import React, { useState, useEffect } from 'react';
import { db } from '../utils/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { CalendarEvent, EventStatus } from '../types';
import {
    Loader2, CheckCircle2, Circle, Clock, Calendar,
    ArrowRight, RotateCcw, Layout, CheckSquare, Briefcase, Check
} from 'lucide-react';

interface ClientProductionViewProps {
    empresaId: string;
}

// --- COMPONENTE AUXILIAR (Movido para fora para evitar erros de render/key) ---
interface TaskCardProps {
    event: CalendarEvent;
    isCompleted: boolean;
    onToggle: (event: CalendarEvent) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ event, isCompleted, onToggle }) => (
    <div className={`p-4 rounded-sm border mb-3 transition-all duration-200 group ${isCompleted ? 'bg-[#111111] border-white/5 opacity-75 hover:opacity-100' : 'bg-[#1A1A1A] border-white/10 hover:border-[#FABE01]/50 shadow-lg'}`}>
        <div className="flex justify-between items-start gap-3">
            <div className="flex-1">
                <h4 className={`font-bold text-sm mb-1 ${isCompleted ? 'text-zinc-500 line-through' : 'text-white'}`}>
                    {event.title || 'Sem título'}
                </h4>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Calendar className="w-3 h-3" />
                    {event.date.toLocaleDateString('pt-BR')}
                </div>
            </div>

            <button
                onClick={() => onToggle(event)}
                className={`p-2 rounded-full transition-all ${isCompleted ? 'bg-zinc-800 text-zinc-500 hover:text-[#FABE01]' : 'bg-[#FABE01] text-black shadow-[0_0_10px_rgba(250,190,1,0.3)] hover:scale-105'}`}
                title={isCompleted ? "Marcar como pendente" : "Concluir tarefa"}
            >
                {isCompleted ? <RotateCcw className="w-4 h-4" /> : <Check className="w-4 h-4" />}
            </button>
        </div>
        {event.proprietario && (
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-zinc-400">
                <Briefcase className="w-3 h-3" />
                {event.proprietario}
            </div>
        )}
    </div>
);

// --- COMPONENTE PRINCIPAL ---
const ClientProductionView: React.FC<ClientProductionViewProps> = ({ empresaId }) => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!empresaId) return;
        const fetchEvents = async () => {
            setIsLoading(true);
            try {
                const eventsCollection = db.collection('empresas').doc(empresaId).collection('events');
                const snapshot = await eventsCollection.get();
                const eventsData = snapshot.docs.map(doc => ({
                    ...doc.data(),
                    id: doc.id,
                    date: (doc.data().date as firebase.firestore.Timestamp).toDate()
                } as CalendarEvent));

                // Ordenar por data
                setEvents(eventsData.sort((a, b) => a.date.getTime() - b.date.getTime()));
            } catch (error) {
                console.error("Erro ao buscar eventos:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchEvents();
    }, [empresaId]);

    const toggleStatus = async (event: CalendarEvent) => {
        // Agora o TS aceita 'Pendente' e 'Concluído' porque atualizamos o types.ts
        const newStatus: EventStatus = event.status === 'Concluído' ? 'Pendente' : 'Concluído';

        setEvents(prev => prev.map(e => e.id === event.id ? { ...e, status: newStatus } : e));

        try {
            await db.collection('empresas').doc(empresaId).collection('events').doc(event.id).update({
                status: newStatus
            });
        } catch (error) {
            console.error("Erro ao atualizar status:", error);
            setEvents(prev => prev.map(e => e.id === event.id ? { ...e, status: event.status } : e));
        }
    };

    const pendingEvents = events.filter(e => e.status !== 'Concluído');
    const completedEvents = events.filter(e => e.status === 'Concluído');

    if (isLoading) {
        return <div className="h-96 flex items-center justify-center"><Loader2 className="w-10 h-10 text-[#FABE01] animate-spin" /></div>;
    }

    return (
        <div className="text-zinc-100 font-sans min-h-screen">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Layout className="w-8 h-8 text-[#FABE01]" />
                    Gestão de Produção
                </h1>
                <p className="text-zinc-400 mt-2 text-sm">
                    Acompanhe o fluxo de tarefas criadas no calendário.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* COLUNA 1: PENDENTES */}
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Circle className="w-5 h-5 text-[#FABE01]" />
                            Fila de Produção
                        </h2>
                        <span className="bg-[#FABE01]/20 text-[#FABE01] text-xs font-bold px-2 py-1 rounded-sm">
                            {pendingEvents.length}
                        </span>
                    </div>

                    <div className="flex-1 bg-white/[0.02] rounded-sm p-2 sm:p-4 border border-white/5 min-h-[300px]">
                        {pendingEvents.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-2 p-8">
                                <CheckSquare className="w-10 h-10 opacity-20" />
                                <p className="text-sm">Tudo limpo por aqui!</p>
                            </div>
                        ) : (
                            pendingEvents.map(event => (
                                <TaskCard
                                    key={event.id}
                                    event={event}
                                    isCompleted={false}
                                    onToggle={toggleStatus}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* COLUNA 2: CONCLUÍDOS */}
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
                        <h2 className="text-lg font-bold text-zinc-400 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5" />
                            Concluídos
                        </h2>
                        <span className="bg-zinc-800 text-zinc-400 text-xs font-bold px-2 py-1 rounded-sm">
                            {completedEvents.length}
                        </span>
                    </div>

                    <div className="flex-1 bg-black/20 rounded-sm p-2 sm:p-4 border border-white/5 min-h-[300px]">
                        {completedEvents.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-2 p-8">
                                <Clock className="w-10 h-10 opacity-20" />
                                <p className="text-sm">Nenhuma tarefa concluída.</p>
                            </div>
                        ) : (
                            completedEvents.map(event => (
                                <TaskCard
                                    key={event.id}
                                    event={event}
                                    isCompleted={true}
                                    onToggle={toggleStatus}
                                />
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ClientProductionView;