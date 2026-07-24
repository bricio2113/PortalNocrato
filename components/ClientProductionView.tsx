import React, { useState, useEffect } from 'react';
import { db } from '../utils/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import {
    Loader2, Plus, Trash2, Layout,
    ArrowRight, ArrowLeft, GripVertical
} from 'lucide-react';
import EventDetailModal from './EventDetailModal';
import { CalendarEvent } from '../types';
import { STATUS_OPTIONS } from '../constants';

interface KanbanTask {
    id: string;
    title: string;
    status: string;
    createdAt: Date;
    eventId?: string;
}

interface ColumnDef {
    id: string;
    title: string;
    accentColor: string;
}

// Colunas sincronizadas rigorosamente com os Status do Calendário
const COLUMNS: ColumnDef[] = [
    { id: 'Pendente', title: 'Pendente', accentColor: 'bg-zinc-500' },
    { id: 'Agendado', title: 'Agendado', accentColor: 'bg-blue-400' },
    { id: 'Em andamento', title: 'Em andamento', accentColor: 'bg-amber-500' },
    { id: 'Editado', title: 'Editado', accentColor: 'bg-purple-500' },
    { id: 'Concluído', title: 'Concluído', accentColor: 'bg-emerald-500' },
    { id: 'Postado', title: 'Postado', accentColor: 'bg-green-600' },
    { id: 'Cancelado', title: 'Cancelado', accentColor: 'bg-red-500' }
];

interface ClientProductionViewProps {
    empresaId: string;
}

