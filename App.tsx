




import React, { useState, useEffect } from 'react';
// Fix: Use Firebase v8 namespaced API for auth
// Fix: Use the correct User type from the compat library for v8 API compatibility.
// Fix: Import firebase from 'firebase/compat/app' to get the User type.
import firebase from 'firebase/compat/app';
import { auth, db } from './utils/firebase';
import { View } from './types';
import Sidebar from './components/Sidebar';
import CalendarView from './components/CalendarView';
import WeeklyUpdatesView from './components/WeeklyUpdatesView';
import IdeasHubView from './components/IdeasHubView';
import Login from './components/Login';
import Signup from './components/Signup';
import AgencyDashboard from './components/AgencyDashboard';
import VerificationPending from './components/VerificationPending';


const MenuIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

const LogoIcon = () => (
    <svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="8" fill="black"/>
        <g stroke="#FBBF24" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            {/* Hand-drawn Hexagon */}
            <path d="M30 9 C35 10 41 16 40 24 C39 32 32 40 24 40 C16 40 9 34 8 26 C7 18 13 10 21 9 C24 8.5 27 8.5 30 9 Z" />
            {/* Hand-drawn N */}
            <path d="M19 33 L19.5 15" />
            <path d="M19.5 15 L28.5 33" />
            <path d="M28.5 33 L29 15" />
        </g>
    </svg>
);

const LoadingSpinner: React.FC = () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-800">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-amber-400"></div>
    </div>
);


const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.CALENDAR);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Auth state
  // Fix: Use firebase.User as the type for the user state.
  const [user, setUser] = useState<firebase.User | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  
  // State for agency viewing a specific client's portal
  const [agencyViewingClientId, setAgencyViewingClientId] = useState<string | null>(null);
  
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme === 'dark' || storedTheme === 'light') {
            return storedTheme;
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(theme === 'dark' ? 'light' : 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        // Reload user to get the latest emailVerified status
        await currentUser.reload();
        setUser(currentUser);
        
        // Don't fetch data if email is not verified, it will fail
        if (!currentUser.emailVerified) {
          setIsLoadingAuth(false);
          return;
        }

        const agencyEmails = ['briciomarketing@gmail.com', 'briciomarketing@mail.com'];
        const isAdmin = agencyEmails.includes(currentUser.email || '');

        if (isAdmin) {
          setRole('agencia');
          setEmpresaId(null);

          // Sync role to Firestore to ensure security rules work correctly.
          try {
            const userDocRef = db.collection('usuarios').doc(currentUser.uid);
            const userDocSnap = await userDocRef.get();
            if (!userDocSnap.exists || userDocSnap.data()?.role !== 'agencia') {
              await userDocRef.set({
                  email: currentUser.email,
                  role: 'agencia',
                  empresaId: null
              }, { merge: true });
            }
          } catch (error) {
            console.error("Error syncing agency role to Firestore:", error);
          }

        } else {
          try {
            const userDocRef = db.collection('usuarios').doc(currentUser.uid);
            const userDocSnap = await userDocRef.get();
            
            if (userDocSnap.exists) {
              const userData = userDocSnap.data();
              setEmpresaId(userData.empresaId || null);
              setRole(userData.role || 'cliente');
            } else {
              await db.collection('usuarios').doc(currentUser.uid).set({
                  email: currentUser.email,
                  empresaId: null,
                  role: 'cliente',
              });
              setEmpresaId(null);
              setRole('cliente');
            }
          } catch (error) {
              console.error("Error fetching client user data:", error);
              setEmpresaId(null);
              setRole(null);
          }
        }
      } else {
        setUser(null);
        setEmpresaId(null);
        setRole(null);
        setAgencyViewingClientId(null);
      }
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      // Fix: Use Firebase v8 signOut method
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const renderPortalView = (clientId: string) => {
     switch (currentView) {
      case View.CALENDAR:
        return <CalendarView empresaId={clientId} />;
      case View.UPDATES:
        return <WeeklyUpdatesView empresaId={clientId} />;
      case View.IDEAS:
        return <IdeasHubView empresaId={clientId} />;
      default:
        return <CalendarView empresaId={clientId} />;
    }
  };
  
  const renderClientView = () => {
    if (user && !empresaId && role === 'cliente') {
        return <div className="flex items-center justify-center h-full text-center p-4 text-slate-800 dark:text-slate-200">
            <div>
                <h2 className="text-2xl font-bold mb-2">Bem-vindo(a)!</h2>
                <p>Seu cadastro foi realizado com sucesso. Aguarde enquanto a agência associa sua conta a uma empresa.</p>
            </div>
        </div>;
    }
    
    if (!empresaId) {
       return <div className="flex items-center justify-center h-full text-slate-600 dark:text-slate-400"><p>Carregando dados da empresa...</p></div>;
    }

    return renderPortalView(empresaId);
  };
  
  if (isLoadingAuth) {
      return <LoadingSpinner />;
  }

  if (!user) {
      if (authView === 'login') {
        return <Login onSwitchToSignup={() => setAuthView('signup')} />;
      }
      return <Signup onSwitchToLogin={() => setAuthView('login')} />;
  }

  // If user is logged in but email is not verified, show verification pending screen.
  if (!user.emailVerified) {
      return <VerificationPending user={user} handleLogout={handleLogout} />;
  }

  // Role-based routing
  if (role === 'agencia') {
      if (agencyViewingClientId) {
          // Agency is viewing a client's portal
          return (
             <div className="relative min-h-screen md:flex text-slate-800 dark:text-slate-200">
                <Sidebar 
                    currentView={currentView} 
                    setCurrentView={setCurrentView}
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                    handleLogout={handleLogout}
                    userRole={role}
                    onBackToDashboard={() => setAgencyViewingClientId(null)}
                    theme={theme}
                    toggleTheme={toggleTheme}
                />
                <main className="flex-1 overflow-y-auto p-4 sm:p-8 md:pt-8 pt-20">
                    <header className="md:hidden fixed top-0 left-0 right-0 bg-white dark:bg-slate-800 text-slate-800 dark:text-white p-4 flex items-center justify-between shadow-lg z-20">
                        <div className="flex items-center">
                            <div className="mr-3">
                            <LogoIcon />
                            </div>
                            <span className="text-lg font-bold cursor-default select-none">Agência Nocrato</span>
                        </div>
                        <button onClick={() => setIsSidebarOpen(true)} className="p-2" aria-label="Abrir menu">
                            <MenuIcon />
                        </button>
                    </header>
                    {renderPortalView(agencyViewingClientId)}
                </main>
            </div>
          );
      } else {
         return <AgencyDashboard handleLogout={handleLogout} onViewClient={(clientId) => setAgencyViewingClientId(clientId)} />;
      }
  }
  
  // Default to client view
  return (
    <div className="relative min-h-screen md:flex text-slate-800 dark:text-slate-200">
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        handleLogout={handleLogout}
        userRole={role}
        theme={theme}
        toggleTheme={toggleTheme}
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 md:pt-8 pt-20">
        <header className="md:hidden fixed top-0 left-0 right-0 bg-white dark:bg-slate-800 text-slate-800 dark:text-white p-4 flex items-center justify-between shadow-lg z-20">
            <div className="flex items-center">
                <div className="mr-3">
                  <LogoIcon />
                </div>
                <span className="text-lg font-bold cursor-default select-none">Agência Nocrato</span>
            </div>
            <button onClick={() => setIsSidebarOpen(true)} className="p-2" aria-label="Abrir menu">
                <MenuIcon />
            </button>
        </header>
        {renderClientView()}
      </main>
    </div>
  );
};

export default App;
