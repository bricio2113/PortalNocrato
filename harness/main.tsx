import React from 'react';
import ReactDOM from 'react-dom/client';
import CalendarView from '../components/CalendarView';
import ClientProductionView from '../components/ClientProductionView';
import WeeklyUpdatesView from '../components/WeeklyUpdatesView';
import ClientReportsView from '../components/ClientReportsView';
import ClientFormModal from '../components/ClientFormModal';
import ThumbBench from './ThumbBench';
import MateriaisView from '../components/MateriaisView';
import MediaUpload from '../components/MediaUpload';
import PostPreview from '../components/PostPreview';
import ClientHomeView from '../components/ClientHomeView';
import PostTimeline from '../components/PostTimeline';
import PersonCard, { SELO_ADMIN, SELO_COLABORADOR, SELO_SEM_EMPRESA, SELO_ATIVO } from '../components/PersonCard';
import PersonDetailModal from '../components/PersonDetailModal';
import SettingsView from '../components/SettingsView';
import ClientWorkspace from '../components/ClientWorkspace';
import AgencyDashboard from '../components/AgencyDashboard';
import AgencyCalendarView from '../components/AgencyCalendarView';
import TasksView from '../components/TasksView';
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
    // Tres pecas: o carrossel da previa so e exercitado com mais de uma, e a
    // terceira e video, que segue outro caminho de render.
    midias: [
        { url: 'https://exemplo.invalido/peca-1.jpg', path: 'p1', contentType: 'image/jpeg', bytes: 1000 },
        { url: 'https://exemplo.invalido/peca-2.jpg', path: 'p2', contentType: 'image/jpeg', bytes: 1000 },
        { url: 'https://exemplo.invalido/peca-3.mp4', path: 'p3', contentType: 'video/mp4', bytes: 5000 }
    ],
    copy: 'Legenda de exemplo '.repeat(10), approval: 'aguardando'
};

/**
 * MIDIA E PASTAS LADO A LADO.
 *
 * Existe para verificar a promessa "o que subir no conteudo aparece nas pastas".
 * Nenhuma tela isolada prova isso: o modal mostraria o arquivo na propria grade e
 * a tela de pastas mostraria a listagem, sem nada ligando as duas. Aqui o upload
 * acontece no componente de midia da esquerda e a listagem da direita e a mesma
 * `MateriaisView` do app - se o arquivo nao chegar na pasta certa, a coluna da
 * direita continua sem ele depois do "Atualizar".
 *
 * O modal inteiro nao serve aqui: e uma camada fixa sobre a tela e cobriria a
 * listagem. O que precisa ser exercitado e o upload, que e este componente.
 */
