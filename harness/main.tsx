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
import PersonDetailModal from '../components/PersonDetailModal';
import SettingsView from '../components/SettingsView';
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
    // items-start: sem isto a grade esticava os cartoes ate a altura da tela e a
    // captura parecia mostrar cartoes gigantes que o painel real nao tem.
    'pessoa-card': <div className="p-6 bg-[#111111] min-h-screen grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
        <PersonCard pessoa={{ id: 'p1', email: 'pedro.vidal2608@gmail.com', nome: 'Pedro', sobrenome: 'Vidal', cargo: 'Diretor' }} selo={SELO_ADMIN} ehVoce subtitulo="Diretor" campos={[{ rotulo: 'Permissão', valor: 'Administrador' }]} onAbrir={noop} />
        <PersonCard pessoa={{ id: 'p2', email: 'kaiodaikal@gmail.com', nome: 'Kaio', sobrenome: 'Henrique' }} selo={SELO_COLABORADOR} subtitulo="Cargo não definido" campos={[{ rotulo: 'Permissão', valor: 'Colaborador' }]} onAbrir={noop} />
        <PersonCard pessoa={{ id: 'p3', email: 'enfermeira.lima@hotmail.com', nome: 'Ana', sobrenome: 'Lima' }} selo={SELO_SEM_EMPRESA} borda="atencao" subtitulo="Conta sem cliente" onAbrir={noop} />
        <PersonCard pessoa={{ id: 'p4', email: 'marcioalmeida81@gmail.com', nome: 'Marcio', sobrenome: 'Almeida', cargo: 'Contato do cliente' }} selo={SELO_ATIVO} subtitulo="Contato do cliente" campos={[{ rotulo: 'Permissão', valor: 'Cliente' }]} onAbrir={noop} />
    </div>,
    // FICHA DA PESSOA vista por ADMIN: e a unica combinacao que carrega o
    // financeiro. Sem esta tela, a secao de dinheiro nunca era renderizada.
    'pessoa-ficha': <PersonDetailModal
        pessoa={{ id: 'u1', email: 'pedro.vidal2608@gmail.com', role: 'agencia', empresaId: null, nome: 'Maria', sobrenome: 'Silva', cargo: 'Editora de vídeo', telefone: '(13) 98888-7777' }}
        selo={SELO_ADMIN} souAdmin autorEmail={profile.email}
        empresasParaAtividade={[{ id: 'Agencia Mara', nome: 'Agencia Mara' }, { id: 'MarcioFisio', nome: 'Marcio Fisio' }]}
        onSalvarCargo={async () => {}}
        acoes={[{ label: 'Enviar redefinição de senha', onClick: noop }, { label: 'Remover da equipe', onClick: noop, destrutiva: true }]}
        onClose={noop}
    />,
    // A MESMA ficha vista por COLABORADOR: nada de financeiro, nada de editar
    // cargo. Serve para provar que a secao some, e nao apenas fica vazia.
    'pessoa-ficha-colab': <PersonDetailModal
        pessoa={{ id: 'u1', email: 'kaiodaikal@gmail.com', role: 'agencia', empresaId: null, nome: 'Kaio', sobrenome: 'Henrique', cargo: 'Editor de vídeo' }}
        selo={SELO_COLABORADOR} souAdmin={false}
        acoes={[{ label: 'Enviar redefinição de senha', onClick: noop }]}
        onClose={noop}
    />,
    // Contato do CLIENTE: sem financeiro por pessoa (o contrato e da empresa) e
    // com o nome do cliente ao lado do selo.
    'pessoa-ficha-cliente': <PersonDetailModal
        pessoa={{ id: 'u3', email: 'marcioalmeida81@gmail.com', role: 'cliente', empresaId: 'MarcioFisio', nome: 'Marcio', sobrenome: 'Almeida' }}
        selo={SELO_ATIVO} empresaNome="Marcio Fisio" souAdmin autorEmail={profile.email}
        empresasParaAtividade={[{ id: 'MarcioFisio', nome: 'Marcio Fisio' }]}
        acoes={[{ label: 'Enviar redefinição de senha', onClick: noop }, { label: 'Remover acesso', onClick: noop, destrutiva: true }]}
        onClose={noop}
    />,
    // Configuracoes vistas por ADMIN (edita) e por COLABORADOR (so le): a
    // diferenca entre as duas e a razao de a tela existir.
    configuracoes: <div className="p-4 sm:p-8 bg-[#111111] min-h-screen"><SettingsView souAdmin autorEmail={profile.email} cargosEmUso={['Social Media', 'Designer', 'Cargo Antigo']} /></div>,
    'configuracoes-colab': <div className="p-4 sm:p-8 bg-[#111111] min-h-screen"><SettingsView souAdmin={false} cargosEmUso={['Designer']} /></div>,
    andamento: <div className="p-6 bg-[#111111] min-h-screen max-w-lg"><PostTimeline empresaId="agencia-mara" eventId="ev0" userRole="cliente" /></div>,
    relatorios: <div className="p-4 bg-[#111111] min-h-screen"><ClientReportsView empresaId="agencia-mara" userRole="agencia" userName="Pedro Vidal" /></div>,
    modal: <div className="bg-[#111111] min-h-screen"><EventDetailModal event={evento} onSave={noop} onDelete={noop} onClose={noop} empresaId="agencia-mara" userEmail={profile.email} userRole="agencia" userName="Pedro Vidal" /></div>
};

const screen = new URLSearchParams(location.search).get('screen') || 'painel';
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>{SCREENS[screen] || <p style={{ color: 'white' }}>Tela desconhecida: {screen}</p>}</React.StrictMode>
);
