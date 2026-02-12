import React, { useState, useEffect } from 'react';
import { WeeklyTask } from '../types';
import { INITIAL_TASKS } from '../constants';
import { db } from '../utils/firebase';
// Ícones Lucide
import { CheckCircle2, Circle, Trash2, Plus, Target, Loader2 } from 'lucide-react';

interface WeeklyUpdatesViewProps {
  empresaId: string;
}

const WeeklyUpdatesView: React.FC<WeeklyUpdatesViewProps> = ({ empresaId }) => {
  const [tasks, setTasks] = useState<WeeklyTask[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // --- FETCH DATA ---
  useEffect(() => {
    if (!empresaId) return;

    const fetchTasks = async () => {
      setIsLoading(true);
      try {
        const tasksCollection = db.collection('empresas').doc(empresaId).collection('tasks');
        const querySnapshot = await tasksCollection.get();

        if (querySnapshot.empty) {
          const seedingPromises = INITIAL_TASKS.map(task => tasksCollection.add(task));
          await Promise.all(seedingPromises);
          const newSnapshot = await tasksCollection.get();
          setTasks(newSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WeeklyTask)));
        } else {
          setTasks(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WeeklyTask)));
        }
      } catch (error) {
        console.error("Erro ao buscar tarefas: ", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTasks();
  }, [empresaId]);

  // --- ACTIONS ---
  const handleToggleTask = async (id: string) => {
    const taskToToggle = tasks.find(task => task.id === id);
    if (!taskToToggle) return;

    try {
      await db.collection('empresas').doc(empresaId).collection('tasks').doc(id).update({ completed: !taskToToggle.completed });
      setTasks(tasks.map(task => task.id === id ? { ...task, completed: !task.completed } : task));
    } catch (error) { console.error(error); }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    try {
      const newTaskData = { text: newTaskText.trim(), completed: false };
      const docRef = await db.collection('empresas').doc(empresaId).collection('tasks').add(newTaskData);
      setTasks([...tasks, { id: docRef.id, ...newTaskData }]);
      setNewTaskText('');
    } catch (error) { console.error(error); }
  };

  const handleDeleteTask = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await db.collection('empresas').doc(empresaId).collection('tasks').doc(id).delete();
      setTasks(tasks.filter(task => task.id !== id));
    } catch (error) { console.error(error); }
  };

  // Cálculo de Progresso
  const completedTasks = tasks.filter(t => t.completed).length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
      <div className="text-zinc-100 font-sans selection:bg-[#FABE01] selection:text-black">

        {/* HEADER */}
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight flex items-center gap-3">
            <Target className="w-8 h-8 text-[#FABE01]" />
            Foco da Semana
          </h1>
          <p className="text-zinc-400 mt-2 text-lg max-w-2xl">
            Acompanhe em tempo real as prioridades e entregas que nossa equipe está preparando para você.
          </p>
        </header>

        <div className="max-w-4xl mx-auto">

          {/* PROGRESS BAR CARD */}
          <div className="bg-[#1A1A1A] border border-white/5 rounded-sm p-6 mb-8 shadow-lg">
            <div className="flex justify-between items-end mb-3">
              <div>
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-1">Status Geral</span>
                <span className="text-2xl font-bold text-white">{Math.round(progress)}% Concluído</span>
              </div>
              <div className="text-right">
                    <span className="text-sm text-zinc-400">
                        <span className="text-[#FABE01] font-bold">{completedTasks}</span> de {totalTasks} tarefas
                    </span>
              </div>
            </div>
            <div className="w-full bg-[#111111] rounded-full h-1.5 overflow-hidden">
              <div
                  className="bg-[#FABE01] h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_#FABE01]"
                  style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* LISTA DE TAREFAS */}
          <div className="bg-[#1A1A1A] border border-white/5 rounded-sm shadow-2xl overflow-hidden">

            {/* INPUT DE NOVA TAREFA (Sticky Top) */}
            <div className="p-6 border-b border-white/5 bg-[#1A1A1A]">
              <form onSubmit={handleAddTask} className="flex items-center gap-3">
                <div className="relative flex-grow">
                  <input
                      type="text"
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                      placeholder="Adicionar nova tarefa ou prioridade..."
                      className="w-full bg-[#111111] border border-zinc-700 rounded-sm py-3 pl-4 pr-10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all"
                  />
                  <Plus className="absolute right-3 top-3.5 w-5 h-5 text-zinc-500" />
                </div>
                <button
                    type="submit"
                    disabled={!newTaskText.trim()}
                    className="bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-bold py-3 px-6 rounded-sm shadow-[0_0_15px_rgba(250,190,1,0.2)] transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide text-sm"
                >
                  Adicionar
                </button>
              </form>
            </div>

            {/* LISTA */}
            <div className="divide-y divide-white/5">
              {isLoading ? (
                  <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 text-[#FABE01] animate-spin" />
                    <p className="text-zinc-500 text-sm">Sincronizando tarefas...</p>
                  </div>
              ) : tasks.length === 0 ? (
                  <div className="p-12 text-center text-zinc-500">
                    <p>Nenhuma tarefa definida para esta semana.</p>
                  </div>
              ) : (
                  tasks.map(task => (
                      <div
                          key={task.id}
                          onClick={() => handleToggleTask(task.id)}
                          className={`
                                group flex items-center p-5 cursor-pointer transition-all duration-200
                                ${task.completed ? 'bg-black/20 hover:bg-black/30' : 'hover:bg-white/[0.02]'}
                            `}
                      >
                        {/* Checkbox Customizado */}
                        <div className={`mr-4 transition-colors ${task.completed ? 'text-[#FABE01]' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
                          {task.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                        </div>

                        {/* Texto da Tarefa */}
                        <span className={`flex-1 text-sm font-medium transition-all ${task.completed ? 'text-zinc-500 line-through decoration-zinc-700' : 'text-zinc-200'}`}>
                                {task.text}
                            </span>

                        {/* Botão Excluir (Só aparece no hover) */}
                        <button
                            onClick={(e) => handleDeleteTask(task.id, e)}
                            className="ml-4 p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Excluir Tarefa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
  );
};

export default WeeklyUpdatesView;