const MidiaEPastas: React.FC = () => {
    const [midias, setMidias] = React.useState<any[]>([]);
    const [pasta, setPasta] = React.useState<string[] | null>(null);
    return (
        <div className="p-4 bg-[#111111] min-h-screen grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="bg-[#1A1A1A] border border-white/5 rounded-card p-4">
                <MediaUpload
                    empresaId="agencia-mara"
                    eventId=""
                    midias={midias}
                    onChange={setMidias}
                    onThumb={noop}
                    titulo="Reel de captação — agosto"
                    pastaMidia={pasta}
                    onPastaMidia={setPasta}
                />
            </div>
            <MateriaisView empresaId="agencia-mara" userRole="agencia" />
        </div>
    );
};

/**
 * PECA QUE FALHOU E CARROSSEL QUE CRESCE.
 *
 * A previa marcava a peca quebrada e nunca tentava de novo: quem subia tres
 * arquivos via a peca 1 em "nao foi possivel carregar" para sempre, porque ela e
 * renderizada no instante seguinte ao upload dela - quando a URL as vezes ainda nao
 * esta servindo - e nada limpava a marca depois.
 *
 * A auditoria nunca pegou isso porque no harness TODAS as imagens falham (o host
 * de exemplo nao existe), entao o estado "uma falhou e as outras nao" nao existia.
 * Aqui as pecas sao data URI - carregam offline -, a falha e provocada na mao e o
 * botao adiciona a peca seguinte.
 */
const peca = (n: number) =>
    `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#333"/><text x="20" y="26" font-size="18" fill="#FABE01" text-anchor="middle">${n}</text></svg>`
    )}`;

const PreviaCarrossel: React.FC = () => {
    const [qtd, setQtd] = React.useState(2);
    const midias = Array.from({ length: qtd }, (_, i) => ({
        url: peca(i + 1), path: `p${i}`, contentType: 'image/svg+xml', bytes: 100
    }));
    return (
        <div className="p-4 bg-[#111111] min-h-screen max-w-md space-y-3">
            <PostPreview
                event={{ ...evento, id: 'ev-previa', midias } as any}
                handle="drasylviafisio"
            />
            <button
                onClick={() => setQtd(q => q + 1)}
                className="w-full py-2 text-xs font-semibold bg-white/5 text-zinc-200 rounded-control"
            >
                adicionar peça
            </button>
        </div>
    );
};

const SCREENS: Record<string, React.ReactNode> = {
    login: <Login onSwitchToSignup={noop} />,
    signup: <Signup onSwitchToLogin={noop} />,
    verificacao: <VerificationPending user={{ email: 'pedro@x.com', sendEmailVerification: async () => {}, reload: async () => {}, emailVerified: false } as any} handleLogout={noop} />,
    'perfil-obrigatorio': <CompleteProfileModal profile={{ ...profile, nome: '', sobrenome: '' }} onSaved={noop} handleLogout={noop} />,
    perfil: <div className="p-4 bg-[#111111] min-h-screen"><ProfileView profile={profile} /></div>,
    // onOpenClient registra em vez de navegar: a navegacao vive no App, que o
    // harness nao monta. Sem registrar, "clicou e nao aconteceu nada" e
    // indistinguivel de "clicou e o painel pediu para abrir o conteudo certo".
    painel: <AgencyDashboard
        handleLogout={noop}
        onOpenClient={(empresaId, nome, section, eventId) => {
            (globalThis as any).__abriu = { empresaId, nome, section, eventId };
        }}
        onOpenProfile={noop} profile={profile} userEmail={profile.email} userName="Pedro Vidal"
    />,
    // A OUTRA METADE do caminho: o espaco de trabalho recebendo o conteudo a abrir.
    'cliente-workspace-tarefa': <ClientWorkspace
        empresaId="agencia-mara" empresaNome="Agencia Mara"
        userEmail={profile.email} userName="Pedro Vidal"
        initialSection="production" initialEventId="ev0" onBack={noop}
    />,
    'cliente-workspace': <ClientWorkspace empresaId="agencia-mara" empresaNome="Agencia Mara" userEmail={profile.email} userName="Pedro Vidal" onBack={noop} />,
    calendario: <div className="p-4 bg-[#111111] min-h-screen"><CalendarView empresaId="agencia-mara" empresaNome="Agencia Mara" userRole="agencia" userEmail={profile.email} userName="Pedro Vidal" /></div>,
    // O MESMO calendario visto pelo cliente. Existe como tela propria porque a
    // diferenca entre os dois papeis nao e cosmetica: o cliente nao arrasta, nao
    // ve prazo de producao nem atraso. Sem esta tela, metade do componente
    // nunca era renderizada na auditoria.
    'calendario-cliente': <div className="p-4 bg-[#111111] min-h-screen"><CalendarView empresaId="agencia-mara" empresaNome="Agencia Mara" userRole="cliente" userEmail="cliente@exemplo.com" userName="Cliente Exemplo" /></div>,
    producao: <div className="p-4 bg-[#111111] min-h-screen"><ClientProductionView empresaId="agencia-mara" userEmail={profile.email} userName="Pedro Vidal" onIrParaCalendario={noop} /></div>,
    // O MESMO modal do calendario, aberto na aba de gestao - as duas abas do post
    // precisam ser medidas, e a de gestao so aparece para a agencia.
    // MODAL visto pelo CLIENTE: a coluna da peca com o bloco de aprovacao, e
    // nenhuma aba de gestao. Sem esta tela o caminho do cliente nao e medido.
    'modal-cliente': <div className="bg-[#111111] min-h-screen">
        <EventDetailModal
            event={{ ...evento, id: 'ev0' } as any}
            onSave={noop} onDelete={noop} onClose={noop}
            empresaId="agencia-mara" userRole="cliente" perfilHandle="drasylviafisio"
            userEmail="cliente@exemplo.com" userName="Cliente Exemplo"
        />
    </div>,
    // MIDIA com pasta ja escolhida: a faixa do destino e a grade de arquivos.
    'modal-midia': <div className="bg-[#111111] min-h-screen">
        <EventDetailModal
            event={{ ...evento, id: 'ev0', pastaMidia: ['Imagens', '2026', 'Estatico Captacao'] } as any}
            onSave={noop} onDelete={noop} onClose={noop}
            empresaId="agencia-mara" userRole="agencia" perfilHandle="drasylviafisio"
            userEmail={profile.email} userName="Pedro Vidal"
        />
    </div>,
    // PUBLICACAO NOVA (sem id). E a tela onde o campo de midia havia DESAPARECIDO:
    // ele estava atras de `!isCreating`. Sem esta tela na auditoria, o caso "criar
    // conteudo e ja subir a peca" nunca era renderizado - e foi assim que a
    // regressao passou.
    'modal-novo': <div className="bg-[#111111] min-h-screen">
        <EventDetailModal
            event={{
                id: '', title: 'Reel de captação — agosto', date: new Date(),
                type: 'Reel', status: 'Pendente', plataforma: 'Instagram'
            } as any}
            // Registra o que o "Agendar" entrega. A capa de um post sem id viaja
            // aqui, e nao no documento: sem inspecionar este argumento, o teste nao
            // consegue distinguir "capa gravada depois" de "capa perdida".
            onSave={(ev, extras) => {
                (globalThis as any).__save = {
                    id: ev.id,
                    pastaMidia: ev.pastaMidia || null,
                    midias: (ev.midias || []).length,
                    thumbBytes: extras?.thumb ? extras.thumb.length : 0
                };
            }}
            onDelete={noop} onClose={noop}
            empresaId="agencia-mara" userRole="agencia" perfilHandle="drasylviafisio"
            userEmail={profile.email} userName="Pedro Vidal"
        />
    </div>,
    'midia-e-pastas': <MidiaEPastas />,
    'previa-carrossel': <PreviaCarrossel />,
    // TAREFAS isolada, para medir a faixa de tempo e os filtros sem o painel.
    tarefas: <div className="p-4 bg-[#111111] min-h-screen">
        <TasksView
            empresas={[
                { id: 'Agencia Mara', nome: 'Agencia Mara' },
                { id: 'MarcioFisio', nome: 'Marcio Fisio' }
            ] as any}
            users={[
                { id: 'u0', email: 'pedro.vidal2608@gmail.com', role: 'agencia', empresaId: null, nome: 'Maria', sobrenome: 'Silva', cargo: 'Social Media' },
                { id: 'u3', email: 'briciomarketing@gmail.com', role: 'agencia', empresaId: null, nome: 'Carlos', sobrenome: 'Teixeira', cargo: 'Designer' }
            ] as any}
            onOpenClient={(empresaId, nome, section, eventId) => {
                (globalThis as any).__abriu = { empresaId, nome, section, eventId };
            }}
        />
    </div>,
    // CALENDARIO GLOBAL isolado, para medir o seletor sem o painel em volta.
    'calendario-agencia': <div className="p-4 bg-[#111111] min-h-screen">
        <AgencyCalendarView
            empresas={[
                { id: 'Agencia Mara', nome: 'Agencia Mara', handle: 'agenciamara' },
                { id: 'Dra.SylviaFisio', nome: 'Dra. Sylvia Fisio', handle: 'drasylviafisio' },
                { id: 'MarcioFisio', nome: 'Marcio Fisio', handle: 'marciofisio' }
            ] as any}
            pendingByEmpresa={{ 'MarcioFisio': { aguardandoAgencia: 3 } as any }}
            userEmail={profile.email}
            userName="Pedro Vidal"
        />
    </div>,
    'modal-gestao': <div className="bg-[#111111] min-h-screen">
        <EventDetailModal
            event={{ ...evento, id: 'ev0', responsaveis: ['u0', 'u3'] } as any}
            abaInicial="gestao"
            onSave={noop} onDelete={noop} onClose={noop}
            empresaId="agencia-mara" userRole="agencia" perfilHandle="drasylviafisio"
            userEmail={profile.email} userName="Pedro Vidal"
        />
    </div>,
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
