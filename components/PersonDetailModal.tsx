import React, { useState, useEffect } from 'react';
import { UserProfile, DadosFinanceiros } from '../types';
import { getDisplayName, getInitials, isSafeImageSrc } from '../utils/avatar';
import { permissionLevel, PERMISSION_LABEL, PERMISSION_HINT } from '../utils/permissions';
import {
    lerFinanceiroUsuario, salvarFinanceiroUsuario, formatarMoeda,
    centavosParaTexto, textoParaCentavos
} from '../utils/empresas';
import { lerAtividadeDaPessoa, AtividadeDaPessoa, descreverHistorico } from '../utils/historico';
import { subscribeCargos, mesmoCargo } from '../utils/cargos';
import { ICONES_HISTORICO } from './PostTimeline';
import { toDateInputValue, fromDateInputValue } from '../utils/date';
import {
    X, Mail, Phone, Building2, ShieldCheck, Briefcase, Lock, Loader2, Save,
    AlertTriangle, Pencil, Check, Wallet, CalendarClock, FileText, History,
    Activity, Layers, BadgeCheck
} from 'lucide-react';

export interface PersonDetailAcao {
    label: string;
    onClick: () => void;
    destrutiva?: boolean;
}

interface PersonDetailModalProps {
    pessoa: UserProfile;
    /** Selo de identidade, o mesmo do cartao (Admin, Colaborador, Ativo...). */
    selo: { texto: string; cor: string };
    /** Nome do cliente ao qual a pessoa pertence. Equipe da agencia nao tem. */
    empresaNome?: string | null;
    /**
     * Clientes onde procurar o que esta pessoa fez. O historico e por cliente,
     * entao sem esta lista a ficha nao tem onde olhar. Vazio = sem atividade.
     */
    empresasParaAtividade?: { id: string; nome: string }[];
    ehVoce?: boolean;
    souAdmin: boolean;
    autorEmail?: string | null;
    /** Grava o cargo. Ausente = cargo nao editavel nesta tela. */
    onSalvarCargo?: (cargo: string) => Promise<void>;
    acoes?: PersonDetailAcao[];
    /** Bloco extra do contexto - ex: vincular a um cliente. */
    children?: React.ReactNode;
    onClose: () => void;
}

const inputStyle = "w-full bg-black/40 border border-white/10 rounded-control px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all placeholder:text-zinc-500";
const labelStyle = "block text-[11px] font-semibold text-zinc-400 mb-1.5";

