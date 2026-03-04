import React, { useState, useEffect } from 'react';
import { db } from '../utils/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import {
    Loader2, Plus, Trash2, Layout, MoreVertical,
    ArrowRight, ArrowLeft, GripVertical
} from 'lucide-react';

// Tipos locais exclusivos para o Kanban (Não interferem no calendário)
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

interface KanbanTask {
    id: string;
    title: string;
    status: TaskStatus;
    createdAt: Date;
}

interface ColumnDef {
    id: TaskStatus;
    title: string;
    accentColor: string;
}

const COLUMNS: ColumnDef[] = [
    { id: 'TODO', title: 'Fila de Produção', accentColor: 'bg-zinc-500' },
    { id: 'IN_PROGRESS', title: 'Em Andamento', accentColor: 'bg-blue-500' },
    { id: 'DONE', title: 'Concluído', accentColor: 'bg-green-500' }
];

interface ClientProductionViewProps {
    empresaId: string;
}

const ClientProductionView: React.FC<ClientProductionViewProps> = ({ empresaId }) => {
    const [tasks, setTasks] = useState<KanbanTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Estados para criação de nova tarefa
    const [addingToColumn, setAddingToColumn] = useState<TaskStatus | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');

    // 1. BUSCAR TAREFAS (Coleção separada do calendário: 'kanban_tasks')
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

    // 2. ADICIONAR TAREFA
    const handleAddTask = async (e: React.FormEvent, status: TaskStatus) => {
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

    // 3. EXCLUIR TAREFA
    const handleDeleteTask = async (taskId: string) => {
        if (!window.confirm("Excluir este card?")) return;
        try {
            await db.collection('empresas').doc(empresaId).collection('kanban_tasks').doc(taskId).delete();
            setTasks(tasks.filter(t => t.id !== taskId));
        } catch (error) {
            console.error("Erro ao excluir:", error);
        }
    };

    // 4. MOVER TAREFA (Usado pelos botões e pelo Drag & Drop)
    const moveTask = async (taskId: string, newStatus: TaskStatus) => {
        // Otimista: Atualiza a tela imediatamente
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
        try {
            await db.collection('empresas').doc(empresaId).collection('kanban_tasks').doc(taskId).update({ status: newStatus });
        } catch (error) {
            console.error("Erro ao mover:", error);
            // Reverter em caso de erro (simplificado)
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: tasks.find(x => x.id === taskId)?.status || 'TODO' } : t));
        }
    };

    // --- FUNÇÕES DE DRAG AND DROP (NATIVO HTML5) ---
    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        e.dataTransfer.setData('taskId', taskId);
        e.dataTransfer.effectAllowed = 'move';
        // Atraso sutil para o card não sumir enquanto arrasta
        setTimeout(() => { (e.target as HTMLElement).classList.add('opacity-50'); }, 0);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        (e.target as HTMLElement).classList.remove('opacity-50');
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessário para permitir o drop
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('taskId');
        if (taskId) {
            moveTask(taskId, status);
        }
    };

    // --- RENDERIZAÇÃO ---
    if (isLoading) {
        return <div className="h-96 flex items-center justify-center"><Loader2 className="w-10 h-10 text-[#FABE01] animate-spin" /></div>;
    }

    return (
        <div className="text-zinc-100 font-sans h-[calc(100vh-100px)] flex flex-col">
            <header className="mb-6 shrink-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                    <Layout className="w-8 h-8 text-[#FABE01]" />
                    Quadro de Tarefas
                </h1>
                <p className="text-zinc-400 mt-2 text-sm">
                    Gestão de produção livre. Crie, organize e mova os cards. Independente do calendário.
                </p>
            </header>

            {/* CONTAINER DO KANBAN: Scroll horizontal no mobile, lado a lado no desktop */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar pb-4">
                <div className="flex gap-6 h-full items-start min-w-max px-1">

                    {COLUMNS.map((col, colIndex) => {
                        const columnTasks = tasks.filter(t => t.status === col.id);

                        return (
                            <div
                                key={col.id}
                                className="w-[300px] sm:w-[340px] shrink-0 bg-[#1A1A1A] rounded-md flex flex-col max-h-full border border-white/5"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, col.id)}
                            >
                                {/* Header da Coluna */}
                                <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#111111]/50 rounded-t-md">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full ${col.accentColor}`} />
                                        <h3 className="font-bold text-white tracking-wide">{col.title}</h3>
                                    </div>
                                    <span className="bg-white/10 text-zinc-300 text-xs font-bold px-2 py-1 rounded-full">
                                        {columnTasks.length}
                                    </span>
                                </div>

                                {/* Lista de Cards (Área "Soltável") */}
                                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                                    {columnTasks.map(task => (
                                        <div
                                            key={task.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, task.id)}
                                            onDragEnd={handleDragEnd}
                                            className="bg-[#111111] border border-white/10 p-4 rounded-sm shadow-sm hover:border-zinc-500 transition-colors group cursor-grab active:cursor-grabbing"
                                        >
                                            <div className="flex items-start gap-2 mb-3">
                                                <GripVertical className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5 md:hidden group-hover:block" />
                                                <p className="text-sm font-medium text-white leading-relaxed break-words flex-1">
                                                    {task.title}
                                                </p>
                                                <button
                                                    onClick={() => handleDeleteTask(task.id)}
                                                    className="text-zinc-600 hover:text-red-500 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                                    title="Excluir card"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {/* CONTROLES MOBILE: Setas de mover (Aparecem sempre no mobile, apenas no hover no desktop) */}
                                            <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-auto">
                                                <div className="text-[10px] text-zinc-600 font-mono">
                                                    {task.createdAt.toLocaleDateString('pt-BR')}
                                                </div>

                                                <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {colIndex > 0 && (
                                                        <button
                                                            onClick={() => moveTask(task.id, COLUMNS[colIndex - 1].id)}
                                                            className="p-1.5 text-zinc-400 hover:text-[#FABE01] bg-white/5 hover:bg-white/10 rounded-sm transition-colors"
                                                            title="Mover para esquerda"
                                                        >
                                                            <ArrowLeft className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {colIndex < COLUMNS.length - 1 && (
                                                        <button
                                                            onClick={() => moveTask(task.id, COLUMNS[colIndex + 1].id)}
                                                            className="p-1.5 text-zinc-400 hover:text-[#FABE01] bg-white/5 hover:bg-white/10 rounded-sm transition-colors"
                                                            title="Mover para direita"
                                                        >
                                                            <ArrowRight className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Formulário de Nova Tarefa INLINE */}
                                    {addingToColumn === col.id ? (
                                        <form onSubmit={(e) => handleAddTask(e, col.id)} className="bg-[#111111] border border-[#FABE01] p-3 rounded-sm shadow-lg animate-in fade-in zoom-in-95">
                                            <textarea
                                                autoFocus
                                                value={newTaskTitle}
                                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                                placeholder="O que precisa ser feito?"
                                                className="w-full bg-transparent text-sm text-white resize-none outline-none border-none p-0 mb-3 placeholder:text-zinc-600"
                                                rows={3}
                                                onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddTask(e as any, col.id); } }}
                                            />
                                            <div className="flex items-center justify-between">
                                                <button type="button" onClick={() => {setAddingToColumn(null); setNewTaskTitle('');}} className="text-xs font-bold text-zinc-500 hover:text-white px-2 py-1">Cancelar</button>
                                                <button type="submit" disabled={!newTaskTitle.trim()} className="bg-[#FABE01] text-black text-xs font-bold px-3 py-1.5 rounded-sm disabled:opacity-50">Adicionar</button>
                                            </div>
                                        </form>
                                    ) : (
                                        <button
                                            onClick={() => setAddingToColumn(col.id)}
                                            className="w-full py-3 flex items-center justify-center gap-2 text-sm font-medium text-zinc-500 hover:text-white hover:bg-white/5 rounded-sm transition-colors border border-dashed border-transparent hover:border-white/20"
                                        >
                                            <Plus className="w-4 h-4" /> Adicionar Cartão
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                </div>
            </div>
        </div>
    );
};

export default ClientProductionView;