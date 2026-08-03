import React, { useState, useEffect } from 'react';
import { db, auth } from '../utils/firebase';
import { DELETE_USER_ENDPOINT } from '../constants';
import { subscribePendingCounts, PendingCounts } from '../utils/posts';
import { UserProfile } from '../types';
import { getDisplayName, getInitials, isSafeImageSrc } from '../utils/avatar';
import { isAdmin, permissionLevel, PERMISSION_LABEL, PERMISSION_HINT } from '../utils/permissions';
import { Empresa } from '../types';
import { parseEmpresa, statusLabel } from '../utils/empresas';
import ClientFormModal from './ClientFormModal';
import AgencyCalendarBoard from './AgencyCalendarBoard';
import { AppSidebar, MobileTopBar, NavGroup } from './AppSidebar';
import { PageHeader, StatTile, greeting } from './ui';
import {
    LogOut, Calendar, Mail, Trash2, UserCog, Building2, Plus, Save,
    X, Search, Loader2, Users, LayoutDashboard, Briefcase,
    ArrowRight, Shield, ClipboardList, MessageSquareWarning, FileBarChart, Check, AlertTriangle, Pencil
} from 'lucide-react';

interface UserData {
    id: string;
    email: string;
    role: string;
    empresaId: string | null;
    nome?: string | null;
    sobrenome?: string | null;
    fotoUrl?: string | null;
    /** Profissao: "Social Media", "Designer". So admin altera (ver regras). */
    cargo?: string | null;
}

// A ficha do cliente agora e um tipo compartilhado (types.ts): antes eram so
// id e nome, e todo contato e contrato vivia fora do sistema.
type EmpresaData = Empresa;

type ClientSection = 'overview' | 'calendar' | 'production' | 'weekly' | 'files' | 'reports';

interface AgencyDashboardProps {
    handleLogout: () => void;
    /**
     * Abre o espaco de trabalho de um cliente.
     *
     * Substitui onViewClient + onViewClientTasks: dois caminhos separados
     * obrigavam voltar ao painel so para sair do calendario e entrar na
     * producao do MESMO cliente.
     */
    onOpenClient: (empresaId: string, nome: string, section?: ClientSection) => void;
    /** Abre a tela de perfil do proprio usuario da agencia. */
    onOpenProfile?: () => void;
    profile?: UserProfile | null;
    userEmail?: string | null;
    userName?: string | null;
}

// Empty state reutilizavel. O padrao aqui e sempre apontar a proxima acao -
// uma tela que so informa "0 itens" deixa o usuario sem saida.
const EmptyState: React.FC<{
    icon: React.ElementType;
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
}> = ({ icon: Icon, title, description, action }) => (
    <div className="col-span-full py-14 px-6 text-center border border-dashed border-white/10 rounded-card">
        <span className="w-14 h-14 mx-auto mb-4 rounded-card bg-white/[0.03] flex items-center justify-center">
            <Icon className="w-7 h-7 text-zinc-600" />
        </span>
        <p className="text-white font-bold mb-1">{title}</p>
        <p className="text-zinc-500 text-sm max-w-md mx-auto leading-relaxed">{description}</p>
        {action && (
            <button
                onClick={action.onClick}
                className="mt-6 inline-flex items-center gap-2 bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-semibold text-sm px-5 py-2.5 rounded-full transition-colors"
            >
                {action.label}
                <ArrowRight className="w-4 h-4" />
            </button>
        )}
    </div>
);


/**
 * Card de cliente com informacao macro.
 *
 * Antes existiam DOIS cards identicos para o mesmo cliente - um na Visao Geral e
 * um na aba Clientes -, ambos com os mesmos dois botoes e nenhum dado. O card
 * agora carrega o estado do cliente, e a superficie inteira e clicavel: abrir o
 * cliente e a acao principal, e os atalhos de secao sao secundarios.
 */
