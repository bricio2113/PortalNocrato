import React from 'react';
import { View, UserProfile } from '../types';
import { getDisplayName, getInitials, isSafeImageSrc } from '../utils/avatar';
import { AppSidebar, NavGroup } from './AppSidebar';
import {
    Calendar, Target, DownloadCloud, ExternalLink, LayoutDashboard,
    MessageCircle, LogOut, ArrowLeft, UserCircle
} from 'lucide-react';

interface SidebarProps {
    currentView: View;
    setCurrentView: (view: View) => void;
    isOpen: boolean;
    onClose: () => void;
    handleLogout: () => void;
    userRole: string | null;
    /** E-mail da conta logada. Sem ele o rodape mostra um placeholder neutro. */
    userEmail?: string | null;
    /** Nome/ID da empresa que esta sendo visualizada, quando conhecido. */
    empresaNome?: string | null;
    /** Publicacoes aguardando acao de quem esta logado. */
    pendingCount?: number;
    /** Perfil do usuario logado: nome e foto no rodape. */
    profile?: UserProfile | null;
    onBackToDashboard?: () => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
}

/**
 * Menu do portal do cliente.
 *
 * A casca - gaveta, overlay, pilulas, rodape - vive em AppSidebar e e a mesma
 * do painel da agencia e do espaco de trabalho de um cliente. Aqui fica so o
 * que e especifico deste contexto: quais secoes existem e o atalho de suporte.
 */
const Sidebar: React.FC<SidebarProps> = ({
    currentView, setCurrentView, isOpen, onClose, handleLogout,
    userRole, userEmail, profile, empresaNome, pendingCount = 0, onBackToDashboard
}) => {
    const groups: NavGroup[] = [
        {
            title: 'Geral',
            items: [
                // O selo de pendencia sai do calendario e vem para a Visao Geral:
                // e ela que agora responde "tem algo me esperando?", e o selo
                // precisa estar onde a resposta esta.
                { id: View.HOME, label: 'Visão Geral', icon: LayoutDashboard, badge: pendingCount },
                { id: View.CALENDAR, label: 'Calendário Editorial', icon: Calendar },
                { id: View.IDEAS, label: 'Arquivos & Materiais', icon: DownloadCloud }
            ]
        },
        {
            title: 'Conta',
            items: [
                { id: View.PROFILE, label: 'Meu Perfil', icon: UserCircle }
            ]
        }
    ];

    const handleNavItemClick = (view: View) => {
        setCurrentView(view);
        if (window.innerWidth < 768) onClose(); // Fecha a gaveta ao escolher no mobile
    };

    const parts = { nome: profile?.nome, sobrenome: profile?.sobrenome, email: userEmail };
    const hasPhoto = isSafeImageSrc(profile?.fotoUrl);

    return (
        <AppSidebar
            groups={groups}
            activeId={currentView}
            onSelect={(id) => handleNavItemClick(id as View)}
            isOpen={isOpen}
            onClose={onClose}
            aboveNav={userRole === 'agencia' && onBackToDashboard ? (
                <button
                    onClick={onBackToDashboard}
                    className="flex items-center justify-center gap-2 w-full px-3 py-2.5 text-sm font-semibold rounded-control bg-[#FABE01] text-black hover:bg-[#FABE01]/90 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar ao painel
                </button>
            ) : undefined}
            footer={
                <div className="space-y-1">
                    {/* Identidade real da sessao. Antes isto era "Cliente Nocrato /
                        Plano Premium" fixo no codigo: todo cliente via o mesmo
                        nome e um plano que nao existe. */}
                    <button
                        onClick={() => handleNavItemClick(View.PROFILE)}
                        title={userEmail || undefined}
                        className="flex items-center gap-3 w-full p-2 rounded-control hover:bg-white/5 transition-colors text-left group"
                    >
                        {hasPhoto ? (
                            <img src={profile!.fotoUrl!} alt="" className="w-9 h-9 shrink-0 rounded-full object-cover" />
                        ) : (
                            <div
                                className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-tr from-[#FABE01] to-[#DE7928] flex items-center justify-center text-black font-bold text-xs"
                                aria-hidden="true"
                            >
                                {getInitials(parts)}
                            </div>
                        )}
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-white truncate group-hover:text-[#FABE01] transition-colors">
                                {getDisplayName(parts)}
                            </span>
                            <span className="block text-[11px] text-zinc-500 truncate">
                                {userRole === 'agencia'
                                    ? (empresaNome ? `Agência · vendo ${empresaNome}` : 'Agência')
                                    : (empresaNome || 'Cliente')}
                            </span>
                        </span>
                    </button>

                    <a
                        href="https://wa.me/5513991187759"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-control text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        <MessageCircle className="w-[18px] h-[18px] shrink-0 text-zinc-500 group-hover:text-[#25D366] transition-colors" />
                        Falar com a agência
                        <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                    </a>

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
    );
};

export default Sidebar;
