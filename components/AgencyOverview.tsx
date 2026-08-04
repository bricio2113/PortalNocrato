import React, { useState, useEffect, useMemo } from 'react';
import { Empresa, UserProfile } from '../types';
import { PendingCounts } from '../utils/posts';
import { ClientStage, CLIENT_STAGES, stageView } from '../utils/eventState';
import { Subtarefa, subscribeSubtarefas, SUBTAREFA_STATUS } from '../utils/subtarefas';
import TarefasAbertasModal, { TarefaAberta } from './TarefasAbertasModal';
import { indexarPorUid } from '../utils/equipe';
import { getDisplayName } from '../utils/avatar';
import { AvatarBubble } from './AvatarBubble';
import { StatTile } from './ui';
import {
    Building2, Users, AlertTriangle, MessageSquareWarning, Shield, ArrowRight,
    CalendarClock, ListChecks, Check, Archive, ImageOff, Layers
} from 'lucide-react';

/** Ordem em que os estagios sao lidos: da esquerda (comeco) para a direita. */
const ORDEM: ClientStage[] = ['em_producao', 'aguardando_voce', 'aprovado', 'publicado', 'cancelado'];

/** Cor da fatia na barra. As classes de CLIENT_STAGES sao de texto/borda. */
const BARRA: Record<ClientStage, string> = {
    em_producao: 'bg-zinc-600',
    aguardando_voce: 'bg-[#FABE01]',
    aprovado: 'bg-emerald-500',
    publicado: 'bg-green-600',
    cancelado: 'bg-red-500/60'
};

interface AgencyOverviewProps {
    empresas: Empresa[];
    users: UserProfile[];
    pendingByEmpresa: Record<string, PendingCounts>;
    souAdmin: boolean;
    semVinculo: number;
    /**
     * Abre o cliente. `eventId` abre JA no conteudo indicado - e o que faz a lista
     * de tarefas levar direto na tarefa, em vez de largar a pessoa no quadro.
     */
    onOpenClient: (empresaId: string, nome: string, section?: 'calendar' | 'production', eventId?: string) => void;
    onIrParaClientes: () => void;
    onIrParaEquipe: () => void;
}

/** Cartao de painel. Titulo, acao opcional no canto, corpo. */
const Painel: React.FC<{
    titulo: string;
    icone: React.ElementType;
    acao?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}> = ({ titulo, icone: Icone, acao, className = '', children }) => (
    <section className={`bg-[#1A1A1A] border border-white/5 rounded-card flex flex-col ${className}`}>
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
            <Icone className="w-4 h-4 text-[#FABE01] shrink-0" />
            <h2 className="text-sm font-bold text-white tracking-tight">{titulo}</h2>
            {acao && <div className="ml-auto shrink-0">{acao}</div>}
        </div>
        <div className="p-5 flex-1">{children}</div>
    </section>
);

/**
 * Barra de proporcao.
 *
 * Uma barra em vez de cinco numeros: a pergunta "como esta o andamento" e sobre
 * PROPORCAO - quanto ja saiu, quanto esta com o cliente, quanto ainda e nosso -
 * e proporcao se le de relance numa barra e nao numa lista de inteiros.
 */
const Barra: React.FC<{ fatias: { chave: string; n: number; cor: string }[]; total: number }> = ({ fatias, total }) => (
    <div className="flex h-2.5 rounded-full overflow-hidden bg-white/5 gap-px">
        {total === 0
            ? <div className="flex-1" />
            : fatias.filter(f => f.n > 0).map(f => (
                <div
                    key={f.chave}
                    className={f.cor}
                    style={{ width: `${(f.n / total) * 100}%` }}
                    title={`${f.chave}: ${f.n}`}
                />
            ))}
    </div>
);

