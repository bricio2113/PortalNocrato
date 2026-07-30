import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../utils/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { CalendarEvent } from '../types';
import { PendingCounts, subscribePendingCounts } from '../utils/posts';
import ClientSwitcher, { SwitcherEmpresa } from './ClientSwitcher';
import CalendarView from './CalendarView';
import FeedPreview from './FeedPreview';
import { ArrowLeft, Loader2, Building2, PanelRightClose, PanelRightOpen } from 'lucide-react';

interface AgencyCalendarBoardProps {
    userEmail?: string | null;
    onBack: () => void;
}

/**
 * Tela de calendarios da agencia: troca de cliente no topo, calendario a
 * esquerda, previa do feed a direita.
 *
 * Por que so a agencia: o cliente pertence a uma empresa, entao seletor de
 * cliente nao faz sentido para ele. A previa do feed em si e reaproveitavel
 * (FeedPreview), e o modal do calendario ja atende os dois papeis.
 */
const AgencyCalendarBoard: React.FC<AgencyCalendarBoardProps> = ({ userEmail, onBack }) => {
    const [empresas, setEmpresas] = useState<SwitcherEmpresa[]>([]);
    const [isLoadingEmpresas, setIsLoadingEmpresas] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [pendingByEmpresa, setPendingByEmpresa] = useState<Record<string, PendingCounts>>({});

    // Eventos do cliente selecionado, para alimentar a previa do feed.
    // O CalendarView mantem a propria assinatura; esta e separada de proposito,
    // para o painel do feed nao depender de o calendario expor estado interno.
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState(false);

    // Em telas medias as tres regioes nao caberiam: o feed vira painel que o
    // usuario abre e fecha.
    const [showFeed, setShowFeed] = useState(true);

    useEffect(() => {
        let active = true;
        db.collection('empresas').get()
            .then(snapshot => {
                if (!active) return;
                const list = snapshot.docs
                    .map(doc => ({ id: doc.id, nome: doc.data().nome || doc.id }))
                    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
                setEmpresas(list);
                // Abre já no primeiro cliente: a tela sem selecao nao serve para nada.
                setSelectedId(prev => prev ?? (list[0]?.id ?? null));
            })
            .catch(error => console.error('Erro ao carregar empresas:', error))
            .finally(() => { if (active) setIsLoadingEmpresas(false); });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (empresas.length === 0) return;
        const unsubscribes = empresas.map(empresa =>
            subscribePendingCounts(empresa.id, counts =>
                setPendingByEmpresa(prev => ({ ...prev, [empresa.id]: counts }))
            )
        );
        return () => unsubscribes.forEach(fn => fn());
    }, [empresas]);

    useEffect(() => {
        if (!selectedId) return;
        setIsLoadingEvents(true);
        const unsubscribe = db.collection('empresas').doc(selectedId).collection('events')
            .onSnapshot(
                snapshot => {
                    setEvents(snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            ...data,
                            id: doc.id,
                            date: (data.date as firebase.firestore.Timestamp)?.toDate() || new Date()
                        } as CalendarEvent;
                    }));
                    setIsLoadingEvents(false);
                },
                error => { console.error(error); setIsLoadingEvents(false); }
            );
        return unsubscribe;
    }, [selectedId]);

    const selectedEmpresa = useMemo(
        () => empresas.find(e => e.id === selectedId) || null,
        [empresas, selectedId]
    );

    return (
        <div className="min-h-screen bg-[#111111] text-zinc-100 flex flex-col">

            {/* BARRA SUPERIOR */}
            <div className="sticky top-0 z-30 bg-[#111111]/95 backdrop-blur border-b border-white/5">
                <div className="px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
                    <button
                        onClick={onBack}
                        className="flex items-center text-zinc-400 hover:text-[#FABE01] transition-colors font-medium text-sm shrink-0"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Voltar ao Painel
                    </button>

                    <button
                        onClick={() => setShowFeed(v => !v)}
                        className="hidden lg:flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-400 hover:text-white transition-colors"
                    >
                        {showFeed ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                        {showFeed ? 'Ocultar feed' : 'Mostrar feed'}
                    </button>
                </div>

                {isLoadingEmpresas ? (
                    <div className="px-4 sm:px-8 py-6 flex items-center gap-2 text-zinc-500 text-sm border-t border-white/5">
                        <Loader2 className="w-4 h-4 animate-spin" /> Carregando clientes...
                    </div>
                ) : empresas.length === 0 ? (
                    <div className="px-4 sm:px-8 py-6 border-t border-white/5">
                        <p className="text-zinc-400 text-sm">
                            Nenhuma empresa cadastrada. Vincule um usuário a uma empresa na aba Equipe &amp; Permissões.
                        </p>
                    </div>
                ) : (
                    <ClientSwitcher
                        empresas={empresas}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        pendingByEmpresa={pendingByEmpresa}
                        search={search}
                        onSearchChange={setSearch}
                    />
                )}
            </div>

            {/* CORPO: CALENDARIO + FEED */}
            {selectedId && selectedEmpresa ? (
                <div className="flex-1 px-4 sm:px-8 py-6">
                    <div className="flex flex-col xl:flex-row gap-6 items-start max-w-[1800px] mx-auto">
                        <div className="flex-1 min-w-0 w-full">
                            {/* key força remontagem ao trocar de cliente: sem isso o
                                calendario reaproveitaria o estado do cliente anterior. */}
                            <CalendarView
                                key={selectedId}
                                empresaId={selectedId}
                                userRole="agencia"
                                userEmail={userEmail}
                            />
                        </div>

                        {showFeed && (
                            <aside className="w-full xl:w-[380px] shrink-0">
                                <div className="xl:sticky xl:top-[180px]">
                                    {isLoadingEvents ? (
                                        <div className="bg-[#1A1A1A] border border-white/10 rounded-xl p-10 flex flex-col items-center gap-3">
                                            <Loader2 className="w-6 h-6 text-[#FABE01] animate-spin" />
                                            <p className="text-zinc-500 text-xs">Montando prévia do feed...</p>
                                        </div>
                                    ) : (
                                        <FeedPreview
                                            events={events}
                                            empresaNome={selectedEmpresa.nome}
                                        />
                                    )}
                                </div>
                            </aside>
                        )}
                    </div>
                </div>
            ) : !isLoadingEmpresas && empresas.length > 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <Building2 className="w-12 h-12 text-zinc-700" />
                    <p className="text-zinc-400">Escolha um cliente acima para ver o calendário.</p>
                </div>
            ) : null}
        </div>
    );
};

export default AgencyCalendarBoard;
