import React, { useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import { auth, db } from './utils/firebase';
import { View } from './types';
import { AGENCY_EMAILS } from './constants';
import { subscribePendingCounts, PendingCounts } from './utils/posts';

// Componentes
import Sidebar from './components/Sidebar';
import CalendarView from './components/CalendarView';
import WeeklyUpdatesView from './components/WeeklyUpdatesView';
import IdeasHubView from './components/IdeasHubView';
import Login from './components/Login';
import Signup from './components/Signup';
import AgencyDashboard from './components/AgencyDashboard';
import VerificationPending from './components/VerificationPending';
// Importação da Nova View de Produção
import ClientProductionView from './components/ClientProductionView';

// Ícones e Assets
import { Menu, Loader2, ArrowLeft } from 'lucide-react';
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
    currentView: View;
    setCurrentView: (view: View) => void;
    isSidebarOpen: boolean;
    setIsSidebarOpen: (open: boolean) => void;
    handleLogout: () => void;
    onBackToDashboard?: () => void;
}

const PortalLayout: React.FC<PortalLayoutProps> = ({
    targetEmpresaId, userRole, userEmail, currentView, setCurrentView,
    isSidebarOpen, setIsSidebarOpen, handleLogout, onBackToDashboard
}) => {
    const role: 'agencia' | 'cliente' = userRole === 'agencia' ? 'agencia' : 'cliente';

    // Contador de pendencia no menu. Para o cliente conta o que espera decisao
    // dele; para a agencia, os ajustes que o cliente pediu e ninguem resolveu.
    // Cada lado ve a propria fila.
    const [pending, setPending] = useState<PendingCounts>({ aguardandoCliente: 0, aguardandoAgencia: 0 });

    useEffect(() => {
        if (!targetEmpresaId) return;
        return subscribePendingCounts(targetEmpresaId, setPending);
    }, [targetEmpresaId]);

    const pendingCount = role === 'cliente' ? pending.aguardandoCliente : pending.aguardandoAgencia;

    const renderPortalContent = () => {
        switch (currentView) {
            case View.CALENDAR: return <CalendarView empresaId={targetEmpresaId} userRole={role} userEmail={userEmail} />;
            case View.UPDATES: return <WeeklyUpdatesView empresaId={targetEmpresaId} />;
            case View.IDEAS: return <IdeasHubView empresaId={targetEmpresaId} />;
            default: return <CalendarView empresaId={targetEmpresaId} userRole={role} userEmail={userEmail} />;
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
                empresaNome={targetEmpresaId}
                pendingCount={pendingCount}
                onBackToDashboard={onBackToDashboard}
                theme="dark"
                toggleTheme={() => {}}
            />

            <main className="flex-1 h-screen overflow-y-auto bg-[#111111]">
                <header className="md:hidden sticky top-0 left-0 right-0 bg-[#111111]/90 backdrop-blur-md border-b border-white/10 p-4 flex items-center justify-between z-40">
                    <div className="flex items-center gap-3"><img src={favicon} alt="Nocrato" className="h-8 w-auto brightness-0 invert" /><span className="text-lg font-bold text-white">Nocrato</span></div>
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 text-white"
                        aria-label="Abrir menu de navegação"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </header>
                <div className="p-4 sm:p-8 max-w-[1600px] mx-auto">
                    {renderPortalContent()}
                </div>
            </main>
        </div>
    );
};

const ProductionLayout: React.FC<{ targetEmpresaId: string; onBack: () => void }> = ({ targetEmpresaId, onBack }) => (
    <div className="min-h-screen bg-[#111111] text-zinc-100 overflow-y-auto">
        <div className="sticky top-0 z-30 bg-[#111111]/95 backdrop-blur border-b border-white/5 px-4 py-4 sm:px-8">
            <div className="max-w-7xl mx-auto flex items-center">
                <button
                    onClick={onBack}
                    className="flex items-center text-zinc-400 hover:text-[#FABE01] transition-colors font-medium text-sm"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar ao Dashboard
                </button>
            </div>
        </div>
        <div className="p-4 sm:p-8 max-w-7xl mx-auto">
            <ClientProductionView empresaId={targetEmpresaId} />
        </div>
    </div>
);

const App: React.FC = () => {
    const [currentView, setCurrentView] = useState<View>(View.CALENDAR);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [user, setUser] = useState<firebase.User | null>(null);
    const [empresaId, setEmpresaId] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [authView, setAuthView] = useState<'login' | 'signup'>('login');

    // Estado para quando a agência entra no portal do cliente (Calendário)
    const [agencyViewingClientId, setAgencyViewingClientId] = useState<string | null>(null);

    // NOVO ESTADO: Estado para quando a agência entra na produção do cliente (Trello/Tasks)
    const [agencyViewingTasksId, setAgencyViewingTasksId] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
            if (currentUser) {
                await currentUser.reload();
                const isAdmin = AGENCY_EMAILS.includes(currentUser.email || '');

                if (!currentUser.emailVerified && !isAdmin) {
                    setUser(currentUser);
                    setIsLoadingAuth(false);
                    return;
                }

                if (isAdmin) {
                    setUser(currentUser);
                    setRole('agencia');
                    setEmpresaId(null);
                    // Garante role no firestore
                    db.collection('usuarios').doc(currentUser.uid).set({ email: currentUser.email, role: 'agencia', empresaId: null }, { merge: true }).catch(console.error);
                } else {
                    setUser(currentUser);
                    try {
                        const userDoc = await db.collection('usuarios').doc(currentUser.uid).get();
                        if (userDoc.exists) {
                            const data = userDoc.data();
                            setEmpresaId(data?.empresaId || null);
                            setRole(data?.role || 'cliente');
                        } else {
                            await db.collection('usuarios').doc(currentUser.uid).set({ email: currentUser.email, empresaId: null, role: 'cliente', });
                            setRole('cliente');
                            setEmpresaId(null);
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
                setAgencyViewingClientId(null);
                setAgencyViewingTasksId(null);
            }
            setIsLoadingAuth(false);
        });
        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        try { await auth.signOut(); setAgencyViewingClientId(null); setAgencyViewingTasksId(null); } catch (error) { console.error(error); }
    };

    const backToDashboard = () => { setAgencyViewingClientId(null); setAgencyViewingTasksId(null); };

    // --- RENDERIZAÇÃO FINAL ---

    if (isLoadingAuth) return <LoadingSpinner />;

    if (!user) {
        return authView === 'login' ? <Login onSwitchToSignup={() => setAuthView('signup')} /> : <Signup onSwitchToLogin={() => setAuthView('login')} />;
    }

    if (!user.emailVerified) {
        return <VerificationPending user={user} handleLogout={handleLogout} />;
    }

    // ROTAS DA AGÊNCIA
    if (role === 'agencia') {
        // 1. Prioridade: Se clicou em "Ver Produção", mostra a ProductionLayout
        if (agencyViewingTasksId) {
            return <ProductionLayout targetEmpresaId={agencyViewingTasksId} onBack={backToDashboard} />;
        }
        // 2. Se clicou em "Acessar Calendário", mostra o PortalLayout
        if (agencyViewingClientId) {
            return (
                <PortalLayout
                    targetEmpresaId={agencyViewingClientId}
                    userRole="agencia"
                    userEmail={user.email}
                    currentView={currentView}
                    setCurrentView={setCurrentView}
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                    handleLogout={handleLogout}
                    onBackToDashboard={backToDashboard}
                />
            );
        }
        // 3. Caso contrário, mostra o Dashboard Principal
        // AQUI ESTAVA O ERRO: Precisamos passar a função setAgencyViewingTasksId
        return <AgencyDashboard
            handleLogout={handleLogout}
            onViewClient={setAgencyViewingClientId}
            onViewClientTasks={setAgencyViewingTasksId}
        />;
    }

    // ROTAS DO CLIENTE
    if (empresaId) {
        return (
            <PortalLayout
                targetEmpresaId={empresaId}
                userRole="cliente"
                userEmail={user.email}
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