const ClientProductionView: React.FC<ClientProductionViewProps> = ({ empresaId }) => {
    const [tasks, setTasks] = useState<KanbanTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

    useEffect(() => {
        if (!empresaId) return;
        const fetchTasks = async () => {
            setIsLoading(true);
            try {
                const snapshot = await db.collection('empresas').doc(empresaId).collection('kanban_tasks').orderBy('createdAt', 'desc').get();
                const tasksData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate() || new Date()
                } as KanbanTask));
                setTasks(tasksData);
            } catch (error) {
                console.error("Erro ao buscar tarefas Kanban:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTasks();
    }, [empresaId]);

    const handleAddTask = async (e: React.FormEvent, status: string) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;
        const newTask = {
            title: newTaskTitle.trim(),
            status: status,
            createdAt: new Date()
        };
        try {
            const docRef = await db.collection('empresas').doc(empresaId).collection('kanban_tasks').add(newTask);
            setTasks([{ id: docRef.id, ...newTask } as KanbanTask, ...tasks]);
            setAddingToColumn(null);
            setNewTaskTitle('');
        } catch (error) {
            console.error("Erro ao adicionar tarefa:", error);
        }
    };

    const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("Excluir este card?")) return;
        try {
            await db.collection('empresas').doc(empresaId).collection('kanban_tasks').doc(taskId).delete();
            setTasks(tasks.filter(t => t.id !== taskId));
        } catch (error) {
            console.error("Erro ao excluir:", error);
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
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: tasks.find(x => x.id === taskId)?.status || 'Pendente' } : t));
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
        if (task.eventId) {
            setIsLoading(true);
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
                    alert("Evento detalhado não encontrado na agenda.");
                }
            } catch (error) {
                console.error("Erro ao buscar evento:", error);
            } finally {
                setIsLoading(false);
            }
        } else {
            alert("Esta tarefa foi criada manualmente na produção. Crie o post na aba Calendário para habilitar o modal de edição avançada.");
        }
    };

    const handleSaveEvent = async (eventData: CalendarEvent) => {
        try {
            const { id, ...data } = eventData;
            await db.collection('empresas').doc(empresaId).collection('events').doc(id).update(data);
            
            const task = tasks.find(t => t.eventId === id);
            if (task && (task.title !== eventData.title || task.status !== eventData.status)) {
                await db.collection('empresas').doc(empresaId).collection('kanban_tasks').doc(task.id).update({ 
                    title: eventData.title, 
                    status: eventData.status 
                });
                setTasks(prev => prev.map(t => t.id === task.id ? { ...t, title: eventData.title, status: eventData.status } : t));
            }
            setSelectedEvent(null);
        } catch (error) {
            console.error("Erro ao salvar evento:", error);
        }
    };

    const handleDeleteEvent = async (eventId: string) => {
        try {
            await db.collection('empresas').doc(empresaId).collection('events').doc(eventId).delete();
            const task = tasks.find(t => t.eventId === eventId);
            if (task) {
                await db.collection('empresas').doc(empresaId).collection('kanban_tasks').doc(task.id).delete();
                setTasks(prev => prev.filter(t => t.id !== task.id));
            }
            setSelectedEvent(null);
        } catch (error) {
            console.error("Erro ao excluir evento:", error);
        }
    };

    if (isLoading && !selectedEvent) {
        return <div className="h-96 flex items-center justify-center"><Loader2 className="w-10 h-10 text-[#FABE01] animate-spin" /></div>;
    }

    return (
        <div className="text-zinc-100 font-sans h-[calc(100vh-100px)] flex flex-col relative">
            <header className="mb-6 shrink-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                    <Layout className="w-8 h-8 text-[#FABE01]" />
                    Quadro de Tarefas
                </h1>
                <p className="text-zinc-400 mt-2 text-sm">
                    Acompanhe e movimente o status. Clique nos cards da agenda para editar o conteúdo e legenda.
                </p>
            </header>

            <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar pb-4">
                <div className="flex gap-6 h-full items-start min-w-max px-1">
                    {COLUMNS.map((col, colIndex) => {
                        const columnTasks = tasks.filter(t => t.status === col.id);
                        return (
                            <div key={col.id} className="w-[300px] sm:w-[340px] shrink-0 bg-[#1A1A1A] rounded-md flex flex-col max-h-full border border-white/5" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, col.id)}>
                                <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#111111]/50 rounded-t-md">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full ${col.accentColor}`} />
                                        <h3 className="font-bold text-white tracking-wide truncate">{col.title}</h3>
                                    </div>
                                    <span className="bg-white/10 text-zinc-300 text-xs font-bold px-2 py-1 rounded-full">{columnTasks.length}</span>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                                    {columnTasks.map(task => (
                                        <div
                                            key={task.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, task.id)}
                                            onDragEnd={handleDragEnd}
                                            onClick={() => handleTaskClick(task)}
                                            className="bg-[#111111] border border-white/10 p-4 rounded-sm shadow-sm hover:border-[#FABE01]/50 transition-colors group cursor-grab active:cursor-grabbing"
                                        >
                                            <div className="flex items-start gap-2 mb-3">
                                                <GripVertical className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5 md:hidden group-hover:block" />
                                                <p className="text-sm font-medium text-white leading-relaxed break-words flex-1">
                                                    {task.title}
                                                </p>
                                                <button onClick={(e) => handleDeleteTask(task.id, e)} className="text-zinc-600 hover:text-red-500 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0" title="Excluir card">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            
                                            <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-auto">
                                                <div className="text-[10px] text-zinc-600 font-mono">
                                                    {task.createdAt.toLocaleDateString('pt-BR')}
                                                </div>
                                                <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {colIndex > 0 && (
                                                        <button onClick={(e) => moveTask(task.id, COLUMNS[colIndex - 1].id, e)} className="p-1.5 text-zinc-400 hover:text-[#FABE01] bg-white/5 hover:bg-white/10 rounded-sm transition-colors" title="Mover para esquerda">
                                                            <ArrowLeft className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {colIndex < COLUMNS.length - 1 && (
                                                        <button onClick={(e) => moveTask(task.id, COLUMNS[colIndex + 1].id, e)} className="p-1.5 text-zinc-400 hover:text-[#FABE01] bg-white/5 hover:bg-white/10 rounded-sm transition-colors" title="Mover para direita">
                                                            <ArrowRight className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {addingToColumn === col.id ? (
                                        <form onSubmit={(e) => handleAddTask(e, col.id)} className="bg-[#111111] border border-[#FABE01] p-3 rounded-sm shadow-lg animate-in fade-in zoom-in-95">
                                            <textarea autoFocus value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="O que precisa ser feito?" className="w-full bg-transparent text-sm text-white resize-none outline-none border-none p-0 mb-3 placeholder:text-zinc-600" rows={3} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddTask(e as any, col.id); } }} />
                                            <div className="flex items-center justify-between">
                                                <button type="button" onClick={() => { setAddingToColumn(null); setNewTaskTitle(''); }} className="text-xs font-bold text-zinc-500 hover:text-white px-2 py-1">Cancelar</button>
                                                <button type="submit" disabled={!newTaskTitle.trim()} className="bg-[#FABE01] text-black text-xs font-bold px-3 py-1.5 rounded-sm disabled:opacity-50">Adicionar</button>
                                            </div>
                                        </form>
                                    ) : (
                                        <button onClick={() => setAddingToColumn(col.id)} className="w-full py-3 flex items-center justify-center gap-2 text-sm font-medium text-zinc-500 hover:text-white hover:bg-white/5 rounded-sm transition-colors border border-dashed border-transparent hover:border-white/20">
                                            <Plus className="w-4 h-4" /> Adicionar Card
                                        </button>
                                    )}
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
                    onClose={() => setSelectedEvent(null)}
                />
            )}
        </div>
    );
};

export default ClientProductionView;