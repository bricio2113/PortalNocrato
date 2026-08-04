import React, { useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import { auth, db } from './utils/firebase';
import { View, UserProfile } from './types';
import { isAdmin } from './utils/permissions';
import { subscribePendingCounts, PendingCounts } from './utils/posts';

// Componentes
import Sidebar from './components/Sidebar';
import CalendarView from './components/CalendarView';
import WeeklyUpdatesView from './components/WeeklyUpdatesView';
import MateriaisView from './components/MateriaisView';
import Login from './components/Login';
import Signup from './components/Signup';
import AgencyDashboard from './components/AgencyDashboard';
import VerificationPending from './components/VerificationPending';
// Importação da Nova View de Produção
import ClientWorkspace from './components/ClientWorkspace';
import ClientHomeView from './components/ClientHomeView';
import ProfileView from './components/ProfileView';
import CompleteProfileModal from './components/CompleteProfileModal';
import { splitFullName, getDisplayName, isProfileComplete } from './utils/avatar';

import { MobileTopBar } from './components/AppSidebar';

// Ícones e Assets
import { Loader2, ArrowLeft } from 'lucide-react';
// @ts-ignore
import favicon from './assets/favicon.png';

const LoadingSpinner: React.FC = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#111111] gap-4">
        <Loader2 className="w-12 h-12 text-[#FABE01] animate-spin" />
    </div>
);

// PortalLayout e ProductionLayout vivem FORA do App de proposito.
//
// Quando eram declarados no corpo do App, cada render criava uma funcao nova,
// ou seja um tipo de componente novo. O React nao reconcilia tipos diferentes:
// desmontava e remontava toda a subarvore. Na pratica, abrir o menu mobile
// refazia o fetch do calendario no Firestore e zerava o scroll e o mes
// selecionado. Mantendo a identidade estavel, o estado sobrevive aos renders.

interface PortalLayoutProps {
    targetEmpresaId: string;
    userRole: string;
    userEmail?: string | null;
    /** Perfil do usuario logado; alimenta avatar, nome e a aba de perfil. */
    profile: UserProfile | null;
    onProfileSaved: (patch: Partial<UserProfile>) => void;
    currentView: View;
    setCurrentView: (view: View) => void;
    isSidebarOpen: boolean;
    setIsSidebarOpen: (open: boolean) => void;
    handleLogout: () => void;
    onBackToDashboard?: () => void;
}

const PortalLayout: React.FC<PortalLayoutProps> = ({
    targetEmpresaId, userRole, userEmail, profile, onProfileSaved, currentView, setCurrentView,
    isSidebarOpen, setIsSidebarOpen, handleLogout, onBackToDashboard
}) => {
    const role: 'agencia' | 'cliente' = userRole === 'agencia' ? 'agencia' : 'cliente';

    // Contador de pendencia no menu. Para o cliente conta o que espera decisao
    // dele; para a agencia, os ajustes que o cliente pediu e ninguem resolveu.
    // Cada lado ve a propria fila.
    const [pending, setPending] = useState<PendingCounts>({ aguardandoCliente: 0, aguardandoAgencia: 0, total: 0, noMes: 0, publicados: 0, semCapa: 0, atrasados: 0, atrasadosCliente: 0 });

    useEffect(() => {
        if (!targetEmpresaId) return;
        return subscribePendingCounts(targetEmpresaId, setPending);
    }, [targetEmpresaId]);

    const pendingCount = role === 'cliente' ? pending.aguardandoCliente : pending.aguardandoAgencia;

    // Nome de exibicao resolvido uma vez: vai para a aprovacao e para os
    // comentarios, que precisam guardar o nome no momento da acao.
    const userName = getDisplayName({ nome: profile?.nome, sobrenome: profile?.sobrenome, email: userEmail });

    const renderPortalContent = () => {
        switch (currentView) {
            case View.HOME: return (
                <ClientHomeView
                    empresaId={targetEmpresaId}
                    empresaNome={targetEmpresaId}
                    userName={userName}
                    onIrParaCalendario={setCurrentView}
                />
            );
            case View.CALENDAR: return <CalendarView empresaId={targetEmpresaId} userRole={role} userEmail={userEmail} userName={userName} />;
            case View.UPDATES: return <WeeklyUpdatesView empresaId={targetEmpresaId} />;
            case View.IDEAS: return <MateriaisView empresaId={targetEmpresaId} userRole={role} />;
            case View.PROFILE:
                return profile
                    ? <ProfileView profile={profile} onSaved={onProfileSaved} />
                    : <CalendarView empresaId={targetEmpresaId} userRole={role} userEmail={userEmail} userName={userName} />;
            default: return (
                <ClientHomeView
                    empresaId={targetEmpresaId}
                    empresaNome={targetEmpresaId}
                    userName={userName}
                    onIrParaCalendario={setCurrentView}
                />
            );
        }
    };

    return (
        <div className="relative min-h-screen md:flex bg-[#111111] text-zinc-100">
            <Sidebar
                currentView={currentView}
                setCurrentView={setCurrentView}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                handleLogout={handleLogout}
                userRole={userRole}
                userEmail={userEmail}
                profile={profile}
                empresaNome={targetEmpresaId}
                pendingCount={pendingCount}
                onBackToDashboard={onBackToDashboard}
                theme="dark"
                toggleTheme={() => {}}
            />

            <main className="flex-1 min-w-0 md:h-screen md:overflow-y-auto bg-[#111111]">
                <MobileTopBar
                    onOpenMenu={() => setIsSidebarOpen(true)}
                    title={
                        <span className="flex items-center justify-center gap-2">
                            <img src={favicon} alt="" className="h-5 w-auto brightness-0 invert" />
                            <span className="text-sm font-bold text-white">Nocrato</span>
                        </span>
                    }
                />
                <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto overflow-x-hidden">
                    {renderPortalContent()}
                </div>
            </main>
        </div>
    );
};

