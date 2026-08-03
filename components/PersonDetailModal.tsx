import React, { useState, useEffect } from 'react';
import { UserProfile, DadosFinanceiros } from '../types';
import { getDisplayName, getInitials, isSafeImageSrc } from '../utils/avatar';
import { permissionLevel, PERMISSION_LABEL, PERMISSION_HINT } from '../utils/permissions';
import {
    lerFinanceiroUsuario, salvarFinanceiroUsuario, formatarMoeda,
    centavosParaTexto, textoParaCentavos
} from '../utils/empresas';
import { toDateInputValue, fromDateInputValue } from '../utils/date';
import {
    X, Mail, Phone, Building2, ShieldCheck, Briefcase, Lock, Loader2, Save,
    AlertTriangle, Pencil, Check, Wallet, CalendarClock, FileText
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

const inputStyle = "w-full bg-[#111111] border border-zinc-700 rounded-control px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all placeholder:text-zinc-600";
const labelStyle = "block text-[11px] font-semibold text-zinc-500 mb-1.5";

/** Titulo de secao. Pequeno de proposito: separa sem competir com o conteudo. */
const Secao: React.FC<{ titulo: string; icone: React.ElementType; children: React.ReactNode; acao?: React.ReactNode }> = ({
    titulo, icone: Icone, children, acao
}) => (
    <section>
        <div className="flex items-center gap-2 mb-2.5">
            <Icone className="w-3.5 h-3.5 text-zinc-600" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{titulo}</h3>
            {acao && <div className="ml-auto">{acao}</div>}
        </div>
        {children}
    </section>
);

/**
 * Uma linha rotulo/valor. Rotulo acima, valor abaixo: em telefone estreito o
 * par lado a lado quebrava o valor em duas linhas e desalinhava a lista.
 */
const Linha: React.FC<{ rotulo: string; valor?: string | null; icone?: React.ElementType; dica?: string }> = ({
    rotulo, valor, icone: Icone, dica
}) => (
    <div className="bg-[#111111] px-3.5 py-3 min-w-0">
        <p className="text-[10px] text-zinc-600 mb-1">{rotulo}</p>
        <div className="flex items-center gap-2 min-w-0">
            {Icone && <Icone className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
            <p className={`text-sm truncate ${valor ? 'text-zinc-100' : 'text-zinc-600 italic'}`} title={valor || undefined}>
                {valor || 'não informado'}
            </p>
        </div>
        {dica && <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed">{dica}</p>}
    </div>
);

/** Moldura das linhas: fundo claro vazando entre elas cria a divisao sem borda. */
const Grupo: React.FC<{ children: React.ReactNode; colunas?: 1 | 2 }> = ({ children, colunas = 1 }) => (
    <div className={`grid gap-px bg-white/5 rounded-control overflow-hidden ${colunas === 2 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
        {children}
    </div>
);

/**
 * FICHA DA PESSOA - tudo que se sabe de um colaborador ou de um contato do
 * cliente, numa tela so.
 *
 * POR QUE ELA EXISTE: o cartao da lista precisa caber nove vezes na tela, e
 * cada campo que se acrescenta ali encolhe os outros - foi assim que o cartao
 * antigo virou uma parede de rotulos. O cartao passa a ser PORTA DE ENTRADA:
 * mostra rosto, nome e situacao; o resto mora aqui.
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
    pessoa, selo, empresaNome, ehVoce, souAdmin, autorEmail, onSalvarCargo, acoes = [], children, onClose
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

    // Esc fecha. Sem isto a unica saida e o X, e num modal alto ele fica fora
    // da vista depois de rolar.
    useEffect(() => {
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', esc);
        return () => document.removeEventListener('keydown', esc);
    }, [onClose]);

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
    const temFinanceiro = !!financeiro && (
        financeiro.valorMensalCentavos != null || financeiro.diaVencimento != null ||
        !!financeiro.escopo || !!financeiro.observacoes || !!financeiro.inicioContrato
    );

    const botaoTexto = "text-[11px] font-semibold text-zinc-400 hover:text-white flex items-center gap-1 transition-colors";

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`Ficha de ${nome}`}
                className="relative w-full sm:max-w-2xl bg-[#1A1A1A] border-t sm:border border-white/10 rounded-t-card sm:rounded-card shadow-card flex flex-col max-h-[92dvh] overflow-hidden"
            >
                {/* Fecha flutuando sobre a area rolavel. O fundo proprio nao e
                    enfeite: rolando a ficha, o botao passa por cima do texto das
                    secoes e sem ele os dois se misturam. */}
                <button
                    onClick={onClose}
                    aria-label="Fechar"
                    className="absolute right-3 top-3 z-10 p-2 rounded-full bg-black/50 backdrop-blur-sm text-zinc-300 hover:text-white hover:bg-black/70 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* IDENTIDADE. Faixa mais clara no topo em vez de bloco de cor:
                        separa a identidade dos dados sem introduzir uma cor nova
                        na paleta. */}
                    <header className="bg-gradient-to-b from-white/[0.06] to-transparent px-5 pt-8 pb-5 sm:px-7 sm:pt-9 flex flex-col items-center text-center border-b border-white/5">
                        {temFoto ? (
                            <img
                                src={pessoa.fotoUrl!}
                                alt=""
                                className="w-20 h-20 rounded-full object-cover ring-2 ring-white/10"
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-white/5 ring-2 ring-white/10 flex items-center justify-center text-zinc-300 font-bold text-2xl">
                                {getInitials(pessoa)}
                            </div>
                        )}

                        <div className="flex items-center gap-2 mt-3.5 max-w-full">
                            <h2 className="text-xl font-bold text-white tracking-tight truncate">{nome}</h2>
                            {ehVoce && (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-[#FABE01] shrink-0">você</span>
                            )}
                        </div>

                        <p className="text-sm text-zinc-500 mt-0.5">
                            {pessoa.cargo || (ehColaborador ? 'Cargo não definido' : 'Contato do cliente')}
                        </p>

                        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3.5">
                            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${selo.cor}`}>
                                {selo.texto}
                            </span>
                            {empresaNome && (
                                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/5 text-zinc-400 flex items-center gap-1">
                                    <Building2 className="w-3 h-3" /> {empresaNome}
                                </span>
                            )}
                        </div>
                    </header>

                    <div className="p-5 sm:p-7 space-y-6">
                        <Secao titulo="Contato" icone={Mail}>
                            <Grupo colunas={2}>
                                <Linha rotulo="E-mail" valor={pessoa.email} icone={Mail} />
                                <Linha rotulo="Telefone / WhatsApp" valor={pessoa.telefone} icone={Phone} />
                            </Grupo>
                        </Secao>

                        <Secao
                            titulo="Acesso"
                            icone={ShieldCheck}
                            acao={onSalvarCargo && !editandoCargo ? (
                                <button onClick={() => { setRascunhoCargo(pessoa.cargo || ''); setEditandoCargo(true); }} className={botaoTexto}>
                                    <Pencil className="w-3 h-3" /> Editar cargo
                                </button>
                            ) : undefined}
                        >
                            <Grupo colunas={2}>
                                <Linha
                                    rotulo="Nível de permissão"
                                    valor={PERMISSION_LABEL[nivel]}
                                    icone={ShieldCheck}
                                    dica={PERMISSION_HINT[nivel]}
                                />
                                {/* Cargo editavel no lugar onde e lido, e nao numa
                                    tela de edicao separada. */}
                                <div className="bg-[#111111] px-3.5 py-3 min-w-0">
                                    <p className="text-[10px] text-zinc-600 mb-1">Cargo</p>
                                    {editandoCargo ? (
                                        <div className="flex gap-1.5">
                                            <input
                                                autoFocus
                                                value={rascunhoCargo}
                                                onChange={e => setRascunhoCargo(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') salvarCargo(); }}
                                                placeholder="Ex: Social Media"
                                                className="min-w-0 flex-1 bg-[#0D0D0D] border border-zinc-700 text-zinc-100 text-sm rounded-control px-2 py-1.5 outline-none focus:border-[#FABE01]"
                                            />
                                            <button
                                                onClick={salvarCargo}
                                                disabled={salvandoCargo}
                                                aria-label="Salvar cargo"
                                                className="shrink-0 px-2.5 rounded-control bg-[#FABE01] text-black disabled:opacity-40"
                                            >
                                                {salvandoCargo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Briefcase className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                                            <p className={`text-sm truncate ${pessoa.cargo ? 'text-zinc-100' : 'text-zinc-600 italic'}`}>
                                                {pessoa.cargo || 'não definido'}
                                            </p>
                                        </div>
                                    )}
                                    <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed">
                                        {ehColaborador
                                            ? 'Só administrador altera — a pessoa não muda o próprio cargo.'
                                            : 'Cliente é sempre cliente: o nível não muda por esta tela.'}
                                    </p>
                                </div>
                            </Grupo>
                        </Secao>

                        {/* FINANCEIRO - so admin. Colaborador nao ve nem a secao
                            vazia: um bloco "sem permissao" so anuncia que existe
                            dado ali e convida a pedir. */}
                        {mostrarFinanceiro && (
                            <Secao
                                titulo="Financeiro · pagamento"
                                icone={Wallet}
                                acao={!editandoFin && !carregandoFin ? (
                                    <button onClick={() => setEditandoFin(true)} className={botaoTexto}>
                                        <Pencil className="w-3 h-3" /> {temFinanceiro ? 'Editar' : 'Preencher'}
                                    </button>
                                ) : undefined}
                            >
                                <div className="flex items-start gap-2 bg-[#FABE01]/5 border border-[#FABE01]/20 rounded-control p-3 mb-2">
                                    <Lock className="w-3.5 h-3.5 text-[#FABE01] shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                                        Coleção separada: só administradores e a própria pessoa leem.
                                        Escrita é só de administrador — ninguém edita o próprio contrato.
                                    </p>
                                </div>

                                {carregandoFin ? (
                                    <div className="flex items-center gap-2 text-zinc-500 text-sm py-4 px-1">
                                        <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                                    </div>
                                ) : editandoFin ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#111111] border border-white/5 rounded-control p-3.5">
                                        <div>
                                            <label className={labelStyle}>
                                                Valor mensal / cachê (R$)
                                            </label>
                                            <input
                                                autoFocus
                                                value={valorTexto}
                                                onChange={e => {
                                                    setValorTexto(e.target.value);
                                                    setRascunhoFin(d => ({ ...d, valorMensalCentavos: textoParaCentavos(e.target.value) }));
                                                }}
                                                placeholder="1.500,00"
                                                inputMode="decimal"
                                                className={inputStyle}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelStyle}>
                                                Dia do pagamento
                                            </label>
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
                                        <div className="sm:col-span-2">
                                            <label className={labelStyle}>
                                                Escopo do trabalho
                                            </label>
                                            <input
                                                value={rascunhoFin.escopo || ''}
                                                onChange={e => setRascunhoFin(d => ({ ...d, escopo: e.target.value }))}
                                                placeholder="20h/semana, edição de reels"
                                                className={inputStyle}
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className={labelStyle}>Observações</label>
                                            <textarea
                                                rows={3}
                                                value={rascunhoFin.observacoes || ''}
                                                onChange={e => setRascunhoFin(d => ({ ...d, observacoes: e.target.value }))}
                                                className={`${inputStyle} resize-none`}
                                            />
                                        </div>
                                        {erroFin && (
                                            <p className="sm:col-span-2 text-red-400 text-xs flex items-start gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {erroFin}
                                            </p>
                                        )}
                                        <div className="sm:col-span-2 flex gap-2">
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
                                                className="flex-1 py-2.5 text-sm font-semibold rounded-control bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors"
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
                                    <p className="text-red-400 text-xs flex items-start gap-1.5 px-1">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {erroFin}
                                    </p>
                                ) : !temFinanceiro ? (
                                    <p className="text-xs text-zinc-500 px-1 leading-relaxed">
                                        Nada preenchido ainda. Registre o valor e o dia do pagamento
                                        para não depender de memória no fim do mês.
                                    </p>
                                ) : (
                                    <>
                                        <Grupo colunas={2}>
                                            <Linha
                                                rotulo="Valor mensal / cachê"
                                                valor={financeiro?.valorMensalCentavos != null ? formatarMoeda(financeiro.valorMensalCentavos) : null}
                                                icone={Wallet}
                                            />
                                            <Linha
                                                rotulo="Dia do pagamento"
                                                valor={financeiro?.diaVencimento ? `Todo dia ${financeiro.diaVencimento}` : null}
                                                icone={CalendarClock}
                                            />
                                            <Linha
                                                rotulo="Início"
                                                valor={financeiro?.inicioContrato?.toLocaleDateString('pt-BR')}
                                                icone={CalendarClock}
                                            />
                                            <Linha
                                                rotulo="Escopo do trabalho"
                                                valor={financeiro?.escopo}
                                                icone={FileText}
                                            />
                                        </Grupo>
                                        {financeiro?.observacoes && (
                                            <div className="bg-[#111111] border border-white/5 rounded-control px-3.5 py-3 mt-2">
                                                <p className="text-[10px] text-zinc-600 mb-1">Observações</p>
                                                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{financeiro.observacoes}</p>
                                            </div>
                                        )}
                                        {financeiro?.atualizadoEm && (
                                            <p className="text-[10px] text-zinc-600 mt-2 px-1">
                                                Última alteração em {financeiro.atualizadoEm.toLocaleDateString('pt-BR')}
                                                {financeiro.atualizadoPor ? ` por ${financeiro.atualizadoPor}` : ''}.
                                            </p>
                                        )}
                                    </>
                                )}
                            </Secao>
                        )}

                        {children}
                    </div>
                </div>

                {/* ACOES no rodape fixo: era um menu de tres pontos no cartao, que
                    escondia "redefinir senha" atras de um clique sem rotulo. */}
                {acoes.length > 0 && (
                    <footer className="shrink-0 border-t border-white/5 p-4 sm:px-7 flex flex-wrap gap-2">
                        {acoes.map(acao => (
                            <button
                                key={acao.label}
                                onClick={acao.onClick}
                                className={`px-3.5 py-2.5 text-xs font-semibold rounded-control transition-colors ${
                                    acao.destrutiva
                                        ? 'text-red-400 bg-red-400/5 hover:bg-red-400/15 sm:ml-auto'
                                        : 'text-zinc-300 bg-white/5 hover:bg-white/10'
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
