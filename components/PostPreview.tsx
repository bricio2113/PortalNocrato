import React, { useState, useEffect, useRef } from 'react';
import { CalendarEvent } from '../types';
import { getMediaPreview, getLinkLabel } from '../utils/media';
import { isSafeImageSrc } from '../utils/avatar';
import {
    Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ChevronLeft, ChevronRight,
    ImageOff, ExternalLink, Play, RotateCcw
} from 'lucide-react';

interface PostPreviewProps {
    event: CalendarEvent;
    /** @ do cliente. Sem ele a simulacao usa um placeholder neutro. */
    handle?: string | null;
    /** Foto de perfil do cliente, quando houver. */
    fotoPerfil?: string | null;
}

interface Peca {
    kind: 'image' | 'video' | 'external';
    src: string;
}

/**
 * Como o post VAI FICAR no perfil.
 *
 * Antes a "prévia" era uma faixa dentro do formulario, do lado dos campos: uma
 * imagem solta, sem contexto, que nao respondia a pergunta que se faz antes de
 * aprovar - "como isso aparece no Instagram?". Carrossel mostrava so a primeira
 * peca, video nao tocava, e nada indicava proporcao.
 *
 * Aqui a peca aparece no formato do feed: cabecalho com o @, midia na proporcao
 * do formato, acoes e legenda embaixo. Carrossel PASSA de peca em peca; video
 * TOCA. E o mesmo que o cliente vai ver publicado, e e isso que ele esta
 * aprovando.
 */
