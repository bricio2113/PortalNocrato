import React, { useState, useEffect } from 'react';
import { db, auth } from '../utils/firebase';
import { DELETE_USER_ENDPOINT } from '../constants';
import { subscribePendingCounts, PendingCounts } from '../utils/posts';
import { UserProfile } from '../types';
import { getDisplayName, getInitials, isSafeImageSrc } from '../utils/avatar';
import { isAdmin, permissionLevel, PERMISSION_LABEL } from '../utils/permissions';
import { Empresa } from '../types';
import { parseEmpresa, statusLabel } from '../utils/empresas';
import ClientFormModal from './ClientFormModal';
import PersonDetailModal, { PersonDetailAcao, Bloco } from './PersonDetailModal';
import PersonCard, { SELO_ADMIN, SELO_COLABORADOR, SELO_SEM_EMPRESA } from './PersonCard';
import SettingsView from './SettingsView';
import AgencyOverview from './AgencyOverview';
import { AppSidebar, MobileTopBar, NavGroup } from './AppSidebar';
import { PageHeader, StatTile, greeting } from './ui';
import {
    LogOut, Calendar, Mail, Trash2, UserCog, Building2, Plus,
    X, Search, Loader2, Users, LayoutDashboard, Briefcase,
    ArrowRight, Shield, ClipboardList, MessageSquareWarning, FileBarChart, Check, AlertTriangle, Pencil, SlidersHorizontal
} from 'lucide-react';

interface UserData {
    id: string;
    email: string;
    role: string;
    empresaId: string | null;
    nome?: string | null;
    sobrenome?: string | null;
    fotoUrl?: string | null;
    /** Profissao: "Social Media", "Designer". So admin altera (ver regras). */
    cargo?: string | null;
    /** Contato. A propria pessoa mantem, igual a nome e foto. */
    telefone?: string | null;
}

// A ficha do cliente agora e um tipo compartilhado (types.ts): antes eram so
// id e nome, e todo contato e contrato vivia fora do sistema.
type EmpresaData = Empresa;

type ClientSection = 'overview' | 'calendar' | 'production' | 'weekly' | 'files' | 'reports';

type Aba = 'overview' | 'clients' | 'team' | 'settings';

interface AgencyDashboardProps {
    handleLogout: () => void;
    /**
     * Abre o espaco de trabalho de um cliente.
     *
     * Substitui onViewClient + onViewClientTasks: dois caminhos separados
     * obrigavam voltar ao painel so para sair do calendario e entrar na
     * producao do MESMO cliente.
     */
    onOpenClient: (empresaId: string, nome: string, section?: ClientSection) => void;
    /**
     * Aba em que abrir. Vem de fora porque entrar num cliente DESMONTA este
     * componente: sem isso, voltar caia sempre na Visao Geral.
     */
    abaInicial?: string;
    onTrocarAba?: (aba: string) => void;
    /** Abre a tela de perfil do proprio usuario da agencia. */
    onOpenProfile?: () => void;
    profile?: UserProfile | null;
    userEmail?: string | null;
    userName?: string | null;
}

// Empty state reutilizavel. O padrao aqui e sempre apontar a proxima acao -
// uma tela que so informa "0 itens" deixa o usuario sem saida.
const EmptyState: React.FC<{
    icon: React.ElementType;
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
}> = ({ icon: Icon, title, description, action }) => (
    <div className="col-span-full py-14 px-6 text-center border border-dashed border-white/10 rounded-card">
        <span className="w-14 h-14 mx-auto mb-4 rounded-card bg-white/[0.03] flex items-center justify-center">
            <Icon className="w-7 h-7 text-zinc-600" />
        </span>
        <p className="text-white font-bold mb-1">{title}</p>
        <p className="text-zinc-500 text-sm max-w-md mx-auto leading-relaxed">{description}</p>
        {action && (
            <button
                onClick={action.onClick}
                className="mt-6 inline-flex items-center gap-2 bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-semibold text-sm px-5 py-2.5 rounded-full transition-colors"
            >
                {action.label}
                <ArrowRight className="w-4 h-4" />
            </button>
        )}
    </div>
);


/**
 * Card de cliente com informacao macro.
 *
 * Antes existiam DOIS cards identicos para o mesmo cliente - um na Visao Geral e
 * um na aba Clientes -, ambos com os mesmos dois botoes e nenhum dado. O card
 * agora carrega o estado do cliente, e a superficie inteira e clicavel: abrir o
 * cliente e a acao principal, e os atalhos de secao sao secundarios.
 *
 * NOVO DESENHO. Os tres numeros ficavam soltos lado a lado e brigavam com o nome
 * pelo mesmo peso visual; o icone de predio era o mesmo em todo cartao, entao nao
 * distinguia nada; e as acoes de editar/excluir ficavam sempre acesas ao lado do
 * status, competindo com ele. Agora:
 *
 *   - a MARCA e a inicial do cliente, nao um icone generico repetido;
 *   - o STATUS e um ponto colorido junto ao nome, nao uma etiqueta que disputa o
 *     canto com dois botoes;
 *   - editar e excluir SO APARECEM no hover, porque nao e o que se faz aqui;
 *   - os numeros viram uma faixa dividida, um degrau abaixo do titulo;
 *   - o que exige acao ganha uma FAIXA no topo, na cor da urgencia - da para
 *     varrer nove cartoes e achar o problema sem ler numero nenhum.
 */