const ClientCard: React.FC<{
    empresa: EmpresaData;
    stats?: PendingCounts;
    usuarios: number;
    onOpen: (section?: ClientSection) => void;
    onDelete?: () => void;
    onEdit?: () => void;
}> = ({ empresa, stats, usuarios, onOpen, onDelete, onEdit }) => {
    const ajustes = stats?.aguardandoAgencia || 0;
    const aguardando = stats?.aguardandoCliente || 0;
    const atrasados = stats?.atrasados || 0;

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onOpen()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
            className={`group text-left bg-[#1A1A1A] border rounded-card p-5 cursor-pointer transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-[#FABE01] ${
                atrasados > 0 ? 'border-red-500/30 hover:border-red-500/60'
                    : ajustes > 0 ? 'border-amber-500/30 hover:border-amber-500/60'
                    : 'border-white/5 hover:border-[#FABE01]/40'
            }`}
        >
            <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 shrink-0 rounded-control bg-[#FABE01]/10 text-[#FABE01] flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-white font-bold leading-tight truncate group-hover:text-[#FABE01] transition-colors">
                        {empresa.nome}
                    </h3>
                    {/* @ e nicho: o card agora identifica o cliente, nao so o
                        nomeia. Antes a unica linha era a contagem de usuarios. */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        {empresa.handle && (
                            <span className="text-[11px] text-zinc-500 truncate">@{empresa.handle}</span>
                        )}
                        {empresa.segmento && (
                            <span className="text-[10px] font-medium text-zinc-400 bg-white/5 px-1.5 py-0.5 rounded-full truncate max-w-[10rem]">
                                {empresa.segmento}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusLabel(empresa.status).cor}`}>
                        {statusLabel(empresa.status).label}
                    </span>
                    {onEdit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(); }}
                            aria-label={`Editar ficha de ${empresa.nome}`}
                            title="Editar ficha"
                            className="text-zinc-600 hover:text-white p-1.5 rounded-full hover:bg-white/5 transition-colors"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(); }}
                            aria-label={`Excluir ${empresa.nome}`}
                            className="text-zinc-700 hover:text-red-500 p-1.5 rounded-full hover:bg-red-500/5 transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Numeros do cliente: e o que responde "como esta esse cliente?"
                sem precisar entrar nele. */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <div>
                    <p className="text-[11px] text-zinc-500">No mês</p>
                    <p className="text-xl font-bold text-white">{stats ? stats.noMes : '—'}</p>
                </div>
                <div>
                    <p className="text-[11px] text-zinc-500">Publicados</p>
                    <p className="text-xl font-bold text-white">{stats ? stats.publicados : '—'}</p>
                </div>
                <div>
                    <p className="text-[11px] text-zinc-500">Total</p>
                    <p className="text-xl font-bold text-white">{stats ? stats.total : '—'}</p>
                </div>
            </div>

            {usuarios === 0 && (
                <p className="text-[11px] text-amber-400/90 mb-3 leading-relaxed">
                    Nenhum usuário vinculado — ninguém do lado do cliente consegue entrar.
                </p>
            )}

            {(ajustes > 0 || aguardando > 0 || atrasados > 0) && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {/* Atraso de producao: interno, e o mais urgente do card. */}
                    {atrasados > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-1 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> {atrasados} atrasado(s)
                        </span>
                    )}
                    {ajustes > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-1 rounded-full">
                            <MessageSquareWarning className="w-3 h-3" /> {ajustes} ajuste(s)
                        </span>
                    )}
                    {aguardando > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/5 text-zinc-400 px-2 py-1 rounded-full">
                            {aguardando} aguardando o cliente
                        </span>
                    )}
                </div>
            )}

            {/* Atalhos de secao: levam direto ao lugar, sem passar pela visao
                geral do cliente. stopPropagation para nao disparar o card. */}
            <div className="flex flex-wrap gap-1.5 pt-3 border-t border-white/5">
                {([
                    ['calendar', 'Calendário', Calendar],
                    ['production', 'Produção', ClipboardList],
                    ['reports', 'Relatórios', FileBarChart]
                ] as const).map(([section, label, Icon]) => (
                    <button
                        key={section}
                        onClick={(e) => { e.stopPropagation(); onOpen(section); }}
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-white hover:bg-white/5 px-2.5 py-1.5 rounded-full transition-colors"
                    >
                        <Icon className="w-3 h-3" /> {label}
                    </button>
                ))}
            </div>
        </div>
    );
};

const AgencyDashboard: React.FC<AgencyDashboardProps> = ({ handleLogout, onOpenClient, onOpenProfile, profile, userEmail, userName }) => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [empresas, setEmpresas] = useState<EmpresaData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState('');
    const [activeTab, setActiveTab] = useState<'overview' | 'editorial' | 'clients' | 'team'>('overview');
    const [isNavOpen, setIsNavOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [pendingEmpresaChanges, setPendingEmpresaChanges] = useState<Record<string, string | null>>({});
    const [pendingRoleChanges, setPendingRoleChanges] = useState<Record<string, string>>({});
    const [pendingCargoChanges, setPendingCargoChanges] = useState<Record<string, string>>({});
    /** Card de colaborador aberto para edicao. Um por vez, de proposito. */
    const [editingUserId, setEditingUserId] = useState<string | null>(null);

    // FICHA DO CLIENTE. `null` fechado, `'novo'` criando, ou a empresa editada.
    //
    // Um caminho de criacao so, com duas portas: o botao "Novo cliente" e a
    // opcao "+ Novo cliente" no select de vinculo. Dois formularios diferentes
    // para a mesma coisa e a redundancia que confunde - e um deles sempre fica
    // esquecido quando um campo novo aparece.
    const [fichaAberta, setFichaAberta] = useState<'novo' | Empresa | null>(null);
    /** Usuario a vincular assim que o cliente for criado, se veio do select. */
    const [vincularApos, setVincularApos] = useState<string | null>(null);

    // Quem esta olhando: admin ou colaborador.
    //
    // Nao vem de estado nem do banco - e derivado do e-mail da sessao contra
    // ADMIN_EMAILS, a mesma lista que firestore.rules usa. Se um colaborador
    // forcar o botao pelo console, a regra recusa a escrita: a interface aqui
    // e conveniencia, nao a trava.
    const souAdmin = isAdmin(auth.currentUser?.email);

    // Pendencia por empresa: quais clientes pediram ajuste e estao esperando.
    // Uma assinatura por empresa - aceitavel no volume de um portal de agencia,
    // e o unico jeito de saber sem manter contadores denormalizados.
    const [pendingByEmpresa, setPendingByEmpresa] = useState<Record<string, PendingCounts>>({});

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const usersSnapshot = await db.collection('usuarios').get();
            setUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserData)));
            const empresasSnapshot = await db.collection('empresas').get();
            setEmpresas(empresasSnapshot.docs.map(doc => parseEmpresa(doc.id, doc.data())));
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        if (empresas.length === 0) return;
        const unsubscribes = empresas.map(empresa =>
            subscribePendingCounts(empresa.id, counts =>
                setPendingByEmpresa(prev => ({ ...prev, [empresa.id]: counts }))
            )
        );
        return () => unsubscribes.forEach(fn => fn());
    }, [empresas]);

    const empresasComAjuste = empresas.filter(e => (pendingByEmpresa[e.id]?.aguardandoAgencia || 0) > 0);
    const totalAjustes = empresasComAjuste.reduce(
        (sum, e) => sum + (pendingByEmpresa[e.id]?.aguardandoAgencia || 0), 0
    );

    // ATRASO DE PRODUCAO, somado em todos os clientes. Interno da agencia.
    const empresasAtrasadas = empresas.filter(e => (pendingByEmpresa[e.id]?.atrasados || 0) > 0);
    const totalAtrasados = empresasAtrasadas.reduce(
        (sum, e) => sum + (pendingByEmpresa[e.id]?.atrasados || 0), 0
    );

    const showNotification = (msg: string) => {
        setNotification(msg);
        setTimeout(() => setNotification(''), 4000);
    };

    const handleDeleteUser = async (userId: string) => {
        // Guarda de nivel repetida aqui, e nao so no botao: a interface esconde,
        // mas quem chamar pelo console recebe uma recusa legivel em vez do erro
        // cru de permissao do Firestore. A trava de verdade esta nas regras.
        if (!souAdmin) return showNotification('Apenas administradores podem fazer isso.');
        if (!window.confirm("ATENÇÃO: Deseja remover este usuário?")) return;
        try {
            // O ID token identifica quem esta pedindo a exclusao. A funcao
            // deleteUser precisa verifica-lo com admin.auth().verifyIdToken()
            // e conferir se o chamador e mesmo da agencia - sem isso o
            // endpoint continua aberto a qualquer um.
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) {
                showNotification('Sessão expirada. Faça login novamente.');
                return;
            }

            await db.collection('usuarios').doc(userId).delete();
            setUsers(prev => prev.filter(u => u.id !== userId));

            const response = await fetch(DELETE_USER_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ uid: userId })
            });

            if (!response.ok) {
                // O documento ja saiu do Firestore, mas a conta continua no
                // Auth: o usuario ainda consegue logar. Precisa ser visivel.
                showNotification('Documento removido, mas a conta de login permaneceu. Verifique no Firebase.');
                return;
            }

            showNotification('Usuário removido.');
        } catch (error) {
            showNotification('Erro ao excluir.');
        }
    };

    const handleDeleteEmpresa = async (empresaId: string) => {
        // Guarda de nivel repetida aqui, e nao so no botao: a interface esconde,
        // mas quem chamar pelo console recebe uma recusa legivel em vez do erro
        // cru de permissao do Firestore. A trava de verdade esta nas regras.
        if (!souAdmin) return showNotification('Apenas administradores podem fazer isso.');
        const linkedUsers = users.filter(u => u.empresaId === empresaId);
        
        const msg = linkedUsers.length > 0 
            ? `Esta empresa tem ${linkedUsers.length} usuário(s) vinculado(s). Deseja excluí-la e desvincular os usuários automaticamente?` 
            : "Excluir empresa definitivamente?";

        if (!window.confirm(msg)) return;

        try {
            await db.collection('empresas').doc(empresaId).delete();
            
            if (linkedUsers.length > 0) {
                const batch = db.batch();
                linkedUsers.forEach(u => {
                    batch.update(db.collection('usuarios').doc(u.id), { empresaId: null });
                });
                await batch.commit();
            }

            setEmpresas(prev => prev.filter(e => e.id !== empresaId));
            setUsers(prev => prev.map(u => u.empresaId === empresaId ? { ...u, empresaId: null } : u));
            showNotification('Empresa excluída com sucesso.');
        } catch (error) {
            showNotification('Erro ao excluir.');
        }
    };

    // EDICAO DE UM COLABORADOR.
    //
    // Antes os dois selects viviam abertos no card e cada um tinha o proprio
    // botao de salvar, que so aparecia depois de mexer. Resultado: nada dizia
    // se o que estava na tela era o valor atual ou uma alteracao ainda nao
    // gravada, e trocar permissao e empresa exigia dois saves. Agora o card e
    // leitura por padrao e a edicao e um estado explicito, com um Salvar so.
    const startUserEdit = (userId: string) => {
        setEditingUserId(userId);
        descartarRascunho(userId);
    };

    const descartarRascunho = (userId: string) => {
        setPendingRoleChanges(prev => { const n = { ...prev }; delete n[userId]; return n; });
        setPendingEmpresaChanges(prev => { const n = { ...prev }; delete n[userId]; return n; });
        setPendingCargoChanges(prev => { const n = { ...prev }; delete n[userId]; return n; });
    };

    const cancelUserEdit = (userId: string) => {
        setEditingUserId(null);
        descartarRascunho(userId);
    };

    const saveUserEdit = async (userId: string) => {
        // Guarda de nivel repetida aqui, e nao so no botao: a interface esconde,
        // mas quem chamar pelo console recebe uma recusa legivel em vez do erro
        // cru de permissao do Firestore. A trava de verdade esta nas regras.
        if (!souAdmin) return showNotification('Apenas administradores podem fazer isso.');
        const novoRole = pendingRoleChanges[userId];
        const novaEmpresa = pendingEmpresaChanges[userId];
        const novoCargo = pendingCargoChanges[userId];
        if (novoRole === undefined && novaEmpresa === undefined && novoCargo === undefined) {
            setEditingUserId(null);
            return;
        }

        // Uma escrita so: gravar em dois update() separados deixaria a conta
        // num estado meio-salvo se o segundo falhasse.
        const patch: Record<string, unknown> = {};
        if (novoRole !== undefined) patch.role = novoRole;
        if (novaEmpresa !== undefined) patch.empresaId = novaEmpresa;
        // String vazia grava null: um cargo "" apareceria como etiqueta em
        // branco no card.
        if (novoCargo !== undefined) patch.cargo = novoCargo.trim() || null;

        try {
            await db.collection('usuarios').doc(userId).update(patch);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...patch } as UserData : u));
            descartarRascunho(userId);
            setEditingUserId(null);
            showNotification('Alterações salvas.');
        } catch (e) {
            console.error(e);
            // Mantem o modo de edicao aberto: o rascunho continua na tela para
            // o usuario tentar de novo em vez de perder o que escolheu.
            showNotification('Não foi possível salvar. Tente novamente.');
        }
    };

    const handleEmpresaSelection = (userId: string, val: string) => {
        if (val === 'create_new') {
            // Mesma ficha completa do botao "Novo cliente". Antes esta opcao
            // abria um input de texto solto que criava o cliente com nome e
            // mais nada.
            setVincularApos(userId);
            setFichaAberta('novo');
            setPendingEmpresaChanges(prev => { const n = { ...prev }; delete n[userId]; return n; });
            return;
        }
        setPendingEmpresaChanges(prev => ({ ...prev, [userId]: val === 'null' ? null : val }));
    };

    /**
     * Cliente criado ou editado na ficha.
     *
     * Recarrega a lista em vez de inserir na mao: a ficha grava campos que este
     * componente nao conhece, e montar o objeto aqui deixaria a tela mostrando
     * uma versao incompleta ate o proximo refresh.
     */
    const handleFichaSalva = async (empresaId: string, nome: string) => {
        setFichaAberta(null);
        const paraVincular = vincularApos;
        setVincularApos(null);

        if (paraVincular) {
            try {
                await db.collection('usuarios').doc(paraVincular).update({ empresaId });
                setUsers(prev => prev.map(u => u.id === paraVincular ? { ...u, empresaId } : u));
                setEditingUserId(null);
                descartarRascunho(paraVincular);
                showNotification(`Cliente "${nome}" criado e vinculado.`);
            } catch (e) {
                console.error(e);
                showNotification(`Cliente "${nome}" criado, mas o vínculo falhou. Vincule na aba Equipe.`);
            }
        } else {
            showNotification(`Cliente "${nome}" salvo.`);
        }
        fetchData();
    };

    const handlePasswordReset = async (email: string) => {
        try {
            await auth.sendPasswordResetEmail(email);
            showNotification(`Email enviado para ${email}`);
        } catch (e) { showNotification('Erro ao enviar email'); }
    };

    // Busca por nome OU e-mail: quem digita "maria" espera achar a Maria, e nem
    // sempre o e-mail dela contem o nome.
    const filteredUsers = users.filter(u => {
        const term = searchTerm.toLowerCase();
        if (!term) return true;
        return u.email.toLowerCase().includes(term)
            || getDisplayName(u).toLowerCase().includes(term);
    });
    // Busca por nome, @ ou segmento: quem digita "fisio" espera achar a
    // clinica pelo nicho, nao so pelo nome fantasia.
    const filteredEmpresas = empresas.filter(e => {
        const termo = searchTerm.toLowerCase();
        if (!termo) return true;
        return [e.nome, e.handle, e.segmento].some(v => (v || '').toLowerCase().includes(termo));
    });

    // Cliente sem empresa nao consegue usar o portal - so ve o aviso de conta
    // nao vinculada. E a pendencia mais acionavel do painel, por isso vira
    // destaque na Visao Geral em vez de ficar escondida na tabela.
    const unlinkedUsers = users.filter(u => u.role !== 'agencia' && !u.empresaId);

    // Separar por papel elimina a coluna "Vínculo" com "Global" repetido em toda
    // linha de agencia, que era ruido puro.
    const equipe = users.filter(u => u.role === 'agencia');
    const clientes = users.filter(u => u.role !== 'agencia');
    const equipeFiltrada = filteredUsers.filter(u => u.role === 'agencia');
    const clientesFiltrados = filteredUsers.filter(u => u.role !== 'agencia');

    // Cabecalho por secao. Fica junto porque a saudacao e o subtitulo mudam com
    // a navegacao e antes nao existiam - a tela abria com "Painel
    // Administrativo" fixo, que nao dizia onde voce estava.
    const HEADERS: Record<typeof activeTab, { title: string; subtitle: string }> = {
        overview: {
            title: greeting(userName),
            subtitle: 'Resumo do que exige atenção hoje em todos os clientes.'
        },
        editorial: {
            title: 'Calendário Editorial',
            subtitle: 'Todas as publicações de todos os clientes em um lugar só.'
        },
        clients: {
            title: 'Clientes',
            subtitle: 'Clique em um cliente para abrir o espaço de trabalho dele.'
        },
        team: {
            title: 'Equipe & Permissões',
            subtitle: 'Quem tem acesso ao portal e a qual empresa cada conta pertence.'
        }
    };

    const navGroups: NavGroup[] = [
        {
            title: 'Geral',
            items: [
                { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
                { id: 'editorial', label: 'Calendário Editorial', icon: Calendar },
                { id: 'clients', label: 'Clientes', icon: Briefcase, badge: totalAjustes, badgeTone: 'amber' }
            ]
        },
        {
            title: 'Gestão',
            items: [
                { id: 'team', label: 'Equipe & Permissões', icon: Users, badge: unlinkedUsers.length }
            ]
        }
    ];

    const perfilNome = getDisplayName({ nome: profile?.nome, sobrenome: profile?.sobrenome, email: auth.currentUser?.email });

    return (
        <div className="relative min-h-screen md:flex bg-[#111111] text-zinc-100 font-sans selection:bg-[#FABE01] selection:text-black">
            <AppSidebar
                groups={navGroups}
                activeId={activeTab}
                // O termo de busca e compartilhado pelas secoes; sem limpar na
                // troca, o usuario mudava de secao e via uma lista vazia por
                // causa de um filtro digitado em outro contexto.
                onSelect={(id) => { setActiveTab(id as any); setSearchTerm(''); setIsNavOpen(false); }}
                isOpen={isNavOpen}
                onClose={() => setIsNavOpen(false)}
                footer={
                    <div className="space-y-1">
                        <button
                            onClick={onOpenProfile}
                            disabled={!onOpenProfile}
                            title={auth.currentUser?.email || undefined}
                            className="flex items-center gap-3 w-full p-2 rounded-control hover:bg-white/5 transition-colors text-left disabled:hover:bg-transparent group"
                        >
                            {isSafeImageSrc(profile?.fotoUrl) ? (
                                <img src={profile!.fotoUrl!} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                            ) : (
                                <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-tr from-[#FABE01] to-[#DE7928] flex items-center justify-center text-black font-bold text-xs">
                                    {getInitials({ nome: profile?.nome, sobrenome: profile?.sobrenome, email: auth.currentUser?.email })}
                                </div>
                            )}
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium text-white truncate group-hover:text-[#FABE01] transition-colors">
                                    {perfilNome}
                                </span>
                                <span className="block text-[11px] text-zinc-500 truncate">Agência · ver meu perfil</span>
                            </span>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-control text-zinc-400 hover:text-red-400 hover:bg-red-400/5 transition-colors"
                        >
                            <LogOut className="w-[18px] h-[18px] shrink-0" />
                            Sair da conta
                        </button>
                    </div>
                }
            />

            <main className="flex-1 min-w-0 md:h-screen md:overflow-y-auto">
                <MobileTopBar title={HEADERS[activeTab].title} onOpenMenu={() => setIsNavOpen(true)} />

                <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto overflow-x-hidden">
                    {notification && <div className="fixed top-20 right-4 z-50 bg-[#FABE01] text-black px-4 py-3 rounded-control shadow-lg font-bold text-sm flex items-center gap-2"><div className="w-2 h-2 bg-black rounded-full animate-pulse" />{notification}</div>}

                    <PageHeader title={HEADERS[activeTab].title} subtitle={HEADERS[activeTab].subtitle} />

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4"><Loader2 className="w-10 h-10 text-[#FABE01] animate-spin" /></div>
                ) : (
                    <>
                        {activeTab === 'overview' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
                                    <StatTile label="Clientes" value={empresas.length} icon={Building2} tone="brand" />
                                    {/* Producao atrasada vem antes de "usuarios
                                        cadastrados": e a unica coisa aqui que
                                        exige acao hoje. */}
                                    <StatTile
                                        label="Produção atrasada"
                                        value={totalAtrasados}
                                        icon={AlertTriangle}
                                        tone={totalAtrasados > 0 ? 'attention' : 'positive'}
                                        hint={totalAtrasados > 0
                                            ? `Em ${empresasAtrasadas.length} cliente(s) · prazo vencido`
                                            : 'Nenhum prazo de produção vencido'}
                                        onClick={totalAtrasados > 0 ? () => { setActiveTab('clients'); setSearchTerm(''); } : undefined}
                                    />
                                    <StatTile label="Usuários cadastrados" value={users.length} icon={Users} />
                                    <StatTile
                                        label="Ajustes pedidos"
                                        value={totalAjustes}
                                        icon={MessageSquareWarning}
                                        tone={totalAjustes > 0 ? 'attention' : 'positive'}
                                        hint={totalAjustes > 0 ? 'O cliente está esperando a equipe' : 'Nada pendente com a equipe'}
                                        onClick={totalAjustes > 0 ? () => { setActiveTab('clients'); setSearchTerm(''); } : undefined}
                                    />
                                    <StatTile
                                        label="Aguardando vínculo"
                                        value={unlinkedUsers.length}
                                        icon={Shield}
                                        tone={unlinkedUsers.length > 0 ? 'attention' : 'positive'}
                                        hint={
                                            unlinkedUsers.length === 0
                                                ? 'Todo mundo com acesso liberado'
                                                : souAdmin
                                                    ? 'Sem empresa, não conseguem usar o portal'
                                                    : 'Sem empresa. Peça a um administrador para vincular'
                                        }
                                        onClick={unlinkedUsers.length > 0 && souAdmin ? () => { setActiveTab('team'); setSearchTerm(''); } : undefined}
                                    />
                                </div>

                                {/* A Visão Geral só mostrava três números - nenhum caminho para
                                    a tarefa real. O trabalho do dia é entrar no calendário ou na
                                    produção de um cliente, então esses atalhos passam a ficar
                                    aqui, junto do que exige atenção. */}
                                {/* Ajustes pedidos pelo cliente: e a fila de trabalho
                                    mais urgente da agencia, porque alguem do outro
                                    lado esta esperando. Vem antes do resto. */}
                                {totalAjustes > 0 && (
                                    <div className="border border-amber-500/30 bg-amber-500/5 rounded-card p-5">
                                        <div className="flex items-start gap-3">
                                            <MessageSquareWarning className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-white font-bold text-sm mb-1">
                                                    {totalAjustes === 1
                                                        ? '1 publicação com ajuste pedido pelo cliente'
                                                        : `${totalAjustes} publicações com ajuste pedido pelo cliente`}
                                                </h3>
                                                <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                                                    O cliente revisou e pediu mudanças. O detalhe está na conversa de cada publicação.
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {empresasComAjuste.map(empresa => (
                                                        <button
                                                            key={empresa.id}
                                                            onClick={() => onOpenClient(empresa.id, empresa.nome, 'calendar')}
                                                            className="inline-flex items-center gap-2 bg-white/5 hover:bg-amber-500/20 border border-amber-500/20 text-white text-xs font-bold px-3 py-2 rounded-control transition-colors"
                                                        >
                                                            {empresa.nome}
                                                            <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-amber-500 text-black text-[10px]">
                                                                {pendingByEmpresa[empresa.id]?.aguardandoAgencia}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {totalAjustes === 0 && unlinkedUsers.length === 0 && (
                                    <div className="border border-white/5 bg-[#1A1A1A] rounded-card p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                                        <div className="w-10 h-10 shrink-0 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                                            <Check className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-bold text-sm mb-0.5">Nada pendente com a equipe</p>
                                            <p className="text-zinc-400 text-sm leading-relaxed">
                                                Nenhum ajuste pedido e todo mundo com empresa vinculada.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => { setActiveTab('clients'); setSearchTerm(''); }}
                                            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold px-4 py-2.5 rounded-control uppercase tracking-wide transition-colors shrink-0"
                                        >
                                            Ver clientes <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}

                                {unlinkedUsers.length > 0 && (
                                    <div className="border border-[#FABE01]/20 bg-[#FABE01]/5 rounded-card p-5">
                                        <div className="flex items-start gap-3">
                                            <UserCog className="w-5 h-5 text-[#FABE01] shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-white font-bold text-sm mb-1">
                                                    {unlinkedUsers.length === 1
                                                        ? '1 usuário aguardando vínculo'
                                                        : `${unlinkedUsers.length} usuários aguardando vínculo`}
                                                </h3>
                                                <p className="text-zinc-400 text-sm leading-relaxed mb-3">
                                                    Enquanto não tiverem empresa, essas contas entram e veem apenas um aviso de conta não vinculada.
                                                </p>
                                                <p className="text-xs text-zinc-500 font-mono truncate mb-4">
                                                    {unlinkedUsers.slice(0, 3).map(u => getDisplayName(u)).join(', ')}
                                                    {unlinkedUsers.length > 3 && ` +${unlinkedUsers.length - 3}`}
                                                </p>
                                                <button
                                                    onClick={() => { setActiveTab('team'); setSearchTerm(''); }}
                                                    className="inline-flex items-center gap-2 bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-semibold text-xs px-4 py-2 rounded-full transition-colors"
                                                >
                                                    {souAdmin ? 'Resolver agora' : 'Ver quem está sem empresa'} <ArrowRight className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </div>
                        )}

                        {activeTab === 'editorial' && (
                            <div className="animate-in fade-in">
                                <AgencyCalendarBoard embedded userEmail={userEmail} userName={userName} />
                            </div>
                        )}

                        {activeTab === 'clients' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="relative w-full sm:max-w-md">
                                        <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-500 pointer-events-none" />
                                        <input
                                            type="text"
                                            placeholder="Buscar por nome, @ ou segmento..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-[#1A1A1A] border border-white/10 rounded-control py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] outline-none transition-all"
                                        />
                                    </div>
                                    {souAdmin && (
                                        <button
                                            onClick={() => { setVincularApos(null); setFichaAberta('novo'); }}
                                            className="sm:ml-auto shrink-0 inline-flex items-center justify-center gap-2 bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-semibold text-sm px-5 py-2.5 rounded-full transition-colors"
                                        >
                                            <Plus className="w-4 h-4" /> Novo cliente
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {/* Distinguir "nenhuma empresa cadastrada" de "a busca nao
                                        achou nada" evita o usuario concluir que perdeu dados. */}
                                    {filteredEmpresas.length === 0 && (
                                        empresas.length === 0 ? (
                                            <EmptyState
                                                icon={Building2}
                                                title="Nenhum cliente cadastrado"
                                                description="Cadastre o cliente com contato, nicho e contrato. Depois vincule os usuários dele na aba Equipe & Permissões."
                                                action={souAdmin ? { label: 'Cadastrar cliente', onClick: () => { setVincularApos(null); setFichaAberta('novo'); } } : undefined}
                                            />
                                        ) : (
                                            <EmptyState
                                                icon={Search}
                                                title="Nenhum resultado"
                                                description={`Nenhuma empresa corresponde a “${searchTerm}”.`}
                                                action={{ label: 'Limpar busca', onClick: () => setSearchTerm('') }}
                                            />
                                        )
                                    )}
                                    {filteredEmpresas.map(empresa => (
                                        <ClientCard
                                            key={empresa.id}
                                            empresa={empresa}
                                            stats={pendingByEmpresa[empresa.id]}
                                            usuarios={users.filter(u => u.empresaId === empresa.id).length}
                                            onOpen={(section) => onOpenClient(empresa.id, empresa.nome, section)}
                                            onEdit={souAdmin ? () => { setVincularApos(null); setFichaAberta(empresa); } : undefined}
                                            onDelete={souAdmin ? () => handleDeleteEmpresa(empresa.id) : undefined}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'team' && (
                            <div className="space-y-6 animate-in fade-in">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="relative w-full sm:max-w-md">
                                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                                        <input
                                            type="text"
                                            placeholder="Buscar por nome ou e-mail..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-[#1A1A1A] border border-white/10 rounded-control py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-zinc-600 focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] outline-none transition-all"
                                        />
                                        {searchTerm && (
                                            <button onClick={() => setSearchTerm('')} aria-label="Limpar busca" className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-white">
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-zinc-500 sm:ml-auto shrink-0">
                                        <span className="text-white font-bold">{equipe.length}</span> na equipe ·{' '}
                                        <span className="text-white font-bold">{clientes.length}</span> cliente(s)
                                    </p>
                                </div>

                                {/* Cartoes em vez de tabela.
                                    A tabela tinha 800px de largura minima, entao rolava
                                    lateralmente em qualquer tela media, e empilhava
                                    e-mail, dois selects e dois icones na mesma linha.
                                    Separar por papel tambem elimina a coluna "Vínculo"
                                    vazia com "Global" repetido em toda linha de agencia. */}
                                {filteredUsers.length === 0 ? (
                                    <div className="py-14 px-6 text-center border border-dashed border-white/10 rounded-card">
                                        <Users className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                                        <p className="text-zinc-300 font-bold mb-1">Nenhum usuário encontrado</p>
                                        <p className="text-zinc-500 text-sm">
                                            {searchTerm
                                                ? <>Nada corresponde a “{searchTerm}”. <button onClick={() => setSearchTerm('')} className="text-[#FABE01] hover:underline font-bold">Limpar busca</button></>
                                                : 'Os usuários aparecem aqui depois de criarem conta no portal.'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        {([
                                            ['Equipe da agência', equipeFiltrada, 'Acesso a todos os clientes.'],
                                            ['Clientes', clientesFiltrados, 'Cada um vê apenas a própria empresa.']
                                        ] as const).map(([titulo, lista, legenda]) => lista.length > 0 && (
                                            <section key={titulo}>
                                                <div className="flex items-center gap-2.5 mb-1">
                                                    <h3 className="text-lg font-bold text-white tracking-tight">{titulo}</h3>
                                                    <span className="text-[11px] font-semibold text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full">{lista.length}</span>
                                                </div>
                                                <p className="text-xs text-zinc-500 mb-4">{legenda}</p>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                                                    {lista.map(user => {
                                                        const isMe = user.id === auth.currentUser?.uid;
                                                        const semVinculo = user.role !== 'agencia' && !user.empresaId;
                                                        const isEditing = editingUserId === user.id;
                                                        const empresaAtual = empresas.find(e => e.id === user.empresaId);
                                                        // Vinculo orfao: aponta para uma empresa que nao existe mais.
                                                        // Sem tratar, o card se contradizia - selo "Ativo" no canto e
                                                        // "Nenhuma" no campo Empresa. A conta funciona pela metade:
                                                        // passa pelo gate de empresa mas nao acha dado nenhum.
                                                        const vinculoOrfao = Boolean(user.empresaId) && !empresaAtual;

                                                        // Selo de situacao. Ate agora o unico jeito de saber que uma
                                                        // conta estava sem empresa era ler o texto de aviso; um selo
                                                        // no canto responde isso varrendo a grade com o olho.
                                                        const nivel = permissionLevel(user);
                                                        const selo = user.role === 'agencia'
                                                            ? nivel === 'admin'
                                                                ? { texto: 'Admin', cor: 'bg-[#FABE01]/15 text-[#FABE01]' }
                                                                : { texto: 'Colaborador', cor: 'bg-white/5 text-zinc-400' }
                                                            : semVinculo
                                                                ? { texto: 'Sem empresa', cor: 'bg-amber-500/15 text-amber-400' }
                                                                : vinculoOrfao
                                                                    ? { texto: 'Vínculo quebrado', cor: 'bg-red-500/15 text-red-400' }
                                                                    : { texto: 'Ativo', cor: 'bg-emerald-500/15 text-emerald-400' };

                                                        return (
                                                            <div
                                                                key={user.id}
                                                                className={`bg-[#1A1A1A] border rounded-card p-4 flex flex-col transition-colors ${
                                                                    vinculoOrfao ? 'border-red-500/30'
                                                                        : semVinculo ? 'border-[#FABE01]/25'
                                                                        : 'border-white/5 hover:border-white/15'
                                                                }`}
                                                            >
                                                                {/* IDENTIDADE */}
                                                                <div className="flex items-start gap-3">
                                                                    {isSafeImageSrc(user.fotoUrl) ? (
                                                                        <img src={user.fotoUrl!} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                                                                    ) : (
                                                                        <div className="w-11 h-11 shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 font-bold text-sm">
                                                                            {getInitials(user)}
                                                                        </div>
                                                                    )}
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <p className="font-bold text-white truncate">{getDisplayName(user)}</p>
                                                                            {isMe && <span className="text-[9px] font-bold uppercase tracking-wider text-[#FABE01] shrink-0">você</span>}
                                                                        </div>
                                                                        {/* Cargo como etiqueta: a equipe passa a ser
                                                                            legivel por funcao, nao so por nome. */}
                                                                        {user.cargo && (
                                                                            <span className="inline-block text-[10px] font-medium text-zinc-300 bg-white/5 px-2 py-0.5 rounded-full mt-1 mb-0.5 truncate max-w-full">
                                                                                {user.cargo}
                                                                            </span>
                                                                        )}
                                                                        <p className="text-xs text-zinc-500 truncate">
                                                                            {user.role === 'agencia'
                                                                                ? PERMISSION_HINT[nivel]
                                                                                : empresaAtual?.nome || (vinculoOrfao ? 'Empresa não encontrada' : 'Cliente sem empresa')}
                                                                        </p>
                                                                    </div>
                                                                    <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ${selo.cor}`}>
                                                                        {selo.texto}
                                                                    </span>
                                                                </div>

                                                                {/* CAMPOS. Em leitura sao texto; so viram controle no
                                                                    modo de edicao. Antes os dois selects ficavam sempre
                                                                    abertos no card, e nada dizia se aquilo era o valor
                                                                    atual ou uma alteracao pendente. */}
                                                                <div className="grid grid-cols-2 gap-3 mt-4">
                                                                    <div className="min-w-0">
                                                                        <p className="text-[11px] font-medium text-zinc-500 mb-1">Permissão</p>
                                                                        {isEditing && !isMe && nivel !== 'admin' ? (
                                                                            <select
                                                                                value={pendingRoleChanges[user.id] ?? user.role}
                                                                                onChange={(e) => setPendingRoleChanges(prev => ({ ...prev, [user.id]: e.target.value }))}
                                                                                className="w-full bg-[#111111] border border-zinc-700 text-zinc-200 text-xs rounded-control px-2 py-2 outline-none focus:border-[#FABE01]"
                                                                            >
                                                                                <option value="cliente">Cliente</option>
                                                                                <option value="agencia">Agência</option>
                                                                            </select>
                                                                        ) : (
                                                                            <p className="text-sm text-zinc-200 truncate">
                                                                                {PERMISSION_LABEL[nivel]}
                                                                            </p>
                                                                        )}
                                                                    </div>

                                                                    <div className="min-w-0">
                                                                        <p className="text-[11px] font-medium text-zinc-500 mb-1">Empresa</p>
                                                                        {user.role === 'agencia' ? (
                                                                            <p className="text-sm text-zinc-500 truncate">Todos os clientes</p>
                                                                        ) : isEditing ? (
                                                                            // "+ Novo cliente" abre a ficha completa (ClientFormModal) em vez
                                                                            // do campo de texto solto que existia aqui e criava o cliente com
                                                                            // nome e mais nada. Um caminho de criacao so.
                                                                            <select
                                                                                value={pendingEmpresaChanges[user.id] ?? user.empresaId ?? 'null'}
                                                                                onChange={(e) => handleEmpresaSelection(user.id, e.target.value)}
                                                                                className="w-full bg-[#111111] border border-zinc-700 text-zinc-200 text-xs rounded-control px-2 py-2 outline-none focus:border-[#FABE01]"
                                                                            >
                                                                                <option value="null">— sem empresa —</option>
                                                                                {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                                                                                {souAdmin && <option value="create_new">+ Nova empresa</option>}
                                                                            </select>
                                                                        ) : (
                                                                            <p
                                                                                className={`text-sm truncate ${vinculoOrfao ? 'text-red-400' : semVinculo ? 'text-amber-400' : 'text-zinc-200'}`}
                                                                                title={vinculoOrfao ? `ID gravado: ${user.empresaId}` : undefined}
                                                                            >
                                                                                {empresaAtual?.nome || (vinculoOrfao ? user.empresaId : 'Nenhuma')}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {isEditing && (
                                                                    <div className="mt-3">
                                                                        <p className="text-[11px] font-medium text-zinc-500 mb-1">Cargo</p>
                                                                        <input
                                                                            value={pendingCargoChanges[user.id] ?? user.cargo ?? ''}
                                                                            onChange={(e) => setPendingCargoChanges(prev => ({ ...prev, [user.id]: e.target.value }))}
                                                                            placeholder={user.role === 'agencia' ? 'Ex: Social Media' : 'Ex: Responsável pelo marketing'}
                                                                            className="w-full bg-[#111111] border border-zinc-700 text-zinc-200 text-xs rounded-control px-2 py-2 outline-none focus:border-[#FABE01]"
                                                                        />
                                                                    </div>
                                                                )}

                                                                {/* CONTATO em poco proprio: o e-mail e longo e estava
                                                                    competindo com o nome na mesma coluna de texto. */}
                                                                <div className="mt-3 flex items-center gap-2 bg-[#111111] border border-white/5 rounded-control px-3 py-2.5 min-w-0">
                                                                    <Mail className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                                                                    <span className="text-xs text-zinc-400 truncate" title={user.email}>{user.email}</span>
                                                                </div>

                                                                {!isEditing && semVinculo && (
                                                                    <p className="text-[11px] text-amber-400/90 mt-3 leading-relaxed">
                                                                        Sem empresa, esta conta entra no portal e vê apenas um aviso.
                                                                    </p>
                                                                )}
                                                                {!isEditing && vinculoOrfao && (
                                                                    <p className="text-[11px] text-red-400/90 mt-3 leading-relaxed">
                                                                        A empresa vinculada não existe mais. {souAdmin ? 'Escolha outra em Editar' : 'Peça a um administrador para corrigir'}, ou a conta entra e não encontra nada.
                                                                    </p>
                                                                )}

                                                                {/* ACOES */}
                                                                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
                                                                    {isEditing ? (
                                                                        <>
                                                                            <button
                                                                                onClick={() => cancelUserEdit(user.id)}
                                                                                className="flex-1 py-2 text-xs font-semibold rounded-control bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors"
                                                                            >
                                                                                Cancelar
                                                                            </button>
                                                                            <button
                                                                                onClick={() => saveUserEdit(user.id)}
                                                                                className="flex-1 py-2 text-xs font-semibold rounded-control bg-[#FABE01] text-black hover:bg-[#FABE01]/90 transition-colors"
                                                                            >
                                                                                Salvar
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            {/* Nao desenhado em vez de desabilitado.
                                                                                Oito botoes dourados apagados ainda
                                                                                pareciam a acao principal do card e
                                                                                convidavam ao clique; um card sem o
                                                                                botao diz a verdade de imediato.
                                                                                Admin nao aparece porque o nivel vem
                                                                                de ADMIN_EMAILS, nao desta tela. */}
                                                                            {souAdmin && nivel !== 'admin' && (
                                                                                <button
                                                                                    onClick={() => startUserEdit(user.id)}
                                                                                    className="flex-1 py-2 text-xs font-semibold rounded-control bg-[#FABE01] text-black hover:bg-[#FABE01]/90 transition-colors"
                                                                                >
                                                                                    Editar
                                                                                </button>
                                                                            )}
                                                                            <button
                                                                                onClick={() => handlePasswordReset(user.email)}
                                                                                className="flex-1 py-2 text-xs font-semibold rounded-control bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors"
                                                                            >
                                                                                Enviar senha
                                                                            </button>
                                                                            {!isMe && souAdmin && (
                                                                                <button
                                                                                    onClick={() => handleDeleteUser(user.id)}
                                                                                    title="Remover usuário"
                                                                                    aria-label={`Remover ${getDisplayName(user)}`}
                                                                                    className="shrink-0 p-2 text-zinc-600 hover:text-red-400 hover:bg-red-400/5 rounded-control transition-colors"
                                                                                >
                                                                                    <Trash2 className="w-4 h-4" />
                                                                                </button>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </section>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
                </div>
            </main>

            {fichaAberta && (
                <ClientFormModal
                    empresa={fichaAberta === 'novo' ? null : fichaAberta}
                    isAdmin={souAdmin}
                    autorEmail={auth.currentUser?.email}
                    onClose={() => { setFichaAberta(null); setVincularApos(null); }}
                    onSaved={handleFichaSalva}
                />
            )}
        </div>
    );
};
export default AgencyDashboard;