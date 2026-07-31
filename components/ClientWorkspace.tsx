import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../utils/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { CalendarEvent } from '../types';
import { getClientStage, CLIENT_STAGES, needsClientAction, needsAgencyAction } from '../utils/eventState';
import CalendarView from './CalendarView';
import ClientProductionView from './ClientProductionView';
import WeeklyUpdatesView from './WeeklyUpdatesView';
import IdeasHubView from './IdeasHubView';
import ClientReportsView from './ClientReportsView';
import FeedPreview from './FeedPreview';
import {
    ArrowLeft, LayoutDashboard, Calendar, ClipboardList, Target,
    DownloadCloud, FileBarChart, Building2, Loader2, X, Menu
} from 'lucide-react';

type Section = 'overview' | 'calendar' | 'production' | 'weekly' | 'files' | 'reports';

interface ClientWorkspaceProps {
    empresaId: string;
    empresaNome: string;
    userEmail?: string | null;
    userName?: string | null;
    onBack: () => void;
    /** Secao inicial: o card do painel abre direto no que foi clicado. */
    initialSection?: Section;
}

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'calendar', label: 'Calendário Editorial', icon: Calendar },
    { id: 'production', label: 'Produção', icon: ClipboardList },
    { id: 'weekly', label: 'Foco da Semana', icon: Target },
    { id: 'files', label: 'Arquivos & Materiais', icon: DownloadCloud },
    { id: 'reports', label: 'Relatórios', icon: FileBarChart }
];

/**
 * Espaco de trabalho de UM cliente, visto pela agencia.
 *
 * Antes a agencia entrava no cliente reaproveitando o PortalLayout - o layout do
 * proprio cliente. Dois efeitos ruins: o menu trazia "Meu Perfil" (o perfil de
 * quem estava olhando, no meio dos dados de outra pessoa), e calendario e
 * producao eram rotas separadas, o que obrigava voltar ao painel para trocar de
 * uma para outra. Aqui as secoes convivem num submenu proprio.
 */