const ClientCard: React.FC<{
    empresa: EmpresaData;
    stats?: PendingCounts;
    usuarios: number;
    onOpen: (section?: ClientSection) => void;
    onDelete?: () => void;
    onEdit?: () => void;
}> = ({ empresa, stats, usuarios, onOpen, onDelete, onEdit }) => {
    const ajustes = stats?.aguardandoAgencia || 0;
    const aguardando = stats?.aguardandoCliente || 0;
    const atrasados = stats?.atrasados || 0;

    const urgencia = atrasados > 0 ? 'erro' : ajustes > 0 ? 'atencao' : usuarios === 0 ? 'aviso' : null;

    const BORDA = {
        erro: 'border-red-500/25 hover:border-red-500/50',
        atencao: 'border-[#FABE01]/25 hover:border-[#FABE01]/50',
        aviso: 'border-white/5 hover:border-white/15',
        normal: 'border-white/5 hover:border-[#FABE01]/40'
    };

    const FAIXA = {
        erro: 'bg-red-500/[0.08] text-red-400 border-red-500/20',
        atencao: 'bg-[#FABE01]/[0.08] text-[#FABE01] border-[#FABE01]/20',
        aviso: 'bg-white/[0.03] text-zinc-400 border-white/10'
    };

    const aviso = atrasados > 0
        ? `${atrasados} conteúdo(s) com prazo estourado`
        : ajustes > 0
            ? `${ajustes} ajuste(s) esperando a equipe`
            : usuarios === 0
                ? 'Ninguém do cliente consegue entrar ainda'
                : null;

    // Iniciais do cliente. Duas letras de palavras diferentes quando ha ("Dra.
    // Sylvia" -> DS); uma so quando e nome unico.
    const iniciais = empresa.nome
        .split(/\s+/)
        .filter(p => /[a-zA-ZÀ-ÿ0-9]/.test(p))
        .slice(0, 2)
        .map(p => p[0])
        .join('')
        .toUpperCase() || '?';

    const status = statusLabel(empresa.status);

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onOpen()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
            className={`group relative flex flex-col h-full text-left bg-[#1A1A1A] border rounded-card overflow-hidden cursor-pointer transition-colors focus:outline-none focus-visible:border-[#FABE01] ${
                BORDA[urgencia || 'normal']
            }`}
        >
            {/* FAIXA DE URGENCIA. Uma linha, no topo, na cor do problema. */}
            {aviso && urgencia && (
                <div className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold border-b ${FAIXA[urgencia]}`}>
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span className="truncate">{aviso}</span>
                </div>
            )}

            <div className="p-5">
                <div className="flex items-start gap-3">
                    <span className="w-11 h-11 shrink-0 rounded-control bg-[#FABE01]/10 text-[#FABE01] font-bold text-sm flex items-center justify-center">
                        {iniciais}
                    </span>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                            {/* Ponto de status junto ao nome: informa sem ocupar
                                uma etiqueta inteira. O texto vive no title. */}
                            <span
                                title={status.label}
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    empresa.status === 'encerrado' ? 'bg-zinc-600'
                                        : empresa.status === 'pausado' ? 'bg-amber-400'
                                        : 'bg-emerald-400'
                                }`}
                            />
                            <h3 className="text-white font-bold leading-tight truncate group-hover:text-[#FABE01] transition-colors">
                                {empresa.nome}
                            </h3>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            {empresa.handle && (
                                <span className="text-[11px] text-zinc-500 truncate">@{empresa.handle}</span>
                            )}
                            {empresa.segmento && (
                                <span className="text-[10px] font-medium text-zinc-400 bg-white/5 px-1.5 py-0.5 rounded-full truncate max-w-[10rem]">
                                    {empresa.segmento}
                                </span>
                            )}
                            {(empresa.status === 'pausado' || empresa.status === 'encerrado') && (
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${status.cor}`}>
                                    {status.label}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Editar e excluir aparecem no hover. Sempre acesas, nove
                        cartoes viravam dezoito botoes de manutencao na tela. */}
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        {onEdit && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                                aria-label={`Editar ficha de ${empresa.nome}`}
                                title="Editar ficha"
                                className="text-zinc-500 hover:text-white p-1.5 rounded-full hover:bg-white/5 transition-colors"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                aria-label={`Excluir ${empresa.nome}`}
                                className="text-zinc-600 hover:text-red-400 p-1.5 rounded-full hover:bg-red-500/10 transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* NUMEROS em faixa dividida: o fundo claro vazando entre eles
                    separa sem precisar de tres blocos. */}
                <div className="grid grid-cols-3 gap-px bg-white/5 rounded-control overflow-hidden mt-4">
                    {[
                        { r: 'No mês', v: stats ? stats.noMes : null },
                        { r: 'Publicados', v: stats ? stats.publicados : null },
                        { r: 'Na agenda', v: stats ? stats.total : null }
                    ].map(item => (
                        <div key={item.r} className="bg-[#111111] px-3 py-2.5">
                            <p className="text-lg font-bold text-white leading-none">
                                {item.v === null ? '—' : item.v}
                            </p>
                            <p className="text-[10px] text-zinc-500 mt-1">{item.r}</p>
                        </div>
                    ))}
                </div>

                {aguardando > 0 && (
                    <p className="text-[11px] text-zinc-500 mt-3">
                        <span className="text-zinc-300 font-semibold">{aguardando}</span> aguardando o cliente aprovar
                    </p>
                )}
            </div>

            {/* Atalhos de secao: levam direto ao lugar, sem passar pela visao
                geral do cliente. stopPropagation para nao disparar o card. */}
            <div className="flex items-center gap-0.5 mt-auto px-3 py-2 border-t border-white/5 bg-white/[0.015]">
                {([
                    ['calendar', 'Calendário', Calendar],
                    ['production', 'Produção', ClipboardList],
                    ['reports', 'Relatórios', FileBarChart]
                ] as const).map(([section, label, Icon]) => (
                    <button
                        key={section}
                        onClick={(e) => { e.stopPropagation(); onOpen(section); }}
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-white hover:bg-white/5 px-2.5 py-1.5 rounded-full transition-colors"
                    >
                        <Icon className="w-3 h-3" /> {label}
                    </button>
                ))}
                <span className="ml-auto pr-1.5 text-zinc-600 group-hover:text-[#FABE01] transition-colors">
                    <ArrowRight className="w-3.5 h-3.5" />
                </span>
            </div>
        </div>
    );
};

const AgencyDashboard: React.FC<AgencyDashboardProps> = ({
    handleLogout, onOpenClient, onOpenProfile, profile, userEmail, userName,
    abaInicial = 'overview', onTrocarAba
}) => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [empresas, setEmpresas] = useState<EmpresaData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState('');
    const [activeTab, setActiveTab] = useState<Aba>(abaInicial as Aba);
    const [isNavOpen, setIsNavOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [pendingEmpresaChanges, setPendingEmpresaChanges] = useState<Record<string, string | null>>({});

    // FICHA DO CLIENTE. `null` fechado, `'novo'` criando, ou a empresa editada.
    //
    // Um caminho de criacao so, com duas portas: o botao "Novo cliente" e a
    // opcao "+ Novo cliente" no select de vinculo. Dois formularios diferentes
    // para a mesma coisa e a redundancia que confunde - e um deles sempre fica
    // esquecido quando um campo novo aparece.
    const [fichaAberta, setFichaAberta] = useState<'novo' | Empresa | null>(null);
    /** Usuario a vincular assim que o cliente for criado, se veio do select. */
    const [vincularApos, setVincularApos] = useState<string | null>(null);
    /**
     * Pessoa com a FICHA aberta - contato, acesso e financeiro numa tela so.
     *
     * Antes existiam dois modais para a mesma pessoa (financeiro) e um modo de
     * edicao embutido no card (cargo). Um lugar so: o card abre a ficha.
     */
    const [fichaPessoa, setFichaPessoa] = useState<UserData | null>(null);

    // Quem esta olhando: admin ou colaborador.
    //
    // Nao vem de estado nem do banco - e derivado do e-mail da sessao contra
    // ADMIN_EMAILS, a mesma lista que firestore.rules usa. Se um colaborador
    // forcar o botao pelo console, a regra recusa a escrita: a interface aqui
    // e conveniencia, nao a trava.
    const souAdmin = isAdmin(auth.currentUser?.email);

    // Pendencia por empresa: quais clientes pediram ajuste e estao esperando.
    // Uma assinatura por empresa - aceitavel no volume de um portal de agencia,
    // e o unico jeito de saber sem manter contadores denormalizados.
    const [pendingByEmpresa, setPendingByEmpresa] = useState<Record<string, PendingCounts>>({});

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const usersSnapshot = await db.collection('usuarios').get();
            setUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserData)));
            const empresasSnapshot = await db.collection('empresas').get();
            setEmpresas(empresasSnapshot.docs.map(doc => parseEmpresa(doc.id, doc.data())));
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        if (empresas.length === 0) return;
        const unsubscribes = empresas.map(empresa =>
            subscribePendingCounts(empresa.id, counts =>
                setPendingByEmpresa(prev => ({ ...prev, [empresa.id]: counts }))
            )
        );
        return () => unsubscribes.forEach(fn => fn());
    }, [empresas]);

    /**
     * Ajustes pedidos, somados. Alimenta o badge da aba Clientes.
     *
     * Os outros agregados que existiam aqui foram para AgencyOverview, que e quem
     * os desenha: manter a soma nos dois lugares e duas contas para o mesmo
     * numero, e a que ninguem le fica sem manutencao.
     */
    const totalAjustes = empresas.reduce(
        (sum, e) => sum + (pendingByEmpresa[e.id]?.aguardandoAgencia || 0), 0
    );

    const showNotification = (msg: string) => {
        setNotification(msg);
        setTimeout(() => setNotification(''), 4000);
    };

    const handleDeleteUser = async (userId: string) => {
        // Guarda de nivel repetida aqui, e nao so no botao: a interface esconde,
        // mas quem chamar pelo console recebe uma recusa legivel em vez do erro
        // cru de permissao do Firestore. A trava de verdade esta nas regras.
        if (!souAdmin) return showNotification('Apenas administradores podem fazer isso.');
        if (!window.confirm("ATENÇÃO: Deseja remover este usuário?")) return;
        try {
            // O ID token identifica quem esta pedindo a exclusao. A funcao
            // deleteUser precisa verifica-lo com admin.auth().verifyIdToken()
            // e conferir se o chamador e mesmo da agencia - sem isso o
            // endpoint continua aberto a qualquer um.
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) {
                showNotification('Sessão expirada. Faça login novamente.');
                return;
            }

            await db.collection('usuarios').doc(userId).delete();
            setUsers(prev => prev.filter(u => u.id !== userId));

            const response = await fetch(DELETE_USER_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ uid: userId })
            });

            if (!response.ok) {
                // O documento ja saiu do Firestore, mas a conta continua no
                // Auth: o usuario ainda consegue logar. Precisa ser visivel.
                showNotification('Documento removido, mas a conta de login permaneceu. Verifique no Firebase.');
                return;
            }

            showNotification('Usuário removido.');
        } catch (error) {
            showNotification('Erro ao excluir.');
        }
    };

    const handleDeleteEmpresa = async (empresaId: string) => {
        // Guarda de nivel repetida aqui, e nao so no botao: a interface esconde,
        // mas quem chamar pelo console recebe uma recusa legivel em vez do erro
        // cru de permissao do Firestore. A trava de verdade esta nas regras.
        if (!souAdmin) return showNotification('Apenas administradores podem fazer isso.');
        const linkedUsers = users.filter(u => u.empresaId === empresaId);
        
        const msg = linkedUsers.length > 0 
            ? `Esta empresa tem ${linkedUsers.length} usuário(s) vinculado(s). Deseja excluí-la e desvincular os usuários automaticamente?` 
            : "Excluir empresa definitivamente?";

        if (!window.confirm(msg)) return;

        try {
            await db.collection('empresas').doc(empresaId).delete();
            
            if (linkedUsers.length > 0) {
                const batch = db.batch();
                linkedUsers.forEach(u => {
                    batch.update(db.collection('usuarios').doc(u.id), { empresaId: null });
                });
                await batch.commit();
            }

            setEmpresas(prev => prev.filter(e => e.id !== empresaId));
            setUsers(prev => prev.map(u => u.empresaId === empresaId ? { ...u, empresaId: null } : u));
            showNotification('Empresa excluída com sucesso.');
        } catch (error) {
            showNotification('Erro ao excluir.');
        }
    };

    const descartarRascunho = (userId: string) => {
        setPendingEmpresaChanges(prev => { const n = { ...prev }; delete n[userId]; return n; });
    };

    /**
     * VINCULA a conta a um cliente.
     *
     * Toda alteracao acontece dentro da FICHA (PersonDetailModal), nunca no card
     * da lista: os selects abertos no card nao diziam se o que estava na tela era
     * o valor gravado ou um rascunho, e cada campo tinha o proprio Salvar.
     *
     * Chamava-se `saveUserEdit` e carregava rascunho de role e de cargo tambem.
     * Os dois eram CODIGO MORTO: nada na interface preenchia
     * `pendingRoleChanges` nem `pendingCargoChanges` - cargo passou a ser gravado
     * por `salvarCargoDaFicha` e papel nao tinha tela nenhuma. Um "salva role" que
     * nunca recebia role dava a impressao, lendo o codigo, de que promover
     * colaborador estava resolvido.
     */
    const salvarVinculo = async (userId: string) => {
        // Guarda de nivel repetida aqui, e nao so no botao: a interface esconde,
        // mas quem chamar pelo console recebe uma recusa legivel em vez do erro
        // cru de permissao do Firestore. A trava de verdade esta nas regras.
        if (!souAdmin) {
            showNotification('Apenas administradores podem fazer isso.');
            return;
        }
        const novaEmpresa = pendingEmpresaChanges[userId];
        if (novaEmpresa === undefined) return;

        const patch: Record<string, unknown> = { empresaId: novaEmpresa };

        try {
            await db.collection('usuarios').doc(userId).update(patch);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...patch } as UserData : u));
            // A ficha aberta le de `fichaPessoa`, uma copia: sem isto o cargo
            // salvo continuaria mostrando o valor antigo ate fechar e reabrir.
            setFichaPessoa(prev => prev && prev.id === userId ? { ...prev, ...patch } as UserData : prev);
            descartarRascunho(userId);
            showNotification('Alterações salvas.');
        } catch (e) {
            console.error(e);
            // O rascunho continua na tela para o usuario tentar de novo em vez
            // de perder o que escolheu.
            showNotification('Não foi possível salvar. Tente novamente.');
        }
    };

    /**
     * Grava o cargo pela ficha.
     *
     * Nao reaproveita saveUserEdit de proposito: aquele le o rascunho do estado,
     * e o estado ainda nao chegou no mesmo tick do clique. A ficha ja tem o
     * valor em maos, entao escreve direto. Propaga o erro para a ficha manter o
     * campo aberto em vez de fingir que salvou.
     */
    const salvarCargoDaFicha = async (userId: string, cargo: string) => {
        try {
            await db.collection('usuarios').doc(userId).update({ cargo: cargo.trim() || null });
            const patch = { cargo: cargo.trim() || null };
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...patch } : u));
            setFichaPessoa(prev => prev && prev.id === userId ? { ...prev, ...patch } : prev);
            descartarRascunho(userId);
            showNotification('Cargo atualizado.');
        } catch (e) {
            console.error(e);
            showNotification('Não foi possível salvar o cargo.');
            throw e;
        }
    };

    const handleEmpresaSelection = (userId: string, val: string) => {
        if (val === 'create_new') {
            // Mesma ficha completa do botao "Novo cliente". Antes esta opcao
            // abria um input de texto solto que criava o cliente com nome e
            // mais nada.
            setVincularApos(userId);
            setFichaPessoa(null); // Duas camadas no mesmo z-index se sobrepõem.
            setFichaAberta('novo');
            setPendingEmpresaChanges(prev => { const n = { ...prev }; delete n[userId]; return n; });
            return;
        }
        setPendingEmpresaChanges(prev => ({ ...prev, [userId]: val === 'null' ? null : val }));
    };

    /**
     * Cliente criado ou editado na ficha.
     *
     * Recarrega a lista em vez de inserir na mao: a ficha grava campos que este
     * componente nao conhece, e montar o objeto aqui deixaria a tela mostrando
     * uma versao incompleta ate o proximo refresh.
     */
    const handleFichaSalva = async (empresaId: string, nome: string) => {
        setFichaAberta(null);
        const paraVincular = vincularApos;
        setVincularApos(null);

        if (paraVincular) {
            try {
                await db.collection('usuarios').doc(paraVincular).update({ empresaId });
                setUsers(prev => prev.map(u => u.id === paraVincular ? { ...u, empresaId } : u));
                descartarRascunho(paraVincular);
                showNotification(`Cliente "${nome}" criado e vinculado.`);
            } catch (e) {
                console.error(e);
                showNotification(`Cliente "${nome}" criado, mas o vínculo falhou. Vincule na aba Equipe.`);
            }
        } else {
            showNotification(`Cliente "${nome}" salvo.`);
        }
        fetchData();
    };

    /**
     * PROMOVE a conta a colaborador da agencia, ou tira da equipe.
     *
     * ESTE ERA O BURACO DO CADASTRO DE PESSOAS. Conta nasce sempre como
     * `role: 'cliente'` sem vinculo - a regra de criacao forca isso, de proposito,
     * para ninguem nascer com acesso a agencia. Mas nao havia NENHUMA tela que
     * mudasse o papel depois: a unica forma de ter um colaborador era editar o
     * campo `role` na mao, no console do Firebase. A tela de Equipe ainda dizia "a
     * equipe aparece aqui depois de criar conta no portal", o que nunca aconteceria.
     *
     * O papel e gravado direto, sem rascunho: nao e um campo que se ajusta junto de
     * outros, e uma decisao de acesso - vira uma escrita com confirmacao explicita.
     *
     * `empresaId: null` junto: colaborador trabalha em TODOS os clientes, e um
     * vinculo esquecido faria a pessoa aparecer como contato daquele cliente ao
     * mesmo tempo que da equipe. No caminho de volta, o mesmo - a conta volta para
     * a fila "aguardando vinculo", que e onde uma conta sem cliente pertence.
     *
     * NAO mexe em administrador: esse nivel vem da lista de e-mails em
     * constants.ts / firestore.rules, que nenhum SDK escreve. Ver isAdminEmail().
     */
    const handleAlterarPapel = async (pessoa: UserData, paraEquipe: boolean) => {
        if (!souAdmin) {
            showNotification('Apenas administradores podem fazer isso.');
            return;
        }
        const nome = getDisplayName(pessoa);
        const aviso = paraEquipe
            ? `Tornar ${nome} colaborador da agência?\n\nEle passa a ver e editar o conteúdo de TODOS os clientes.`
            : `Tirar ${nome} da equipe?\n\nEle perde o acesso a todos os clientes e volta para a fila "aguardando vínculo".`;
        if (!window.confirm(aviso)) return;

        const patch = { role: paraEquipe ? 'agencia' : 'cliente', empresaId: null };
        try {
            await db.collection('usuarios').doc(pessoa.id).update(patch);
            setUsers(prev => prev.map(u => u.id === pessoa.id ? { ...u, ...patch } as UserData : u));
            setFichaPessoa(null);
            showNotification(paraEquipe
                ? `${nome} agora é colaborador da agência.`
                : `${nome} saiu da equipe.`);
        } catch (e) {
            console.error(e);
            showNotification('Não foi possível alterar a permissão. Tente novamente.');
        }
    };

    const handlePasswordReset = async (email: string) => {
        try {
            await auth.sendPasswordResetEmail(email);
            showNotification(`Email enviado para ${email}`);
        } catch (e) { showNotification('Erro ao enviar email'); }
    };

    // Busca por nome OU e-mail: quem digita "maria" espera achar a Maria, e nem
    // sempre o e-mail dela contem o nome.
    const filteredUsers = users.filter(u => {
        const term = searchTerm.toLowerCase();
        if (!term) return true;
        return u.email.toLowerCase().includes(term)
            || getDisplayName(u).toLowerCase().includes(term);
    });
    // Busca por nome, @ ou segmento: quem digita "fisio" espera achar a
    // clinica pelo nicho, nao so pelo nome fantasia.
    const filteredEmpresas = empresas.filter(e => {
        const termo = searchTerm.toLowerCase();
        if (!termo) return true;
        return [e.nome, e.handle, e.segmento].some(v => (v || '').toLowerCase().includes(termo));
    });

    // Cliente sem empresa nao consegue usar o portal - so ve o aviso de conta
    // nao vinculada. E a pendencia mais acionavel do painel, por isso vira
    // destaque na Visao Geral em vez de ficar escondida na tabela.
    const unlinkedUsers = users.filter(u => u.role !== 'agencia' && !u.empresaId);
    // Filtrada pela busca, para a fila respeitar o filtro digitado.
    const semVinculo = filteredUsers.filter(u => u.role !== 'agencia' && !u.empresaId);

    // Separar por papel elimina a coluna "Vínculo" com "Global" repetido em toda
    // linha de agencia, que era ruido puro.
    const equipe = users.filter(u => u.role === 'agencia');
    const equipeFiltrada = filteredUsers.filter(u => u.role === 'agencia');

    // Cabecalho por secao. Fica junto porque a saudacao e o subtitulo mudam com
    // a navegacao e antes nao existiam - a tela abria com "Painel
    // Administrativo" fixo, que nao dizia onde voce estava.
    const HEADERS: Record<typeof activeTab, { title: string; subtitle: string }> = {
        overview: {
            title: greeting(userName),
            subtitle: 'Resumo do que exige atenção hoje em todos os clientes.'
        },
        clients: {
            title: 'Clientes',
            subtitle: 'Clique em um cliente para abrir o espaço de trabalho dele.'
        },
        team: {
            title: 'Equipe',
            subtitle: 'Quem trabalha na agência. O acesso de cada cliente fica dentro do próprio cliente.'
        },
        settings: {
            title: 'Configurações',
            subtitle: 'O que vale para a agência inteira: cargos, prazos e padrões do sistema.'
        }
    };

    const navGroups: NavGroup[] = [
        {
            title: 'Geral',
            items: [
                { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
                // NAO existe mais "Calendário Editorial" aqui.
                //
                // Aquela tela era o MESMO CalendarView do cliente com um seletor
                // de cliente em cima - e ainda montava uma segunda previa do feed,
                // que o proprio CalendarView ja tem dentro. Dois caminhos para a
                // mesma tela, um deles com o titulo repetido no menu do cliente.
                // O seletor tambem era redundante: esta aba Clientes JA e o
                // seletor, e com mais informacao (pendencia, atraso, status).
                { id: 'clients', label: 'Clientes', icon: Briefcase, badge: totalAjustes, badgeTone: 'amber' }
            ]
        },
        {
            title: 'Gestão',
            items: [
                { id: 'team', label: 'Equipe', icon: Users, badge: unlinkedUsers.length, badgeTone: 'amber' as const },
                // Visivel para a equipe inteira, editavel so por admin. Esconder
                // do colaborador faria ele procurar onde muda o cargo em vez de
                // ver, escrito, que a decisao nao e dele.
                { id: 'settings', label: 'Configurações', icon: SlidersHorizontal }
            ]
        }
    ];

    const perfilNome = getDisplayName({ nome: profile?.nome, sobrenome: profile?.sobrenome, email: auth.currentUser?.email });

    return (
        <div className="relative min-h-screen md:flex bg-[#111111] text-zinc-100 font-sans selection:bg-[#FABE01] selection:text-black">
            <AppSidebar
                groups={navGroups}
                activeId={activeTab}
                // O termo de busca e compartilhado pelas secoes; sem limpar na
                // troca, o usuario mudava de secao e via uma lista vazia por
                // causa de um filtro digitado em outro contexto.
                onSelect={(id) => {
                    setActiveTab(id as Aba);
                    // Avisa o App: entrar num cliente desmonta esta tela, e quem
                    // lembra da aba para o "voltar" e ele.
                    onTrocarAba?.(id);
                    setSearchTerm('');
                    setIsNavOpen(false);
                }}
                isOpen={isNavOpen}
                onClose={() => setIsNavOpen(false)}
                footer={
                    <div className="space-y-1">
                        <button
                            onClick={onOpenProfile}
                            disabled={!onOpenProfile}
                            title={auth.currentUser?.email || undefined}
                            className="flex items-center gap-3 w-full p-2 rounded-control hover:bg-white/5 transition-colors text-left disabled:hover:bg-transparent group"
                        >
                            {isSafeImageSrc(profile?.fotoUrl) ? (
                                <img src={profile!.fotoUrl!} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                            ) : (
                                <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-tr from-[#FABE01] to-[#DE7928] flex items-center justify-center text-black font-bold text-xs">
                                    {getInitials({ nome: profile?.nome, sobrenome: profile?.sobrenome, email: auth.currentUser?.email })}
                                </div>
                            )}
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium text-white truncate group-hover:text-[#FABE01] transition-colors">
                                    {perfilNome}
                                </span>
                                <span className="block text-[11px] text-zinc-500 truncate">Agência · ver meu perfil</span>
                            </span>
                        </button>
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

            <main className="flex-1 min-w-0 md:h-screen md:overflow-y-auto">
                <MobileTopBar title={HEADERS[activeTab].title} onOpenMenu={() => setIsNavOpen(true)} />

                <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto overflow-x-hidden">
                    {notification && <div className="fixed top-20 right-4 z-50 bg-[#FABE01] text-black px-4 py-3 rounded-control shadow-lg font-bold text-sm flex items-center gap-2"><div className="w-2 h-2 bg-black rounded-full animate-pulse" />{notification}</div>}

                    <PageHeader title={HEADERS[activeTab].title} subtitle={HEADERS[activeTab].subtitle} />

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4"><Loader2 className="w-10 h-10 text-[#FABE01] animate-spin" /></div>
                ) : (
                    <>
                        {activeTab === 'overview' && (
                            <AgencyOverview
                                empresas={empresas}
                                users={users as UserProfile[]}
                                pendingByEmpresa={pendingByEmpresa}
                                souAdmin={souAdmin}
                                semVinculo={unlinkedUsers.length}
                                onOpenClient={onOpenClient}
                                onIrParaClientes={() => { setActiveTab('clients'); onTrocarAba?.('clients'); setSearchTerm(''); }}
                                onIrParaEquipe={() => { setActiveTab('team'); onTrocarAba?.('team'); setSearchTerm(''); }}
                            />
                        )}

                        {activeTab === 'clients' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="relative w-full sm:max-w-md">
                                        <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-500 pointer-events-none" />
                                        <input
                                            type="text"
                                            placeholder="Buscar por nome, @ ou segmento..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-[#1A1A1A] border border-white/10 rounded-control py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] outline-none transition-all"
                                        />
                                    </div>
                                    {souAdmin && (
                                        <button
                                            onClick={() => { setVincularApos(null); setFichaAberta('novo'); }}
                                            className="sm:ml-auto shrink-0 inline-flex items-center justify-center gap-2 bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-semibold text-sm px-5 py-2.5 rounded-full transition-colors"
                                        >
                                            <Plus className="w-4 h-4" /> Novo cliente
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {/* Distinguir "nenhuma empresa cadastrada" de "a busca nao
                                        achou nada" evita o usuario concluir que perdeu dados. */}
                                    {filteredEmpresas.length === 0 && (
                                        empresas.length === 0 ? (
                                            <EmptyState
                                                icon={Building2}
                                                title="Nenhum cliente cadastrado"
                                                description="Cadastre o cliente com contato, nicho e contrato. Depois vincule os usuários dele na aba Equipe & Permissões."
                                                action={souAdmin ? { label: 'Cadastrar cliente', onClick: () => { setVincularApos(null); setFichaAberta('novo'); } } : undefined}
                                            />
                                        ) : (
                                            <EmptyState
                                                icon={Search}
                                                title="Nenhum resultado"
                                                description={`Nenhuma empresa corresponde a “${searchTerm}”.`}
                                                action={{ label: 'Limpar busca', onClick: () => setSearchTerm('') }}
                                            />
                                        )
                                    )}
                                    {filteredEmpresas.map(empresa => (
                                        <ClientCard
                                            key={empresa.id}
                                            empresa={empresa}
                                            stats={pendingByEmpresa[empresa.id]}
                                            usuarios={users.filter(u => u.empresaId === empresa.id).length}
                                            onOpen={(section) => onOpenClient(empresa.id, empresa.nome, section)}
                                            onEdit={souAdmin ? () => { setVincularApos(null); setFichaAberta(empresa); } : undefined}
                                            onDelete={souAdmin ? () => handleDeleteEmpresa(empresa.id) : undefined}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <SettingsView
                                souAdmin={souAdmin}
                                autorEmail={auth.currentUser?.email}
                                cargosEmUso={users.map(u => u.cargo || '').filter(Boolean)}
                            />
                        )}

                        {activeTab === 'team' && (
                            <div className="space-y-8 animate-in fade-in">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="relative w-full sm:max-w-md">
                                        <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-500 pointer-events-none" />
                                        <input
                                            type="text"
                                            placeholder="Buscar por nome, e-mail ou cargo..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-[#1A1A1A] border border-white/10 rounded-control py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-zinc-600 focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] outline-none transition-all"
                                        />
                                        {searchTerm && (
                                            <button onClick={() => setSearchTerm('')} aria-label="Limpar busca" className="absolute right-2.5 top-3 text-zinc-500 hover:text-white">
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-zinc-500 sm:ml-auto shrink-0">
                                        <span className="text-white font-semibold">{equipe.length}</span> na equipe
                                        {semVinculo.length > 0 && (
                                            <> · <span className="text-amber-400 font-semibold">{semVinculo.length}</span> aguardando vínculo</>
                                        )}
                                    </p>
                                </div>

                                {/* CONTAS AGUARDANDO VINCULO.
                                    Vem primeiro porque e a unica coisa nesta tela que
                                    exige acao hoje: enquanto nao tiverem empresa, essas
                                    contas entram no portal e veem so um aviso.

                                    Elas ficam AQUI, e nao na aba Clientes, porque ainda
                                    nao sao cliente de ninguem - nao ha cliente sob o qual
                                    listar. Depois de vinculadas, somem daqui e passam a
                                    viver dentro do cliente (aba Acessos do cliente). */}
                                {semVinculo.length > 0 && (
                                    <section>
                                        <div className="flex items-center gap-2.5 mb-1">
                                            <h3 className="text-lg font-bold text-white tracking-tight">Aguardando vínculo</h3>
                                            <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">
                                                {semVinculo.length}
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-500 mb-4">
                                            Criaram conta e ainda não têm função. Abra a ficha para tornar colaborador da agência
                                        ou vincular a um cliente — sem isso, entram e veem apenas um aviso.
                                        </p>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                                            {semVinculo.map(user => (
                                                <PersonCard
                                                    key={user.id}
                                                    pessoa={user}
                                                    selo={SELO_SEM_EMPRESA}
                                                    borda="atencao"
                                                    subtitulo="Conta sem cliente"
                                                    onAbrir={() => setFichaPessoa(user)}
                                                />
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* EQUIPE DA AGENCIA.
                                    Cliente NAO aparece nesta tela: o acesso de um cliente
                                    pertence ao cliente, e vive dentro dele (aba Acessos).
                                    Listar os dois aqui repetia o nome da empresa em dois
                                    campos e mostrava "Permissão: Cliente" embaixo de um
                                    titulo que ja dizia Clientes. */}
                                <section>
                                    <div className="flex items-center gap-2.5 mb-1">
                                        <h3 className="text-lg font-bold text-white tracking-tight">Equipe da agência</h3>
                                        <span className="text-[11px] font-semibold text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full">
                                            {equipeFiltrada.length}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-500 mb-4">
                                        Acesso a todos os clientes. Administrador é definido pela lista de e-mails do
                                        sistema, não por esta tela — por isso o nível não aparece como campo editável.
                                    </p>

                                    {equipeFiltrada.length === 0 ? (
                                        <EmptyState
                                            icon={Users}
                                            title={searchTerm ? 'Nenhum resultado' : 'Nenhuma pessoa na equipe'}
                                            description={searchTerm
                                                ? `Nada corresponde a “${searchTerm}”.`
                                                : 'A pessoa cria conta no portal, aparece em “Aguardando vínculo” e você a torna colaboradora pela ficha dela.'}
                                            action={searchTerm ? { label: 'Limpar busca', onClick: () => setSearchTerm('') } : undefined}
                                        />
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                                            {equipeFiltrada.map(user => {
                                                const nivel = permissionLevel(user);
                                                const isMe = user.id === auth.currentUser?.uid;
                                                return (
                                                    <PersonCard
                                                        key={user.id}
                                                        pessoa={user}
                                                        ehVoce={isMe}
                                                        selo={nivel === 'admin' ? SELO_ADMIN : SELO_COLABORADOR}
                                                        subtitulo={user.cargo || 'Cargo não definido'}
                                                        campos={[{ rotulo: 'Permissão', valor: PERMISSION_LABEL[nivel] }]}
                                                        onAbrir={() => setFichaPessoa(user)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}

                    </>
                )}
                </div>
            </main>

            {/* FICHA DA PESSOA. Uma tela para colaborador e para conta sem
                vinculo: o que muda e o que a ficha oferece fazer, nao o layout.
                Cliente vinculado nao abre por aqui - ele vive dentro do cliente,
                na aba Acessos. */}
            {fichaPessoa && (() => {
                const pessoa = fichaPessoa;
                const isMe = pessoa.id === auth.currentUser?.uid;
                const daEquipe = pessoa.role === 'agencia';
                const acoes: PersonDetailAcao[] = [
                    { label: 'Enviar redefinição de senha', onClick: () => handlePasswordReset(pessoa.email) }
                ];
                if (souAdmin && !isMe) {
                    acoes.push({
                        label: daEquipe ? 'Remover da equipe' : 'Remover conta',
                        destrutiva: true,
                        onClick: async () => {
                            await handleDeleteUser(pessoa.id);
                            setFichaPessoa(null);
                        }
                    });
                }
                return (
                    <PersonDetailModal
                        pessoa={pessoa}
                        selo={daEquipe
                            ? (permissionLevel(pessoa) === 'admin' ? SELO_ADMIN : SELO_COLABORADOR)
                            : SELO_SEM_EMPRESA}
                        empresaNome={empresas.find(e => e.id === pessoa.empresaId)?.nome}
                        // Equipe da agencia trabalha em TODOS os clientes, entao a
                        // atividade dela e procurada em todos. Contato de cliente
                        // so tem historico no cliente dele.
                        empresasParaAtividade={daEquipe
                            ? empresas.map(e => ({ id: e.id, nome: e.nome }))
                            : empresas.filter(e => e.id === pessoa.empresaId).map(e => ({ id: e.id, nome: e.nome }))}
                        ehVoce={isMe}
                        souAdmin={souAdmin}
                        autorEmail={auth.currentUser?.email}
                        onSalvarCargo={souAdmin ? (cargo) => salvarCargoDaFicha(pessoa.id, cargo) : undefined}
                        acoes={acoes}
                        onClose={() => setFichaPessoa(null)}
                    >
                        {/* O QUE ESTA CONTA E. Duas saidas para a mesma conta sem
                            vinculo - virar colaborador da agencia ou virar contato
                            de um cliente -, lado a lado, porque a duvida de quem
                            abre a ficha e exatamente essa. Antes so a segunda
                            existia: quem criava conta para trabalhar na agencia
                            ficava parado na fila para sempre. */}
                        {souAdmin && !isMe && (
                            <Bloco titulo="Permissão" icone={Shield}>
                                <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                                    {daEquipe
                                        ? 'Colaborador da agência: vê e edita o conteúdo de todos os clientes.'
                                        : pessoa.empresaId
                                            ? 'Contato do cliente: vê apenas o portal do próprio cliente.'
                                            : 'Conta sem função. Entra no portal e vê apenas um aviso.'}
                                </p>
                                <button
                                    onClick={() => handleAlterarPapel(pessoa, !daEquipe)}
                                    className={`w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-control transition-colors ${
                                        daEquipe
                                            ? 'text-zinc-300 bg-white/5 hover:bg-white/10'
                                            : 'bg-[#FABE01] text-black hover:bg-[#FABE01]/90'
                                    }`}
                                >
                                    <UserCog className="w-3.5 h-3.5" />
                                    {daEquipe ? 'Tirar da equipe' : 'Tornar colaborador da agência'}
                                </button>
                                {/* Nivel de admin nao e editavel aqui, e a ficha diz
                                    por que - senao a ausencia do campo parece falta. */}
                                <p className="text-[10px] text-zinc-600 mt-2.5 leading-relaxed">
                                    Administrador não se define por esta tela: vem da lista de e-mails do sistema,
                                    que nenhum acesso do app consegue escrever.
                                </p>
                            </Bloco>
                        )}

                        {/* VINCULO. So aparece para conta sem cliente, que e o
                            unico caso em que ele esta faltando - depois de
                            vinculada, mudar de empresa nao e rotina. */}
                        {!daEquipe && !pessoa.empresaId && (
                            <Bloco titulo="Vínculo com cliente" icone={Building2}>
                                {souAdmin ? (
                                    <>
                                        <p className="text-xs text-amber-400/90 mb-3 leading-relaxed">
                                            Se esta pessoa é do cliente e não da agência, vincule aqui para liberar o portal dela.
                                        </p>
                                        <div className="flex gap-1.5">
                                            <select
                                                value={pendingEmpresaChanges[pessoa.id] ?? 'null'}
                                                onChange={(e) => handleEmpresaSelection(pessoa.id, e.target.value)}
                                                className="min-w-0 flex-1 bg-[#0D0D0D] border border-zinc-700 text-zinc-200 text-sm rounded-control px-2.5 py-2 outline-none focus:border-[#FABE01]"
                                            >
                                                <option value="null">— escolha o cliente —</option>
                                                {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                                                <option value="create_new">+ Novo cliente</option>
                                            </select>
                                            {pendingEmpresaChanges[pessoa.id] && (
                                                <button
                                                    onClick={async () => { await salvarVinculo(pessoa.id); setFichaPessoa(null); }}
                                                    className="shrink-0 px-3.5 py-2 text-xs font-semibold bg-[#FABE01] text-black rounded-control"
                                                >
                                                    Vincular
                                                </button>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-xs text-zinc-500 leading-relaxed">
                                        Só administradores vinculam contas a um cliente.
                                    </p>
                                )}
                            </Bloco>
                        )}
                    </PersonDetailModal>
                );
            })()}

            {fichaAberta && (
                <ClientFormModal
                    empresa={fichaAberta === 'novo' ? null : fichaAberta}
                    isAdmin={souAdmin}
                    autorEmail={auth.currentUser?.email}
                    onClose={() => { setFichaAberta(null); setVincularApos(null); }}
                    onSaved={handleFichaSalva}
                />
            )}
        </div>
    );
};
export default AgencyDashboard;