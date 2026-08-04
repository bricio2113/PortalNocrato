import React, { useEffect, useState } from 'react';
import { ArquivoMaterial, tipoDoArquivo } from '../utils/pastas';
import { X, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, AlertTriangle } from 'lucide-react';

interface MediaViewerProps {
    /** Arquivos da pasta aberta. A navegacao acontece dentro desta lista. */
    arquivos: ArquivoMaterial[];
    /** Qual esta na tela. */
    indice: number;
    onTrocar: (indice: number) => void;
    onFechar: () => void;
}

const formatarBytes = (bytes?: number) =>
    bytes === undefined ? '' :
    bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

/**
 * Abre a peca em tamanho grande, sem sair da tela de pastas.
 *
 * O card de arquivo tinha uma miniatura de 100px e um botao de download. Para
 * conferir se a foto e a certa, ou para assistir um reel, a unica saida era baixar
 * o arquivo ou abrir numa aba - e voltar. Numa pasta com dez pecas isso e dez
 * downloads para achar uma.
 *
 * A NAVEGACAO E DENTRO DA PASTA, com setas e teclado: conferir material e uma
 * sequencia ("é essa? a próxima?"), nao um arquivo isolado. Fecha no Esc e no
 * clique fora, como qualquer visualizador.
 *
 * DOCUMENTO NAO E EXIBIDO AQUI. PDF em iframe depende de como o navegador e o
 * Storage negociam a exibicao, e prometer previa que as vezes aparece em branco e
 * pior que oferecer o link direto. Imagem e video, que e o material de conteudo,
 * abrem aqui mesmo.
 */
const MediaViewer: React.FC<MediaViewerProps> = ({ arquivos, indice, onTrocar, onFechar }) => {
    const [falhou, setFalhou] = useState(false);
    const atual = arquivos[indice];

    // Peca nova, tentativa nova. Sem isto, uma falha de rede num arquivo deixaria
    // todos os seguintes marcados como quebrados enquanto o visualizador ficasse
    // aberto - foi exatamente o defeito que a previa do post tinha.
    useEffect(() => { setFalhou(false); }, [atual?.path]);

    useEffect(() => {
        const tecla = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { onFechar(); return; }
            if (e.key === 'ArrowRight' && indice < arquivos.length - 1) onTrocar(indice + 1);
            if (e.key === 'ArrowLeft' && indice > 0) onTrocar(indice - 1);
        };
        document.addEventListener('keydown', tecla);
        return () => document.removeEventListener('keydown', tecla);
    }, [indice, arquivos.length, onTrocar, onFechar]);

    if (!atual) return null;
    const tipo = tipoDoArquivo(atual);

    return (
        <div
            className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex flex-col animate-in fade-in"
            role="dialog"
            aria-modal="true"
            aria-label={`Visualizar ${atual.nome}`}
        >
            <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/10">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{atual.nome}</p>
                    <p className="text-[11px] text-zinc-500">
                        {formatarBytes(atual.bytes)}
                        {arquivos.length > 1 && ` · ${indice + 1} de ${arquivos.length}`}
                    </p>
                </div>
                <a
                    href={atual.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 rounded-control transition-colors"
                >
                    <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Baixar</span>
                </a>
                <button
                    onClick={onFechar}
                    aria-label="Fechar"
                    className="shrink-0 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </header>

            {/* O clique no fundo fecha; o clique na peca nao - senao tentar dar
                play num video fecharia o visualizador. */}
            <div className="flex-1 min-h-0 relative flex items-center justify-center p-4" onClick={onFechar}>
                {falhou ? (
                    <div className="text-center" onClick={e => e.stopPropagation()}>
                        <AlertTriangle className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                        <p className="text-zinc-400 text-sm mb-3">Não foi possível carregar este arquivo.</p>
                        <div className="flex gap-2 justify-center">
                            <button
                                onClick={() => setFalhou(false)}
                                className="px-3.5 py-2 text-xs font-semibold bg-white/10 text-white rounded-control hover:bg-white/20 transition-colors"
                            >
                                Tentar de novo
                            </button>
                            <a
                                href={atual.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3.5 py-2 text-xs font-semibold bg-[#FABE01] text-black rounded-control"
                            >
                                Abrir em nova aba
                            </a>
                        </div>
                    </div>
                ) : tipo === 'imagem' ? (
                    <img
                        key={atual.path}
                        src={atual.url}
                        alt={atual.nome}
                        onClick={e => e.stopPropagation()}
                        onError={() => setFalhou(true)}
                        className="max-w-full max-h-full object-contain rounded-card"
                    />
                ) : tipo === 'video' ? (
                    <video
                        key={atual.path}
                        src={atual.url}
                        controls
                        playsInline
                        onClick={e => e.stopPropagation()}
                        onError={() => setFalhou(true)}
                        className="max-w-full max-h-full rounded-card bg-black"
                    />
                ) : (
                    <div className="text-center" onClick={e => e.stopPropagation()}>
                        <FileText className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                        <p className="text-zinc-400 text-sm mb-3 max-w-xs leading-relaxed">
                            Documento. A visualização acontece no seu leitor de PDF, não aqui.
                        </p>
                        <a
                            href={atual.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-[#FABE01] text-black rounded-control"
                        >
                            <ExternalLink className="w-3.5 h-3.5" /> Abrir documento
                        </a>
                    </div>
                )}

                {indice > 0 && (
                    <button
                        onClick={e => { e.stopPropagation(); onTrocar(indice - 1); }}
                        aria-label="Arquivo anterior"
                        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/70 border border-white/10 text-white flex items-center justify-center hover:bg-black/90 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                )}
                {indice < arquivos.length - 1 && (
                    <button
                        onClick={e => { e.stopPropagation(); onTrocar(indice + 1); }}
                        aria-label="Próximo arquivo"
                        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/70 border border-white/10 text-white flex items-center justify-center hover:bg-black/90 transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default MediaViewer;
