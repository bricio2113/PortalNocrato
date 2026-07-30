import React, { useMemo, useState, useEffect } from 'react';
import { CalendarEvent } from '../types';
import { getMediaPreview } from '../utils/media';
import { getTypeStyles } from '../utils/eventStyles';
import { getClientStage, CLIENT_STAGES } from '../utils/eventState';
import {
    Instagram, ChevronLeft, ChevronRight, Play, ImageOff,
    Images, Grid3x3
} from 'lucide-react';

interface FeedPreviewProps {
    events: CalendarEvent[];
    empresaNome: string;
    /** Abre o post ao clicar no tile. */
    onSelectEvent?: (event: CalendarEvent) => void;
}

const PAGE_SIZE = 9;

// Ordem de precedencia da imagem do tile: escolha manual, depois capa resolvida
// pelo Drive, depois os links do material como ultimo recurso.
const coverSourceOf = (event: CalendarEvent) =>
    event.previewUrl || event.coverUrl || event.finalUrl || event.url;

// Formatos que NAO aparecem na grade do perfil.
//
// Story expira em 24h e nunca entra no grid. Trafego e anuncio: roda no feed
// dos outros, nao no perfil da marca. Deixar os dois aqui produziria uma
// simulacao de um feed que nunca vai existir.
const EXCLUDED_FROM_GRID = ['STORY', 'TRÁFEGO', 'TRAFEGO'];

const isInstagramFeedPost = (event: CalendarEvent): boolean => {
    const plataforma = (event.plataforma || '').toLowerCase();
    if (plataforma && plataforma !== 'instagram') return false;
    const type = (event.type || '').toUpperCase();
    return !EXCLUDED_FROM_GRID.some(excluded => type.includes(excluded));
};

// Carrossel e Reel ganham marca de canto, como no app do Instagram.
const cornerIcon = (type?: string) => {
    const t = (type || '').toUpperCase();
    if (t.includes('CARROSSEL')) return <Images className="w-3.5 h-3.5" />;
    if (t.includes('REEL') || t.includes('VÍDEO') || t.includes('VIDEO')) return <Play className="w-3.5 h-3.5 fill-current" />;
    return null;
};

/**
 * Simulacao da grade do perfil do Instagram a partir do calendario.
 *
 * Serve para ver a coerencia visual do feed antes de publicar - e o que a
 * agencia e julgada por, e nenhuma lista de posts mostra isso. Ordem
 * decrescente por data, como o perfil real monta: o mais novo no topo-esquerda.
 */
const FeedPreview: React.FC<FeedPreviewProps> = ({ events, empresaNome, onSelectEvent }) => {
    const [page, setPage] = useState(0);

    const feedPosts = useMemo(
        () => events
            .filter(isInstagramFeedPost)
            .sort((a, b) => b.date.getTime() - a.date.getTime()),
        [events]
    );

    const totalPages = Math.max(1, Math.ceil(feedPosts.length / PAGE_SIZE));

    // Trocar de cliente ou encolher a lista nao pode deixar a pagina fora do
    // intervalo, senao o grid aparece vazio sem motivo.
    useEffect(() => {
        setPage(prev => Math.min(prev, totalPages - 1));
    }, [totalPages]);

    const pagePosts = feedPosts.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    const initials = (empresaNome || '--').slice(0, 2).toUpperCase();

    return (
        <div className="bg-[#1A1A1A] border border-white/10 rounded-xl overflow-hidden flex flex-col">
            {/* CABECALHO IMITANDO O PERFIL */}
            <div className="p-4 border-b border-white/5">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#FABE01] to-[#DE7928] flex items-center justify-center text-black font-bold text-lg shrink-0">
                        {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <Instagram className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <p className="text-white font-bold text-sm truncate">{empresaNome}</p>
                        </div>
                        <p className="text-zinc-500 text-xs mt-0.5">
                            <span className="text-zinc-300 font-bold">{feedPosts.length}</span> publicações no calendário
                        </p>
                    </div>
                </div>
                <p className="text-[11px] text-zinc-600 leading-relaxed">
                    Prévia da grade do perfil. Stories e tráfego não entram — não aparecem no feed.
                </p>
            </div>

            {/* GRADE 3x3 */}
            <div className="p-3">
                {feedPosts.length === 0 ? (
                    <div className="aspect-square flex flex-col items-center justify-center text-center px-6 border border-dashed border-white/10 rounded-sm">
                        <Grid3x3 className="w-10 h-10 text-zinc-700 mb-3" />
                        <p className="text-zinc-400 text-sm font-medium mb-1">Nada para simular ainda</p>
                        <p className="text-zinc-600 text-xs leading-relaxed">
                            Publicações de feed do Instagram aparecem aqui na ordem em que vão ficar no perfil.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-1">
                        {pagePosts.map(event => {
                            const preview = getMediaPreview(coverSourceOf(event));
                            const styles = getTypeStyles(event.type);
                            const stage = getClientStage(event);
                            const stageStyle = CLIENT_STAGES[stage];
                            const corner = cornerIcon(event.type);

                            return (
                                <button
                                    key={event.id}
                                    onClick={() => onSelectEvent?.(event)}
                                    title={`${event.title || '(sem título)'} — ${stageStyle.label}`}
                                    className="group relative aspect-square bg-[#111111] overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FABE01]"
                                >
                                    {preview && preview.kind === 'image' ? (
                                        <img
                                            src={preview.src}
                                            alt={event.title || 'Publicação'}
                                            loading="lazy"
                                            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                                            // Tile quebrado polui mais que placeholder: escondemos a
                                            // imagem e deixamos o fundo com o icone do formato.
                                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    ) : (
                                        <div className={`w-full h-full flex items-center justify-center ${styles.bg}`}>
                                            <ImageOff className={`w-5 h-5 ${styles.text} opacity-50`} />
                                        </div>
                                    )}

                                    {/* Faixa de estagio: da para ver de relance o que ainda
                                        depende de aprovacao sem abrir post por post. */}
                                    <span className={`absolute top-1 left-1 w-2 h-2 rounded-full ${stageStyle.dot} ring-2 ring-black/40`} />

                                    {corner && (
                                        <span className="absolute top-1 right-1 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                            {corner}
                                        </span>
                                    )}

                                    {/* Legenda no hover, para nao poluir a leitura do conjunto. */}
                                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="block text-[9px] text-white font-medium leading-tight line-clamp-2 text-left">
                                            {event.title || '(sem título)'}
                                        </span>
                                        <span className="block text-[8px] text-zinc-400 text-left mt-0.5">
                                            {event.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}

                        {/* Completa o 3x3 para a grade nao ficar torta na ultima pagina. */}
                        {Array.from({ length: Math.max(0, PAGE_SIZE - pagePosts.length) }).map((_, i) => (
                            <div key={`filler-${i}`} className="aspect-square bg-[#111111]/40 border border-white/[0.02]" />
                        ))}
                    </div>
                )}
            </div>

            {/* PAGINACAO DE 9 EM 9 */}
            {feedPosts.length > PAGE_SIZE && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Página anterior do feed"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-zinc-500">
                        {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, feedPosts.length)} de {feedPosts.length}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Próxima página do feed"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default FeedPreview;
