import React, { useState, useEffect, useMemo } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db } from '../utils/firebase';
import { CalendarEvent, View } from '../types';
import { getClientStage, CLIENT_STAGES, needsClientAction } from '../utils/eventState';
import { janelaRevisao } from '../utils/sla';
import { formatTime } from '../utils/date';
import { PageHeader, StatTile, Card } from './ui';
import FeedPreview from './FeedPreview';
import { subscribeThumbs } from '../utils/midia';
import {
    Calendar, ThumbsUp, CheckCircle2, Loader2, ArrowRight, Clock, AlertTriangle
} from 'lucide-react';

interface ClientHomeViewProps {
    empresaId: string;
    empresaNome?: string | null;
    /** Primeiro nome de quem entrou, para a saudacao. */
    userName?: string | null;
    /** Leva para o calendario, opcionalmente num post especifico. */
    onIrParaCalendario: (view: View) => void;
}

/**
 * Primeira tela do portal do CLIENTE.
 *
 * O portal abria direto no calendario: uma grade de mes, sem dizer se havia algo
 * esperando por ele. A agencia tinha painel com numeros; o cliente nao tinha
 * nada equivalente - ele precisava varrer o mes com o olho para descobrir se
 * tinha trabalho.
 *
 * O QUE APARECE AQUI E SO O LADO DELE. Nada de prazo de producao, atraso da
 * equipe ou financeiro: essas coisas nao passam por esta tela em nenhuma
 * hipotese. Ver utils/sla.ts sobre a separacao por dono.
 */