/**
 * VISAO GERAL DA AGENCIA - o andamento de tudo, num lugar.
 *
 * Antes eram cinco numeros e um aviso. Os numeros nao respondiam a pergunta que
 * se faz ao abrir o painel de manha - "como estao as coisas?" -, porque numero
 * absoluto sem proporcao nao diz se 306 e muito ou pouco, nem onde esta o
 * gargalo. Aqui: proporcao dos conteudos por estagio, carga da equipe, o que sai
 * nos proximos dias, e a fila de atencao com caminho para cada item.
 */
const AgencyOverview: React.FC<AgencyOverviewProps> = ({
    empresas, users, pendingByEmpresa, souAdmin, semVinculo,
    onOpenClient, onIrParaClientes, onIrParaEquipe
}) => {
    /**
     * Subtarefas de todos os clientes.
     *
     * Uma assinatura por cliente - a colecao e por cliente, e nao existe consulta
     * entre colecoes no Firestore. Com o teto abaixo o custo e conhecido; acima
     * disso o certo passa a ser um contador agregado gravado junto da subtarefa.
     */
    const LIMITE_CLIENTES = 12;
    const [subtarefas, setSubtarefas] = useState<Record<string, Subtarefa[]>>({});
    /** Lista de tarefas abertas aberta sobre a tela. */
    const [verTarefas, setVerTarefas] = useState(false);

    useEffect(() => {
        if (empresas.length === 0) return;
        const cancelamentos = empresas.slice(0, LIMITE_CLIENTES).map(empresa =>
            subscribeSubtarefas(empresa.id, lista =>
                setSubtarefas(prev => ({ ...prev, [empresa.id]: lista }))
            )
        );
        return () => cancelamentos.forEach(fn => fn());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresas.map(e => e.id).join(',')]);

    const equipe = useMemo(() => users.filter(u => u.role === 'agencia'), [users]);
    const indice = useMemo(() => indexarPorUid(equipe), [equipe]);

    /** Soma de tudo o que chega por cliente. */
    const total = useMemo(() => {
        const zero = {
            conteudos: 0, noMes: 0, publicados: 0, semCapa: 0,
            atrasados: 0, atrasadosCliente: 0, atrasadosAntigos: 0,
            ajustes: 0, aguardandoCliente: 0,
            porEstagio: { em_producao: 0, aguardando_voce: 0, aprovado: 0, publicado: 0, cancelado: 0 } as Record<ClientStage, number>
        };
        for (const empresa of empresas) {
            const c = pendingByEmpresa[empresa.id];
            if (!c) continue;
            zero.conteudos += c.total;
            zero.noMes += c.noMes;
            zero.publicados += c.publicados;
            zero.semCapa += c.semCapa;
            zero.atrasados += c.atrasados;
            zero.atrasadosCliente += c.atrasadosCliente;
            zero.atrasadosAntigos += c.atrasadosAntigos;
            zero.ajustes += c.aguardandoAgencia;
            zero.aguardandoCliente += c.aguardandoCliente;
            ORDEM.forEach(e => { zero.porEstagio[e] += c.porEstagio?.[e] || 0; });
        }
        return zero;
    }, [empresas, pendingByEmpresa]);

    /** Tarefas da equipe, somando os clientes. */
    const tarefas = useMemo(() => {
        const todas = Object.values(subtarefas).flat();
        const porStatus = { aberta: 0, fazendo: 0, feita: 0 };
        const porPessoa: Record<string, number> = {};
        let semDono = 0;
        for (const s of todas) {
            porStatus[s.status] = (porStatus[s.status] || 0) + 1;
            if (s.status === 'feita') continue;
            if (s.responsavelUid) porPessoa[s.responsavelUid] = (porPessoa[s.responsavelUid] || 0) + 1;
            else semDono++;
        }
        const carga = Object.entries(porPessoa)
            .map(([uid, n]) => ({ pessoa: indice[uid], n }))
            .filter(c => c.pessoa)
            .sort((a, b) => b.n - a.n);
        return { total: todas.length, porStatus, carga, semDono, abertas: porStatus.aberta + porStatus.fazendo };
    }, [subtarefas, indice]);

    /**
     * Tarefas abertas com o cliente de cada uma, para a lista clicavel.
     *
     * Separada de `tarefas` de proposito: aquele calculo produz CONTAGEM, e a
     * contagem nao guarda de qual cliente cada tarefa veio - informacao que a lista
     * precisa para poder abrir o conteudo certo.
     */
    const tarefasAbertas = useMemo<TarefaAberta[]>(() => {
        const lista: TarefaAberta[] = [];
        for (const empresa of empresas) {
            for (const tarefa of subtarefas[empresa.id] || []) {
                if (tarefa.status === 'feita') continue;
                lista.push({ empresaId: empresa.id, empresaNome: empresa.nome, tarefa });
            }
        }
        return lista;
    }, [empresas, subtarefas]);

    /** Proximas entregas de todos os clientes, misturadas e em ordem. */
    const proximas = useMemo(() => {
        const lista: { empresaId: string; empresaNome: string; id: string; title: string; date: Date; type?: string }[] = [];
        for (const empresa of empresas) {
            for (const p of pendingByEmpresa[empresa.id]?.proximas || []) {
                lista.push({ ...p, empresaId: empresa.id, empresaNome: empresa.nome });
            }
        }
        return lista.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 6);
    }, [empresas, pendingByEmpresa]);

    /** Clientes com algo pendente, os mais urgentes primeiro. */
    const clientesEmOrdem = useMemo(() =>
        [...empresas].sort((a, b) => {
            const ca = pendingByEmpresa[a.id];
            const cb = pendingByEmpresa[b.id];
            const peso = (c?: PendingCounts) => (c?.atrasados || 0) * 10 + (c?.aguardandoAgencia || 0) * 5;
            return peso(cb) - peso(ca);
        }), [empresas, pendingByEmpresa]);

    const atencao = [
        {
            chave: 'ajustes',
            n: total.ajustes,
            titulo: 'Ajuste pedido pelo cliente',
            detalhe: 'Alguém do outro lado está esperando a equipe voltar.',
            icone: MessageSquareWarning,
            tom: 'atencao' as const,
            ir: onIrParaClientes
        },
        {
            chave: 'atrasados',
            n: total.atrasados,
            titulo: 'Produção vencida',
            detalhe: 'Passou da data de publicação e ainda está com a equipe.',
            icone: AlertTriangle,
            tom: 'erro' as const,
            ir: onIrParaClientes
        },
        {
            chave: 'vinculo',
            n: semVinculo,
            titulo: 'Conta aguardando vínculo',
            detalhe: souAdmin
                ? 'Sem cliente, essas contas entram e veem só um aviso.'
                : 'Só administradores vinculam contas a um cliente.',
            icone: Shield,
            tom: 'atencao' as const,
            ir: onIrParaEquipe
        },
        {
            chave: 'semCapa',
            n: total.semCapa,
            titulo: 'Sem capa definida',
            detalhe: 'A prévia do feed fica com um espaço vazio no lugar da peça.',
            icone: ImageOff,
            tom: 'neutro' as const,
            ir: onIrParaClientes
        },
        {
            chave: 'antigos',
            n: total.atrasadosAntigos,
            titulo: 'Backlog antigo',
            // Isto nao e trabalho: e cadastro para fechar. Desde que o prazo
            // passou a ser a data de publicacao, todo post de meses atras que
            // ninguem marcou como Postado ou Cancelado conta como vencido.
            detalhe: 'Venceram há mais de 30 dias. Marque como publicado ou cancele para sair da fila.',
            icone: Archive,
            tom: 'neutro' as const,
            ir: onIrParaClientes
        }
    ].filter(a => a.n > 0);

    const TONS = {
        erro: 'border-red-500/25 bg-red-500/[0.06] text-red-400',
        atencao: 'border-[#FABE01]/25 bg-[#FABE01]/[0.06] text-[#FABE01]',
        neutro: 'border-white/10 bg-white/[0.02] text-zinc-300'
    };

    return (
        <div className="space-y-4 animate-in fade-in">
            {/* NUMEROS DO TOPO. "Produção atrasada" saiu de um numero unico que
                somava backlog historico com atraso de hoje - 306 nao dizia nada.
                Aqui o que aparece e o que exige acao esta semana. */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                <StatTile label="Clientes" value={empresas.length} icon={Building2} tone="brand" hint={`${total.conteudos} conteúdos na agenda`} />
                <StatTile
                    label="Produção vencida"
                    value={total.atrasados}
                    icon={AlertTriangle}
                    tone={total.atrasados > 0 ? 'attention' : 'positive'}
                    hint={total.atrasados > 0 ? 'Com a equipe, passou da data' : 'Nada vencido com a equipe'}
                    onClick={total.atrasados > 0 ? onIrParaClientes : undefined}
                />
                <StatTile
                    label="Ajustes pedidos"
                    value={total.ajustes}
                    icon={MessageSquareWarning}
                    tone={total.ajustes > 0 ? 'attention' : 'positive'}
                    hint={total.ajustes > 0 ? 'O cliente está esperando' : 'Nada pendente com a equipe'}
                    onClick={total.ajustes > 0 ? onIrParaClientes : undefined}
                />
                <StatTile
                    label="Tarefas abertas"
                    value={tarefas.abertas}
                    icon={ListChecks}
                    hint={tarefas.semDono > 0 ? `${tarefas.semDono} sem responsável` : 'Todas com responsável'}
                    // Numero que nao levava a lugar nenhum: dizia 7 e nao dizia
                    // quais, de quem, nem onde.
                    onClick={tarefas.abertas > 0 ? () => setVerTarefas(true) : undefined}
                />
                <StatTile
                    label="Aguardando vínculo"
                    value={semVinculo}
                    icon={Shield}
                    tone={semVinculo > 0 ? 'attention' : 'positive'}
                    hint={semVinculo === 0 ? 'Todo mundo com acesso liberado' : 'Não conseguem usar o portal'}
                    onClick={semVinculo > 0 && souAdmin ? onIrParaEquipe : undefined}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                {/* ANDAMENTO DOS CONTEUDOS */}
                <Painel titulo="Andamento dos conteúdos" icone={Layers} className="lg:col-span-2">
                    {total.conteudos === 0 ? (
                        <p className="text-xs text-zinc-500 leading-relaxed">
                            Nenhum conteúdo na agenda ainda. Crie a primeira publicação dentro de um cliente.
                        </p>
                    ) : (
                        <>
                            <Barra
                                total={total.conteudos}
                                fatias={ORDEM.map(e => ({
                                    chave: stageView(e, 'agencia').label,
                                    n: total.porEstagio[e],
                                    cor: BARRA[e]
                                }))}
                            />

                            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3.5">
                                {ORDEM.filter(e => total.porEstagio[e] > 0).map(e => (
                                    <span key={e} className="flex items-center gap-1.5 text-[11px]">
                                        <span className={`w-2 h-2 rounded-full ${BARRA[e]}`} />
                                        <span className="text-zinc-300 font-semibold">{total.porEstagio[e]}</span>
                                        <span className="text-zinc-500">{stageView(e, 'agencia').label}</span>
                                    </span>
                                ))}
                            </div>

                            {/* POR CLIENTE: a mesma barra, cliente por cliente. E
                                onde se ve QUAL cliente esta puxando o atraso, que o
                                total sozinho nunca disse. */}
                            <ul className="mt-5 space-y-1 -mx-2">
                                {clientesEmOrdem.map(empresa => {
                                    const c = pendingByEmpresa[empresa.id];
                                    const subs = subtarefas[empresa.id] || [];
                                    const abertas = subs.filter(s => s.status !== 'feita').length;
                                    return (
                                        <li key={empresa.id}>
                                            <button
                                                onClick={() => onOpenClient(empresa.id, empresa.nome)}
                                                className="w-full flex items-center gap-3 px-2 py-2 rounded-control hover:bg-white/[0.03] transition-colors group text-left"
                                            >
                                                <span className="w-8 h-8 shrink-0 rounded-control bg-[#FABE01]/10 text-[#FABE01] text-[11px] font-bold flex items-center justify-center">
                                                    {empresa.nome.slice(0, 2).toUpperCase()}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-center gap-2">
                                                        <span className="text-[13px] font-semibold text-white truncate group-hover:text-[#FABE01] transition-colors">
                                                            {empresa.nome}
                                                        </span>
                                                        {(c?.atrasados || 0) > 0 && (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-chip bg-red-500/15 text-red-400 shrink-0">
                                                                {c!.atrasados} vencido{c!.atrasados > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                        {(c?.aguardandoAgencia || 0) > 0 && (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-chip bg-[#FABE01]/15 text-[#FABE01] shrink-0">
                                                                {c!.aguardandoAgencia} ajuste{c!.aguardandoAgencia > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="block mt-1.5">
                                                        <Barra
                                                            total={c?.total || 0}
                                                            fatias={ORDEM.map(e => ({
                                                                chave: stageView(e, 'agencia').label,
                                                                n: c?.porEstagio?.[e] || 0,
                                                                cor: BARRA[e]
                                                            }))}
                                                        />
                                                    </span>
                                                </span>
                                                <span className="shrink-0 text-right">
                                                    <span className="block text-[11px] text-zinc-400">
                                                        {c ? `${c.total} conteúdos` : '—'}
                                                    </span>
                                                    <span className="block text-[10px] text-zinc-600">
                                                        {abertas > 0 ? `${abertas} tarefa(s) aberta(s)` : 'sem tarefa aberta'}
                                                    </span>
                                                </span>
                                                <ArrowRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-[#FABE01] shrink-0 transition-colors" />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    )}
                </Painel>

                {/* TAREFAS DA EQUIPE */}
                <Painel titulo="Tarefas da equipe" icone={ListChecks}>
                    {tarefas.total === 0 ? (
                        <p className="text-xs text-zinc-500 leading-relaxed">
                            Nenhuma subtarefa criada. Abra um conteúdo no quadro de produção e quebre em etapas —
                            roteiro, design, revisão.
                        </p>
                    ) : (
                        <>
                            <div className="grid grid-cols-3 gap-px bg-white/5 rounded-control overflow-hidden mb-4">
                                {SUBTAREFA_STATUS.map(s => (
                                    <div key={s.id} className="bg-[#111111] px-3 py-2.5">
                                        <p className="text-lg font-bold text-white leading-none">{tarefas.porStatus[s.id]}</p>
                                        <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                                            <span className={`w-1.5 h-1.5 rounded-full ${s.ponto}`} />
                                            {s.label}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">
                                Quem está com o quê
                            </p>
                            {tarefas.carga.length === 0 && tarefas.semDono === 0 ? (
                                <p className="text-xs text-zinc-500">Nada em aberto.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {tarefas.carga.slice(0, 5).map(({ pessoa, n }) => (
                                        <li key={pessoa.id} className="flex items-center gap-2.5">
                                            <AvatarBubble pessoa={pessoa} tamanho="sm" anel={false} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-xs text-zinc-200 truncate">{getDisplayName(pessoa)}</span>
                                                {pessoa.cargo && <span className="block text-[10px] text-zinc-600 truncate">{pessoa.cargo}</span>}
                                            </span>
                                            <span className="shrink-0 text-[11px] font-bold text-zinc-300 bg-white/5 px-2 py-0.5 rounded-full">
                                                {n}
                                            </span>
                                        </li>
                                    ))}
                                    {tarefas.semDono > 0 && (
                                        <li className="flex items-center gap-2.5 pt-2 border-t border-white/5">
                                            <span className="w-6 h-6 rounded-full border border-dashed border-white/20 flex items-center justify-center shrink-0">
                                                <Users className="w-3 h-3 text-zinc-500" />
                                            </span>
                                            <span className="text-xs text-amber-400/90 flex-1">Sem responsável</span>
                                            <span className="shrink-0 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                                                {tarefas.semDono}
                                            </span>
                                        </li>
                                    )}
                                </ul>
                            )}
                        </>
                    )}
                </Painel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                {/* PROXIMAS ENTREGAS */}
                <Painel titulo="Próximas entregas" icone={CalendarClock}>
                    {proximas.length === 0 ? (
                        <p className="text-xs text-zinc-500 leading-relaxed">
                            Nada agendado à frente em nenhum cliente.
                        </p>
                    ) : (
                        <ul className="-mx-2 divide-y divide-white/[0.04]">
                            {proximas.map(p => {
                                const dias = Math.ceil((p.date.getTime() - Date.now()) / 86400000);
                                return (
                                    <li key={`${p.empresaId}-${p.id}`}>
                                        <button
                                            onClick={() => onOpenClient(p.empresaId, p.empresaNome, 'calendar')}
                                            className="w-full flex items-center gap-3 px-2 py-2.5 rounded-control hover:bg-white/[0.03] transition-colors group text-left"
                                        >
                                            <span className="w-10 shrink-0 text-center">
                                                <span className="block text-sm font-bold text-white leading-none">
                                                    {p.date.getDate()}
                                                </span>
                                                <span className="block text-[9px] uppercase text-zinc-500 mt-0.5">
                                                    {p.date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                                                </span>
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[13px] text-zinc-100 truncate">{p.title}</span>
                                                <span className="block text-[10px] text-zinc-500 truncate">
                                                    {p.empresaNome}{p.type ? ` · ${p.type}` : ''}
                                                </span>
                                            </span>
                                            <span className="shrink-0 text-[10px] text-zinc-500">
                                                {dias <= 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias}d`}
                                            </span>
                                            <ArrowRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-[#FABE01] shrink-0 transition-colors" />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Painel>

                {/* PRECISA DE ATENCAO */}
                <Painel titulo="Precisa de atenção" icone={AlertTriangle}>
                    {atencao.length === 0 ? (
                        <div className="text-center py-6">
                            <span className="w-10 h-10 mx-auto mb-2.5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                <Check className="w-5 h-5 text-emerald-400" />
                            </span>
                            <p className="text-white font-semibold text-sm">Nada exigindo ação</p>
                            <p className="text-zinc-500 text-xs mt-1">
                                Sem ajuste em aberto, sem prazo vencido e todo mundo com acesso.
                            </p>
                        </div>
                    ) : (
                        <ul className="-mx-2 divide-y divide-white/[0.04]">
                            {atencao.map(a => {
                                const Icone = a.icone;
                                return (
                                    <li key={a.chave}>
                                        <button
                                            onClick={a.ir}
                                            className="w-full flex items-center gap-3 px-2 py-2.5 rounded-control hover:bg-white/[0.03] transition-colors group text-left"
                                        >
                                            <span className={`w-9 h-9 shrink-0 rounded-control border flex items-center justify-center text-[13px] font-bold ${TONS[a.tom]}`}>
                                                {a.n}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-white">
                                                    <Icone className="w-3 h-3 text-zinc-500 shrink-0" />
                                                    {a.titulo}
                                                </span>
                                                <span className="block text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                                                    {a.detalhe}
                                                </span>
                                            </span>
                                            <ArrowRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-[#FABE01] shrink-0 transition-colors" />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Painel>
            </div>

            {verTarefas && (
                <TarefasAbertasModal
                    itens={tarefasAbertas}
                    indice={indice}
                    onAbrir={(empresaId, nome, eventId) => {
                        setVerTarefas(false);
                        onOpenClient(empresaId, nome, 'production', eventId);
                    }}
                    onFechar={() => setVerTarefas(false)}
                />
            )}
        </div>
    );
};

export default AgencyOverview;
