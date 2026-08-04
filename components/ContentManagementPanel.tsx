import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../utils/firebase';
import { CalendarEvent, UserProfile } from '../types';
import {
    Subtarefa, SubtarefaStatus, SUBTAREFA_STATUS, subtarefaStatusInfo,
    subscribeSubtarefas, criarSubtarefa, atualizarSubtarefa, removerSubtarefa, progresso,
    situacaoPrazo, TONS_PRAZO
} from '../utils/subtarefas';
import { lerEquipeAgencia, indexarPorUid, pessoasDeUids } from '../utils/equipe';
import { slaAtual, slaClasses, slaTipoLabel } from '../utils/sla';
import { getDisplayName } from '../utils/avatar';
import { toDateInputValue, fromDateInputValue } from '../utils/date';
import { AvatarBubble } from './AvatarBubble';
import { Dropdown, OpcaoDropdown } from './Dropdown';
import {
    Plus, Trash2, Loader2, ListChecks, Users, AlertTriangle, Clock, Check, UserPlus
} from 'lucide-react';

interface ContentManagementPanelProps {
    empresaId: string;
    /** O evento como esta gravado. Vazio quando o post ainda nao foi criado. */
    event: CalendarEvent;
    autorEmail?: string | null;
    /** Cliente nao gerencia producao: o painel nem aparece para ele. */
    podeEditar: boolean;
    /**
     * Equipe ja carregada pelo pai. O painel busca sozinho quando nao vem - a
     * aba de conteudo tambem precisa dos rostos, e duas leituras da mesma lista
     * na mesma tela e desperdicio.
     */
    equipe?: UserProfile[];
}

const SEM_DONO = '__sem_dono__';

/**
 * GESTAO DO CONTEUDO - responsaveis e subtarefas.
 *
 * Era um modal separado (ContentTaskModal), aberto pelo card do quadro, com um
 * botao "Abrir conteudo" que FECHAVA a gestao e abria o editor - sem caminho de
 * volta. Duas fichas para o mesmo post, e escolher errado custava reabrir tudo.
 * Agora e uma ABA do mesmo modal: as duas metades do post convivem, e trocar
 * entre elas nao perde nada.
 *
 * O PAINEL BUSCA OS PROPRIOS DADOS (equipe e subtarefas) em vez de recebe-los.
 * Assim o modal do calendario ganha a aba de graca, sem o calendario precisar
 * saber que subtarefa existe.
 */
