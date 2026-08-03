import React from 'react';
import ReactDOM from 'react-dom/client';
import CalendarView from '../components/CalendarView';
import ClientProductionView from '../components/ClientProductionView';
import WeeklyUpdatesView from '../components/WeeklyUpdatesView';
import ClientReportsView from '../components/ClientReportsView';
import ClientFormModal from '../components/ClientFormModal';
import ThumbBench from './ThumbBench';
import MateriaisView from '../components/MateriaisView';
import ClientHomeView from '../components/ClientHomeView';
import PostTimeline from '../components/PostTimeline';
import PersonCard, { SELO_ADMIN, SELO_COLABORADOR, SELO_SEM_EMPRESA, SELO_ATIVO } from '../components/PersonCard';
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
    calendario: <div className="p-4 bg-[#111111] min-h-screen"><CalendarView empresaId="agencia-mara" empresaNome="Agencia Mara" userRole="agencia" userEmail={profile.email} userName="Pedro Vidal" /></div>,
    // O MESMO calendario visto pelo cliente. Existe como tela propria porque a
    // diferenca entre os dois papeis nao e cosmetica: o cliente nao arrasta, nao
    // ve prazo de producao nem atraso. Sem esta tela, metade do componente
    // nunca era renderizada na auditoria.
    'calendario-cliente': <div className="p-4 bg-[#111111] min-h-screen"><CalendarView empresaId="agencia-mara" empresaNome="Agencia Mara" userRole="cliente" userEmail="cliente@exemplo.com" userName="Cliente Exemplo" /></div>,
    producao: <div className="p-4 bg-[#111111] min-h-screen"><ClientProductionView empresaId="agencia-mara" userEmail={profile.email} userName="Pedro Vidal" /></div>,
    semana: <div className="p-4 bg-[#111111] min-h-screen"><WeeklyUpdatesView empresaId="agencia-mara" /></div>,
    arquivos: <div className="p-4 bg-[#111111] min-h-screen"><MateriaisView empresaId="agencia-mara" userRole="agencia" /></div>,
    'ficha-cliente': <div className="bg-[#111111] min-h-screen"><ClientFormModal isAdmin autorEmail={profile.email} onClose={noop} onSaved={noop} /></div>,
    'ficha-cliente-colab': <div className="bg-[#111111] min-h-screen"><ClientFormModal isAdmin={false} autorEmail={profile.email} onClose={noop} onSaved={noop} /></div>,
    thumb: <ThumbBench />,
    materiais: <div className="p-4 bg-[#111111] min-h-screen"><MateriaisView empresaId="agencia-mara" userRole="agencia" /></div>,
    'materiais-cliente': <div className="p-4 bg-[#111111] min-h-screen"><MateriaisView empresaId="agencia-mara" userRole="cliente" /></div>,
    'home-cliente': <div className="p-4 bg-[#111111] min-h-screen"><ClientHomeView empresaId="agencia-mara" empresaNome="Agencia Mara" userName="Cliente Exemplo" onIrParaCalendario={noop} /></div>,
    'pessoa-card': <div className="p-6 bg-[#111111] min-h-screen grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <PersonCard pessoa={{ id: 'p1', email: 'pedro.vidal2608@gmail.com', nome: 'Pedro', sobrenome: 'Vidal', cargo: 'Diretor' }} selo={SELO_ADMIN} ehVoce subtitulo="Diretor" campos={[{ rotulo: 'Permissão', valor: 'Administrador' }]} acoes={[{ label: 'Editar cargo', onClick: noop }, { label: 'Financeiro', onClick: noop }, { label: 'Remover da equipe', onClick: noop, destrutiva: true }]} />
        <PersonCard pessoa={{ id: 'p2', email: 'kaiodaikal@gmail.com', nome: 'Kaio', sobrenome: 'Henrique' }} selo={SELO_COLABORADOR} subtitulo="Cargo não definido" campos={[{ rotulo: 'Permissão', valor: 'Colaborador' }]} acoes={[{ label: 'Enviar redefinição de senha', onClick: noop }]} />
        <PersonCard pessoa={{ id: 'p3', email: 'enfermeira.lima@hotmail.com', nome: 'Ana', sobrenome: 'Lima' }} selo={SELO_SEM_EMPRESA} borda="atencao" subtitulo="Conta sem cliente" acoes={[{ label: 'Remover conta', onClick: noop, destrutiva: true }]} />
        <PersonCard pessoa={{ id: 'p4', email: 'marcioalmeida81@gmail.com', nome: 'Marcio', sobrenome: 'Almeida', cargo: 'Contato do cliente' }} selo={SELO_ATIVO} subtitulo="Contato do cliente" campos={[{ rotulo: 'Permissão', valor: 'Cliente' }]} acoes={[{ label: 'Enviar redefinição de senha', onClick: noop }]} />
    </div>,
    andamento: <div className="p-6 bg-[#111111] min-h-screen max-w-lg"><PostTimeline empresaId="agencia-mara" eventId="ev0" userRole="cliente" /></div>,
    relatorios: <div className="p-4 bg-[#111111] min-h-screen"><ClientReportsView empresaId="agencia-mara" userRole="agencia" userName="Pedro Vidal" /></div>,
    modal: <div className="bg-[#111111] min-h-screen"><EventDetailModal event={evento} onSave={noop} onDelete={noop} onClose={noop} empresaId="agencia-mara" userEmail={profile.email} userRole="agencia" userName="Pedro Vidal" /></div>
};

const screen = new URLSearchParams(location.search).get('screen') || 'painel';
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>{SCREENS[screen] || <p style={{ color: 'white' }}>Tela desconhecida: {screen}</p>}</React.StrictMode>
);