const ClientWorkspace: React.FC<ClientWorkspaceProps> = ({
    empresaId, empresaNome, userEmail, userName, onBack, initialSection = 'overview'
}) => {
    const [section, setSection] = useState<Section>(initialSection);
    const [isNavOpen, setIsNavOpen] = useState(false);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Assinatura propria para os numeros macro e para a previa do feed. O
    // CalendarView tem a dele; separar evita acoplar as duas telas.
    useEffect(() => {
        if (!empresaId) return;
        setIsLoading(true);
        const unsubscribe = db.collection('empresas').doc(empresaId).collection('events')
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
                    setIsLoading(false);
                },
                error => { console.error(error); setIsLoading(false); }
            );
        return unsubscribe;
    }, [empresaId]);

    const stats = useMemo(() => {
        const agora = new Date();
        const proximos = events
            .filter(e => e.date >= agora && e.status !== 'Cancelado' && e.status !== 'Postado')
            .sort((a, b) => a.date.getTime() - b.date.getTime());

        const doMes = events.filter(e =>
            e.date.getMonth() === agora.getMonth() && e.date.getFullYear() === agora.getFullYear()
        );

        return {
            total: events.length,
            noMes: doMes.length,
            aguardandoCliente: events.filter(needsClientAction).length,
            ajustePedido: events.filter(needsAgencyAction).length,
            publicados: events.filter(e => e.status === 'Postado').length,
            proximo: proximos[0] || null,
            semCapa: events.filter(e => !e.previewUrl && !e.coverUrl).length
        };
    }, [events]);

    const navButton = (item: typeof SECTIONS[number]) => {
        const isActive = section === item.id;
        const badge = item.id === 'calendar' ? stats.ajustePedido : 0;
        return (
            <button
                key={item.id}
                onClick={() => { setSection(item.id); setIsNavOpen(false); }}
                className={`group flex items-center w-full px-4 py-3 text-sm font-medium rounded-sm transition-all relative ${
                    isActive ? 'bg-[#FABE01]/10 text-[#FABE01]' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
            >
                {isActive && <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#FABE01] rounded-r-full" />}
                <item.icon className={`w-5 h-5 mr-3 shrink-0 ${isActive ? 'text-[#FABE01]' : 'text-zinc-500 group-hover:text-white'}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {badge > 0 && (
                    <span className="ml-2 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-500 text-black text-[10px] font-bold">
                        {badge > 9 ? '9+' : badge}
                    </span>
                )}
            </button>
        );
    };

    const renderSection = () => {
        switch (section) {
            case 'calendar':
                return <CalendarView empresaId={empresaId} userRole="agencia" userEmail={userEmail} userName={userName} />;
            case 'production':
                return <ClientProductionView empresaId={empresaId} userEmail={userEmail} userName={userName} />;
            case 'weekly':
                return <WeeklyUpdatesView empresaId={empresaId} />;
            case 'files':
                return <IdeasHubView empresaId={empresaId} />;
            case 'reports':
                return <ClientReportsView empresaId={empresaId} userRole="agencia" userName={userName} />;
            default:
                return renderOverview();
        }
    };

    const statCard = (label: string, value: number | string, hint?: string, accent?: string) => (
        <div className="bg-[#1A1A1A] border border-white/5 rounded-sm p-5">
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-2xl sm:text-3xl font-bold ${accent || 'text-white'}`}>{value}</p>
            {hint && <p className="text-xs text-zinc-600 mt-1.5 leading-snug">{hint}</p>}
        </div>
    );

    const renderOverview = () => (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">{empresaNome}</h1>
                <p className="text-zinc-500 text-sm font-mono">ID: {empresaId}</p>
            </div>

            {isLoading ? (
                <div className="py-16 flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-[#FABE01] animate-spin" />
                    <p className="text-zinc-500 text-sm">Carregando dados do cliente...</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {statCard('Publicações no mês', stats.noMes, `${stats.total} no total`)}
                        {statCard(
                            'Ajuste pedido',
                            stats.ajustePedido,
                            stats.ajustePedido > 0 ? 'O cliente está esperando a equipe' : 'Nada pendente com a equipe',
                            stats.ajustePedido > 0 ? 'text-amber-400' : 'text-white'
                        )}
                        {statCard(
                            'Aguardando o cliente',
                            stats.aguardandoCliente,
                            stats.aguardandoCliente > 0 ? 'Pronto, esperando aprovação' : 'Sem nada para aprovar'
                        )}
                        {statCard('Publicados', stats.publicados)}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                        <div className="xl:col-span-2 space-y-4">
                            {/* Proxima entrega: e a pergunta que a agencia faz ao abrir
                                o cliente, e antes exigia varrer o calendario. */}
                            <div className="bg-[#1A1A1A] border border-white/5 rounded-sm p-5">
                                <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-3">Próxima entrega</p>
                                {stats.proximo ? (
                                    <button
                                        onClick={() => setSection('calendar')}
                                        className="w-full text-left group"
                                    >
                                        <p className="text-white font-bold group-hover:text-[#FABE01] transition-colors">
                                            {stats.proximo.title || '(sem título)'}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                            <span className="text-sm text-zinc-400">
                                                {stats.proximo.date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                                            </span>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider border ${
                                                CLIENT_STAGES[getClientStage(stats.proximo)].bg
                                            } ${CLIENT_STAGES[getClientStage(stats.proximo)].text} ${
                                                CLIENT_STAGES[getClientStage(stats.proximo)].border
                                            }`}>
                                                {CLIENT_STAGES[getClientStage(stats.proximo)].label}
                                            </span>
                                        </div>
                                    </button>
                                ) : (
                                    <p className="text-zinc-500 text-sm">Nada agendado para os próximos dias.</p>
                                )}
                            </div>

                            {stats.semCapa > 0 && (
                                <div className="border border-[#FABE01]/20 bg-[#FABE01]/5 rounded-sm p-5">
                                    <p className="text-white font-bold text-sm mb-1">
                                        {stats.semCapa} publicação(ões) sem capa definida
                                    </p>
                                    <p className="text-zinc-400 text-sm leading-relaxed">
                                        Sem capa, a prévia do feed mostra um espaço vazio no lugar da peça. Use "Resolver capas" na aba Calendário Editorial do painel.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="w-full max-w-md xl:max-w-none mx-auto xl:mx-0">
                            <FeedPreview events={events} empresaNome={empresaNome} />
                        </div>
                    </div>
                </>
            )}
        </div>
    );

    return (
        <div className="relative min-h-screen md:flex bg-[#111111] text-zinc-100">
            {/* OVERLAY MOBILE */}
            <div
                className={`fixed inset-0 bg-black/80 z-40 backdrop-blur-sm transition-opacity md:hidden ${
                    isNavOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
                onClick={() => setIsNavOpen(false)}
                aria-hidden="true"
            />

            {/* SUBMENU DO CLIENTE.
                Nao reaproveita o Sidebar do portal de proposito: aquele e o menu
                do cliente e traz "Meu Perfil", que nao faz sentido dentro dos
                dados de outra pessoa. */}
            <aside
                className={`fixed md:sticky top-0 left-0 z-50 h-screen w-72 bg-[#111111] border-r border-white/5 flex flex-col transform transition-transform md:translate-x-0 ${
                    isNavOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="px-4 py-5 border-b border-white/5">
                    <button
                        onClick={onBack}
                        className="flex items-center w-full px-4 py-3 mb-4 text-sm font-bold rounded-sm bg-[#FABE01] text-black hover:bg-[#FABE01]/90 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Voltar ao Painel
                    </button>

                    <div className="flex items-center gap-3 px-1">
                        <div className="w-9 h-9 shrink-0 rounded-sm bg-[#FABE01]/10 text-[#FABE01] flex items-center justify-center">
                            <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-white font-bold text-sm truncate" title={empresaNome}>{empresaNome}</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Cliente</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                    <p className="px-4 text-xs font-bold text-zinc-600 uppercase tracking-widest mb-3">Dados do cliente</p>
                    {SECTIONS.map(navButton)}
                </nav>
            </aside>

            <main className="flex-1 min-w-0 h-screen overflow-y-auto">
                <header className="md:hidden sticky top-0 bg-[#111111]/95 backdrop-blur border-b border-white/10 p-4 flex items-center justify-between z-30">
                    <p className="text-white font-bold truncate">{empresaNome}</p>
                    <button onClick={() => setIsNavOpen(true)} aria-label="Abrir menu do cliente" className="p-2 text-white shrink-0">
                        <Menu className="w-6 h-6" />
                    </button>
                </header>

                <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto overflow-x-hidden">
                    {renderSection()}
                </div>
            </main>
        </div>
    );
};

export default ClientWorkspace;