/** Cartao interno da ficha. Vidro dentro do vidro, um degrau mais escuro. */
const Bloco: React.FC<{
    titulo: string;
    icone: React.ElementType;
    acao?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}> = ({ titulo, icone: Icone, acao, children, className = '' }) => (
    <section className={`bg-black/25 border border-white/10 rounded-card p-4 sm:p-5 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
            <Icone className="w-4 h-4 text-[#FABE01]" />
            <h3 className="text-sm font-bold text-white tracking-tight">{titulo}</h3>
            {acao && <div className="ml-auto">{acao}</div>}
        </div>
        {children}
    </section>
);

/**
 * Par rotulo/valor do cabecalho - rotulo pequeno acima, valor grande abaixo.
 * O mesmo desenho da referencia: a linha de identidade se le de uma vez, sem
 * icone competindo com o texto.
 */
const Dado: React.FC<{ rotulo: string; valor?: string | null; vazio?: string }> = ({
    rotulo, valor, vazio = 'não informado'
}) => (
    <div className="min-w-0">
        <p className="text-[11px] text-zinc-400 mb-1">{rotulo}</p>
        <p
            className={`text-[15px] font-semibold truncate ${valor ? 'text-white' : 'text-zinc-500 font-normal italic'}`}
            title={valor || undefined}
        >
            {valor || vazio}
        </p>
    </div>
);

/** Tile de numero com icone em circulo, como na referencia. */
const Tile: React.FC<{
    icone: React.ElementType;
    valor: string;
    rotulo: string;
    destaque?: boolean;
}> = ({ icone: Icone, valor, rotulo, destaque }) => (
    <div className="flex items-center gap-3 bg-black/25 border border-white/10 rounded-card px-4 py-3.5 min-w-0">
        <span className={`w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center ${
            destaque ? 'bg-[#FABE01]/15 text-[#FABE01]' : 'bg-white/[0.07] text-zinc-300'
        }`}>
            <Icone className="w-[18px] h-[18px]" />
        </span>
        {/* Nada de truncate aqui: em dois tiles por linha no celular, "Ações
            registradas" virava "Ações registrad..." e "Administrador" virava
            "Administ...". Numero e rotulo QUEBRAM em duas linhas - o tile cresce,
            que e melhor que esconder a palavra que da sentido ao numero. */}
        <div className="min-w-0">
            <p className={`font-bold leading-tight ${destaque ? 'text-[#FABE01] text-sm sm:text-base' : 'text-white text-lg'}`}>
                {valor}
            </p>
            <p className="text-[11px] text-zinc-400 leading-tight mt-0.5">{rotulo}</p>
        </div>
    </div>
);

/** Linha de dado dentro de um bloco. */
const Linha: React.FC<{
    rotulo: string;
    valor: string;
    icone?: React.ElementType;
    /** Marca que o valor e um padrao, nao algo que alguem cadastrou. */
    padrao?: boolean;
    dica?: string;
}> = ({ rotulo, valor, icone: Icone, padrao, dica }) => (
    <div className="py-2.5 min-w-0">
        <p className="text-[11px] text-zinc-400 mb-1">{rotulo}</p>
        <div className="flex items-center gap-2 min-w-0">
            {Icone && <Icone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
            <p className={`text-sm truncate ${padrao ? 'text-zinc-400' : 'text-white font-medium'}`} title={valor}>
                {valor}
            </p>
            {padrao && (
                <span className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded-full shrink-0">
                    padrão
                </span>
            )}
        </div>
        {dica && <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{dica}</p>}
    </div>
);

const relativo = (data: Date) => {
    const dias = Math.floor((Date.now() - data.getTime()) / 86400000);
    if (dias <= 0) return 'hoje';
    if (dias === 1) return 'ontem';
    if (dias < 30) return `há ${dias} dias`;
    const meses = Math.floor(dias / 30);
    return meses === 1 ? 'há 1 mês' : `há ${meses} meses`;
};

/**
 * FICHA DA PESSOA - identidade, numeros, o que ela fez por ultimo e o
 * financeiro, numa folha de vidro sobre a tela.
 *
 * POR QUE ELA EXISTE: o cartao da lista precisa caber nove vezes na tela, e cada
 * campo que se acrescenta ali encolhe os outros - foi assim que o cartao antigo
 * virou uma parede de rotulos. O cartao e PORTA DE ENTRADA; o resto mora aqui.
 *
 * ISSO SUBSTITUI O MODAL SO-DE-FINANCEIRO. Existiam duas telas para a mesma
 * pessoa, alcancadas por dois itens do mesmo menu - o financeiro nao e um
 * assunto separado da pessoa, e uma secao da ficha dela.
 *
 * O FINANCEIRO SO E LIDO SE QUEM ABRIU FOR ADMIN. Nao e a interface escondendo:
 * mora em usuarios/{uid}/_financeiro/dados, subcolecao propria, e a regra recusa
 * a leitura para os outros. Se este componente tentasse ler sempre, colaborador
 * levaria erro de permissao no console em cada abertura de ficha.
 */
const PersonDetailModal: React.FC<PersonDetailModalProps> = ({
    pessoa, selo, empresaNome, empresasParaAtividade = [], ehVoce, souAdmin, autorEmail,
    onSalvarCargo, acoes = [], children, onClose
}) => {
    const nivel = permissionLevel(pessoa);
    const ehColaborador = nivel !== 'cliente';

    /**
     * O financeiro da ficha e o da PESSOA - quanto a agencia paga a ela.
     *
     * Por isso nao aparece para um contato do cliente: o dinheiro dele nao e um
     * salario, e o contrato da EMPRESA, que vive na ficha do cliente
     * (empresas/{id}/_financeiro). Mostrar os dois seria a mesma informacao em
     * dois lugares, com dois valores que podem divergir - e o segundo seria
     * sempre o desatualizado.
     */
    const mostrarFinanceiro = souAdmin && ehColaborador;

    const [financeiro, setFinanceiro] = useState<DadosFinanceiros | null>(null);
    const [carregandoFin, setCarregandoFin] = useState(mostrarFinanceiro);
    const [editandoFin, setEditandoFin] = useState(false);
    const [rascunhoFin, setRascunhoFin] = useState<DadosFinanceiros>({});
    const [valorTexto, setValorTexto] = useState('');
    const [salvandoFin, setSalvandoFin] = useState(false);
    const [erroFin, setErroFin] = useState('');

    const [editandoCargo, setEditandoCargo] = useState(false);
    const [rascunhoCargo, setRascunhoCargo] = useState(pessoa.cargo || '');
    const [salvandoCargo, setSalvandoCargo] = useState(false);

    /**
     * Cargos disponiveis. Vem das configuracoes, nao de um array no codigo: o
     * admin muda a lista em Gestao > Configuracoes e a ficha acompanha.
     */
    const [cargos, setCargos] = useState<string[]>([]);

    const [atividade, setAtividade] = useState<AtividadeDaPessoa[]>([]);
    const [carregandoAtiv, setCarregandoAtiv] = useState(empresasParaAtividade.length > 0);

    // Esc fecha. Sem isto a unica saida e o X, e numa ficha alta ele fica fora da
    // vista depois de rolar.
    useEffect(() => {
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', esc);
        return () => document.removeEventListener('keydown', esc);
    }, [onClose]);

    // So assina a lista quem pode editar - para quem so le, a lista nao muda
    // nada na tela e seria uma assinatura paga a toa.
    useEffect(() => {
        if (!onSalvarCargo) return;
        return subscribeCargos(setCargos);
    }, [onSalvarCargo]);

    useEffect(() => {
        if (!mostrarFinanceiro) return;
        let vivo = true;
        lerFinanceiroUsuario(pessoa.id)
            .then(lidos => {
                if (!vivo) return;
                setFinanceiro(lidos);
                setRascunhoFin(lidos || {});
                setValorTexto(centavosParaTexto(lidos?.valorMensalCentavos));
            })
            .catch(e => {
                console.error(e);
                if (vivo) setErroFin('Não foi possível carregar o financeiro.');
            })
            .finally(() => { if (vivo) setCarregandoFin(false); });
        return () => { vivo = false; };
    }, [pessoa.id, mostrarFinanceiro]);

    // Atividade: uma leitura por cliente, so na abertura da ficha. Nao e
    // assinatura - o que esta pessoa fez no passado nao muda enquanto a ficha
    // esta aberta, e onSnapshot por cliente sairia caro sem entregar nada.
    useEffect(() => {
        if (empresasParaAtividade.length === 0) return;
        let vivo = true;
        lerAtividadeDaPessoa(empresasParaAtividade, pessoa.email)
            .then(lidas => { if (vivo) setAtividade(lidas); })
            .finally(() => { if (vivo) setCarregandoAtiv(false); });
        return () => { vivo = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pessoa.email]);

    const salvarFin = async () => {
        setSalvandoFin(true);
        setErroFin('');
        try {
            await salvarFinanceiroUsuario(pessoa.id, rascunhoFin, autorEmail);
            // Reflete o autor e a data na tela sem reler o documento: a funcao
            // grava os dois com serverTimestamp, e um segundo get() so para
            // mostrar a linha "ultima alteracao" e leitura paga a mais.
            setFinanceiro({ ...rascunhoFin, atualizadoEm: new Date(), atualizadoPor: autorEmail || null });
            setEditandoFin(false);
        } catch (e) {
            console.error(e);
            setErroFin('Não foi possível salvar. Só administradores escrevem aqui.');
        } finally {
            setSalvandoFin(false);
        }
    };

    const salvarCargo = async () => {
        if (!onSalvarCargo) return;
        setSalvandoCargo(true);
        try {
            await onSalvarCargo(rascunhoCargo.trim());
            setEditandoCargo(false);
        } catch (e) {
            // Quem grava avisa o usuario. Aqui so nao fechamos o campo: fechar
            // depois de uma falha mostraria o valor antigo como se fosse o novo.
            console.error(e);
        } finally {
            setSalvandoCargo(false);
        }
    };

    const temFoto = isSafeImageSrc(pessoa.fotoUrl);
    const nome = getDisplayName(pessoa);

    // NUMEROS derivados da atividade lida. Contagem do que esta na ficha, nao um
    // total do banco - por isso "registradas", e nao "total".
    const publicacoesTocadas = new Set(atividade.map(a => a.eventId)).size;
    const ultima = atividade[0];

    const botaoTexto = "text-[11px] font-semibold text-zinc-300 hover:text-white flex items-center gap-1 transition-colors bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-full";

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md sm:p-4 lg:p-6 animate-in fade-in">
            {/* VIDRO. Fundo semitransparente com desfoque em vez de painel opaco:
                a ficha se le como uma folha SOBRE a lista, e nao como outra tela.
                A borda clara em cima e o que separa o vidro do fundo escuro -
                sem ela a folha desaparece no plano de fundo. */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`Ficha de ${nome}`}
                className="relative w-full sm:max-w-5xl bg-white/[0.09] backdrop-blur-2xl border-t sm:border border-white/20 rounded-t-card sm:rounded-card shadow-[0_24px_80px_rgba(0,0,0,0.55)] flex flex-col max-h-[94dvh] overflow-hidden"
            >
                {/* CABECALHO fixo: barra dourada + titulo a esquerda, cargo e
                    fechar a direita. Nao rola com o conteudo - numa ficha alta,
                    saber de quem e a ficha nao pode depender de rolar de volta. */}
                <header className="shrink-0 flex items-center gap-3 px-5 sm:px-7 py-4 border-b border-white/10 bg-white/[0.03]">
                    <span className="w-1 h-5 rounded-full bg-[#FABE01] shrink-0" />
                    <h2 className="text-lg font-bold text-white tracking-tight truncate">
                        {ehColaborador ? 'Detalhes do colaborador' : 'Detalhes do contato'}
                    </h2>
                    <span className={`hidden sm:inline-flex text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${selo.cor}`}>
                        {selo.texto}
                    </span>
                    <button
                        onClick={onClose}
                        aria-label="Fechar"
                        className="ml-auto p-2 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-7 space-y-4">
                    {/* IDENTIDADE: foto grande a esquerda, nome e os tres dados de
                        contato numa linha - o mesmo arranjo da referencia. */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                        {temFoto ? (
                            <img
                                src={pessoa.fotoUrl!}
                                alt=""
                                className="w-20 h-20 sm:w-28 sm:h-28 shrink-0 rounded-full object-cover ring-2 ring-white/15 mx-auto sm:mx-0"
                            />
                        ) : (
                            <div className="w-20 h-20 sm:w-28 sm:h-28 shrink-0 rounded-full bg-white/[0.07] ring-2 ring-white/15 flex items-center justify-center text-zinc-200 font-bold text-2xl sm:text-3xl mx-auto sm:mx-0">
                                {getInitials(pessoa)}
                            </div>
                        )}

                        <div className="min-w-0 flex-1 text-center sm:text-left">
                            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                                <h3 className="text-2xl sm:text-[28px] font-bold text-white tracking-tight leading-tight truncate">
                                    {nome}
                                </h3>
                                {ehVoce && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#FABE01] shrink-0">você</span>
                                )}
                                <span className={`sm:hidden text-[10px] font-semibold px-2 py-0.5 rounded-full ${selo.cor}`}>
                                    {selo.texto}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-6 mt-3 sm:mt-4 text-left">
                                <Dado
                                    rotulo="Cargo"
                                    valor={pessoa.cargo}
                                    vazio={ehColaborador ? 'Cargo não definido' : 'Contato do cliente'}
                                />
                                <Dado rotulo="Telefone" valor={pessoa.telefone} vazio="Sem telefone" />
                                <Dado rotulo="E-mail" valor={pessoa.email} />
                            </div>
                        </div>
                    </div>

                    {/* NUMEROS. Contagem do que a ficha leu; o quarto tile e o
                        nivel de acesso, que e o "predicado" desta pessoa. */}
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3">
                        <Tile
                            icone={Activity}
                            valor={String(atividade.length)}
                            rotulo={atividade.length === 1 ? 'Ação registrada' : 'Ações registradas'}
                        />
                        <Tile
                            icone={Layers}
                            valor={String(publicacoesTocadas)}
                            rotulo={publicacoesTocadas === 1 ? 'Publicação tocada' : 'Publicações tocadas'}
                        />
                        <Tile
                            icone={History}
                            valor={ultima ? relativo(ultima.em) : '—'}
                            rotulo="Última atividade"
                        />
                        <Tile
                            icone={BadgeCheck}
                            valor={PERMISSION_LABEL[nivel]}
                            rotulo="Nível de acesso"
                            destaque
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
                        {/* ATIVIDADE ocupa mais espaco que os dados fixos: e a
                            unica parte da ficha que responde "essa pessoa esta
                            trabalhando em que?". */}
                        <Bloco titulo="Últimas atividades" icone={History} className="lg:col-span-3">
                            {carregandoAtiv ? (
                                <div className="flex items-center gap-2 text-zinc-400 text-sm py-6">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                                </div>
                            ) : atividade.length === 0 ? (
                                <p className="text-xs text-zinc-400 leading-relaxed py-2">
                                    Nenhuma ação registrada {empresasParaAtividade.length === 0 ? 'para consultar aqui' : 'ainda'}.
                                    O histórico começa a encher assim que esta pessoa criar, mover ou aprovar uma
                                    publicação.
                                </p>
                            ) : (
                                <ol className="relative space-y-3.5 pl-1">
                                    {atividade.map((entrada, i) => {
                                        const Icone = ICONES_HISTORICO[entrada.tipo];
                                        const { texto, destaque } = descreverHistorico(entrada);
                                        return (
                                            <li key={`${entrada.empresaId}-${entrada.id}`} className="flex gap-3 min-w-0">
                                                <div className="flex flex-col items-center shrink-0">
                                                    <span className="w-7 h-7 rounded-full bg-white/[0.07] border border-white/10 flex items-center justify-center text-zinc-300">
                                                        <Icone className="w-3.5 h-3.5" />
                                                    </span>
                                                    {/* Fio ligando as entradas. Some na ultima:
                                                        um fio solto abaixo do fim da lista parece
                                                        conteudo que nao carregou. */}
                                                    {i < atividade.length - 1 && (
                                                        <span className="w-px flex-1 bg-white/10 mt-1" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 pb-0.5">
                                                    <p className="text-sm text-zinc-100 leading-snug">{texto}</p>
                                                    {destaque && (
                                                        <p className="text-xs text-zinc-400 truncate" title={destaque}>{destaque}</p>
                                                    )}
                                                    <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                                                        {entrada.empresaNome} · {relativo(entrada.em)}
                                                        {' · '}
                                                        {entrada.em.toLocaleDateString('pt-BR')}
                                                    </p>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ol>
                            )}
                        </Bloco>

                        <div className="lg:col-span-2 space-y-4">
                            <Bloco
                                titulo="Acesso"
                                icone={ShieldCheck}
                                acao={onSalvarCargo && !editandoCargo ? (
                                    <button onClick={() => { setRascunhoCargo(pessoa.cargo || ''); setEditandoCargo(true); }} className={botaoTexto}>
                                        <Pencil className="w-3 h-3" /> Cargo
                                    </button>
                                ) : undefined}
                            >
                                <div className="divide-y divide-white/5 -my-2.5">
                                    <Linha
                                        rotulo="Nível de permissão"
                                        valor={PERMISSION_LABEL[nivel]}
                                        icone={ShieldCheck}
                                        dica={PERMISSION_HINT[nivel]}
                                    />
                                    <div className="py-2.5 min-w-0">
                                        <p className="text-[11px] text-zinc-400 mb-1">Cargo</p>
                                        {editandoCargo ? (
                                            <>
                                                {/* ESCOLHA, nao digitacao. Cargo digitado a mao
                                                    produzia "Social Media", "social midia" e "SM"
                                                    como tres cargos distintos para o banco. A lista
                                                    e mantida em Gestao > Configuracoes. */}
                                                <div className="flex gap-1.5">
                                                    <select
                                                        autoFocus
                                                        value={rascunhoCargo}
                                                        onChange={e => setRascunhoCargo(e.target.value)}
                                                        className="min-w-0 flex-1 bg-black/40 border border-white/10 text-white text-sm rounded-control px-2.5 py-1.5 outline-none focus:border-[#FABE01]"
                                                    >
                                                        <option value="">— sem cargo —</option>
                                                        {/* O cargo atual entra na lista mesmo se
                                                            tiver saido das configuracoes: sem isto o
                                                            select abriria em branco e um salvar
                                                            distraido apagaria o cargo da pessoa. */}
                                                        {rascunhoCargo && !cargos.some(c => mesmoCargo(c, rascunhoCargo)) && (
                                                            <option value={rascunhoCargo}>{rascunhoCargo} (fora da lista)</option>
                                                        )}
                                                        {cargos.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                    <button
                                                        onClick={salvarCargo}
                                                        disabled={salvandoCargo}
                                                        aria-label="Salvar cargo"
                                                        className="shrink-0 px-2.5 rounded-control bg-[#FABE01] text-black disabled:opacity-40"
                                                    >
                                                        {salvandoCargo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Briefcase className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                                <p className={`text-sm truncate ${pessoa.cargo ? 'text-white font-medium' : 'text-zinc-400'}`}>
                                                    {pessoa.cargo || 'não definido'}
                                                </p>
                                            </div>
                                        )}
                                        <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                                            {editandoCargo
                                                ? 'A lista é mantida em Gestão › Configurações.'
                                                : ehColaborador
                                                    ? 'Só administrador altera — a pessoa não muda o próprio cargo.'
                                                    : 'Cliente é sempre cliente: o nível não muda por esta tela.'}
                                        </p>
                                    </div>
                                    {empresaNome && (
                                        <Linha rotulo="Cliente" valor={empresaNome} icone={Building2} />
                                    )}
                                </div>
                            </Bloco>

                            {/* FINANCEIRO - so admin, e so equipe. Colaborador nao ve
                                nem a secao vazia: um bloco "sem permissao" so anuncia
                                que existe dado ali e convida a pedir. */}
                            {mostrarFinanceiro && (
                                <Bloco
                                    titulo="Financeiro"
                                    icone={Wallet}
                                    acao={!editandoFin && !carregandoFin ? (
                                        <button onClick={() => setEditandoFin(true)} className={botaoTexto}>
                                            <Pencil className="w-3 h-3" /> Editar
                                        </button>
                                    ) : undefined}
                                >
                                    {carregandoFin ? (
                                        <div className="flex items-center gap-2 text-zinc-400 text-sm py-6">
                                            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                                        </div>
                                    ) : editandoFin ? (
                                        <div className="space-y-3.5">
                                            <div>
                                                <label className={labelStyle}>Valor mensal / cachê (R$)</label>
                                                <input
                                                    autoFocus
                                                    value={valorTexto}
                                                    onChange={e => {
                                                        setValorTexto(e.target.value);
                                                        setRascunhoFin(d => ({ ...d, valorMensalCentavos: textoParaCentavos(e.target.value) }));
                                                    }}
                                                    placeholder="0,00"
                                                    inputMode="decimal"
                                                    className={inputStyle}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className={labelStyle}>Dia do pagamento</label>
                                                    <input
                                                        type="number" min={1} max={31}
                                                        value={rascunhoFin.diaVencimento ?? ''}
                                                        onChange={e => setRascunhoFin(d => ({ ...d, diaVencimento: e.target.value ? Number(e.target.value) : null }))}
                                                        placeholder="5"
                                                        className={inputStyle}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelStyle}>Início</label>
                                                    <input
                                                        type="date"
                                                        value={rascunhoFin.inicioContrato ? toDateInputValue(rascunhoFin.inicioContrato) : ''}
                                                        onChange={e => setRascunhoFin(d => ({ ...d, inicioContrato: fromDateInputValue(e.target.value) }))}
                                                        className={`${inputStyle} [color-scheme:dark]`}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className={labelStyle}>Escopo do trabalho</label>
                                                <input
                                                    value={rascunhoFin.escopo || ''}
                                                    onChange={e => setRascunhoFin(d => ({ ...d, escopo: e.target.value }))}
                                                    placeholder="20h/semana, edição de reels"
                                                    className={inputStyle}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelStyle}>Observações</label>
                                                <textarea
                                                    rows={2}
                                                    value={rascunhoFin.observacoes || ''}
                                                    onChange={e => setRascunhoFin(d => ({ ...d, observacoes: e.target.value }))}
                                                    className={`${inputStyle} resize-none`}
                                                />
                                            </div>
                                            {erroFin && (
                                                <p className="text-red-400 text-xs flex items-start gap-1.5">
                                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {erroFin}
                                                </p>
                                            )}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        // Descarta o rascunho: sair da edicao mantendo o
                                                        // que foi digitado faria a tela mostrar valor que
                                                        // nao esta gravado.
                                                        setRascunhoFin(financeiro || {});
                                                        setValorTexto(centavosParaTexto(financeiro?.valorMensalCentavos));
                                                        setErroFin('');
                                                        setEditandoFin(false);
                                                    }}
                                                    className="flex-1 py-2.5 text-sm font-semibold rounded-control bg-white/5 text-zinc-200 hover:bg-white/10 transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={salvarFin}
                                                    disabled={salvandoFin}
                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-control bg-[#FABE01] text-black hover:bg-[#FABE01]/90 transition-colors disabled:opacity-40"
                                                >
                                                    {salvandoFin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                    Salvar
                                                </button>
                                            </div>
                                        </div>
                                    ) : erroFin ? (
                                        <p className="text-red-400 text-xs flex items-start gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {erroFin}
                                        </p>
                                    ) : (
                                        <>
                                            {/* SEMPRE os quatro campos, mesmo sem nada
                                                cadastrado. Campo vazio nao diz se o dado nao
                                                existe ou se a tela nao carregou; o padrao
                                                marcado com a etiqueta diz as duas coisas -
                                                e R$ 0,00 sem a etiqueta seria pior que
                                                vazio, porque parece salario de verdade. */}
                                            <div className="divide-y divide-white/5 -my-2.5">
                                                <Linha
                                                    rotulo="Valor mensal / cachê"
                                                    valor={formatarMoeda(financeiro?.valorMensalCentavos ?? 0)}
                                                    icone={Wallet}
                                                    padrao={financeiro?.valorMensalCentavos == null}
                                                />
                                                <Linha
                                                    rotulo="Dia do pagamento"
                                                    valor={financeiro?.diaVencimento
                                                        ? `Todo dia ${financeiro.diaVencimento}`
                                                        : 'Sem dia definido'}
                                                    icone={CalendarClock}
                                                    padrao={!financeiro?.diaVencimento}
                                                />
                                                <Linha
                                                    rotulo="Início"
                                                    valor={financeiro?.inicioContrato
                                                        ? financeiro.inicioContrato.toLocaleDateString('pt-BR')
                                                        : 'Sem data definida'}
                                                    icone={CalendarClock}
                                                    padrao={!financeiro?.inicioContrato}
                                                />
                                                <Linha
                                                    rotulo="Escopo do trabalho"
                                                    valor={financeiro?.escopo || 'Não definido'}
                                                    icone={FileText}
                                                    padrao={!financeiro?.escopo}
                                                />
                                                {financeiro?.observacoes && (
                                                    <div className="py-2.5">
                                                        <p className="text-[11px] text-zinc-400 mb-1">Observações</p>
                                                        <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">
                                                            {financeiro.observacoes}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-start gap-2 mt-4 pt-3 border-t border-white/5">
                                                <Lock className="w-3.5 h-3.5 text-[#FABE01] shrink-0 mt-0.5" />
                                                <p className="text-[10px] text-zinc-400 leading-relaxed">
                                                    Coleção separada: só administradores leem.
                                                    {financeiro?.atualizadoEm && (
                                                        <> Última alteração em {financeiro.atualizadoEm.toLocaleDateString('pt-BR')}
                                                        {financeiro.atualizadoPor ? ` por ${financeiro.atualizadoPor}` : ''}.</>
                                                    )}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </Bloco>
                            )}

                            {children}
                        </div>
                    </div>
                </div>

                {/* ACOES no rodape fixo: era um menu de tres pontos no cartao, que
                    escondia "redefinir senha" atras de um clique sem rotulo. */}
                {acoes.length > 0 && (
                    <footer className="shrink-0 border-t border-white/10 bg-white/[0.03] p-4 sm:px-7 flex flex-wrap gap-2">
                        {acoes.map(acao => (
                            <button
                                key={acao.label}
                                onClick={acao.onClick}
                                className={`px-3.5 py-2.5 text-xs font-semibold rounded-control transition-colors ${
                                    acao.destrutiva
                                        ? 'text-red-300 bg-red-500/10 hover:bg-red-500/20 sm:ml-auto'
                                        : 'text-zinc-200 bg-white/5 hover:bg-white/10'
                                }`}
                            >
                                {acao.label}
                            </button>
                        ))}
                    </footer>
                )}
            </div>
        </div>
    );
};

export default PersonDetailModal;
