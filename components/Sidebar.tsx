import React from 'react';
import { View } from '../types';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  isOpen: boolean;
  onClose: () => void;
  handleLogout: () => void;
  userRole: string | null;
  onBackToDashboard?: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-slate-200 hover:bg-slate-700 hover:text-white'
      }`}
    >
      <span className="mr-3">{icon}</span>
      {label}
    </button>
  );
};

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

const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
);

const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
);

const ThemeToggleButton: React.FC<{ theme: 'light' | 'dark'; toggleTheme: () => void; }> = ({ theme, toggleTheme }) => {
    return (
        <button
            onClick={toggleTheme}
            className="flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 text-slate-200 hover:bg-slate-700 hover:text-white"
            aria-label={`Mudar para modo ${theme === 'light' ? 'escuro' : 'claro'}`}
        >
            <span className="mr-3">
                {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </span>
            <span>
                {theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
            </span>
        </button>
    );
};


const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, isOpen, onClose, handleLogout, userRole, onBackToDashboard, theme, toggleTheme }) => {
  const navItems = [
    { view: View.CALENDAR, label: 'Calendário', icon: <CalendarIcon /> },
    { view: View.UPDATES, label: 'Foco da Semana', icon: <CheckListIcon /> },
    { view: View.IDEAS, label: 'Hub de Ideias', icon: <LightbulbIcon /> },
  ];

  const handleNavItemClick = (view: View) => {
    setCurrentView(view);
    onClose();
  }

  return (
    <>
    {/* Backdrop for mobile */}
    <div 
        className={`fixed inset-0 bg-black/50 z-20 transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
    ></div>

    <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-800 text-white flex flex-col p-4 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between mb-10 px-2">
        <div className="flex items-center">
            <div className="mr-3">
              <LogoIcon />
            </div>
            <span className="text-xl font-bold cursor-default select-none">Agência Nocrato</span>
        </div>
        <button onClick={onClose} className="md:hidden p-2" aria-label="Fechar menu">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <nav className="flex-1 space-y-2">
         {userRole === 'agencia' && onBackToDashboard && (
            <button
                onClick={onBackToDashboard}
                className="flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 bg-amber-500 text-slate-900 hover:bg-amber-600 mb-4"
            >
                <span className="mr-3"><ArrowLeftIcon /></span>
                Voltar ao Painel
            </button>
        )}
        {navItems.map((item) => (
          <NavItem
            key={item.view}
            icon={item.icon}
            label={item.label}
            isActive={currentView === item.view}
            onClick={() => handleNavItemClick(item.view)}
          />
        ))}
      </nav>
      <div className="mt-auto space-y-1">
        <a 
          href="https://wa.me/5513991187759"
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 text-slate-200 hover:bg-slate-700 hover:text-white"
        >
          <span className="mr-3"><ChatIcon /></span>
          Falar com a Agência
          <span className="ml-auto"><ExternalLinkIcon /></span>
        </a>
        <ThemeToggleButton theme={theme} toggleTheme={toggleTheme} />
         <button
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 text-slate-200 hover:bg-slate-700 hover:text-white"
        >
          <span className="mr-3"><LogoutIcon /></span>
          Sair
        </button>
      </div>
    </aside>
    </>
  );
};

const CalendarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const CheckListIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
const LightbulbIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>;
const ExternalLinkIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>;
const ChatIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
const LogoutIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
const ArrowLeftIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>;


export default Sidebar;