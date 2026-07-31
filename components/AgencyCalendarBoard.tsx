import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../utils/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { CalendarEvent } from '../types';
import { PendingCounts, subscribePendingCounts } from '../utils/posts';
import ClientSwitcher, { SwitcherEmpresa } from './ClientSwitcher';
import CalendarView from './CalendarView';
import FeedPreview from './FeedPreview';
import { ArrowLeft, Loader2, Building2, PanelRightClose, PanelRightOpen, ImageDown, Check, AlertTriangle } from 'lucide-react';
import { resolveDriveCover, describeCoverFailure, hasDriveApiKey } from '../utils/driveCover';

interface AgencyCalendarBoardProps {
    userEmail?: string | null;
    userName?: string | null;
    /** Ausente no modo embutido: como aba do painel nao existe "voltar". */
    onBack?: () => void;
    /** Renderiza dentro do painel, sem barra de voltar nem tela cheia. */
    embedded?: boolean;
}

/**
 * Tela de calendarios da agencia: troca de cliente no topo, calendario a
 * esquerda, previa do feed a direita.
 *
 * Por que so a agencia: o cliente pertence a uma empresa, entao seletor de
 * cliente nao faz sentido para ele. A previa do feed em si e reaproveitavel
 * (FeedPreview), e o modal do calendario ja atende os dois papeis.
 */
const AgencyCalendarBoard: React.FC<AgencyCalendarBoardProps> = ({ userEmail, userName, onBack, embedded = false }) => {
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

    // Resolucao de capas em lote.
    const [isResolving, setIsResolving] = useState(false);
    const [resolveProgress, setResolveProgress] = useState({ feito: 0, total: 0, ok: 0 });
    const [resolveReport, setResolveReport] = useState('');

    // Posts sem capa resolvida e sem escolha manual, mas com link de material
    // para tentar. Nao inclui quem ja tem previewUrl: sobrescrever a escolha
    // manual de alguem seria destruir trabalho.
    const pendingCovers = useMemo(
        () => events.filter(e => !e.previewUrl && !e.coverUrl && (e.url || e.finalUrl)),
        [events]
    );

    /**
     * Resolve as capas em serie, nao em paralelo.
     *
     * Disparar 80 fetches de uma vez rende 429 da Drive API e metade das capas
     * falha sem motivo aparente. Em serie leva mais tempo e termina.
     */
    const handleResolveCovers = async () => {
        if (!selectedId || isResolving || pendingCovers.length === 0) return;
        setIsResolving(true);
        setResolveReport('');
        setResolveProgress({ feito: 0, total: pendingCovers.length, ok: 0 });

        const falhas: Record<string, number> = {};
        let ok = 0;

        for (let i = 0; i < pendingCovers.length; i++) {
            const event = pendingCovers[i];
            const result = await resolveDriveCover(event.url || event.finalUrl);

            if (result.ok) {
                try {
                    await db.collection('empresas').doc(selectedId).collection('events').doc(event.id)
                        .update({ coverUrl: result.coverUrl, coverResolvedAt: new Date() });
                    ok++;
                } catch (error) {
                    console.error('Falha ao gravar capa:', error);
                    falhas['erro'] = (falhas['erro'] || 0) + 1;
                }
            } else {
                falhas[result.reason] = (falhas[result.reason] || 0) + 1;
            }

            setResolveProgress({ feito: i + 1, total: pendingCovers.length, ok });
        }

        const partes = [`${ok} de ${pendingCovers.length} capas resolvidas.`];
        Object.entries(falhas).forEach(([reason, count]) => {
            partes.push(`${count}: ${describeCoverFailure(reason as any)}`);
        });
        setResolveReport(partes.join(' '));
        setIsResolving(false);
    };

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
        <div className={embedded ? 'flex flex-col' : 'min-h-screen bg-[#111111] text-zinc-100 flex flex-col'}>

            {/* BARRA SUPERIOR */}
            <div className={embedded ? 'border-b border-white/5 mb-2' : 'sticky top-0 z-30 bg-[#111111]/95 backdrop-blur border-b border-white/5'}>
                <div className={`flex flex-wrap items-center justify-between gap-3 ${embedded ? 'py-1' : 'px-4 sm:px-8 py-3'}`}>
                    {onBack && !embedded ? (
                        <button
                            onClick={onBack}
                            className="flex items-center text-zinc-400 hover:text-[#FABE01] transition-colors font-medium text-sm shrink-0"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Voltar ao Painel
                        </button>
                    ) : <span />}

                    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    {/* Resolver capas: le a pasta do Drive de cada post e grava a
                        imagem de capa. Fica aqui, e nao automatico no carregamento,
                        porque sao N chamadas de rede - disparar isso a cada abertura
                        de tela queimaria cota sem o usuario pedir. */}
                    {selectedId && pendingCovers.length > 0 && hasDriveApiKey() && (
                        <button
                            onClick={handleResolveCovers}
                            disabled={isResolving}
                            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide bg-white/5 hover:bg-white/10 text-zinc-300 px-3 py-2 rounded-control transition-colors disabled:opacity-50"
                            title="Busca a capa na pasta do Drive de cada publicação"
                        >
                            {isResolving
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> {resolveProgress.feito}/{resolveProgress.total}</>
                                : <><ImageDown className="w-4 h-4" /> Resolver {pendingCovers.length} capa(s)</>}
                        </button>
                    )}

                    <button
                        onClick={() => setShowFeed(v => !v)}
                        className="hidden lg:flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-400 hover:text-white transition-colors"
                    >
                        {showFeed ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                        {showFeed ? 'Ocultar feed' : 'Mostrar feed'}
                    </button>
                    </div>
                </div>

                {resolveReport && (
                    <div className="px-4 sm:px-8 pb-3 flex items-start gap-2 text-xs">
                        {resolveProgress.ok === resolveProgress.total
                            ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />}
                        <span className="text-zinc-400 leading-relaxed flex-1">{resolveReport}</span>
                        <button onClick={() => setResolveReport('')} className="text-zinc-600 hover:text-zinc-300 shrink-0">
                            Fechar
                        </button>
                    </div>
                )}

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
                <div className={embedded ? 'flex-1 py-6' : 'flex-1 px-4 sm:px-8 py-6'}>
                    <div className="flex flex-col xl:flex-row gap-6 items-start max-w-[1800px] mx-auto">
                        <div className="flex-1 min-w-0 w-full">
                            {/* key força remontagem ao trocar de cliente: sem isso o
                                calendario reaproveitaria o estado do cliente anterior. */}
                            <CalendarView
                                key={selectedId}
                                empresaId={selectedId}
                                userRole="agencia"
                                userEmail={userEmail}
                                userName={userName}
                            />
                        </div>

                        {showFeed && (
                            <aside className="w-full xl:w-[380px] shrink-0">
                                <div className="xl:sticky xl:top-[180px]">
                                    {isLoadingEvents ? (
                                        <div className="bg-[#1A1A1A] border border-white/10 rounded-card p-10 flex flex-col items-center gap-3">
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
