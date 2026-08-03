import React, { useState, useEffect } from 'react';
import { HistoricoEntrada, HistoricoTipo, subscribeHistorico } from '../utils/historico';
import { getInitials } from '../utils/avatar';
import { formatTime } from '../utils/date';
import {
    History, Loader2, AlertTriangle, Sparkles, ArrowRight,
    CalendarClock, ThumbsUp, MessageSquareWarning, ImagePlus, Clock
} from 'lucide-react';

interface PostTimelineProps {
    empresaId: string;
    eventId: string;
    userRole: 'agencia' | 'cliente';
}

const ICONES: Record<HistoricoTipo, React.ElementType> = {
    criado: Sparkles,
    status: ArrowRight,
    data: CalendarClock,
    aprovacao: ThumbsUp,
    midia: ImagePlus,
    prazo: Clock
};

const formatarData = (iso?: string | null) => {
    if (!iso) return 'sem data';
    const d = new Date(iso);
    const hora = formatTime(d);
    return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}${hora ? ` às ${hora}` : ''}`;
};

/**
 * Frase de cada entrada.
 *
 * Texto pronto, e nao "campo X: de A para B". O historico e lido pelo CLIENTE, e
 * nome de campo do banco na tela dele nao comunica nada.
 */
function descrever(e: HistoricoEntrada): { texto: string; destaque?: string } {
    switch (e.tipo) {
        case 'criado':
            return { texto: 'Publicação criada', destaque: e.para || undefined };
        case 'status':
            return { texto: `Status: ${e.de || '—'} → ${e.para || '—'}` };
        case 'data':
            return { texto: `Publicação remarcada de ${formatarData(e.de)} para ${formatarData(e.para)}` };
        case 'prazo':
            return {
                texto: e.para
                    ? `Prazo de produção: ${formatarData(e.para)}`
                    : 'Prazo de produção removido'
            };
        case 'midia': {
            const antes = Number(e.de || 0);
            const agora = Number(e.para || 0);
            return {
                texto: agora > antes
                    ? `${agora - antes} arquivo(s) enviado(s)`
                    : `${antes - agora} arquivo(s) removido(s)`
            };
        }
        case 'aprovacao':
            if (e.para === 'aprovado') return { texto: 'Aprovado' };
            if (e.para === 'ajuste_solicitado') return { texto: 'Ajuste solicitado' };
            return { texto: 'Voltou para aprovação' };
    }
}

const TOM: Partial<Record<string, string>> = {
    aprovado: 'text-emerald-400',
    ajuste_solicitado: 'text-amber-400'
};

/**
 * Linha do tempo de uma publicacao.
 *
 * Responde "e o meu post?" sem ninguem precisar perguntar no WhatsApp - que era
 * o unico jeito antes, porque a tela mostrava um estado sem passado.
 */
const PostTimeline: React.FC<PostTimelineProps> = ({ empresaId, eventId, userRole }) => {
    const [entradas, setEntradas] = useState<HistoricoEntrada[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState(false);

    useEffect(() => {
        if (!empresaId || !eventId) return;
        setCarregando(true);
        return subscribeHistorico(
            empresaId, eventId, userRole,
            dados => { setEntradas(dados); setCarregando(false); },
            () => { setErro(true); setCarregando(false); }
        );
    }, [empresaId, eventId, userRole]);

    return (
        <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-500 mb-3">
                <History className="w-4 h-4" />
                Andamento
                {entradas.length > 0 && (
                    <span className="bg-white/10 text-zinc-300 px-1.5 py-0.5 rounded-full text-[10px]">
                        {entradas.length}
                    </span>
                )}
            </label>

            {carregando ? (
                <div className="flex items-center gap-2 text-zinc-500 text-sm py-3">
                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando andamento...
                </div>
            ) : erro ? (
                <p className="text-red-400 text-xs flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Não foi possível carregar o andamento.
                </p>
            ) : entradas.length === 0 ? (
                <p className="text-zinc-600 text-sm leading-relaxed">
                    {/* Post anterior ao historico nao tem passado registrado, e
                        dizer "nada aconteceu" seria falso. */}
                    Nada registrado ainda. Mudanças de data, status, aprovação e envio de
                    material passam a aparecer aqui.
                </p>
            ) : (
                <ol className="relative space-y-3 pl-6">
                    {/* Fio vertical ligando os pontos. Absoluto e atras dos
                        marcadores, para nao empurrar o texto. */}
                    <span className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-white/10" aria-hidden="true" />

                    {entradas.map(entrada => {
                        const Icone = ICONES[entrada.tipo];
                        const { texto, destaque } = descrever(entrada);
                        const tom = TOM[entrada.para || ''] || 'text-zinc-300';
                        return (
                            <li key={entrada.id} className="relative">
                                <span
                                    className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-[#1A1A1A] border border-white/10 flex items-center justify-center"
                                    aria-hidden="true"
                                >
                                    <Icone className="w-2.5 h-2.5 text-zinc-400" />
                                </span>
                                <p className={`text-sm leading-snug ${tom}`}>
                                    {texto}
                                    {destaque && <span className="text-zinc-500"> · {destaque}</span>}
                                </p>
                                <p className="text-[11px] text-zinc-600 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                    <span
                                        className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold ${
                                            entrada.porPapel === 'agencia'
                                                ? 'bg-[#FABE01] text-black'
                                                : 'bg-zinc-700 text-zinc-200'
                                        }`}
                                        aria-hidden="true"
                                    >
                                        {getInitials({ nome: entrada.porNome, email: entrada.por })}
                                    </span>
                                    {entrada.porNome || entrada.por}
                                    <span className="text-zinc-700">·</span>
                                    {entrada.em.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                    {' '}
                                    {entrada.em.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
};

export default PostTimeline;
