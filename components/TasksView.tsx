import React, { useState, useEffect, useMemo } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db } from '../utils/firebase';
import { Empresa, UserProfile } from '../types';
import {
    Subtarefa, subscribeSubtarefas, subtarefaStatusInfo, emAberto,
    situacaoPrazo, TONS_PRAZO, atualizarSubtarefa, SUBTAREFA_STATUS, SubtarefaStatus,
    FILTRO_SEM_DONO
} from '../utils/subtarefas';
import { indexarPorUid } from '../utils/equipe';
import { getDisplayName } from '../utils/avatar';
import { AvatarBubble } from './AvatarBubble';
import { Dropdown, OpcaoDropdown } from './Dropdown';
import { EmptyState, Card } from './ui';
import {
    ListChecks, Loader2, ArrowRight, UserPlus, CalendarClock, Filter, X, Layers
} from 'lucide-react';

/** Teto de assinaturas simultaneas. Mesmo motivo da visao geral. */
const LIMITE_CLIENTES = 12;
const SEM_DONO = FILTRO_SEM_DONO;
const TODOS = '__todos__';

interface TasksViewProps {
    empresas: Empresa[];
    users: UserProfile[];
    /** Abre o conteudo da tarefa dentro do cliente. */
    onOpenClient: (empresaId: string, nome: string, section?: 'calendar' | 'production', eventId?: string) => void;
    /** Filtro inicial de pessoa, quando se chega clicando num nome. */
    pessoaInicial?: string | null;
}

interface ConteudoPai {
    id: string;
    empresaId: string;
    empresaNome: string;
    title: string;
    date: Date;
    status?: string;
}

interface Linha {
    empresaId: string;
    empresaNome: string;
    tarefa: Subtarefa;
}

const DIA = 86400000;
const zerar = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * TAREFAS DE TODOS OS CLIENTES, em um lugar.
 *
 * O que existia era o contrario disto: a etapa vivia dentro do conteudo, o conteudo
 * dentro do cliente, e a unica visao geral era um numero ("3 tarefas abertas") que
 * nao dizia quais. Para responder "o que a equipe tem para entregar esta semana?"
 * era preciso abrir cliente por cliente, conteudo por conteudo.
 *
 * AGRUPA PELO CONTEUDO PAI, e nao por pessoa nem por data. A etapa nao significa
 * nada solta - "revisão ortográfica" sem saber de qual post e uma linha inutil -, e
 * e o conteudo que carrega a data de publicacao contra a qual todos os prazos das
 * etapas existem. Por isso cada grupo mostra as DUAS coisas: o prazo do post e o
 * prazo de cada etapa dele.
 *
 * SO O QUE NAO ESTA FEITO. Etapa concluida sai da lista: esta tela e fila de
 * trabalho, nao historico - o historico de um conteudo esta nele.
 *
 * A LINHA DE TEMPO da direita e da criacao ao prazo de cada etapa, com a data de
 * publicacao marcada. Ela desaparece no celular de proposito: em 360px, uma faixa
 * de 8 semanas viraria dois pixels por dia, e as etiquetas de texto ao lado do
 * titulo dizem a mesma coisa sem mentir sobre a precisao.
 */
