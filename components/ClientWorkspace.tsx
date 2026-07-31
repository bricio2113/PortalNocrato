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
import { AppSidebar, MobileTopBar, NavGroup } from './AppSidebar';
import { PageHeader, StatTile, Card } from './ui';
import {
    ArrowLeft, LayoutDashboard, Calendar, ClipboardList, Target,
    DownloadCloud, FileBarChart, Building2, Loader2
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

    const navGroups: NavGroup[] = [{
        title: 'Dados do cliente',
        items: SECTIONS.map(s => ({
            id: s.id,
            label: s.label,
            icon: s.icon,
            badge: s.id === 'calendar' ? stats.ajustePedido : undefined,
            badgeTone: 'amber' as const
        }))
    }];

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

    const renderOverview = () => (
        <div className="space-y-8">
            <PageHeader title={empresaNome} subtitle={`ID: ${empresaId}`} />

            {isLoading ? (
                <div className="py-16 flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-[#FABE01] animate-spin" />
                    <p className="text-zinc-500 text-sm">Carregando dados do cliente...</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <StatTile label="Publicações no mês" value={stats.noMes} icon={Calendar} tone="brand" hint={`${stats.total} no total`} />
                        <StatTile
                            label="Ajuste pedido"
                            value={stats.ajustePedido}
                            icon={ClipboardList}
                            tone={stats.ajustePedido > 0 ? 'attention' : 'positive'}
                            hint={stats.ajustePedido > 0 ? 'O cliente está esperando a equipe' : 'Nada pendente com a equipe'}
                            onClick={stats.ajustePedido > 0 ? () => setSection('calendar') : undefined}
                        />
                        <StatTile
                            label="Aguardando o cliente"
                            value={stats.aguardandoCliente}
                            icon={Target}
                            hint={stats.aguardandoCliente > 0 ? 'Pronto, esperando aprovação' : 'Sem nada para aprovar'}
                        />
                        <StatTile label="Publicados" value={stats.publicados} icon={FileBarChart} tone="positive" />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                        <div className="xl:col-span-2 space-y-4">
                            {/* Proxima entrega: e a pergunta que a agencia faz ao abrir
                                o cliente, e antes exigia varrer o calendario. */}
                            <Card className="p-5">
                                <p className="text-sm text-zinc-400 font-medium mb-3">Próxima entrega</p>
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
                                            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
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
                            </Card>

                            {stats.semCapa > 0 && (
                                <div className="border border-[#FABE01]/20 bg-[#FABE01]/5 rounded-card p-5">
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
            {/* Nao reaproveita o Sidebar do portal de proposito: aquele e o menu
                do cliente e traz "Meu Perfil", que nao faz sentido dentro dos
                dados de outra pessoa. So a casca visual e compartilhada. */}
            <AppSidebar
                groups={navGroups}
                activeId={section}
                onSelect={(id) => { setSection(id as Section); setIsNavOpen(false); }}
                isOpen={isNavOpen}
                onClose={() => setIsNavOpen(false)}
                brand={
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 shrink-0 rounded-chip bg-[#FABE01]/10 text-[#FABE01] flex items-center justify-center">
                            <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-white font-bold text-sm truncate leading-tight" title={empresaNome}>{empresaNome}</p>
                            <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">Cliente</p>
                        </div>
                    </div>
                }
                aboveNav={
                    <button
                        onClick={onBack}
                        className="flex items-center justify-center gap-2 w-full px-3 py-2.5 text-sm font-semibold rounded-control bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Voltar ao painel
                    </button>
                }
            />

            <main className="flex-1 min-w-0 md:h-screen md:overflow-y-auto">
                <MobileTopBar title={empresaNome} onOpenMenu={() => setIsNavOpen(true)} />

                <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto overflow-x-hidden">
                    {renderSection()}
                </div>
            </main>
        </div>
    );
};

export default ClientWorkspace;
