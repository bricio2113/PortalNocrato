import React, { useState, useEffect } from 'react';
import { db, auth } from '../utils/firebase';
import { DELETE_USER_ENDPOINT } from '../constants';
import { subscribePendingCounts, PendingCounts } from '../utils/posts';
import {
    LogOut, Calendar, Mail, Trash2, UserCog, Building2, Plus, Save,
    X, Search, ChevronDown, Loader2, Users, LayoutDashboard, Briefcase,
    ArrowRight, Shield, Link as LinkIcon, ClipboardList, MessageSquareWarning, LayoutGrid
} from 'lucide-react';
// @ts-ignore
import favicon from '../assets/favicon.png';

interface UserData {
    id: string;
    email: string;
    role: string;
    empresaId: string | null;
}

interface EmpresaData {
    id: string;
    nome: string;
}

interface AgencyDashboardProps {
    handleLogout: () => void;
    onViewClient: (clientId: string) => void;
    onViewClientTasks: (clientId: string) => void;
    /** Abre a tela de calendarios com troca rapida de cliente. */
    onOpenCalendarBoard?: () => void;
}

// As classes precisam existir literalmente no fonte: o Tailwind varre o codigo
// estaticamente, entao `text-${color}-500` era removido no build e o icone
// ficava sem cor. Mapa explicito resolve.
const STAT_ACCENTS = {
    yellow: 'text-[#FABE01]',
    blue: 'text-blue-400',
    green: 'text-green-400'
} as const;

type StatAccent = keyof typeof STAT_ACCENTS;

