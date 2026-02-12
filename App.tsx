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

// Ícones e Assets
import { Menu, Loader2 } from 'lucide-react';
// @ts-ignore
import favicon from './assets/favicon.png';

// --- LOADER PERSONALIZADO (SEM LOGO) ---
const LoadingSpinner: React.FC = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#111111] gap-4">
        {/* Logo removida para evitar distorção, mantendo apenas o loader limpo */}
        <Loader2 className="w-12 h-12 text-[#FABE01] animate-spin" />
    </div>
);

const App: React.FC = () => {
    // --- ESTADOS ---
    const [currentView, setCurrentView] = useState<View>(View.CALENDAR);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Auth & User
    const [user, setUser] = useState<firebase.User | null>(null);
    const [empresaId, setEmpresaId] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [authView, setAuthView] = useState<'login' | 'signup'>('login');

    // Controle da Agência
    const [agencyViewingClientId, setAgencyViewingClientId] = useState<string | null>(null);

    // --- EFEITOS (Auth Listener) ---
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
            if (currentUser) {
                await currentUser.reload();

                // Se email não verificado, mostra tela de pendência (exceto se for admin hardcoded)
                const agencyEmails = ['briciomarketing@gmail.com', 'briciomarketing@mail.com']; // Adicione seus emails de admin aqui
                const isAdmin = agencyEmails.includes(currentUser.email || '');

                if (!currentUser.emailVerified && !isAdmin) {
                    setUser(currentUser);
                    setIsLoadingAuth(false);
                    return;
                }

                if (isAdmin) {
                    // Lógica de Admin (Agência)
                    setUser(currentUser);
                    setRole('agencia');
                    setEmpresaId(null);

                    // Sincroniza role no Firestore por segurança
                    db.collection('usuarios').doc(currentUser.uid).set({
                        email: currentUser.email,
                        role: 'agencia',
                        empresaId: null
                    }, { merge: true }).catch(console.error);

                } else {
                    // Lógica de Cliente
                    setUser(currentUser);
                    try {
                        const userDoc = await db.collection('usuarios').doc(currentUser.uid).get();
                        if (userDoc.exists) {
                            const data = userDoc.data();
                            setEmpresaId(data?.empresaId || null);
                            setRole(data?.role || 'cliente');
                        } else {
                            // Cria doc inicial se não existir
                            await db.collection('usuarios').doc(currentUser.uid).set({
                                email: currentUser.email,
                                empresaId: null,
                                role: 'cliente',
                            });
                            setRole('cliente');
                            setEmpresaId(null);
                        }
                    } catch (error) {
                        console.error("Erro ao buscar dados do cliente:", error);
                        setRole(null);
                    }
                }
            } else {
                // Logout
                setUser(null);
                setEmpresaId(null);
                setRole(null);
                setAgencyViewingClientId(null);
            }
            setIsLoadingAuth(false);
        });

        return () => unsubscribe();
    }, []);

    // --- ACTIONS ---
    const handleLogout = async () => {
        try {
            await auth.signOut();
            setAgencyViewingClientId(null);
        } catch (error) { console.error(error); }
    };

    // --- RENDERIZADORES ---

    // Renderiza o conteúdo principal (Calendário, Ideias, etc)
    const renderPortalContent = (targetEmpresaId: string) => {
        switch (currentView) {
            case View.CALENDAR:
                return <CalendarView empresaId={targetEmpresaId} />;
            case View.UPDATES:
                return <WeeklyUpdatesView empresaId={targetEmpresaId} />;
            case View.IDEAS:
                return <IdeasHubView empresaId={targetEmpresaId} />;
            default:
                return <CalendarView empresaId={targetEmpresaId} />;
        }
    };

    // Layout Padrão com Sidebar (Usado para Cliente e para Agência visualizando Cliente)
    const PortalLayout = ({ targetEmpresaId, userRole }: { targetEmpresaId: string, userRole: string }) => (
        <div className="relative min-h-screen md:flex bg-[#111111] text-zinc-100">
            <Sidebar
                currentView={currentView}
                setCurrentView={setCurrentView}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                handleLogout={handleLogout}
                userRole={userRole}
                onBackToDashboard={userRole === 'agencia' ? () => setAgencyViewingClientId(null) : undefined}
                theme="dark"
                toggleTheme={() => {}} // Desativado pois forçamos dark mode
            />

            <main className="flex-1 h-screen overflow-y-auto bg-[#111111]">
                {/* Header Mobile */}
                <header className="md:hidden sticky top-0 left-0 right-0 bg-[#111111]/90 backdrop-blur-md border-b border-white/10 p-4 flex items-center justify-between z-40">
                    <div className="flex items-center gap-3">
                        <img src={favicon} alt="Nocrato" className="h-8 w-auto brightness-0 invert" />
                        <span className="text-lg font-bold text-white">Nocrato</span>
                    </div>
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-white">
                        <Menu className="w-6 h-6" />
                    </button>
                </header>

                {/* Conteúdo da Página */}
                <div className="p-4 sm:p-8 max-w-[1600px] mx-auto">
                    {renderPortalContent(targetEmpresaId)}
                </div>
            </main>
        </div>
    );

    // --- RENDER FINAL ---

    if (isLoadingAuth) return <LoadingSpinner />;

    // 1. Não Autenticado
    if (!user) {
        return authView === 'login'
            ? <Login onSwitchToSignup={() => setAuthView('signup')} />
            : <Signup onSwitchToLogin={() => setAuthView('login')} />;
    }

    // 2. Email Pendente
    if (!user.emailVerified) {
        return <VerificationPending user={user} handleLogout={handleLogout} />;
    }

    // 3. Agência (Admin)
    if (role === 'agencia') {
        if (agencyViewingClientId) {
            // Agência visualizando um cliente específico
            return <PortalLayout targetEmpresaId={agencyViewingClientId} userRole="agencia" />;
        } else {
            // Dashboard Geral da Agência
            return <AgencyDashboard handleLogout={handleLogout} onViewClient={setAgencyViewingClientId} />;
        }
    }

    // 4. Cliente (Usuário Final)
    if (empresaId) {
        return <PortalLayout targetEmpresaId={empresaId} userRole="cliente" />;
    } else {
        // Cliente sem empresa vinculada (Tela de Espera)
        return (
            <div className="min-h-screen bg-[#111111] flex flex-col items-center justify-center p-4 text-center">
                <img src={favicon} alt="Nocrato" className="w-20 h-20 brightness-0 invert mb-6 opacity-50" />
                <h2 className="text-2xl font-bold text-white mb-2">Conta Criada com Sucesso!</h2>
                <p className="text-zinc-400 max-w-md">
                    Sua conta está ativa, mas ainda não foi vinculada a uma empresa.
                    <br/>Entre em contato com o suporte da agência para liberar seu acesso ao painel.
                </p>
                <button onClick={handleLogout} className="mt-8 text-[#FABE01] hover:underline text-sm font-bold uppercase tracking-wide">
                    Sair e tentar novamente mais tarde
                </button>
            </div>
        );
    }
};

export default App;