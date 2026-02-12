import React from 'react';
import { View } from '../types';
// Importação da Logo
// @ts-ignore
import favicon from '../assets/favicon.png';
// Ícones Lucide (Atualizados para Target e DownloadCloud)
import {
    Calendar, Target, DownloadCloud, ExternalLink,
    MessageCircle, LogOut, ArrowLeft, X
} from 'lucide-react';

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

// --- ITEM DE NAVEGAÇÃO ---
const NavItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`group flex items-center w-full px-4 py-3 text-sm font-medium rounded-sm transition-all duration-200 relative ${
                isActive
                    ? 'bg-[#FABE01]/10 text-[#FABE01]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
        >
            {/* Barra lateral dourada para item ativo */}
            {isActive && (
                <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#FABE01] rounded-r-full shadow-[0_0_10px_#FABE01]" />
            )}

            <span className={`mr-3 transition-transform group-hover:scale-110 ${isActive ? 'text-[#FABE01]' : 'text-zinc-500 group-hover:text-white'}`}>
        {icon}
      </span>
            {label}
        </button>
    );
};

// --- COMPONENTE SIDEBAR ---
const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, isOpen, onClose, handleLogout, userRole, onBackToDashboard, theme, toggleTheme }) => {

    const navItems = [
        {
            view: View.CALENDAR,
            label: 'Calendário Editorial',
            icon: <Calendar className="w-5 h-5" />
        },
        {
            view: View.UPDATES,
            label: 'Foco da Semana',
            // Ícone atualizado para Target (Alvo)
            icon: <Target className="w-5 h-5" />
        },
        {
            view: View.IDEAS,
            label: 'Arquivos & Materiais',
            // Ícone atualizado para DownloadCloud (Nuvem)
            icon: <DownloadCloud className="w-5 h-5" />
        },
    ];

    const handleNavItemClick = (view: View) => {
        setCurrentView(view);
        if (window.innerWidth < 768) {
            onClose(); // Fecha menu mobile ao clicar
        }
    }

    return (
        <>
            {/* OVERLAY MOBILE */}
            <div
                className={`fixed inset-0 bg-black/80 z-40 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
                    isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* SIDEBAR */}
            <aside
                className={`
            fixed md:sticky top-0 left-0 z-50 h-screen w-72 bg-[#111111] border-r border-white/5 
            flex flex-col transform transition-transform duration-300 ease-out shadow-2xl md:shadow-none
            ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
            >
                {/* HEADER DA SIDEBAR */}
                <div className="h-20 flex items-center justify-between px-6 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <img src={favicon} alt="Nocrato" className="h-8 w-auto brightness-0 invert" />
                        <div className="flex flex-col">
                            <span className="text-lg font-bold text-white tracking-tight leading-none">Nocrato</span>
                            <span className="text-[10px] text-[#FABE01] uppercase tracking-widest font-bold mt-0.5">Portal</span>
                        </div>
                    </div>

                    {/* Botão Fechar (Mobile) */}
                    <button
                        onClick={onClose}
                        className="md:hidden p-2 text-zinc-400 hover:text-white transition-colors"
                        aria-label="Fechar menu"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* CONTEÚDO DE NAVEGAÇÃO */}
                <div className="flex-1 flex flex-col justify-between py-6 px-4 overflow-y-auto custom-scrollbar">

                    {/* MENU PRINCIPAL */}
                    <nav className="space-y-1">
                        <p className="px-4 text-xs font-bold text-zinc-600 uppercase tracking-widest mb-4">Menu Principal</p>

                        {userRole === 'agencia' && onBackToDashboard && (
                            <button
                                onClick={onBackToDashboard}
                                className="flex items-center w-full px-4 py-3 mb-6 text-sm font-bold rounded-sm transition-all duration-200 bg-[#FABE01] text-black hover:bg-[#FABE01]/90 shadow-[0_0_15px_rgba(250,190,1,0.2)]"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
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

                    {/* RODAPÉ DA SIDEBAR */}
                    <div className="space-y-1 pt-6 border-t border-white/5 mt-6">
                        <p className="px-4 text-xs font-bold text-zinc-600 uppercase tracking-widest mb-2">Suporte & Config</p>

                        <a
                            href="https://wa.me/5513991187759"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center w-full px-4 py-3 text-sm font-medium rounded-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            <MessageCircle className="w-5 h-5 mr-3 text-zinc-500 group-hover:text-[#25D366] transition-colors" />
                            Falar com a Agência
                            <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                        </a>

                        <button
                            onClick={handleLogout}
                            className="flex items-center w-full px-4 py-3 text-sm font-medium rounded-sm text-zinc-400 hover:text-red-400 hover:bg-red-400/5 transition-colors mt-2"
                        >
                            <LogOut className="w-5 h-5 mr-3" />
                            Sair da Conta
                        </button>
                    </div>
                </div>

                {/* USER PROFILE MINI */}
                <div className="p-4 border-t border-white/5 bg-black/20">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FABE01] to-[#DE7928] flex items-center justify-center text-black font-bold text-xs">
                            NC
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-medium text-white truncate">Cliente Nocrato</span>
                            <span className="text-[10px] text-zinc-500 truncate">Plano Premium</span>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;