const StatCard: React.FC<{
    title: string;
    value: number | string;
    icon: React.ElementType;
    color: StatAccent;
    hint?: string;
}> = ({ title, value, icon: Icon, color, hint }) => (
    <div className="bg-[#1A1A1A] p-6 rounded-sm border border-white/5 flex items-start justify-between hover:border-[#FABE01]/30 transition-colors group">
        <div className="min-w-0">
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-white group-hover:text-[#FABE01] transition-colors">{value}</h3>
            {hint && <p className="text-xs text-zinc-600 mt-1.5 leading-snug">{hint}</p>}
        </div>
        <div className={`p-3 shrink-0 rounded-full bg-white/5 ${STAT_ACCENTS[color]} group-hover:bg-[#FABE01]/10 group-hover:text-[#FABE01] transition-colors`}>
            <Icon className="w-6 h-6" />
        </div>
    </div>
);

// Empty state reutilizavel. O padrao aqui e sempre apontar a proxima acao -
// uma tela que so informa "0 itens" deixa o usuario sem saida.
const EmptyState: React.FC<{
    icon: React.ElementType;
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
}> = ({ icon: Icon, title, description, action }) => (
    <div className="col-span-full py-14 px-6 text-center border border-dashed border-white/10 rounded-sm">
        <Icon className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
        <p className="text-zinc-300 font-bold mb-1">{title}</p>
        <p className="text-zinc-500 text-sm max-w-md mx-auto leading-relaxed">{description}</p>
        {action && (
            <button
                onClick={action.onClick}
                className="mt-6 inline-flex items-center gap-2 bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-bold text-sm px-5 py-2.5 rounded-sm uppercase tracking-wide transition-colors"
            >
                {action.label}
                <ArrowRight className="w-4 h-4" />
            </button>
        )}
    </div>
);

const AgencyDashboard: React.FC<AgencyDashboardProps> = ({ handleLogout, onViewClient, onViewClientTasks, onOpenCalendarBoard }) => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [empresas, setEmpresas] = useState<EmpresaData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState('');
    const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'team'>('overview');
    const [searchTerm, setSearchTerm] = useState('');
    const [pendingEmpresaChanges, setPendingEmpresaChanges] = useState<Record<string, string | null>>({});
    const [pendingRoleChanges, setPendingRoleChanges] = useState<Record<string, string>>({});
    const [creatingCompanyForUser, setCreatingCompanyForUser] = useState<string | null>(null);
    const [newCompanyIdInput, setNewCompanyIdInput] = useState('');

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
            setEmpresas(empresasSnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome || doc.id } as EmpresaData)));
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

    const showNotification = (msg: string) => {
        setNotification(msg);
        setTimeout(() => setNotification(''), 4000);
    };

    const handleDeleteUser = async (userId: string) => {
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

    const handleSaveRole = async (userId: string) => {
        const newRole = pendingRoleChanges[userId];
        if (!newRole) return;
        try {
            await db.collection('usuarios').doc(userId).update({ role: newRole });
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
            setPendingRoleChanges(prev => { const n = { ...prev }; delete n[userId]; return n; });
            showNotification('Atualizado!');
        } catch (e) { showNotification('Erro'); }
    };

    const handleEmpresaSelection = (userId: string, val: string) => {
        if (val === 'create_new') {
            setCreatingCompanyForUser(userId);
            setNewCompanyIdInput('');
            setPendingEmpresaChanges(prev => { const n = { ...prev }; delete n[userId]; return n; });
            return;
        }
        setPendingEmpresaChanges(prev => ({ ...prev, [userId]: val === 'null' ? null : val }));
    };

    const handleSaveEmpresa = async (userId: string) => {
        const newId = pendingEmpresaChanges[userId];
        if (newId === undefined) return;
        try {
            await db.collection('usuarios').doc(userId).update({ empresaId: newId });
            setUsers(users.map(u => u.id === userId ? { ...u, empresaId: newId } : u));
            setPendingEmpresaChanges(prev => { const n = { ...prev }; delete n[userId]; return n; });
            showNotification('Vínculo atualizado!');
        } catch (e) { showNotification('Erro'); }
    };

    const handleCreateAndAssignCompany = async (userId: string) => {
        const nome = newCompanyIdInput.trim();
        if (!nome) return showNotification('Informe um nome para a empresa.');

        // O texto digitado ia direto como ID de documento. IDs do Firestore nao
        // aceitam "/", nao podem ser "." ou "..", e um nome com espacos gera um
        // caminho fragil. O nome legivel fica no campo `nome`; o ID vira slug.
        const empresaId = nome
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos (marcas combinantes)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60);

        if (!empresaId) return showNotification('Use ao menos uma letra ou número no nome.');

        try {
            // Criar por cima de uma empresa existente reatribuiria os dados dela
            // para outro cliente sem aviso nenhum.
            const existing = await db.collection('empresas').doc(empresaId).get();
            if (existing.exists) {
                showNotification(`Já existe uma empresa com o ID "${empresaId}". Escolha outro nome.`);
                return;
            }

            await db.collection('empresas').doc(empresaId).set({ nome });
            await db.collection('usuarios').doc(userId).update({ empresaId });
            setCreatingCompanyForUser(null);
            setNewCompanyIdInput('');
            showNotification(`Empresa "${nome}" criada e vinculada.`);
            fetchData();
        } catch (e) {
            console.error(e);
            showNotification('Erro ao criar a empresa.');
        }
    };

    const handlePasswordReset = async (email: string) => {
        try {
            await auth.sendPasswordResetEmail(email);
            showNotification(`Email enviado para ${email}`);
        } catch (e) { showNotification('Erro ao enviar email'); }
    };

    const filteredUsers = users.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredEmpresas = empresas.filter(e => e.nome.toLowerCase().includes(searchTerm.toLowerCase()));

    // Cliente sem empresa nao consegue usar o portal - so ve o aviso de conta
    // nao vinculada. E a pendencia mais acionavel do painel, por isso vira
    // destaque na Visao Geral em vez de ficar escondida na tabela.
    const unlinkedUsers = users.filter(u => u.role !== 'agencia' && !u.empresaId);

    return (
        <div className="min-h-screen bg-[#111111] text-zinc-100 font-sans selection:bg-[#FABE01] selection:text-black flex flex-col">
            <header className="bg-[#111111] border-b border-white/5 sticky top-0 z-30 backdrop-blur-md bg-opacity-90">
                <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <img src={favicon} alt="Logo" className="h-10 w-auto brightness-0 invert" />
                        <div className="h-8 w-px bg-white/10 hidden sm:block" />
                        <div><h1 className="text-lg font-bold text-white leading-none">Painel Administrativo</h1><p className="text-xs text-[#FABE01] mt-1 font-bold uppercase tracking-widest">Gestão Nocrato</p></div>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6">
                        {onOpenCalendarBoard && (
                            <button
                                onClick={onOpenCalendarBoard}
                                className="flex items-center gap-2 bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-bold text-xs px-3 sm:px-4 py-2 rounded-sm uppercase tracking-wide transition-colors"
                            >
                                <LayoutGrid className="w-4 h-4" />
                                <span className="hidden sm:inline">Calendários</span>
                            </button>
                        )}
                        <div className="hidden md:block text-right"><p className="text-sm font-medium text-white">{auth.currentUser?.email}</p><p className="text-xs text-zinc-500">Administrador</p></div><button onClick={handleLogout} className="p-2 text-zinc-400 hover:text-white rounded-sm"><LogOut className="w-5 h-5" /></button></div>
                </div>
            </header>

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
                {notification && <div className="fixed top-24 right-4 z-50 bg-[#FABE01] text-black px-4 py-3 rounded-sm shadow-lg font-bold text-sm flex items-center gap-2"><div className="w-2 h-2 bg-black rounded-full animate-pulse" />{notification}</div>}

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-8 mb-8 border-b border-white/5 pb-2 sm:pb-0 overflow-x-auto">
                    {[{ id: 'overview', label: 'Visão Geral', icon: LayoutDashboard }, { id: 'clients', label: 'Clientes (Empresas)', icon: Briefcase }, { id: 'team', label: 'Equipe & Permissões', icon: Users }].map(tab => (
                        // O termo de busca e compartilhado pelas abas; sem limpar na
                        // troca, o usuario mudava de aba e via uma lista vazia por
                        // causa de um filtro digitado em outro contexto.
                        <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setSearchTerm(''); }} className={`flex items-center gap-2 px-2 pb-4 text-sm font-bold uppercase tracking-wide transition-all relative whitespace-nowrap ${activeTab === tab.id ? 'text-[#FABE01]' : 'text-zinc-500 hover:text-zinc-300'}`}><tab.icon className="w-4 h-4 mb-0.5" />{tab.label}{activeTab === tab.id && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#FABE01]" />}</button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4"><Loader2 className="w-10 h-10 text-[#FABE01] animate-spin" /></div>
                ) : (
                    <>
                        {activeTab === 'overview' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <StatCard title="Total de Clientes" value={empresas.length} icon={Building2} color="yellow" />
                                    <StatCard title="Usuários Cadastrados" value={users.length} icon={Users} color="blue" />
                                    <StatCard
                                        title="Aguardando vínculo"
                                        value={unlinkedUsers.length}
                                        icon={Shield}
                                        color={unlinkedUsers.length > 0 ? 'yellow' : 'green'}
                                        hint={unlinkedUsers.length > 0 ? 'Sem empresa, não conseguem usar o portal' : 'Todo mundo com acesso liberado'}
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
                                    <div className="border border-amber-500/30 bg-amber-500/5 rounded-sm p-5">
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
                                                            onClick={() => onViewClient(empresa.id)}
                                                            className="inline-flex items-center gap-2 bg-white/5 hover:bg-amber-500/20 border border-amber-500/20 text-white text-xs font-bold px-3 py-2 rounded-sm transition-colors"
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

                                {unlinkedUsers.length > 0 && (
                                    <div className="border border-[#FABE01]/20 bg-[#FABE01]/5 rounded-sm p-5">
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
                                                    {unlinkedUsers.slice(0, 3).map(u => u.email).join(', ')}
                                                    {unlinkedUsers.length > 3 && ` +${unlinkedUsers.length - 3}`}
                                                </p>
                                                <button
                                                    onClick={() => { setActiveTab('team'); setSearchTerm(''); }}
                                                    className="inline-flex items-center gap-2 bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-bold text-xs px-4 py-2 rounded-sm uppercase tracking-wide transition-colors"
                                                >
                                                    Resolver agora <ArrowRight className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Acesso rápido aos clientes</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {empresas.length === 0 ? (
                                            <EmptyState
                                                icon={Building2}
                                                title="Nenhuma empresa cadastrada ainda"
                                                description="Vincule um usuário a uma empresa na aba Equipe & Permissões para que o portal dele comece a funcionar."
                                                action={{ label: 'Ir para Equipe', onClick: () => { setActiveTab('team'); setSearchTerm(''); } }}
                                            />
                                        ) : (
                                            empresas.slice(0, 6).map(empresa => (
                                                <div key={empresa.id} className="bg-[#1A1A1A] border border-white/5 p-4 rounded-sm hover:border-[#FABE01]/30 transition-colors">
                                                    <div className="flex items-center gap-3 mb-4 min-w-0">
                                                        <div className="bg-[#FABE01]/10 p-2 rounded-sm text-[#FABE01] shrink-0"><Building2 className="w-4 h-4" /></div>
                                                        <h3 className="text-white font-bold text-sm truncate flex-1">{empresa.nome}</h3>
                                                        {(pendingByEmpresa[empresa.id]?.aguardandoAgencia || 0) > 0 && (
                                                            <span
                                                                className="shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-amber-500 text-black text-[10px] font-bold"
                                                                title="Ajustes pedidos pelo cliente"
                                                            >
                                                                {pendingByEmpresa[empresa.id]?.aguardandoAgencia}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => onViewClient(empresa.id)} className="flex-1 py-2 bg-white/5 hover:bg-[#FABE01] hover:text-black text-white text-xs font-bold rounded-sm transition-colors flex items-center justify-center gap-1.5 uppercase tracking-wide">
                                                            <Calendar className="w-3.5 h-3.5" /> Calendário
                                                        </button>
                                                        <button onClick={() => onViewClientTasks(empresa.id)} className="flex-1 py-2 border border-white/5 hover:bg-white/5 text-zinc-400 hover:text-white text-xs font-bold rounded-sm transition-colors flex items-center justify-center gap-1.5 uppercase tracking-wide">
                                                            <ClipboardList className="w-3.5 h-3.5" /> Produção
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    {empresas.length > 6 && (
                                        <button
                                            onClick={() => { setActiveTab('clients'); setSearchTerm(''); }}
                                            className="mt-4 text-sm text-[#FABE01] hover:underline font-bold inline-flex items-center gap-1.5"
                                        >
                                            Ver todas as {empresas.length} empresas <ArrowRight className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'clients' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                <div className="relative w-full max-w-md">
                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                                    <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#1A1A1A] border border-white/10 rounded-sm py-2 pl-9 pr-4 text-sm text-white focus:border-[#FABE01] outline-none" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {/* Distinguir "nenhuma empresa cadastrada" de "a busca nao
                                        achou nada" evita o usuario concluir que perdeu dados. */}
                                    {filteredEmpresas.length === 0 && (
                                        empresas.length === 0 ? (
                                            <EmptyState
                                                icon={Building2}
                                                title="Nenhuma empresa cadastrada"
                                                description="Empresas são criadas ao vincular um usuário na aba Equipe & Permissões. Escolha “+ Nova” na coluna Vínculo do usuário."
                                                action={{ label: 'Ir para Equipe', onClick: () => { setActiveTab('team'); setSearchTerm(''); } }}
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
                                        <div key={empresa.id} className="bg-[#1A1A1A] border border-white/5 p-6 rounded-sm hover:border-[#FABE01]/50 group relative flex flex-col justify-between min-h-[160px]">
                                            <div>
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="bg-[#FABE01]/10 p-2 rounded-sm text-[#FABE01]"><Building2 className="w-5 h-5" /></div>
                                                    <button onClick={() => handleDeleteEmpresa(empresa.id)} className="text-zinc-600 hover:text-red-500 p-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                                <h3 className="text-lg font-bold text-white mb-1 leading-tight">{empresa.nome}</h3>
                                                <p className="text-xs text-zinc-500 font-mono mb-4 truncate">ID: {empresa.id}</p>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <button onClick={() => onViewClient(empresa.id)} className="w-full py-2.5 bg-white/5 hover:bg-[#FABE01] hover:text-black text-white text-sm font-bold rounded-sm transition-colors flex items-center justify-center gap-2 uppercase tracking-wide">
                                                    <Calendar className="w-4 h-4" /> Acessar Calendário
                                                </button>
                                                <button onClick={() => onViewClientTasks(empresa.id)} className="w-full py-2.5 border border-white/5 hover:bg-white/5 text-zinc-400 hover:text-white text-sm font-bold rounded-sm transition-colors flex items-center justify-center gap-2 uppercase tracking-wide">
                                                    <ClipboardList className="w-4 h-4" /> Ver Produção (Tasks)
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'team' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                <div className="relative w-full max-w-md"><Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" /><input type="text" placeholder="Buscar usuário..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#1A1A1A] border border-white/10 rounded-sm py-2 pl-9 pr-4 text-sm text-white focus:border-[#FABE01] outline-none" /></div>
                                <div className="bg-[#1A1A1A] border border-white/5 rounded-sm overflow-hidden shadow-2xl">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm min-w-[800px]">
                                            <thead className="bg-black/40 border-b border-white/5">
                                                <tr>
                                                    <th className="px-6 py-4 font-bold text-zinc-500 uppercase tracking-wider text-xs">Usuário</th>
                                                    <th className="px-6 py-4 font-bold text-zinc-500 uppercase tracking-wider text-xs">Permissão</th>
                                                    <th className="px-6 py-4 font-bold text-zinc-500 uppercase tracking-wider text-xs">Vínculo</th>
                                                    <th className="px-6 py-4 font-bold text-zinc-500 uppercase tracking-wider text-xs text-right">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {filteredUsers.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="px-6 py-12 text-center">
                                                            <p className="text-zinc-300 font-bold mb-1">Nenhum usuário encontrado</p>
                                                            <p className="text-zinc-500 text-sm">
                                                                {searchTerm
                                                                    ? <>Nada corresponde a “{searchTerm}”. <button onClick={() => setSearchTerm('')} className="text-[#FABE01] hover:underline font-bold">Limpar busca</button></>
                                                                    : 'Os usuários aparecem aqui depois de criarem conta no portal.'}
                                                            </p>
                                                        </td>
                                                    </tr>
                                                )}
                                                {filteredUsers.map(user => (
                                                    <tr key={user.id} className="hover:bg-white/[0.02]">
                                                        <td className="px-6 py-4 font-medium text-zinc-300">{user.email}</td>
                                                        <td className="px-6 py-4">
                                                            {user.id === auth.currentUser?.uid ? <span className="text-[#FABE01] text-xs">ADMIN</span> :
                                                                <div className="flex items-center gap-2">
                                                                    <select value={pendingRoleChanges[user.id] ?? user.role} onChange={(e) => setPendingRoleChanges(prev => ({ ...prev, [user.id]: e.target.value }))} className="bg-[#0a0a0a] border border-zinc-700 text-zinc-300 text-xs rounded-sm p-1.5 outline-none">
                                                                        <option value="cliente">Cliente</option>
                                                                        <option value="agencia">Agência</option>
                                                                    </select>
                                                                    {pendingRoleChanges[user.id] && <button onClick={() => handleSaveRole(user.id)} className="text-[#FABE01]"><Save className="w-4 h-4" /></button>}
                                                                </div>}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {user.role === 'agencia' ? <span className="text-zinc-500 text-xs italic">Global</span> : creatingCompanyForUser === user.id ?
                                                                <div className="flex gap-2">
                                                                    <input value={newCompanyIdInput} onChange={e => setNewCompanyIdInput(e.target.value)} className="bg-[#0a0a0a] border border-[#FABE01] text-white text-xs p-1 w-24 outline-none" />
                                                                    <button onClick={() => handleCreateAndAssignCompany(user.id)} className="text-[#FABE01]"><Save className="w-4 h-4" /></button>
                                                                    <button onClick={() => setCreatingCompanyForUser(null)} className="text-red-400"><X className="w-4 h-4" /></button>
                                                                </div> :
                                                                <div className="flex items-center gap-2">
                                                                    <select value={pendingEmpresaChanges[user.id] ?? user.empresaId ?? 'null'} onChange={(e) => handleEmpresaSelection(user.id, e.target.value)} className="bg-[#0a0a0a] border border-zinc-700 text-zinc-300 text-xs rounded-sm p-1.5 max-w-[140px] outline-none">
                                                                        <option value="null">--</option>
                                                                        {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                                                                        <option value="create_new" className="text-[#FABE01]">+ Nova</option>
                                                                    </select>
                                                                    {pendingEmpresaChanges[user.id] !== undefined && <button onClick={() => handleSaveEmpresa(user.id)} className="text-[#FABE01]"><Save className="w-4 h-4" /></button>}
                                                                </div>}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <button onClick={() => handlePasswordReset(user.email)} className="p-2 text-zinc-400 hover:text-white" title="Senha"><Mail className="w-4 h-4" /></button>
                                                                {user.id !== auth.currentUser?.uid && <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-zinc-400 hover:text-red-400" title="Excluir"><Trash2 className="w-4 h-4" /></button>}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};
export default AgencyDashboard;