const ClientHomeView: React.FC<ClientHomeViewProps> = ({
    empresaId, empresaNome, userName, onIrParaCalendario
}) => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [thumbs, setThumbs] = useState<Record<string, string>>({});
    const [carregando, setCarregando] = useState(true);

    useEffect(() => {
        if (!empresaId) return;
        setCarregando(true);
        const unsubscribe = db.collection('empresas').doc(empresaId).collection('events')
            .onSnapshot(
                snapshot => {
                    setEvents(snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            ...data,
                            id: doc.id,
                            date: (data.date as firebase.firestore.Timestamp)?.toDate() || new Date(),
                            approvalAt: (data.approvalAt as firebase.firestore.Timestamp | undefined)?.toDate() || null
                        } as CalendarEvent;
                    }));
                    setCarregando(false);
                },
                erro => { console.error(erro); setCarregando(false); }
            );
        return unsubscribe;
    }, [empresaId]);

    useEffect(() => {
        if (!empresaId) return;
        return subscribeThumbs(empresaId, setThumbs);
    }, [empresaId]);

    const resumo = useMemo(() => {
        const agora = new Date();
        const noMes = events.filter(e =>
            e.date.getMonth() === agora.getMonth() && e.date.getFullYear() === agora.getFullYear()
        );

        // Fila de aprovacao ordenada pelo que FECHA A JANELA primeiro, nao pela
        // data de publicacao. O que vence antes e o que ele precisa olhar antes -
        // e um reel de daqui a 3 dias fecha a janela antes de uma imagem de
        // amanha.
        const aprovar = events
            .filter(needsClientAction)
            .sort((a, b) => janelaRevisao(a).limite.getTime() - janelaRevisao(b).limite.getTime());

        const proximos = events
            .filter(e => e.date >= agora && e.status !== 'Cancelado')
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .slice(0, 4);

        return {
            noMes: noMes.length,
            publicados: events.filter(e => e.status === 'Postado').length,
            aprovados: events.filter(e => getClientStage(e) === 'aprovado').length,
            aprovar,
            proximos
        };
    }, [events]);

    const primeiroNome = (userName || '').trim().split(/\s+/)[0];

    if (carregando) {
        return (
            <div className="py-20 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-[#FABE01] animate-spin" />
                <p className="text-zinc-500 text-sm">Carregando seu painel...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <PageHeader
                title={primeiroNome ? `Olá, ${primeiroNome}` : (empresaNome || 'Seu portal')}
                subtitle={
                    resumo.aprovar.length > 0
                        ? `${resumo.aprovar.length} publicação(ões) esperando sua aprovação.`
                        : 'Nada esperando por você agora. Tudo em andamento com a equipe.'
                }
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatTile
                    label="Esperando você"
                    value={resumo.aprovar.length}
                    icon={ThumbsUp}
                    tone={resumo.aprovar.length > 0 ? 'brand' : 'positive'}
                    hint={resumo.aprovar.length > 0 ? 'Aprove ou peça ajuste' : 'Nada pendente'}
                    onClick={resumo.aprovar.length > 0 ? () => onIrParaCalendario(View.CALENDAR) : undefined}
                />
                <StatTile label="Publicações no mês" value={resumo.noMes} icon={Calendar} />
                <StatTile label="Aprovados" value={resumo.aprovados} icon={CheckCircle2} tone="positive" />
                <StatTile label="Já publicados" value={resumo.publicados} icon={CheckCircle2} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
                <div className="space-y-4 min-w-0">
                    {/* FILA DE APROVACAO - a razao de existir desta tela. */}
                    {resumo.aprovar.length > 0 && (
                        <Card className="p-5">
                            <div className="flex items-center justify-between gap-2 mb-4">
                                <p className="text-sm font-semibold text-white">Esperando sua aprovação</p>
                                <button
                                    onClick={() => onIrParaCalendario(View.CALENDAR)}
                                    className="text-[11px] font-semibold text-[#FABE01] hover:underline shrink-0"
                                >
                                    Ver no calendário
                                </button>
                            </div>
                            <ul className="space-y-2.5">
                                {resumo.aprovar.slice(0, 5).map(event => {
                                    const janela = janelaRevisao(event);
                                    return (
                                        <li key={event.id} className="flex items-start gap-3">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#FABE01] shrink-0 mt-2" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm text-zinc-200 leading-snug truncate">
                                                    {event.title || '(sem título)'}
                                                </p>
                                                <p className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                                    {event.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                                    {formatTime(event.date) && <>· {formatTime(event.date)}</>}
                                                    <span className="text-zinc-700">·</span>
                                                    {/* A janela e ANUNCIADA aqui tambem: quem so
                                                        olha esta tela precisa saber do prazo sem
                                                        abrir post por post. */}
                                                    {janela.aberta ? (
                                                        <span className={janela.dias <= 1 ? 'text-amber-400' : ''}>
                                                            <Clock className="w-3 h-3 inline mr-0.5" />
                                                            ajuste até {janela.limite.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-500">
                                                            <AlertTriangle className="w-3 h-3 inline mr-0.5" />
                                                            prazo de ajuste encerrado
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                            {resumo.aprovar.length > 5 && (
                                <p className="text-[11px] text-zinc-600 mt-3">
                                    +{resumo.aprovar.length - 5} no calendário
                                </p>
                            )}
                        </Card>
                    )}

                    {/* PROXIMAS PUBLICACOES */}
                    <Card className="p-5">
                        <p className="text-sm font-semibold text-white mb-4">Próximas publicações</p>
                        {resumo.proximos.length === 0 ? (
                            <p className="text-zinc-500 text-sm">Nada agendado para os próximos dias.</p>
                        ) : (
                            <ul className="space-y-3">
                                {resumo.proximos.map(event => {
                                    const stage = CLIENT_STAGES[getClientStage(event)];
                                    return (
                                        <li key={event.id} className="flex items-start gap-3">
                                            <span className="shrink-0 w-10 text-center">
                                                <span className="block text-sm font-bold text-white leading-none">
                                                    {event.date.getDate()}
                                                </span>
                                                <span className="block text-[9px] text-zinc-500 uppercase mt-0.5">
                                                    {event.date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                                                </span>
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm text-zinc-200 leading-snug truncate">
                                                    {event.title || '(sem título)'}
                                                </p>
                                                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${stage.bg} ${stage.text} ${stage.border}`}>
                                                        {stage.label}
                                                    </span>
                                                    {formatTime(event.date) && (
                                                        <span className="text-[10px] text-zinc-600">{formatTime(event.date)}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        <button
                            onClick={() => onIrParaCalendario(View.CALENDAR)}
                            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                        >
                            Abrir calendário <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </Card>
                </div>

                <div className="w-full max-w-[340px] mx-auto xl:mx-0">
                    <FeedPreview
                        events={events}
                        empresaNome={empresaNome || empresaId}
                        thumbs={thumbs}
                    />
                </div>
            </div>
        </div>
    );
};

export default ClientHomeView;