const PostPreview: React.FC<PostPreviewProps> = ({ event, handle, fotoPerfil }) => {
    const [indice, setIndice] = useState(0);
    /**
     * Pecas que nao carregaram, POR URL.
     *
     * Era por indice, e isso causava a peca 1 de um carrossel ficar em "não foi
     * possível carregar esta peça" com a mesma imagem aparecendo na grade ao lado:
     * quem sobe tres arquivos sobe um por vez, e a peca 1 e renderizada no
     * instante seguinte ao upload dela - momento em que a URL de download as vezes
     * ainda nao esta servindo. O onError marcava `falhou[0]` e NADA limpava,
     * porque o unico reset dependia de `event.id` mudar e o post e o mesmo. As
     * pecas 2 e 3 montavam depois, com a URL ja pronta, e apareciam - o que fazia
     * parecer problema da primeira imagem.
     *
     * Por indice tinha um segundo defeito: remover a peca 1 fazia a 2 herdar a
     * marca de quebrada, porque ela passava a ocupar o indice 0.
     */
    const [falhou, setFalhou] = useState<Record<string, boolean>>({});
    /**
     * Contador de tentativa, so para remontar o <img>.
     *
     * A `key` do elemento e a URL: pedir de novo a MESMA URL nao refaz a
     * requisicao, o React reaproveita o no que ja falhou. Com o contador na key, o
     * "tentar de novo" cria um elemento novo e o navegador busca outra vez.
     */
    const [tentativa, setTentativa] = useState(0);
    /** X inicial do toque, para o arrasto lateral do carrossel. */
    const toqueX = useRef<number | null>(null);

    /**
     * As pecas, em ordem.
     *
     * Arquivo enviado ganha do link: quem subiu a midia no portal escolheu ela
     * como a peca, e a ordem do array e a ordem do carrossel. Sem midia, cai
     * para os links (previa manual > capa resolvida > material bruto).
     */
    const pecas: Peca[] = event.midias?.length
        ? event.midias.map(m => ({
            kind: m.contentType?.startsWith('video') ? 'video' as const : 'image' as const,
            src: m.url
        }))
        : (() => {
            const p = getMediaPreview(event.previewUrl || event.coverUrl || event.finalUrl || event.url);
            return p ? [p] : [];
        })();

    // Voltar para a primeira peca ao trocar de post: sem isto, abrir um carrossel
    // de 8 e depois um de 2 deixaria o indice fora da faixa e a tela vazia.
    useEffect(() => { setIndice(0); setFalhou({}); }, [event.id]);

    // MUDOU A LISTA DE PECAS, TENTA TUDO DE NOVO. Subir a segunda peca e a
    // evidencia de que o upload esta funcionando; insistir na falha da primeira
    // depois disso e so teimosia da interface. A dependencia e a lista
    // SERIALIZADA: o array e recriado a cada render e travaria o efeito em laco.
    const chavePecas = pecas.map(p => p.src).join('|');
    useEffect(() => { setFalhou({}); }, [chavePecas]);

    const total = pecas.length;
    // O indice e preso a faixa AQUI, e o resto da tela usa este valor: antes
    // `atual` usava o indice preso e `falhou[indice]` o indice cru, entao os dois
    // podiam falar de pecas diferentes depois de remover um arquivo.
    const indiceAtual = Math.min(indice, Math.max(total - 1, 0));
    const atual = pecas[indiceAtual];
    const quebrou = Boolean(atual && falhou[atual.src]);

    const tentarDeNovo = () => {
        if (!atual) return;
        setFalhou(f => {
            const resto = { ...f };
            delete resto[atual.src];
            return resto;
        });
        setTentativa(t => t + 1);
    };

    // Reel e Story sao verticais no feed; o resto e quadrado. Mostrar um reel em
    // quadrado ensina uma composicao que nao e a real, e o corte aparece so
    // depois de publicado.
    const vertical = ['Reel', 'Story', 'Vídeo'].includes(event.type as string);
    const proporcao = vertical ? 'aspect-[9/16]' : 'aspect-square';

    const arroba = (handle || '').replace(/^@/, '') || 'seu_perfil';

    return (
        <div className="bg-black rounded-card border border-white/10 overflow-hidden">
            {/* CABECALHO do post */}
            <div className="flex items-center gap-2.5 px-3 py-2.5">
                {isSafeImageSrc(fotoPerfil) ? (
                    <img src={fotoPerfil!} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                    <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FABE01] to-amber-600 p-[2px]">
                        <span className="w-full h-full rounded-full bg-black flex items-center justify-center text-[10px] font-bold text-zinc-300">
                            {arroba.slice(0, 2).toUpperCase()}
                        </span>
                    </span>
                )}
                <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-white truncate leading-tight">{arroba}</p>
                    <p className="text-[10px] text-zinc-500 leading-tight">
                        {event.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                    </p>
                </div>
                <MoreHorizontal className="w-4 h-4 text-zinc-500 shrink-0" />
            </div>

            {/* MIDIA */}
            <div
                className={`relative ${proporcao} bg-[#0A0A0A] flex items-center justify-center overflow-hidden`}
                // ARRASTAR PARA O LADO, como no app. As setas sao de mouse; no
                // celular - onde o carrossel e mais conferido - nao existe hover e
                // um alvo de 28px no meio da peca e chute.
                onTouchStart={e => { toqueX.current = e.touches[0]?.clientX ?? null; }}
                onTouchEnd={e => {
                    if (toqueX.current === null || total < 2) return;
                    const delta = (e.changedTouches[0]?.clientX ?? toqueX.current) - toqueX.current;
                    toqueX.current = null;
                    // 40px: abaixo disso e toque tremido, nao arrasto.
                    if (delta < -40 && indice < total - 1) setIndice(i => i + 1);
                    if (delta > 40 && indice > 0) setIndice(i => i - 1);
                }}
            >
                {!atual || quebrou ? (
                    <div className="text-center px-6">
                        {atual?.kind === 'external' && !quebrou ? (
                            <>
                                <ExternalLink className="w-7 h-7 text-zinc-700 mx-auto mb-2" />
                                <p className="text-zinc-400 text-xs mb-2">O material está no {getLinkLabel(atual.src)}.</p>
                                <a
                                    href={atual.src}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-bold text-[#FABE01] hover:underline"
                                >
                                    Abrir material
                                </a>
                            </>
                        ) : (
                            <>
                                <ImageOff className="w-7 h-7 text-zinc-700 mx-auto mb-2" />
                                <p className="text-zinc-500 text-xs leading-relaxed">
                                    {total === 0
                                        ? 'Envie a mídia ou cole um link para ver o post montado aqui.'
                                        : 'Não foi possível carregar esta peça.'}
                                </p>
                                {/* A falha costuma ser passageira - arquivo recem
                                    subido, conexao oscilando. Sem este botao a unica
                                    saida era fechar e reabrir o post. */}
                                {quebrou && (
                                    <button
                                        onClick={tentarDeNovo}
                                        className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#FABE01] hover:underline"
                                    >
                                        <RotateCcw className="w-3 h-3" /> Tentar de novo
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                ) : atual.kind === 'video' ? (
                    // controls: e o unico jeito de conferir um reel antes de
                    // aprovar. Sem autoplay - som surpresa no meio do trabalho.
                    <video
                        key={`${atual.src}#${tentativa}`}
                        src={atual.src}
                        controls
                        playsInline
                        preload="metadata"
                        onError={() => setFalhou(f => ({ ...f, [atual.src]: true }))}
                        className="w-full h-full object-contain bg-black"
                    />
                ) : (
                    <img
                        key={`${atual.src}#${tentativa}`}
                        src={atual.src}
                        alt={`Peça ${indiceAtual + 1} de ${event.title}`}
                        onError={() => setFalhou(f => ({ ...f, [atual.src]: true }))}
                        className="w-full h-full object-cover"
                    />
                )}

                {/* CARROSSEL: setas e contador, como no app. */}
                {total > 1 && (
                    <>
                        {indice > 0 && (
                            <button
                                onClick={() => setIndice(i => i - 1)}
                                aria-label="Peça anterior"
                                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                        )}
                        {indice < total - 1 && (
                            <button
                                onClick={() => setIndice(i => i + 1)}
                                aria-label="Próxima peça"
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                        <span className="absolute top-2 right-2 text-[10px] font-semibold text-white bg-black/60 px-2 py-0.5 rounded-full">
                            {indice + 1}/{total}
                        </span>
                    </>
                )}

                {atual?.kind === 'video' && total === 1 && (
                    <span className="absolute top-2 right-2 text-[10px] font-semibold text-white bg-black/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Play className="w-2.5 h-2.5" /> vídeo
                    </span>
                )}
            </div>

            {/* ACOES - decorativas, so para a peca ser lida no contexto do feed. */}
            <div className="flex items-center gap-3.5 px-3 pt-2.5 text-zinc-300">
                <Heart className="w-[22px] h-[22px]" />
                <MessageCircle className="w-[22px] h-[22px]" />
                <Send className="w-[22px] h-[22px]" />
                <Bookmark className="w-[22px] h-[22px] ml-auto" />
            </div>

            {/* PONTOS do carrossel, abaixo das acoes como no app. */}
            {total > 1 && (
                <div className="flex items-center justify-center gap-1 pt-2">
                    {pecas.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setIndice(i)}
                            aria-label={`Ir para a peça ${i + 1}`}
                            className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                i === indice ? 'bg-[#FABE01]' : 'bg-zinc-700 hover:bg-zinc-500'
                            }`}
                        />
                    ))}
                </div>
            )}

            {/* LEGENDA */}
            <div className="px-3 py-2.5">
                {event.copy ? (
                    <p className="text-[13px] text-zinc-200 leading-snug whitespace-pre-wrap break-words">
                        <span className="font-semibold text-white mr-1.5">{arroba}</span>
                        {event.copy}
                    </p>
                ) : (
                    <p className="text-[13px] text-zinc-600 italic">Sem legenda ainda.</p>
                )}
            </div>
        </div>
    );
};

export default PostPreview;