const App: React.FC = () => {
    // Abre na visao geral, nao no calendario: a primeira pergunta de quem
    // entra e "tem algo me esperando?".
    const [currentView, setCurrentView] = useState<View>(View.HOME);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [user, setUser] = useState<firebase.User | null>(null);
    const [empresaId, setEmpresaId] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [authView, setAuthView] = useState<'login' | 'signup'>('login');

    // Cliente aberto pela agencia. Antes eram DOIS estados - um para calendario,
    // outro para producao -, o que obrigava voltar ao painel so para trocar de
    // secao. Agora e um espaco de trabalho com submenu proprio.
    const [agencyWorkspace, setAgencyWorkspace] = useState<
        { empresaId: string; nome: string; section?: 'overview' | 'calendar' | 'production' | 'weekly' | 'files' | 'reports' } | null
    >(null);
    const [showProfile, setShowProfile] = useState(false);
    /**
     * Aba do painel, guardada AQUI e nao dentro do AgencyDashboard.
     *
     * Entrar num cliente desmonta o painel; ao voltar, ele remontava com a aba
     * padrao e jogava a pessoa na Visao Geral - mesmo tendo saido de Clientes.
     * Como o estado do painel morre a cada entrada, quem tem que lembrar e quem
     * sobrevive: este componente.
     */
    const [abaPainel, setAbaPainel] = useState('overview');

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
            if (currentUser) {
                await currentUser.reload();
                // Bootstrap: os e-mails de ADMIN_EMAILS entram como agencia
                // mesmo sem documento em usuarios/ - e assim que o primeiro
                // admin consegue existir. Comparacao normalizada, para
                // "Pedro.Vidal@..." nao ficar de fora por causa da caixa.
                const isBootstrapAdmin = isAdmin(currentUser.email);

                if (!currentUser.emailVerified && !isBootstrapAdmin) {
                    setUser(currentUser);
                    setIsLoadingAuth(false);
                    return;
                }

                if (isBootstrapAdmin) {
                    setUser(currentUser);
                    setRole('agencia');
                    setEmpresaId(null);
                    const adminRef = db.collection('usuarios').doc(currentUser.uid);
                    // merge preserva nome, sobrenome e foto que o admin ja tenha
                    // preenchido - sem ele o login apagaria o perfil dele.
                    adminRef.set({ email: currentUser.email, role: 'agencia', empresaId: null }, { merge: true })
                        .then(() => adminRef.get())
                        .then(doc => setProfile({ id: currentUser.uid, ...doc.data() } as UserProfile))
                        .catch(console.error);
                } else {
                    setUser(currentUser);
                    try {
                        const userDoc = await db.collection('usuarios').doc(currentUser.uid).get();
                        if (userDoc.exists) {
                            const data = userDoc.data();
                            setEmpresaId(data?.empresaId || null);
                            setRole(data?.role || 'cliente');
                            setProfile({ id: currentUser.uid, ...data } as UserProfile);
                        } else {
                            // Primeiro login: o nome vem do displayName gravado no
                            // Signup. E o unico transporte disponivel, porque o
                            // documento so nasce aqui, depois do cadastro.
                            const { nome, sobrenome } = splitFullName(currentUser.displayName);
                            const novo = {
                                email: currentUser.email,
                                empresaId: null,
                                role: 'cliente',
                                nome,
                                sobrenome,
                                fotoUrl: null
                            };
                            await db.collection('usuarios').doc(currentUser.uid).set(novo);
                            setRole('cliente');
                            setEmpresaId(null);
                            setProfile({ id: currentUser.uid, ...novo } as UserProfile);
                        }
                    } catch (error) {
                        console.error("Erro ao buscar dados do cliente:", error);
                        setRole(null);
                    }
                }
            } else {
                setUser(null);
                setEmpresaId(null);
                setRole(null);
                setProfile(null);
                setAgencyWorkspace(null);
            }
            setIsLoadingAuth(false);
        });
        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        try { await auth.signOut(); setAgencyWorkspace(null); } catch (error) { console.error(error); }
    };

    const handleProfileSaved = (patch: Partial<UserProfile>) => {
        setProfile(prev => (prev ? { ...prev, ...patch } : prev));
    };

    const backToDashboard = () => {
        setAgencyWorkspace(null);
        setShowProfile(false);
    };

    // --- RENDERIZAÇÃO FINAL ---

    if (isLoadingAuth) return <LoadingSpinner />;

    if (!user) {
        return authView === 'login' ? <Login onSwitchToSignup={() => setAuthView('signup')} /> : <Signup onSwitchToLogin={() => setAuthView('login')} />;
    }

    if (!user.emailVerified) {
        return <VerificationPending user={user} handleLogout={handleLogout} />;
    }

    // PASSO OBRIGATORIO: nome e sobrenome.
    //
    // Fica depois do gate de verificacao de proposito - um obstaculo por vez -,
    // e antes de qualquer rota, para valer tanto para o cliente quanto para a
    // agencia. Contas criadas antes destes campos existirem caem aqui no
    // proximo login.
    //
    // A condicao exige `profile` carregado: sem isso a tela piscaria no
    // intervalo entre autenticar e ler o documento do usuario.
    if (profile && !isProfileComplete(profile)) {
        return (
            <CompleteProfileModal
                profile={profile}
                onSaved={handleProfileSaved}
                handleLogout={handleLogout}
            />
        );
    }

    // ROTAS DA AGÊNCIA
    if (role === 'agencia') {
        // Perfil da agencia: o painel nao usa PortalLayout, entao a aba de
        // perfil precisa de rota propria aqui.
        if (showProfile && profile) {
            return (
                <div className="min-h-screen bg-[#111111] text-zinc-100">
                    <div className="sticky top-0 z-30 bg-[#111111]/95 backdrop-blur border-b border-white/5 px-4 py-4 sm:px-8">
                        <div className="max-w-7xl mx-auto">
                            <button
                                onClick={() => setShowProfile(false)}
                                className="flex items-center text-zinc-400 hover:text-[#FABE01] transition-colors font-medium text-sm"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Voltar ao Painel
                            </button>
                        </div>
                    </div>
                    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
                        <ProfileView profile={profile} onSaved={handleProfileSaved} />
                    </div>
                </div>
            );
        }

        if (agencyWorkspace) {
            return (
                <ClientWorkspace
                    key={agencyWorkspace.empresaId}
                    empresaId={agencyWorkspace.empresaId}
                    empresaNome={agencyWorkspace.nome}
                    userEmail={user.email}
                    userName={getDisplayName({ nome: profile?.nome, sobrenome: profile?.sobrenome, email: user.email })}
                    initialSection={agencyWorkspace.section}
                    onBack={backToDashboard}
                />
            );
        }

        return <AgencyDashboard
            handleLogout={handleLogout}
            abaInicial={abaPainel}
            onTrocarAba={setAbaPainel}
            onOpenClient={(empresaId, nome, section) => setAgencyWorkspace({ empresaId, nome, section })}
            onOpenProfile={() => setShowProfile(true)}
            profile={profile}
            userEmail={user.email}
            userName={getDisplayName({ nome: profile?.nome, sobrenome: profile?.sobrenome, email: user.email })}
        />;
    }

    // ROTAS DO CLIENTE
    if (empresaId) {
        return (
            <PortalLayout
                targetEmpresaId={empresaId}
                userRole="cliente"
                userEmail={user.email}
                profile={profile}
                onProfileSaved={handleProfileSaved}
                currentView={currentView}
                setCurrentView={setCurrentView}
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                handleLogout={handleLogout}
            />
        );
    } else {
        return (
            <div className="min-h-screen bg-[#111111] flex flex-col items-center justify-center p-4 text-center">
                <img src={favicon} alt="Nocrato" className="w-20 h-20 brightness-0 invert mb-6 opacity-50" />
                <h2 className="text-2xl font-bold text-white mb-2">Conta Criada com Sucesso!</h2>
                <p className="text-zinc-400 max-w-md">Sua conta está ativa, mas ainda não foi vinculada a uma empresa.<br/>Entre em contato com o suporte da agência.</p>
                <button onClick={handleLogout} className="mt-8 text-[#FABE01] hover:underline text-sm font-bold uppercase tracking-wide">Sair e tentar novamente mais tarde</button>
            </div>
        );
    }
};

export default App;