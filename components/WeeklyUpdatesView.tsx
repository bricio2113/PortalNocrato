


import React, { useState, useEffect } from 'react';
import { WeeklyTask } from '../types';
import { INITIAL_TASKS } from '../constants';
import { db } from '../utils/firebase';
// Fix: Use Firebase v8 Firestore API, removed unused v9 imports


const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

interface WeeklyUpdatesViewProps {
    empresaId: string;
}

const WeeklyUpdatesView: React.FC<WeeklyUpdatesViewProps> = ({ empresaId }) => {
  const [tasks, setTasks] = useState<WeeklyTask[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) return;

    const fetchTasks = async () => {
      setIsLoading(true);
      try {
        // Fix: Use Firebase v8 collection/get methods
        const tasksCollection = db.collection('empresas').doc(empresaId).collection('tasks');
        const querySnapshot = await tasksCollection.get();

        if (querySnapshot.empty) {
          // Fix: Use Firebase v8 collection.add method
          const seedingPromises = INITIAL_TASKS.map(task => tasksCollection.add(task));
          await Promise.all(seedingPromises);
          const newSnapshot = await tasksCollection.get();
          const tasksData = newSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WeeklyTask));
          setTasks(tasksData);
        } else {
          const tasksData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WeeklyTask));
          setTasks(tasksData);
        }
      } catch (error) {
        console.error("Error fetching tasks: ", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTasks();
  }, [empresaId]);

  const handleToggleTask = async (id: string) => {
    const taskToToggle = tasks.find(task => task.id === id);
    if (!taskToToggle) return;

    try {
      // Fix: Use Firebase v8 collection/doc/update methods
      const taskDocRef = db.collection('empresas').doc(empresaId).collection('tasks').doc(id);
      await taskDocRef.update({ completed: !taskToToggle.completed });
      setTasks(tasks.map(task => 
        task.id === id ? { ...task, completed: !task.completed } : task
      ));
    } catch (error) {
      console.error("Error toggling task: ", error);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskText.trim() === '') return;
    try {
      // Fix: Use Firebase v8 collection/add methods
      const tasksCollection = db.collection('empresas').doc(empresaId).collection('tasks');
      const newTaskData = {
        text: newTaskText.trim(),
        completed: false,
      };
      const docRef = await tasksCollection.add(newTaskData);
      const newTask: WeeklyTask = {
        id: docRef.id,
        ...newTaskData
      };
      setTasks([...tasks, newTask]);
      setNewTaskText('');
    } catch (error) {
      console.error("Error adding task: ", error);
    }
  };

  const handleDeleteTask = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Fix: Use Firebase v8 collection/doc/delete methods
      await db.collection('empresas').doc(empresaId).collection('tasks').doc(id).delete();
      setTasks(tasks.filter(task => task.id !== id));
    } catch (error) {
      console.error("Error deleting task: ", error);
    }
  };
  
  const completedTasks = tasks.filter(t => t.completed).length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <>
      <header className="mb-8">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white cursor-default select-none">Foco da Semana</h1>
          <p className="text-slate-800 dark:text-slate-300 mt-1 cursor-default select-none">Acompanhe as tarefas em que nossa equipe está trabalhando.</p>
        </div>
      </header>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Progresso da Semana</span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
            <div className="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
        
        {isLoading ? (
          <div className="text-center p-8 text-slate-500 dark:text-slate-400">Carregando tarefas...</div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <div 
                key={task.id}
                onClick={() => handleToggleTask(task.id)}
                className="group flex items-center p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-4 flex-shrink-0 ${task.completed ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-800'}`}>
                  {task.completed && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className={`flex-1 ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
                  {task.text}
                </span>
                <button
                  onClick={(e) => handleDeleteTask(task.id, e)}
                  className="ml-4 p-2 rounded-full text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Remover tarefa: ${task.text}`}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-6">
          <form onSubmit={handleAddTask} className="flex items-center gap-3">
              <input
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  placeholder="Adicionar nova tarefa..."
                  className="flex-grow border border-slate-300 dark:border-slate-600 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-slate-900 dark:text-white"
                  aria-label="Nova tarefa"
              />
              <button 
                type="submit" 
                className="bg-blue-600 text-white py-3 px-5 rounded-md shadow-sm hover:bg-blue-700 font-semibold transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed flex-shrink-0"
                disabled={!newTaskText.trim()}
                aria-label="Adicionar tarefa"
              >
                Adicionar
              </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default WeeklyUpdatesView;
