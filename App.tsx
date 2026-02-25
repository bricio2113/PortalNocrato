import React, { useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import { auth, db } from './utils/firebase';
import { View } from './types';

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
import favicon from './assets/favicon.png';

const LoadingSpinner: React.FC = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#111111] gap-4">
        <Loader2 className="w-12 h-12 text-[#FABE01] animate-spin" />
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
                const agencyEmails = ['briciomarketing@gmail.com', 'briciomarketing@mail.com'];
                const isAdmin = agencyEmails.includes(currentUser.email || '');

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

    const renderPortalContent = (targetEmpresaId: string) => {
        switch (currentView) {
            case View.CALENDAR: return <CalendarView empresaId={targetEmpresaId} />;
            case View.UPDATES: return <WeeklyUpdatesView empresaId={targetEmpresaId} />;
            case View.IDEAS: return <IdeasHubView empresaId={targetEmpresaId} />;
            default: return <CalendarView empresaId={targetEmpresaId} />;
        }
    };

    // Layout do Portal (Com Sidebar)
    const PortalLayout = ({ targetEmpresaId, userRole }: { targetEmpresaId: string, userRole: string }) => (
        <div className="relative min-h-screen md:flex bg-[#111111] text-zinc-100">
            <Sidebar
                currentView={currentView}
                setCurrentView={setCurrentView}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                handleLogout={handleLogout}
                userRole={userRole}
                onBackToDashboard={userRole === 'agencia' ? () => { setAgencyViewingClientId(null); setAgencyViewingTasksId(null); } : undefined}
                theme="dark"
                toggleTheme={() => {}}
            />

            <main className="flex-1 h-screen overflow-y-auto bg-[#111111]">
                <header className="md:hidden sticky top-0 left-0 right-0 bg-[#111111]/90 backdrop-blur-md border-b border-white/10 p-4 flex items-center justify-between z-40">
                    <div className="flex items-center gap-3"><img src={favicon} alt="Nocrato" className="h-8 w-auto brightness-0 invert" /><span className="text-lg font-bold text-white">Nocrato</span></div>
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-white"><Menu className="w-6 h-6" /></button>
                </header>
                <div className="p-4 sm:p-8 max-w-[1600px] mx-auto">
                    {renderPortalContent(targetEmpresaId)}
                </div>
            </main>
        </div>
    );

    // Layout da Produção/Tasks (Sem Sidebar, Fullscreen com botão voltar)
    const ProductionLayout = ({ targetEmpresaId }: { targetEmpresaId: string }) => (
        <div className="min-h-screen bg-[#111111] text-zinc-100 overflow-y-auto">
            <div className="sticky top-0 z-30 bg-[#111111]/95 backdrop-blur border-b border-white/5 px-4 py-4 sm:px-8">
                <div className="max-w-7xl mx-auto flex items-center">
                    <button
                        onClick={() => setAgencyViewingTasksId(null)}
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
            return <ProductionLayout targetEmpresaId={agencyViewingTasksId} />;
        }
        // 2. Se clicou em "Acessar Calendário", mostra o PortalLayout
        if (agencyViewingClientId) {
            return <PortalLayout targetEmpresaId={agencyViewingClientId} userRole="agencia" />;
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
        return <PortalLayout targetEmpresaId={empresaId} userRole="cliente" />;
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