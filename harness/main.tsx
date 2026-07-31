import React from 'react';
import ReactDOM from 'react-dom/client';
import CalendarView from '../components/CalendarView';
import ClientProductionView from '../components/ClientProductionView';
import WeeklyUpdatesView from '../components/WeeklyUpdatesView';
import IdeasHubView from '../components/IdeasHubView';
import ClientReportsView from '../components/ClientReportsView';
import ClientWorkspace from '../components/ClientWorkspace';
import AgencyDashboard from '../components/AgencyDashboard';
import ProfileView from '../components/ProfileView';
import CompleteProfileModal from '../components/CompleteProfileModal';
import Login from '../components/Login';
import Signup from '../components/Signup';
import VerificationPending from '../components/VerificationPending';
import EventDetailModal from '../components/EventDetailModal';
import { UserProfile } from '../types';

const profile: UserProfile = { id: 'u0', email: 'pedro.vidal@exemplo.com', role: 'agencia', empresaId: null, nome: 'Pedro', sobrenome: 'Vidal' };
const noop = () => {};
const evento: any = {
    id: 'ev0', title: 'Carrossel institucional com título longo para testar quebra',
    date: new Date(), type: 'Carrossel', status: 'Concluído', plataforma: 'Instagram',
    url: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrS',
    copy: 'Legenda de exemplo '.repeat(10), approval: 'aguardando'
};

const SCREENS: Record<string, React.ReactNode> = {
    login: <Login onSwitchToSignup={noop} />,
    signup: <Signup onSwitchToLogin={noop} />,
    verificacao: <VerificationPending user={{ email: 'pedro@x.com', sendEmailVerification: async () => {}, reload: async () => {}, emailVerified: false } as any} handleLogout={noop} />,
    'perfil-obrigatorio': <CompleteProfileModal profile={{ ...profile, nome: '', sobrenome: '' }} onSaved={noop} handleLogout={noop} />,
    perfil: <div className="p-4 bg-[#111111] min-h-screen"><ProfileView profile={profile} /></div>,
    painel: <AgencyDashboard handleLogout={noop} onOpenClient={noop} onOpenProfile={noop} profile={profile} userEmail={profile.email} userName="Pedro Vidal" />,
    'cliente-workspace': <ClientWorkspace empresaId="agencia-mara" empresaNome="Agencia Mara" userEmail={profile.email} userName="Pedro Vidal" onBack={noop} />,
    calendario: <div className="p-4 bg-[#111111] min-h-screen"><CalendarView empresaId="agencia-mara" userRole="agencia" userEmail={profile.email} userName="Pedro Vidal" /></div>,
    producao: <div className="p-4 bg-[#111111] min-h-screen"><ClientProductionView empresaId="agencia-mara" userEmail={profile.email} userName="Pedro Vidal" /></div>,
    semana: <div className="p-4 bg-[#111111] min-h-screen"><WeeklyUpdatesView empresaId="agencia-mara" /></div>,
    arquivos: <div className="p-4 bg-[#111111] min-h-screen"><IdeasHubView empresaId="agencia-mara" /></div>,
    relatorios: <div className="p-4 bg-[#111111] min-h-screen"><ClientReportsView empresaId="agencia-mara" userRole="agencia" userName="Pedro Vidal" /></div>,
    modal: <div className="bg-[#111111] min-h-screen"><EventDetailModal event={evento} onSave={noop} onDelete={noop} onClose={noop} empresaId="agencia-mara" userEmail={profile.email} userRole="agencia" userName="Pedro Vidal" /></div>
};

const screen = new URLSearchParams(location.search).get('screen') || 'painel';
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>{SCREENS[screen] || <p style={{ color: 'white' }}>Tela desconhecida: {screen}</p>}</React.StrictMode>
);
