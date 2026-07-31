import React, { useMemo, useState, useEffect } from 'react';
import { CalendarEvent } from '../types';
import { getMediaPreview } from '../utils/media';
import { getTypeStyles } from '../utils/eventStyles';
import { getClientStage, CLIENT_STAGES } from '../utils/eventState';
import {
    ChevronLeft, ChevronRight, Play, ImageOff, Images, Grid3x3,
    ChevronDown, Plus, Menu, UserSquare2, Clapperboard
} from 'lucide-react';

interface FeedPreviewProps {
    events: CalendarEvent[];
    empresaNome: string;
    /** Abre o post ao clicar no tile. */
    onSelectEvent?: (event: CalendarEvent) => void;
    /** Desenha a moldura de celular em volta. */
    framed?: boolean;
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

const isInstagramPost = (event: CalendarEvent): boolean => {
    const plataforma = (event.plataforma || '').toLowerCase();
    return !plataforma || plataforma === 'instagram';
};

const isStory = (event: CalendarEvent) => (event.type || '').toUpperCase().includes('STORY');

const isInstagramFeedPost = (event: CalendarEvent): boolean => {
    if (!isInstagramPost(event)) return false;
    const type = (event.type || '').toUpperCase();
    return !EXCLUDED_FROM_GRID.some(excluded => type.includes(excluded));
};

const isReel = (type?: string) => {
    const t = (type || '').toUpperCase();
    return t.includes('REEL') || t.includes('VÍDEO') || t.includes('VIDEO');
};

// Carrossel e Reel ganham marca de canto, como no app do Instagram.
const cornerIcon = (type?: string) => {
    const t = (type || '').toUpperCase();
    if (t.includes('CARROSSEL')) return <Images className="w-3.5 h-3.5" />;
    if (isReel(t)) return <Play className="w-3.5 h-3.5 fill-current" />;
    return null;
};

// @nome_da_marca a partir do nome da empresa, so para a simulacao parecer o
// perfil real. Nao e gravado em lugar nenhum.
const handleOf = (nome: string) =>
    (nome || 'perfil')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'perfil';

type FeedTab = 'grid' | 'reels' | 'tagged';

/**
 * Simulacao do perfil do Instagram a partir do calendario.
 *
 * Serve para ver a coerencia visual do feed antes de publicar - e o que a
 * agencia e julgada por, e nenhuma lista de posts mostra isso. Ordem
 * decrescente por data, como o perfil real monta: o mais novo no topo-esquerda.
 *
 * Os tres contadores mostram dados REAIS do calendario (publicacoes, aprovados,
 * aguardando) no lugar de seguidores e seguindo. Numero de seguidores inventado
 * dentro de um portal que o cliente abre seria um dado falso na cara dele; a
 * forma do Instagram e mantida, o conteudo e honesto.
 */
const FeedPreview: React.FC<FeedPreviewProps> = ({ events, empresaNome, onSelectEvent, framed = true }) => {
    const [page, setPage] = useState(0);
    const [tab, setTab] = useState<FeedTab>('grid');

    const feedPosts = useMemo(
        () => events
            .filter(isInstagramFeedPost)
            .sort((a, b) => b.date.getTime() - a.date.getTime()),
        [events]
    );

    // Stories viram os destaques do topo: sao publicacoes reais que nao cabem
    // na grade, e no perfil de verdade e exatamente ali que elas moram.
    const stories = useMemo(
        () => events
            .filter(e => isInstagramPost(e) && isStory(e))
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .slice(0, 5),
        [events]
    );

    const counters = useMemo(() => {
        const stages = feedPosts.map(getClientStage);
        return {
            publicacoes: feedPosts.length,
            aprovados: stages.filter(s => s === 'aprovado' || s === 'publicado').length,
            aguardando: stages.filter(s => s === 'aguardando_voce').length
        };
    }, [feedPosts]);

    const visiblePosts = useMemo(
        () => tab === 'reels' ? feedPosts.filter(e => isReel(e.type)) : feedPosts,
        [feedPosts, tab]
    );

    const totalPages = Math.max(1, Math.ceil(visiblePosts.length / PAGE_SIZE));

    // Trocar de cliente, de aba ou encolher a lista nao pode deixar a pagina
    // fora do intervalo, senao o grid aparece vazio sem motivo.
    useEffect(() => {
        setPage(prev => Math.min(prev, totalPages - 1));
    }, [totalPages]);

    const pagePosts = visiblePosts.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    const initials = (empresaNome || '--').slice(0, 2).toUpperCase();
    const handle = handleOf(empresaNome);

    const counter = (valor: number, rotulo: string) => (
        <div className="text-center min-w-0 flex-1">
            <p className="text-white font-bold text-[15px] leading-tight">{valor}</p>
            <p className="text-zinc-500 text-[11px] leading-tight mt-0.5 truncate">{rotulo}</p>
        </div>
    );

    const tabs: { id: FeedTab; icon: React.ElementType; label: string }[] = [
        { id: 'grid', icon: Grid3x3, label: 'Grade' },
        { id: 'reels', icon: Clapperboard, label: 'Reels' },
        { id: 'tagged', icon: UserSquare2, label: 'Marcados' }
    ];

    const screen = (
        // #000 de proposito: e a cor do app do Instagram no modo escuro, e o
        // ponto aqui e parecer o Instagram, nao parecer o portal.
        <div className="bg-black flex flex-col overflow-hidden h-full">
            {/* BARRA DO APP */}
            <div className="flex items-center justify-between px-3.5 py-2.5 shrink-0">
                <div className="flex items-center gap-1 min-w-0">
                    <span className="text-white font-semibold text-sm truncate">{handle}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-white shrink-0" />
                </div>
                <div className="flex items-center gap-4 text-white shrink-0">
                    <Plus className="w-[18px] h-[18px]" />
                    <Menu className="w-[18px] h-[18px]" />
                </div>
            </div>

            {/* AVATAR + CONTADORES */}
            <div className="flex items-center gap-4 px-3.5 pb-3 shrink-0">
                <div className="w-[74px] h-[74px] shrink-0 rounded-full bg-gradient-to-tr from-[#FABE01] to-[#DE7928] flex items-center justify-center text-black font-bold text-xl">
                    {initials}
                </div>
                <div className="flex items-center gap-1 flex-1 min-w-0">
                    {counter(counters.publicacoes, 'publicações')}
                    {counter(counters.aprovados, 'aprovados')}
                    {counter(counters.aguardando, 'aguardando')}
                </div>
            </div>

            {/* NOME */}
            <div className="px-3.5 pb-3 shrink-0">
                <p className="text-white text-[13px] font-semibold leading-tight truncate">{empresaNome}</p>
                <p className="text-zinc-500 text-[11px] leading-tight mt-0.5">Prévia do feed · Agência Nocrato</p>
            </div>

            {/* BOTOES DO PERFIL - decorativos, so completam a forma da tela */}
            <div className="flex gap-1.5 px-3.5 pb-3 shrink-0" aria-hidden="true">
                <span className="flex-1 text-center bg-[#262626] text-white text-[11px] font-semibold py-1.5 rounded-chip">Editar perfil</span>
                <span className="flex-1 text-center bg-[#262626] text-white text-[11px] font-semibold py-1.5 rounded-chip">Compartilhar</span>
            </div>

            {/* DESTAQUES = STORIES DO CALENDARIO */}
            {stories.length > 0 && (
                <div className="flex gap-3.5 px-3.5 pb-3 overflow-x-auto custom-scrollbar shrink-0">
                    {stories.map(story => {
                        const preview = getMediaPreview(coverSourceOf(story));
                        return (
                            <button
                                key={story.id}
                                onClick={() => onSelectEvent?.(story)}
                                title={`Story: ${story.title || '(sem título)'}`}
                                className="shrink-0 w-[54px] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#FABE01] rounded-chip"
                            >
                                <span className="block w-[54px] h-[54px] rounded-full p-[2px] bg-gradient-to-tr from-[#FABE01] to-[#DE7928]">
                                    <span className="block w-full h-full rounded-full border-2 border-black overflow-hidden bg-[#262626]">
                                        {preview && preview.kind === 'image' ? (
                                            <img src={preview.src} alt="" loading="lazy" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="w-full h-full flex items-center justify-center text-[9px] font-bold text-zinc-500">
                                                {story.date.getDate()}
                                            </span>
                                        )}
                                    </span>
                                </span>
                                <span className="block text-[9px] text-zinc-400 text-center mt-1 truncate">
                                    {story.title || 'Story'}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ABAS DO PERFIL */}
            <div className="flex border-t border-[#262626] shrink-0">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => { setTab(t.id); setPage(0); }}
                        aria-label={t.label}
                        aria-selected={tab === t.id}
                        className={`flex-1 flex items-center justify-center py-2.5 border-b transition-colors ${
                            tab === t.id ? 'border-white text-white' : 'border-transparent text-zinc-600 hover:text-zinc-400'
                        }`}
                    >
                        <t.icon className="w-[18px] h-[18px]" />
                    </button>
                ))}
            </div>

            {/* GRADE.
                Sem altura fixa e sem rolagem interna: a tela cresce ate caber as
                nove pecas. Com o celular travado em 560px o cabecalho do perfil
                comia o espaco e so seis apareciam - o oposto de "ver os 9 de uma
                vez", que e a razao de existir desta tela. */}
            <div className="flex-1">
                {tab === 'tagged' ? (
                    <div className="py-12 px-6 text-center">
                        <UserSquare2 className="w-9 h-9 text-zinc-700 mx-auto mb-3" />
                        <p className="text-zinc-500 text-xs leading-relaxed">
                            Fotos em que a marca é marcada não passam pelo calendário — nada para simular aqui.
                        </p>
                    </div>
                ) : visiblePosts.length === 0 ? (
                    <div className="py-12 px-6 text-center">
                        <Grid3x3 className="w-9 h-9 text-zinc-700 mx-auto mb-3" />
                        <p className="text-zinc-300 text-xs font-medium mb-1">
                            {tab === 'reels' ? 'Nenhum reel no calendário' : 'Nada para simular ainda'}
                        </p>
                        <p className="text-zinc-600 text-[11px] leading-relaxed">
                            {tab === 'reels'
                                ? 'Publicações do tipo Reel ou Vídeo aparecem nesta aba.'
                                : 'Publicações de feed do Instagram aparecem aqui na ordem em que vão ficar no perfil.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-[2px]">
                        {pagePosts.map(event => {
                            const preview = getMediaPreview(coverSourceOf(event));
                            const styles = getTypeStyles(event.type);
                            const stageStyle = CLIENT_STAGES[getClientStage(event)];
                            const corner = cornerIcon(event.type);

                            return (
                                <button
                                    key={event.id}
                                    onClick={() => onSelectEvent?.(event)}
                                    title={`${event.title || '(sem título)'} — ${stageStyle.label}`}
                                    className="group relative aspect-square bg-[#141414] overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FABE01] focus-visible:z-10"
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
                                    <span className={`absolute top-1 left-1 w-2 h-2 rounded-full ${stageStyle.dot} ring-2 ring-black/50`} />

                                    {corner && (
                                        <span className="absolute top-1 right-1 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                            {corner}
                                        </span>
                                    )}

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
                            <div key={`filler-${i}`} className="aspect-square bg-[#0A0A0A]" />
                        ))}
                    </div>
                )}
            </div>

            {/* PAGINACAO DE 9 EM 9 */}
            {visiblePosts.length > PAGE_SIZE && (
                <div className="flex items-center justify-between px-3 py-2 border-t border-[#262626] shrink-0">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Página anterior do feed"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] text-zinc-500">
                        {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, visiblePosts.length)} de {visiblePosts.length}
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

    if (!framed) return <div className="rounded-card overflow-hidden border border-white/10">{screen}</div>;

    return (
        <div>
            {/* MOLDURA DE CELULAR.
                Sem ela a grade parecia um componente do portal; com ela fica
                obvio em dois segundos que aquilo e uma simulacao do aplicativo
                e nao o feed publicado de verdade. */}
            <div className="mx-auto w-full max-w-[340px] rounded-[2rem] bg-[#0A0A0A] border border-white/10 p-2 shadow-card">
                <div className="relative rounded-[1.5rem] overflow-hidden bg-black">
                    {/* pilula da camera */}
                    <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-16 h-1.5 rounded-full bg-white/10 z-10" aria-hidden="true" />
                    <div className="pt-4 flex flex-col">{screen}</div>
                </div>
            </div>
            <p className="text-[11px] text-zinc-600 text-center mt-3 leading-relaxed max-w-[340px] mx-auto">
                Simulação do perfil. Stories aparecem como destaques; tráfego não entra no feed.
            </p>
        </div>
    );
};

export default FeedPreview;