const ContentManagementPanel: React.FC<ContentManagementPanelProps> = ({
    empresaId, event, autorEmail, podeEditar, equipe: equipeDoPai
}) => {
    const [subtarefas, setSubtarefas] = useState<Subtarefa[]>([]);
    const [equipeLocal, setEquipeLocal] = useState<UserProfile[]>([]);
    const equipe = equipeDoPai ?? equipeLocal;
    const [carregando, setCarregando] = useState(true);
    const [novo, setNovo] = useState('');
    const [criando, setCriando] = useState(false);
    /** Prazo digitado junto do titulo da etapa nova. Vazio = sem prazo. */
    const [novoPrazo, setNovoPrazo] = useState('');
    const [erro, setErro] = useState('');
    const [abrindoPessoas, setAbrindoPessoas] = useState(false);

    // Post ainda nao criado nao tem id, logo nao tem onde pendurar subtarefa.
    const existe = Boolean(event.id);

    useEffect(() => {
        if (!empresaId || !existe) { setCarregando(false); return; }
        const cancelar = subscribeSubtarefas(empresaId, todas => {
            setSubtarefas(todas.filter(s => s.eventId === event.id));
            setCarregando(false);
        });
        return cancelar;
    }, [empresaId, event.id, existe]);

    useEffect(() => {
        if (equipeDoPai) return;
        lerEquipeAgencia().then(setEquipeLocal).catch(console.error);
    }, [equipeDoPai]);

    const indice = useMemo(() => indexarPorUid(equipe), [equipe]);
    const responsaveis = pessoasDeUids(event.responsaveis, indice);
    const prog = progresso(subtarefas);
    const sla = slaAtual(event);

    const opcoesResponsavel: OpcaoDropdown<string>[] = [
        { valor: SEM_DONO, label: 'sem dono', adorno: <UserPlus className="w-3.5 h-3.5 text-zinc-500 shrink-0" /> },
        ...equipe.map(p => ({
            valor: p.id,
            label: getDisplayName(p),
            detalhe: p.cargo || undefined,
            adorno: <AvatarBubble pessoa={p} tamanho="xs" anel={false} />
        }))
    ];

    const opcoesStatus: OpcaoDropdown<SubtarefaStatus>[] = SUBTAREFA_STATUS.map(s => ({
        valor: s.id,
        label: s.label,
        adorno: <span className={`w-2 h-2 rounded-full shrink-0 ${s.ponto}`} />
    }));

    const adicionar = async () => {
        const titulo = novo.trim();
        if (!titulo || !existe) return;
        setCriando(true);
        setErro('');
        try {
            await criarSubtarefa(empresaId, event.id, titulo, autorEmail, null, fromDateInputValue(novoPrazo));
            setNovo('');
            setNovoPrazo('');
        } catch (e) {
            console.error(e);
            setErro('Não foi possível criar a subtarefa.');
        } finally {
            setCriando(false);
        }
    };

    const mudarStatus = async (sub: Subtarefa, status: SubtarefaStatus) => {
        try {
            await atualizarSubtarefa(empresaId, sub.id, { status });
        } catch (e) {
            console.error(e);
            setErro('Não foi possível mudar o status da subtarefa.');
        }
    };

    const atribuir = async (sub: Subtarefa, valor: string) => {
        try {
            await atualizarSubtarefa(empresaId, sub.id, {
                responsavelUid: valor === SEM_DONO ? null : valor
            });
        } catch (e) {
            console.error(e);
            setErro('Não foi possível atribuir a subtarefa.');
        }
    };

    /**
     * Prazo da etapa.
     *
     * DIA, sem hora: etapa de producao se combina por dia ("design fica pronto
     * quinta"), e um campo de hora aqui daria uma precisao que ninguem usa e que
     * faria "vence hoje" depender do horario.
     */
    const mudarPrazo = async (sub: Subtarefa, valor: string) => {
        try {
            await atualizarSubtarefa(empresaId, sub.id, { prazo: fromDateInputValue(valor) });
        } catch (e) {
            console.error(e);
            setErro('Não foi possível mudar o prazo da subtarefa.');
        }
    };

    const alternarResponsavel = async (uid: string) => {
        const atuais = event.responsaveis || [];
        const novos = atuais.includes(uid) ? atuais.filter(u => u !== uid) : [...atuais, uid];
        setErro('');
        try {
            // Grava no proprio evento: responsavel e propriedade do CONTEUDO. E o
            // MESMO campo que a aba de informação mostra - antes havia um campo
            // de texto livre "Responsável" ali e uma lista de pessoas aqui, dois
            // donos diferentes para o mesmo post.
            await db.collection('empresas').doc(empresaId).collection('events').doc(event.id)
                .update({ responsaveis: novos });
        } catch (e) {
            console.error(e);
            setErro('Não foi possível salvar os responsáveis.');
        }
    };

    if (!existe) {
        return (
            <div className="py-12 px-6 text-center border border-dashed border-white/10 rounded-card">
                <ListChecks className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-300 font-semibold text-sm">Salve a publicação primeiro</p>
                <p className="text-zinc-500 text-xs mt-1 max-w-sm mx-auto leading-relaxed">
                    Responsáveis e subtarefas pertencem a um conteúdo que já existe. Preencha a aba
                    <strong className="text-zinc-300"> Conteúdo</strong> e salve — a gestão abre em seguida.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* SITUACAO: status e o unico prazo que vale agora. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#111111] border border-white/5 rounded-card px-4 py-3">
                    <p className="text-[11px] text-zinc-500 mb-1">Status do conteúdo</p>
                    <p className="text-sm font-semibold text-white">{event.status}</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Muda na aba Conteúdo ou arrastando no quadro.</p>
                </div>
                <div className="bg-[#111111] border border-white/5 rounded-card px-4 py-3">
                    <p className="text-[11px] text-zinc-500 mb-1">Prazo</p>
                    {sla ? (
                        <>
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${slaClasses(sla.tone)}`}>
                                <Clock className="w-3 h-3" /> {sla.label}
                            </span>
                            <p className="text-[10px] text-zinc-600 mt-1.5">
                                {slaTipoLabel(sla.tipo)} · com {sla.dono === 'agencia' ? 'a equipe' : 'o cliente'}
                                {sla.limite ? ` · ${sla.limite.toLocaleDateString('pt-BR')}` : ''}
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-sm font-semibold text-zinc-400">Sem prazo em aberto</p>
                            <p className="text-[10px] text-zinc-600 mt-1">O conteúdo saiu do fluxo.</p>
                        </>
                    )}
                </div>
            </div>

            {/* RESPONSAVEIS pelo conteudo inteiro. */}
            <section className="bg-[#111111] border border-white/5 rounded-card p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-[#FABE01]" />
                    <h3 className="text-sm font-bold text-white">Responsáveis</h3>
                    {podeEditar && (
                        <button
                            type="button"
                            onClick={() => setAbrindoPessoas(v => !v)}
                            className="ml-auto text-[11px] font-semibold text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-full transition-colors"
                        >
                            {abrindoPessoas ? 'Fechar' : 'Definir'}
                        </button>
                    )}
                </div>

                {abrindoPessoas && podeEditar ? (
                    <div className="flex flex-wrap gap-1.5">
                        {equipe.length === 0 && (
                            <p className="text-xs text-zinc-500">Ninguém na equipe da agência ainda.</p>
                        )}
                        {equipe.map(pessoa => {
                            const marcado = (event.responsaveis || []).includes(pessoa.id);
                            return (
                                <button
                                    type="button"
                                    key={pessoa.id}
                                    onClick={() => alternarResponsavel(pessoa.id)}
                                    aria-pressed={marcado}
                                    className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-xs transition-colors ${
                                        marcado
                                            ? 'bg-[#FABE01]/15 border-[#FABE01]/40 text-white'
                                            : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                                    }`}
                                >
                                    <AvatarBubble pessoa={pessoa} tamanho="xs" anel={false} />
                                    {getDisplayName(pessoa)}
                                    {marcado && <Check className="w-3 h-3 text-[#FABE01]" />}
                                </button>
                            );
                        })}
                    </div>
                ) : responsaveis.length === 0 ? (
                    <p className="text-xs text-zinc-500 leading-relaxed">
                        Ninguém atribuído. Conteúdo sem responsável é o que trava a produção sem ninguém notar.
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {responsaveis.map(p => (
                            <span key={p.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full pl-1.5 pr-3 py-1 text-xs text-zinc-200">
                                <AvatarBubble pessoa={p} tamanho="xs" anel={false} />
                                {getDisplayName(p)}
                            </span>
                        ))}
                    </div>
                )}
            </section>

            {/* SUBTAREFAS. */}
            <section className="bg-[#111111] border border-white/5 rounded-card p-4">
                <div className="flex items-center gap-2 mb-1">
                    <ListChecks className="w-4 h-4 text-[#FABE01]" />
                    <h3 className="text-sm font-bold text-white">Subtarefas</h3>
                    {prog.total > 0 && (
                        <span className="text-[11px] font-semibold text-zinc-300 bg-white/5 px-2 py-0.5 rounded-full">
                            {prog.feitas} de {prog.total}
                        </span>
                    )}
                </div>
                <p className="text-[11px] text-zinc-500 mb-3 leading-relaxed">
                    As etapas deste conteúdo. Concluir todas não muda o status do post — isso continua sendo
                    decisão de quem move o card.
                </p>

                {prog.total > 0 && (
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-4">
                        <div className="h-full bg-[#FABE01] rounded-full transition-all" style={{ width: `${prog.pct}%` }} />
                    </div>
                )}

                {carregando ? (
                    <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
                        <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {subtarefas.map(sub => {
                            const info = subtarefaStatusInfo(sub.status);
                            const resp = sub.responsavelUid ? indice[sub.responsavelUid] : undefined;
                            return (
                                <li key={sub.id} className="flex flex-wrap items-center gap-2 bg-black/30 border border-white/5 rounded-control px-3 py-2.5">
                                    <span className={`flex-1 min-w-[8rem] text-sm break-words ${
                                        sub.status === 'feita' ? 'text-zinc-500 line-through' : 'text-zinc-100'
                                    }`}>
                                        {sub.titulo}
                                    </span>

                                    {/* PRAZO da etapa, ao lado do titulo: e o dado que
                                        diz se ela esta atrasada, e ficava invisivel. */}
                                    {(() => {
                                        const p = situacaoPrazo(sub.prazo);
                                        if (sub.status === 'feita' || (!sub.prazo && podeEditar)) return null;
                                        return (
                                            <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-chip border ${TONS_PRAZO[p.tone]}`}>
                                                {p.label}
                                            </span>
                                        );
                                    })()}

                                    {podeEditar ? (
                                        <>
                                            <div className="w-[8.5rem] shrink-0">
                                                <input
                                                    type="date"
                                                    value={sub.prazo ? toDateInputValue(sub.prazo) : ''}
                                                    onChange={e => mudarPrazo(sub, e.target.value)}
                                                    aria-label={`Prazo de ${sub.titulo}`}
                                                    max={toDateInputValue(event.date)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-control px-2 py-1.5 text-xs text-white outline-none focus:border-[#FABE01] [color-scheme:dark]"
                                                />
                                            </div>
                                            <Dropdown<SubtarefaStatus>
                                                compacto
                                                className="w-[7.5rem] shrink-0"
                                                valor={sub.status}
                                                opcoes={opcoesStatus}
                                                onSelect={s => mudarStatus(sub, s)}
                                                ariaLabel={`Status de ${sub.titulo}`}
                                            />
                                            <Dropdown<string>
                                                compacto
                                                className="w-[9.5rem] shrink-0"
                                                valor={sub.responsavelUid || SEM_DONO}
                                                opcoes={opcoesResponsavel}
                                                onSelect={v => atribuir(sub, v)}
                                                ariaLabel={`Responsável por ${sub.titulo}`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removerSubtarefa(empresaId, sub.id).catch(console.error)}
                                                aria-label={`Excluir ${sub.titulo}`}
                                                className="p-1.5 rounded-full text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border shrink-0 ${info.cor}`}>
                                                {info.label}
                                            </span>
                                            {resp && <AvatarBubble pessoa={resp} tamanho="xs" anel={false} />}
                                        </>
                                    )}
                                </li>
                            );
                        })}

                        {subtarefas.length === 0 && (
                            <p className="text-xs text-zinc-500 py-1">
                                Nenhuma etapa ainda. Quebre o conteúdo no que precisa acontecer: roteiro, design,
                                revisão, agendamento.
                            </p>
                        )}
                    </ul>
                )}

                {podeEditar && (
                    <div className="flex flex-wrap gap-2 mt-3">
                        <input
                            value={novo}
                            onChange={e => setNovo(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } }}
                            placeholder="Nova subtarefa. Ex: Roteiro do reel"
                            className="min-w-[10rem] flex-1 bg-black/40 border border-white/10 rounded-control px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all"
                        />
                        {/* PRAZO JA NA CRIACAO. Etapa sem prazo nao aparece em
                            nenhuma fila de urgencia - pedir a data depois significa
                            que quase nenhuma teria. O campo aceita vazio: nem toda
                            etapa precisa de data propria. */}
                        <div className="w-[9.5rem] shrink-0">
                            <input
                                type="date"
                                value={novoPrazo}
                                onChange={e => setNovoPrazo(e.target.value)}
                                aria-label="Prazo da nova subtarefa"
                                max={toDateInputValue(event.date)}
                                className="w-full bg-black/40 border border-white/10 rounded-control px-2.5 py-2.5 text-sm text-white outline-none focus:border-[#FABE01] [color-scheme:dark]"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={adicionar}
                            disabled={!novo.trim() || criando}
                            className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-control bg-white/5 text-zinc-200 hover:bg-white/10 transition-colors disabled:opacity-30"
                        >
                            {criando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            Adicionar
                        </button>
                        <p className="w-full text-[10px] text-zinc-600 leading-relaxed">
                            O prazo da etapa vence ANTES da publicação ({event.date.toLocaleDateString('pt-BR')}) —
                            por isso o campo não aceita data depois dela.
                        </p>
                    </div>
                )}

                {erro && (
                    <p className="text-red-400 text-xs mt-3 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {erro}
                    </p>
                )}
            </section>
        </div>
    );
};

export default ContentManagementPanel;
