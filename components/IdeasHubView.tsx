

import React, { useState, useEffect } from 'react';
import { Idea } from '../types';
import { INITIAL_IDEAS } from '../constants';
import { db } from '../utils/firebase';
// Fix: Import firebase for Timestamp type and use v8 Firestore API
// Fix: Use compat imports for Firebase v8 API
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

interface IdeasHubViewProps {
    empresaId: string;
}

const IdeasHubView: React.FC<IdeasHubViewProps> = ({ empresaId }) => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [newIdea, setNewIdea] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) return;

    const fetchIdeas = async () => {
      setIsLoading(true);
      try {
        // Fix: Use Firebase v8 collection/orderBy/get methods
        const ideasCollection = db.collection('empresas').doc(empresaId).collection('ideas');
        const q = ideasCollection.orderBy('timestamp', 'desc');
        const querySnapshot = await q.get();

        if (querySnapshot.empty) {
          // Fix: Use Firebase v8 collection.add method
          const seedingPromises = INITIAL_IDEAS.map(idea => ideasCollection.add(idea));
          await Promise.all(seedingPromises);
          const newSnapshot = await q.get();
          const ideasData = newSnapshot.docs.map(doc => {
            const data = doc.data();
            // Fix: Use firebase.firestore.Timestamp
            return { id: doc.id, ...data, timestamp: (data.timestamp as firebase.firestore.Timestamp).toDate() } as Idea
          });
          setIdeas(ideasData);
        } else {
          const ideasData = querySnapshot.docs.map(doc => {
            const data = doc.data();
            // Fix: Use firebase.firestore.Timestamp
            return { id: doc.id, ...data, timestamp: (data.timestamp as firebase.firestore.Timestamp).toDate() } as Idea
          });
          setIdeas(ideasData);
        }
      } catch (error) {
        console.error("Error fetching ideas: ", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchIdeas();
  }, [empresaId]);

  const handleSubmitIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newIdea.trim() === '') return;
    
    try {
      // Fix: Use Firebase v8 collection/add methods
      const ideasCollection = db.collection('empresas').doc(empresaId).collection('ideas');
      const ideaObject: Omit<Idea, 'id'> = {
        text: newIdea.trim(),
        author: 'Cliente',
        timestamp: new Date()
      };
      const docRef = await ideasCollection.add(ideaObject);
      setIdeas([{ id: docRef.id, ...ideaObject }, ...ideas]);
      setNewIdea('');
    } catch (error) {
      console.error("Error submitting idea: ", error);
    }
  };

  return (
    <div>
      <header className="mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-amber-600 dark:text-amber-400 tracking-wide cursor-default select-none">Hub de Ideias</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg cursor-default select-none">Compartilhe suas ideias e inspire nossa próxima grande campanha.</p>
      </header>
      <div className="space-y-12">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg dark:shadow-2xl dark:shadow-black/20 p-8">
          <form onSubmit={handleSubmitIdea}>
            <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2 tracking-wide">Tem uma nova ideia?</h3>
            <p className="text-base text-slate-600 dark:text-slate-400 mb-6">
              Adoramos ouvir suas sugestões! Escreva abaixo e clique em "Enviar Ideia".
            </p>
            <textarea
              value={newIdea}
              onChange={(e) => setNewIdea(e.target.value)}
              rows={4}
              placeholder="Ex: Uma campanha de reels mostrando os bastidores da empresa..."
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm p-4 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
            ></textarea>
            <div className="flex justify-end items-center mt-6">
              <button type="submit" className="bg-amber-500 text-slate-900 py-3 px-6 rounded-lg shadow-md hover:bg-amber-600 font-semibold disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-200" disabled={!newIdea.trim()}>
                Enviar Ideia
              </button>
            </div>
          </form>
        </div>

        {isLoading ? (
            <div className="text-center p-8 text-slate-500 dark:text-slate-400">Carregando ideias...</div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {ideas.map(idea => (
                <div key={idea.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-lg dark:shadow-2xl dark:shadow-black/20 p-6 flex flex-col transition-transform hover:scale-[1.02]">
                <p className="text-slate-700 dark:text-slate-300 flex-1 mb-6 text-lg leading-relaxed">"{idea.text}"</p>
                <div className="pt-4 flex justify-between items-center text-sm text-slate-500">
                    <span className="font-medium">
                        Por: <span className="text-slate-600 dark:text-slate-400">{idea.author}</span>
                    </span>
                    <span className="font-mono">
                        {idea.timestamp.toLocaleDateString('pt-BR')}
                    </span>
                </div>
                </div>
            ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default IdeasHubView;