import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../utils/firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { CalendarEvent, UserProfile, Empresa } from '../types';
import { parseEmpresa, statusLabel } from '../utils/empresas';
import { getClientStage, CLIENT_STAGES, stageView, needsClientAction, needsAgencyAction } from '../utils/eventState';
import { summarizeSla, slaAtual, slaClasses } from '../utils/sla';
import CalendarView from './CalendarView';
import ClientProductionView from './ClientProductionView';
import WeeklyUpdatesView from './WeeklyUpdatesView';
import MateriaisView from './MateriaisView';
import ClientReportsView from './ClientReportsView';
import ResolverCapas from './ResolverCapas';
import { AppSidebar, MobileTopBar, NavGroup } from './AppSidebar';
import PersonCard, { SELO_ATIVO } from './PersonCard';
import PersonDetailModal, { PersonDetailAcao } from './PersonDetailModal';
import { PERMISSION_LABEL } from '../utils/permissions';
import { auth } from '../utils/firebase';
import { isAdmin } from '../utils/permissions';
import { PageHeader, StatTile, Card } from './ui';
import { getTypeStyles } from '../utils/eventStyles';
import {
    ArrowLeft, LayoutDashboard, Calendar, ClipboardList, Target,
    DownloadCloud, FileBarChart, Building2, Loader2, AlertTriangle, Clock, CalendarClock, KeyRound, Users,
    ImageOff, ArrowRight, Check, ChevronDown
} from 'lucide-react';