const TasksView: React.FC<TasksViewProps> = ({ empresas, users, onOpenClient, pessoaInicial }) => {
    const [subtarefas, setSubtarefas] = useState<Record<string, Subtarefa[]>>({});
    const [pais, setPais] = useState<Record<string, ConteudoPai | null>>({});
    const [carregando, setCarregando] = useState(true);
    const [filtroCliente, setFiltroCliente] = useState<string>(TODOS);
    const [filtroPessoa, setFiltroPessoa] = useState<string>(pessoaInicial || TODOS);

    const equipe = useMemo(() => users.filter(u => u.role === 'agencia'), [users]);
    const indice = useMemo(() => indexarPorUid(equipe), [equipe]);

    useEffect(() => {
        if (empresas.length === 0) { setCarregando(false); return; }
        const cancelamentos = empresas.slice(0, LIMITE_CLIENTES).map(empresa =>
            subscribeSubtarefas(empresa.id, lista => {
                setSubtarefas(prev => ({ ...prev, [empresa.id]: lista }));
                setCarregando(false);
            })
        );
        return () => cancelamentos.forEach(fn => fn());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresas.map(e => e.id).join(',')]);

    /** Tudo que nao esta feito, com o cliente de cada etapa. */
    const linhas = useMemo<Linha[]>(() => {
        const out: Linha[] = [];
        for (const empresa of empresas) {
            for (const tarefa of subtarefas[empresa.id] || []) {
                if (!emAberto(tarefa)) continue;
                out.push({ empresaId: empresa.id, empresaNome: empresa.nome, tarefa });
            }
        }
        return out;
    }, [empresas, subtarefas]);

    /**
     * Busca o conteudo pai de cada etapa, UM POR UM e uma vez so.
     *
     * Nao assina a colecao de eventos dos 12 clientes: seriam milhares de documentos
     * em memoria para usar o titulo e a data de algumas dezenas. Aqui se le
     * exatamente os conteudos que tem etapa aberta, e o resultado fica em cache -
     * `null` marca "conteudo apagado", para nao tentar de novo em loop.
     */
    const faltando = useMemo(() => {
        const chaves = new Set(linhas.map(l => `${l.empresaId}|${l.tarefa.eventId}`));
        return [...chaves].filter(k => !(k in pais));
    }, [linhas, pais]);

    useEffect(() => {
        if (faltando.length === 0) return;
        let vivo = true;
        Promise.all(faltando.map(async chave => {
            const [empresaId, eventId] = chave.split('|');
            try {
                const doc = await db.collection('empresas').doc(empresaId)
                    .collection('events').doc(eventId).get();
                if (!doc.exists) return [chave, null] as const;
                const data = doc.data() || {};
                const empresa = empresas.find(e => e.id === empresaId);
                return [chave, {
                    id: eventId,
                    empresaId,
                    empresaNome: empresa?.nome || empresaId,
                    title: (data.title as string) || 'Conteúdo sem título',
                    date: (data.date as firebase.firestore.Timestamp | undefined)?.toDate() || new Date(),
                    status: data.status as string | undefined
                } as ConteudoPai] as const;
            } catch (e) {
                console.error('Falha ao ler o conteúdo da tarefa:', e);
                return [chave, null] as const;
            }
        })).then(pares => {
            if (!vivo) return;
            setPais(prev => {
                const novo = { ...prev };
                pares.forEach(([chave, pai]) => { novo[chave] = pai; });
                return novo;
            });
        });
        return () => { vivo = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [faltando.join(',')]);

    const filtradas = useMemo(() => linhas.filter(l => {
        if (filtroCliente !== TODOS && l.empresaId !== filtroCliente) return false;
        if (filtroPessoa === SEM_DONO) return !l.tarefa.responsavelUid;
        if (filtroPessoa !== TODOS && l.tarefa.responsavelUid !== filtroPessoa) return false;
        return true;
    }), [linhas, filtroCliente, filtroPessoa]);

    /**
     * Grupos por conteudo, os que publicam primeiro no topo.
     *
     * A ordem e a da entrega, nao a alfabetica: quem abre esta tela quer saber o que
     * aperta agora. Conteudo cujo pai ainda nao carregou fica no fim, em vez de
     * sumir - a etapa existe mesmo que a leitura do post esteja a caminho.
     */
    const grupos = useMemo(() => {
        const mapa = new Map<string, { pai: ConteudoPai | null; chave: string; itens: Linha[] }>();
        for (const linha of filtradas) {
            const chave = `${linha.empresaId}|${linha.tarefa.eventId}`;
            if (!mapa.has(chave)) mapa.set(chave, { pai: pais[chave] || null, chave, itens: [] });
            mapa.get(chave)!.itens.push(linha);
        }
        return [...mapa.values()].sort((a, b) => {
            if (!a.pai) return 1;
            if (!b.pai) return -1;
            return a.pai.date.getTime() - b.pai.date.getTime();
        });
    }, [filtradas, pais]);

    /**
     * Janela da linha de tempo: de hoje-7 ate a ultima data que aparece na tela.
     *
     * Comeca uma semana atras para o atraso ficar VISIVEL - uma barra que termina
     * antes do inicio da janela nao existiria no desenho, e atraso e justamente o
     * que precisa aparecer.
     */
    const janela = useMemo(() => {
        const hoje = zerar(new Date());
        let fim = hoje.getTime() + 14 * DIA;
        for (const g of grupos) {
            if (g.pai) fim = Math.max(fim, zerar(g.pai.date).getTime());
            for (const l of g.itens) {
                if (l.tarefa.prazo) fim = Math.max(fim, zerar(l.tarefa.prazo).getTime());
            }
        }
        const inicio = hoje.getTime() - 7 * DIA;
        // Teto de 120 dias: um prazo digitado errado (ano 2030) esmagaria tudo o
        // mais na faixa e a linha de tempo perderia utilidade.
        const total = Math.min(fim - inicio, 120 * DIA);
        return { inicio, fim: inicio + total, total, hoje: hoje.getTime() };
    }, [grupos]);

    const pos = (t: number) => Math.max(0, Math.min(100, ((t - janela.inicio) / janela.total) * 100));

    /** Semanas do cabecalho da faixa. Mesma leitura de um cronograma. */
    const semanas = useMemo(() => {
        const out: { esquerda: number; label: string }[] = [];
        const primeiro = new Date(janela.inicio);
        primeiro.setDate(primeiro.getDate() - primeiro.getDay());
        for (let t = primeiro.getTime(); t <= janela.fim; t += 7 * DIA) {
            if (t < janela.inicio) continue;
            out.push({
                esquerda: pos(t),
                label: new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
            });
        }
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [janela]);

    const opcoesCliente: OpcaoDropdown<string>[] = [
        { valor: TODOS, label: 'Todos os clientes' },
        ...empresas.map(e => ({ valor: e.id, label: e.nome }))
    ];
    const opcoesPessoa: OpcaoDropdown<string>[] = [
        { valor: TODOS, label: 'Toda a equipe' },
        { valor: SEM_DONO, label: 'Sem responsável', detalhe: 'ninguém pegou' },
        ...equipe.map(p => ({
            valor: p.id,
            label: getDisplayName(p),
            detalhe: p.cargo || undefined,
            adorno: <AvatarBubble pessoa={p} tamanho="xs" anel={false} />
        }))
    ];

    const mudarStatus = async (linha: Linha, status: SubtarefaStatus) => {
        try {
            await atualizarSubtarefa(linha.empresaId, linha.tarefa.id, { status });
        } catch (e) {
            console.error(e);
        }
    };

    const totalAbertas = linhas.length;
    const semPrazo = filtradas.filter(l => !l.tarefa.prazo).length;
    const atrasadas = filtradas.filter(l => situacaoPrazo(l.tarefa.prazo).tone === 'vencido').length;
    const filtrando = filtroCliente !== TODOS || filtroPessoa !== TODOS;

    if (carregando) {
        return <div className="py-16 flex justify-center"><Loader2 className="w-7 h-7 text-[#FABE01] animate-spin" /></div>;
    }

    return (
        <div className="space-y-4 animate-in fade-in">
            {/* FILTROS. Cliente e pessoa sao as duas perguntas que se faz aqui:
                "o que falta no cliente X" e "o que a Maria tem para hoje". */}
            <Card className="p-3.5">
                <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 shrink-0">
                        <Filter className="w-3.5 h-3.5" /> Filtrar
                    </span>
                    <div className="w-[12rem]">
                        <Dropdown<string>
                            compacto
                            valor={filtroCliente}
                            opcoes={opcoesCliente}
                            onSelect={setFiltroCliente}
                            ariaLabel="Filtrar por cliente"
                        />
                    </div>
                    <div className="w-[13rem]">
                        <Dropdown<string>
                            compacto
                            valor={filtroPessoa}
                            opcoes={opcoesPessoa}
                            onSelect={setFiltroPessoa}
                            ariaLabel="Filtrar por responsável"
                        />
                    </div>
                    {filtrando && (
                        <button
                            onClick={() => { setFiltroCliente(TODOS); setFiltroPessoa(TODOS); }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-white px-2 py-1.5 rounded-full hover:bg-white/5 transition-colors"
                        >
                            <X className="w-3 h-3" /> limpar
                        </button>
                    )}

                    <p className="text-[11px] text-zinc-500 sm:ml-auto shrink-0">
                        <span className="text-white font-semibold">{filtradas.length}</span> em aberto
                        {filtrando && ` de ${totalAbertas}`}
                        {atrasadas > 0 && <> · <span className="text-red-400 font-semibold">{atrasadas}</span> atrasada(s)</>}
                        {semPrazo > 0 && <> · <span className="text-zinc-400">{semPrazo}</span> sem prazo</>}
                    </p>
                </div>
            </Card>

            {grupos.length === 0 ? (
                <EmptyState
                    icon={ListChecks}
                    title={filtrando ? 'Nada com esse filtro' : 'Nenhuma tarefa em aberto'}
                    description={filtrando
                        ? 'Troque o cliente ou a pessoa — ou limpe o filtro para ver tudo.'
                        : 'As etapas de cada conteúdo aparecem aqui enquanto não estão feitas. Crie na aba Gestão de um conteúdo.'}
                />
            ) : (
                <div className="space-y-3">
                    {/* CABECALHO DA FAIXA. Fica fora dos grupos para todos os grupos
                        compartilharem a MESMA escala: com uma escala por grupo, duas
                        barras do mesmo tamanho significariam durações diferentes. */}
                    {/* gap-3 e px-4 IGUAIS aos das linhas: com espacamentos
                        diferentes, o rotulo da semana desliza alguns por cento em
                        relacao as barras e a faixa passa a mentir a data. */}
                    <div className="hidden lg:flex items-end gap-3 px-4">
                        <span className="w-[26rem] shrink-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                            Conteúdo e etapas
                        </span>
                        <div className="relative flex-1 h-4">
                            {semanas.map(s => (
                                <span
                                    key={s.label + s.esquerda}
                                    className="absolute -translate-x-1/2 text-[10px] text-zinc-600 whitespace-nowrap"
                                    style={{ left: `${s.esquerda}%` }}
                                >
                                    {s.label}
                                </span>
                            ))}
                            {/* HOJE nomeado. A linha vertical aparece em cada faixa;
                                sem o rotulo, ela e um risco sem significado. */}
                            <span
                                className="absolute -translate-x-1/2 -top-3.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500 whitespace-nowrap"
                                style={{ left: `${pos(janela.hoje)}%` }}
                            >
                                hoje
                            </span>
                        </div>
                    </div>

                    {grupos.map(({ pai, chave, itens }) => {
                        const prazoPai = pai ? situacaoPrazo(pai.date) : null;
                        return (
                            <Card key={chave} className="overflow-hidden">
                                {/* CONTEUDO PAI */}
                                <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                                    <span className="w-8 h-8 shrink-0 rounded-control bg-[#FABE01]/10 text-[#FABE01] flex items-center justify-center">
                                        <Layers className="w-4 h-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-bold text-white truncate">
                                            {pai ? pai.title : 'Carregando o conteúdo...'}
                                        </p>
                                        <p className="text-[11px] text-zinc-500 truncate">
                                            {itens[0].empresaNome}
                                            {pai && ` · publica ${pai.date.toLocaleDateString('pt-BR')}`}
                                            {` · ${itens.length} etapa(s) em aberto`}
                                        </p>
                                    </div>
                                    {prazoPai && (
                                        <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-chip border inline-flex items-center gap-1 ${TONS_PRAZO[prazoPai.tone]}`}>
                                            <CalendarClock className="w-3 h-3" />
                                            {prazoPai.tone === 'vencido' ? `publicação ${prazoPai.label}` : `publica ${prazoPai.label}`}
                                        </span>
                                    )}
                                    {pai && (
                                        <button
                                            onClick={() => onOpenClient(pai.empresaId, pai.empresaNome, 'production', pai.id)}
                                            className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#FABE01] hover:bg-[#FABE01]/10 px-2.5 py-1.5 rounded-full transition-colors"
                                        >
                                            abrir <ArrowRight className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>

                                {/* ETAPAS */}
                                <ul className="divide-y divide-white/5">
                                    {itens.map(linha => {
                                        const { tarefa } = linha;
                                        const info = subtarefaStatusInfo(tarefa.status);
                                        const p = situacaoPrazo(tarefa.prazo);
                                        const pessoa = tarefa.responsavelUid ? indice[tarefa.responsavelUid] : null;

                                        const inicioBarra = Math.min(
                                            zerar(tarefa.criadoEm).getTime(),
                                            tarefa.prazo ? zerar(tarefa.prazo).getTime() : Infinity
                                        );
                                        const fimBarra = tarefa.prazo ? zerar(tarefa.prazo).getTime() : null;

                                        return (
                                            <li key={tarefa.id} className="flex flex-wrap lg:flex-nowrap items-center gap-3 px-4 py-2.5">
                                                <div className="flex items-center gap-2.5 w-full lg:w-[26rem] shrink-0 min-w-0">
                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${info.ponto}`} />
                                                    {pessoa ? (
                                                        <AvatarBubble pessoa={pessoa} tamanho="xs" anel={false} />
                                                    ) : (
                                                        <span className="w-5 h-5 shrink-0 rounded-full border border-dashed border-amber-500/50 text-amber-400 flex items-center justify-center">
                                                            <UserPlus className="w-2.5 h-2.5" />
                                                        </span>
                                                    )}
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block text-[13px] text-zinc-100 truncate">{tarefa.titulo}</span>
                                                        <span className="block text-[10px] text-zinc-600 truncate">
                                                            {pessoa ? getDisplayName(pessoa) : 'sem responsável'}
                                                        </span>
                                                    </span>
                                                    <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-chip border ${TONS_PRAZO[p.tone]}`}>
                                                        {p.label}
                                                    </span>
                                                    <div className="w-[6.5rem] shrink-0 hidden sm:block">
                                                        <Dropdown<SubtarefaStatus>
                                                            compacto
                                                            valor={tarefa.status}
                                                            // "Feita" ENTRA na lista: e a acao
                                                            // mais comum aqui, e ela tira a
                                                            // etapa da fila - fechar tarefa e o
                                                            // objetivo da tela.
                                                            opcoes={SUBTAREFA_STATUS.map(s => ({
                                                                valor: s.id,
                                                                label: s.label,
                                                                adorno: <span className={`w-1.5 h-1.5 rounded-full ${s.ponto}`} />
                                                            }))}
                                                            onSelect={s => mudarStatus(linha, s)}
                                                            ariaLabel={`Status de ${tarefa.titulo}`}
                                                        />
                                                    </div>
                                                </div>

                                                {/* BARRA: da criacao ao prazo. Sem prazo nao
                                                    desenha - inventar um fim seria desenhar
                                                    informacao que nao existe. */}
                                                <div className="hidden lg:block relative flex-1 h-6 rounded-chip bg-white/[0.02]">
                                                    {/* hoje */}
                                                    <span
                                                        className="absolute top-0 bottom-0 w-px bg-white/20"
                                                        style={{ left: `${pos(janela.hoje)}%` }}
                                                    />
                                                    {fimBarra !== null ? (
                                                        <span
                                                            title={`${tarefa.criadoEm.toLocaleDateString('pt-BR')} → ${tarefa.prazo!.toLocaleDateString('pt-BR')}`}
                                                            className={`absolute top-1.5 bottom-1.5 rounded-chip ${
                                                                p.tone === 'vencido' ? 'bg-red-500/70'
                                                                    : p.tone === 'hoje' ? 'bg-[#FABE01]'
                                                                        : tarefa.status === 'fazendo' ? 'bg-[#FABE01]/60' : 'bg-zinc-600'
                                                            }`}
                                                            style={{
                                                                left: `${pos(inicioBarra)}%`,
                                                                width: `${Math.max(1.5, pos(fimBarra) - pos(inicioBarra))}%`
                                                            }}
                                                        />
                                                    ) : (
                                                        <span className="absolute inset-y-0 left-2 flex items-center text-[10px] text-zinc-600">
                                                            sem prazo definido
                                                        </span>
                                                    )}
                                                    {/* PUBLICACAO: o prazo do pai, na mesma
                                                        escala - e contra ele que a etapa existe. */}
                                                    {pai && (
                                                        <span
                                                            title={`Publicação: ${pai.date.toLocaleDateString('pt-BR')}`}
                                                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-[#FABE01] ring-2 ring-[#1A1A1A]"
                                                            style={{ left: `${pos(zerar(pai.date).getTime())}%` }}
                                                        />
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </Card>
                        );
                    })}
                </div>
            )}

            {empresas.length > LIMITE_CLIENTES && (
                <p className="text-[10px] text-zinc-600 leading-relaxed px-1">
                    Mostrando os {LIMITE_CLIENTES} primeiros clientes. Acima disso o certo passa a ser
                    um contador agregado, não mais uma assinatura por cliente.
                </p>
            )}
        </div>
    );
};

export default TasksView;