type Section = 'overview' | 'calendar' | 'production' | 'weekly' | 'files' | 'reports' | 'acessos';

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
    { id: 'reports', label: 'Relatórios', icon: FileBarChart },
    // O acesso de um cliente pertence AO CLIENTE, e por isso vive aqui.
    // Antes essas contas apareciam misturadas na Equipe & Permissoes da agencia,
    // onde repetiam o nome da empresa em dois campos e mostravam "Permissão:
    // Cliente" embaixo de um titulo que ja dizia Clientes.
    { id: 'acessos', label: 'Acessos', icon: KeyRound }
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

    // Contas vinculadas a ESTE cliente. Carregadas so quando a secao abre: e uma
    // leitura da colecao usuarios inteira, e nao faz sentido paga-la em toda
    // visita ao espaco de trabalho.
    const souAdmin = isAdmin(auth.currentUser?.email);
    const [acessos, setAcessos] = useState<UserProfile[]>([]);
    const [carregandoAcessos, setCarregandoAcessos] = useState(false);
    const [avisoAcesso, setAvisoAcesso] = useState('');
    /** Contato com a ficha aberta. O card da lista e so a porta de entrada. */
    const [fichaPessoa, setFichaPessoa] = useState<UserProfile | null>(null);

    /** Qual pendencia da visao geral esta expandida. Uma por vez. */
    const [expandida, setExpandida] = useState<string | null>(null);
    /**
     * Conteudo a abrir no quadro de producao.
     *
     * A visao geral nao monta o editor de post: ele precisa dos handlers de
     * salvar e excluir, que ja vivem no quadro. Em vez de duplicar essa logica
     * aqui, a visao geral TROCA DE SECAO pedindo o post - uma fonte para as
     * escritas, e o modal abre igual em qualquer caminho.
     */
    const [abrirEventoId, setAbrirEventoId] = useState<string | null>(null);
    const abrirConteudo = (eventId: string) => {
        setAbrirEventoId(eventId);
        setSection('production');
    };

    /**
     * Ficha do cliente - @, nicho e situacao.
     *
     * Uma leitura por abertura. Vale a pena: sem ela a tela abria com o ID do
     * documento no Firestore como subtitulo, que nao identifica nada para quem
     * trabalha aqui.
     */
    const [ficha, setFicha] = useState<Empresa | null>(null);
    useEffect(() => {
        if (!empresaId) return;
        let vivo = true;
        db.collection('empresas').doc(empresaId).get()
            .then(doc => { if (vivo && doc.exists) setFicha(parseEmpresa(doc.id, doc.data() || {})); })
            .catch(console.error);
        return () => { vivo = false; };
    }, [empresaId]);

    const carregarAcessos = React.useCallback(async () => {
        setCarregandoAcessos(true);
        setAvisoAcesso('');
        try {
            const snap = await db.collection('usuarios').where('empresaId', '==', empresaId).get();
            setAcessos(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
        } catch (e) {
            console.error(e);
            setAvisoAcesso('Não foi possível carregar os acessos.');
        } finally { setCarregandoAcessos(false); }
    }, [empresaId]);

    useEffect(() => {
        if (section === 'acessos') void carregarAcessos();
    }, [section, carregarAcessos]);

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
                            date: (data.date as firebase.firestore.Timestamp)?.toDate() || new Date(),
                            prazoProducao: (data.prazoProducao as firebase.firestore.Timestamp | undefined)?.toDate() || null
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
            semCapa: events.filter(e => !e.previewUrl && !e.coverUrl).length,
            // Prazo de PRODUCAO. Este espaco de trabalho e da agencia, entao
            // pode aparecer aqui; no portal do cliente, nao.
            prazos: summarizeSla(events)
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
                return (
                    <>
                        {/* Unica coisa que so existia na tela de calendarios da
                            agencia, que era este mesmo componente com um seletor
                            de cliente em cima. */}
                        <ResolverCapas empresaId={empresaId} events={events} />
                        <CalendarView empresaId={empresaId} empresaNome={empresaNome} perfilHandle={ficha?.handle} userRole="agencia" userEmail={userEmail} userName={userName} />
                    </>
                );
            case 'production':
                return (
                    <ClientProductionView
                        empresaId={empresaId}
                        userEmail={userEmail}
                        userName={userName}
                        onIrParaCalendario={() => setSection('calendar')}
                        perfilHandle={ficha?.handle}
                        abrirEventoId={abrirEventoId}
                        onEventoAberto={() => setAbrirEventoId(null)}
                    />
                );
            case 'weekly':
                return <WeeklyUpdatesView empresaId={empresaId} />;
            case 'files':
                return <MateriaisView empresaId={empresaId} userRole="agencia" />;
            case 'reports':
                return <ClientReportsView empresaId={empresaId} userRole="agencia" userName={userName} />;
            case 'acessos':
                return renderAcessos();
            default:
                return renderOverview();
        }
    };

    /**
     * Quem consegue entrar no portal DESTE cliente.
     *
     * A permissao nao e editavel: cliente cadastrado e sempre cliente. A empresa
     * tambem nao - ela e definida no vinculo e nao muda por rotina; o que muda,
     * quando o cliente pede, e o NOME da empresa, na ficha dele. Por isso aqui so
     * existem senha e remocao.
     */
    const renderAcessos = () => (
        <div>
            <PageHeader
                title="Acessos"
                subtitle={`Quem consegue entrar no portal de ${empresaNome}.`}
            />

            {avisoAcesso && (
                <p className="text-red-400 text-sm mb-4 flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {avisoAcesso}
                </p>
            )}

            {carregandoAcessos ? (
                <div className="py-16 flex justify-center"><Loader2 className="w-7 h-7 text-[#FABE01] animate-spin" /></div>
            ) : acessos.length === 0 ? (
                <div className="py-14 px-6 text-center border border-dashed border-white/10 rounded-card">
                    <span className="w-14 h-14 mx-auto mb-4 rounded-card bg-white/[0.03] flex items-center justify-center">
                        <Users className="w-7 h-7 text-zinc-600" />
                    </span>
                    <p className="text-white font-bold mb-1">Ninguém tem acesso ainda</p>
                    <p className="text-zinc-500 text-sm max-w-md mx-auto leading-relaxed">
                        Quando alguém do cliente criar conta, vincule em <strong className="text-zinc-300">Equipe → Aguardando vínculo</strong>.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {acessos.map(pessoa => (
                        <PersonCard
                            key={pessoa.id}
                            pessoa={pessoa}
                            selo={SELO_ATIVO}
                            subtitulo={pessoa.cargo || 'Contato do cliente'}
                            campos={[{ rotulo: 'Permissão', valor: PERMISSION_LABEL.cliente }]}
                            onAbrir={() => setFichaPessoa(pessoa)}
                        />
                    ))}
                </div>
            )}
        </div>
    );

    /**
     * VISAO GERAL do cliente.
     *
     * Era uma grade de oito numeros do mesmo tamanho, quase todos zero, e nada
     * dizia o que fazer com eles. Numero nao e resposta: "3 aguardando o cliente"
     * so vira acao quando a tela diz que a bola esta com ele e leva ao lugar de
     * cobrar. Agora a tela abre com O QUE EXIGE ACAO, em ordem de urgencia e com
     * um caminho por linha; os totais viram uma faixa discreta embaixo, porque
     * sao contexto, nao tarefa.
     *
     * O ID DA EMPRESA SAIU do subtitulo. Era o id do documento no Firestore -
     * ninguem na agencia precisa dele, e ocupava a linha onde cabe o que
     * identifica o cliente de verdade: @ do Instagram, nicho e situacao.
     */
    const renderOverview = () => {
        /**
         * As pendencias, com OS CONTEUDOS dentro.
         *
         * A contagem vem do tamanho da lista, e nao de um contador calculado em
         * outro lugar: com duas fontes, o numero e a lista podiam discordar - a
         * linha dizendo "6" e a expansao mostrando 5.
         */
        const atrasadoPor = (dono: 'agencia' | 'cliente') => events.filter(e => {
            const sla = slaAtual(e);
            return sla?.estourado && sla.dono === dono;
        });

        const pendencias = [
            {
                chave: 'atrasoEquipe',
                titulo: 'Atrasado com a equipe',
                detalhe: 'Produção vencida ou ajuste passado de 2 dias úteis.',
                tom: 'erro' as const,
                icone: AlertTriangle,
                itens: atrasadoPor('agencia')
            },
            {
                chave: 'ajuste',
                titulo: 'Ajuste pedido pelo cliente',
                detalhe: 'Ele decidiu e está esperando a equipe voltar com a correção.',
                tom: 'atencao' as const,
                icone: ClipboardList,
                itens: events.filter(needsAgencyAction)
            },
            {
                chave: 'atrasoCliente',
                titulo: 'Atrasado com o cliente',
                detalhe: 'A janela de revisão fechou sem decisão — cabe renegociar ou publicar.',
                tom: 'atencao' as const,
                icone: Clock,
                itens: atrasadoPor('cliente')
            },
            {
                chave: 'semCapa',
                titulo: 'Sem capa definida',
                detalhe: 'A prévia do feed mostra um espaço vazio no lugar da peça.',
                tom: 'neutro' as const,
                icone: ImageOff,
                itens: events.filter(e => !e.midias?.length && !e.previewUrl && !e.coverUrl)
            }
        ]
            .map(p => ({
                ...p,
                // Mais urgente primeiro dentro da propria linha: quem expande quer
                // atacar o pior, nao ler em ordem de cadastro.
                itens: [...p.itens].sort((a, b) => a.date.getTime() - b.date.getTime())
            }))
            .filter(p => p.itens.length > 0);

        const TONS = {
            erro: 'border-red-500/25 bg-red-500/[0.06] text-red-400',
            atencao: 'border-[#FABE01]/25 bg-[#FABE01]/[0.06] text-[#FABE01]',
            neutro: 'border-white/10 bg-white/[0.02] text-zinc-300'
        };

        return (
            <div className="space-y-6">
                {/* IDENTIDADE do cliente, no lugar do id do documento. */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
                            <span className="w-1.5 h-7 rounded-full bg-[#FABE01] shrink-0" />
                            {empresaNome}
                        </h1>
                        <div className="flex items-center gap-2 flex-wrap mt-2 ml-4">
                            {ficha?.handle && <span className="text-xs text-zinc-500">@{ficha.handle}</span>}
                            {ficha?.segmento && (
                                <span className="text-[10px] font-medium text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full">
                                    {ficha.segmento}
                                </span>
                            )}
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusLabel(ficha?.status).cor}`}>
                                {statusLabel(ficha?.status).label}
                            </span>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="py-16 flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-[#FABE01] animate-spin" />
                        <p className="text-zinc-500 text-sm">Carregando dados do cliente...</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                            {/* PRECISA DE ACAO. Ocupa dois tercos porque e a razao
                                de alguem abrir esta tela. */}
                            <section className="lg:col-span-2 bg-[#1A1A1A] border border-white/5 rounded-card overflow-hidden">
                                <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                                    <h2 className="text-sm font-bold text-white tracking-tight">Precisa de ação</h2>
                                    {pendencias.length > 0 && (
                                        <span className="text-[11px] font-semibold text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full">
                                            {pendencias.length}
                                        </span>
                                    )}
                                    <span className="ml-auto text-[10px] font-semibold text-zinc-500 bg-white/5 px-2 py-0.5 rounded-full">
                                        interno · o cliente não vê
                                    </span>
                                </div>

                                {pendencias.length === 0 ? (
                                    <div className="px-5 py-10 text-center">
                                        <span className="w-11 h-11 mx-auto mb-3 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                            <Check className="w-5 h-5 text-emerald-400" />
                                        </span>
                                        <p className="text-white font-semibold text-sm">Nada exigindo ação</p>
                                        <p className="text-zinc-500 text-xs mt-1 leading-relaxed max-w-sm mx-auto">
                                            Sem atraso, sem ajuste em aberto e sem prazo vencendo neste cliente.
                                        </p>
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-white/5">
                                        {pendencias.map(p => {
                                            const Icone = p.icone;
                                            const aberta = expandida === p.chave;
                                            return (
                                                <li key={p.chave}>
                                                    {/* A linha ABRE a lista em vez de sair da tela.
                                                        Antes ela levava para o quadro inteiro e a
                                                        pessoa tinha que reencontrar ali os 6 posts
                                                        que a linha acabou de contar. */}
                                                    <button
                                                        onClick={() => setExpandida(aberta ? null : p.chave)}
                                                        aria-expanded={aberta}
                                                        className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-white/[0.03] transition-colors group"
                                                    >
                                                        <span className={`w-11 h-11 shrink-0 rounded-control border flex items-center justify-center font-bold ${TONS[p.tom]}`}>
                                                            {p.itens.length}
                                                        </span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                                                                <Icone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                                                {p.titulo}
                                                            </span>
                                                            <span className="block text-xs text-zinc-500 mt-0.5 leading-relaxed">
                                                                {p.detalhe}
                                                            </span>
                                                        </span>
                                                        <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-zinc-500 group-hover:text-[#FABE01] transition-colors">
                                                            <span className="hidden sm:inline">{aberta ? 'fechar' : 'ver quais'}</span>
                                                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${aberta ? 'rotate-180' : ''}`} />
                                                        </span>
                                                    </button>

                                                    {aberta && (
                                                        <ul className="bg-black/25 border-t border-white/5 divide-y divide-white/[0.04]">
                                                            {p.itens.map(evento => {
                                                                const sla = slaAtual(evento);
                                                                const styles = getTypeStyles(evento.type);
                                                                return (
                                                                    <li key={evento.id}>
                                                                        {/* Clicar CAI NO CONTEUDO: abre o
                                                                            post no quadro de produção, com
                                                                            as duas abas na mão. */}
                                                                        <button
                                                                            onClick={() => abrirConteudo(evento.id)}
                                                                            className="w-full flex items-center gap-3 pl-5 pr-4 py-2.5 text-left hover:bg-white/[0.04] transition-colors group"
                                                                        >
                                                                            <span className={`w-1 h-8 rounded-full shrink-0 ${styles.dot}`} />
                                                                            <span className="min-w-0 flex-1">
                                                                                <span className="block text-[13px] text-zinc-100 truncate">
                                                                                    {evento.title || '(sem título)'}
                                                                                </span>
                                                                                <span className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                                                    <span className="text-[10px] text-zinc-500">
                                                                                        {evento.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                                                                    </span>
                                                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-chip uppercase tracking-wider ${styles.label}`}>
                                                                                        {evento.type || 'sem formato'}
                                                                                    </span>
                                                                                    {sla && (
                                                                                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-chip border ${slaClasses(sla.tone)}`}>
                                                                                            {sla.label}
                                                                                        </span>
                                                                                    )}
                                                                                </span>
                                                                            </span>
                                                                            <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-[#FABE01] shrink-0 transition-colors" />
                                                                        </button>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </section>

                            <div className="space-y-4">
                                {/* PROXIMA ENTREGA. Pergunta que se faz ao abrir o
                                    cliente, e antes exigia varrer o calendario. */}
                                <section className="bg-[#1A1A1A] border border-white/5 rounded-card p-5">
                                    <p className="text-[11px] text-zinc-500 font-medium mb-2.5">Próxima entrega</p>
                                    {stats.proximo ? (
                                        <button onClick={() => setSection('calendar')} className="w-full text-left group">
                                            <p className="text-white font-bold leading-snug group-hover:text-[#FABE01] transition-colors">
                                                {stats.proximo.title || '(sem título)'}
                                            </p>
                                            <p className="text-xs text-zinc-400 mt-1.5 first-letter:uppercase">
                                                {stats.proximo.date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                                            </p>
                                            <span className={`inline-block mt-2 text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
                                                CLIENT_STAGES[getClientStage(stats.proximo)].bg
                                            } ${CLIENT_STAGES[getClientStage(stats.proximo)].text} ${
                                                CLIENT_STAGES[getClientStage(stats.proximo)].border
                                            }`}>
                                                {stageView(getClientStage(stats.proximo), 'agencia').label}
                                            </span>
                                        </button>
                                    ) : (
                                        <p className="text-zinc-500 text-sm">Nada agendado para os próximos dias.</p>
                                    )}
                                </section>

                                {/* AGUARDANDO O CLIENTE nao e pendencia da equipe -
                                    e informacao. Por isso sai da lista de acoes e
                                    fica aqui, sem cor de alarme. */}
                                <section className="bg-[#1A1A1A] border border-white/5 rounded-card p-5">
                                    <p className="text-[11px] text-zinc-500 font-medium mb-1">Na mão do cliente</p>
                                    <p className="text-2xl font-bold text-white leading-none">
                                        {stats.aguardandoCliente}
                                        <span className="text-xs font-medium text-zinc-500 ml-1.5">aguardando aprovação</span>
                                    </p>
                                    {stats.prazos.proximos > 0 && (
                                        <p className="text-[11px] text-[#FABE01] mt-2.5 leading-relaxed">
                                            {stats.prazos.proximos} com prazo vencendo em até 2 dias.
                                        </p>
                                    )}
                                </section>
                            </div>
                        </div>

                        {/* NUMEROS DO MES: contexto, nao tarefa. Peso leve de
                            proposito - eles nao competem com a lista de acao. */}
                        <section>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">
                                Números
                            </p>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 rounded-card overflow-hidden">
                                {[
                                    { r: 'Neste mês', v: stats.noMes },
                                    { r: 'Publicados', v: stats.publicados },
                                    { r: 'Total na agenda', v: stats.total },
                                    { r: 'Ajustes em aberto', v: stats.prazos.ajustesAbertos }
                                ].map(item => (
                                    <div key={item.r} className="bg-[#1A1A1A] px-4 py-3.5">
                                        <p className="text-xl font-bold text-white leading-none">{item.v}</p>
                                        <p className="text-[11px] text-zinc-500 mt-1">{item.r}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </div>
        );
    };

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

            {/* FICHA DO CONTATO. Mesma tela da equipe, com as acoes deste
                contexto: aqui remover significa TIRAR O ACESSO, nao apagar a
                conta - o contato pode sair da empresa e voltar. */}
            {fichaPessoa && (() => {
                const pessoa = fichaPessoa;
                const acoes: PersonDetailAcao[] = [
                    {
                        label: 'Enviar redefinição de senha',
                        onClick: async () => {
                            try {
                                await auth.sendPasswordResetEmail(pessoa.email);
                                setAvisoAcesso('');
                                window.alert(`E-mail de redefinição enviado para ${pessoa.email}.`);
                            } catch (e) {
                                console.error(e);
                                setAvisoAcesso('Não foi possível enviar o e-mail.');
                                setFichaPessoa(null);
                            }
                        }
                    }
                ];
                if (souAdmin) {
                    acoes.push({
                        label: 'Remover acesso',
                        destrutiva: true,
                        onClick: async () => {
                            if (!window.confirm(`Remover o acesso de ${pessoa.email}? A conta deixa de entrar no portal.`)) return;
                            try {
                                await db.collection('usuarios').doc(pessoa.id).update({ empresaId: null });
                                setFichaPessoa(null);
                                await carregarAcessos();
                            } catch (e) {
                                console.error(e);
                                setAvisoAcesso('Não foi possível remover. Só administradores fazem isso.');
                                setFichaPessoa(null);
                            }
                        }
                    });
                }
                return (
                    <PersonDetailModal
                        pessoa={pessoa}
                        selo={SELO_ATIVO}
                        empresaNome={empresaNome}
                        empresasParaAtividade={[{ id: empresaId, nome: empresaNome }]}
                        souAdmin={souAdmin}
                        autorEmail={auth.currentUser?.email}
                        acoes={acoes}
                        onClose={() => setFichaPessoa(null)}
                    />
                );
            })()}
        </div>
    );
};

export default ClientWorkspace;
