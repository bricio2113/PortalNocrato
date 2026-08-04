import React, { useState, useRef } from 'react';
import { MidiaArquivo } from '../types';
import { enviarMidiaDoPost, salvarThumb, removerMidia, MidiaInvalidaError } from '../utils/midia';
import { ehVideo } from '../utils/thumbnail';
import { Caminho, criarPasta, nomePastaSeguro } from '../utils/pastas';
import PastaPicker from './PastaPicker';
import {
    Upload, Loader2, AlertTriangle, Play, Trash2, FolderOpen, Folder, ChevronRight
} from 'lucide-react';

interface MediaUploadProps {
    empresaId: string;
    /**
     * Id do post, ou VAZIO em publicacao ainda nao gravada.
     *
     * Vazio e estado previsto: o arquivo vai para a pasta escolhida em materiais/,
     * que nao tem id no caminho. O id so faz falta para a miniatura (covers/{id}),
     * que nesse caso e devolvida pelo onThumb para quem criar o post gravar.
     */
    eventId: string;
    midias: MidiaArquivo[];
    /** Chamado a cada mudanca. O modal decide quando gravar. */
    onChange: (midias: MidiaArquivo[]) => void;
    /**
     * Capa do post. A primeira midia enviada define a capa automaticamente; o
     * usuario pode trocar clicando em outra. Em post sem id, este e o UNICO
     * caminho da capa - ver a nota em handleFiles.
     */
    onThumb: (thumb: string | null) => void;
    disabled?: boolean;
    /**
     * Titulo do conteudo. Vira o NOME DA SUBPASTA quando a pessoa escolhe criar
     * uma. Sem titulo, sobra a opcao de usar uma pasta existente.
     */
    titulo?: string;
    /** Pasta em materiais/ onde a midia deste conteudo mora. */
    pastaMidia?: string[] | null;
    /** Grava a pasta no rascunho do post. */
    onPastaMidia: (caminho: string[] | null) => void;
}

const formatarBytes = (bytes: number) =>
    bytes >= 1024 * 1024
        ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
        : `${Math.round(bytes / 1024)} KB`;

/**
 * Upload da midia de uma publicacao.
 *
 * Aceita VARIOS arquivos porque carrossel e o formato mais comum da agencia -
 * um campo de arquivo unico obrigaria dez idas e voltas para um post de dez
 * imagens.
 *
 * A ordem da lista e a ordem do carrossel. Por isso a remocao mantem o resto
 * intacto em vez de reordenar: mexer na sequencia sem o usuario pedir e o tipo
 * de surpresa que faz alguem republicar tudo.
 */
const MediaUpload: React.FC<MediaUploadProps> = ({
    empresaId, eventId, midias, onChange, onThumb, disabled,
    titulo, pastaMidia, onPastaMidia
}) => {
    const [enviando, setEnviando] = useState<{ nome: string; pct: number } | null>(null);
    const [erro, setErro] = useState('');
    const [escolhendo, setEscolhendo] = useState(false);
    const [preparando, setPreparando] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const nomeDaPasta = nomePastaSeguro(titulo || '');

    /**
     * Fecha o seletor de pasta e define o destino da midia.
     *
     * DOIS DESFECHOS, decididos no PastaPicker:
     *
     *   criarSubpasta -> cria `nomeDaPasta` dentro de `alvo` e usa a nova pasta.
     *                    A pasta e criada AQUI, e nao no primeiro upload, por dois
     *                    motivos: aparece na arvore de materiais na hora (a equipe
     *                    ja pode largar arquivo nela por fora) e, se a permissao
     *                    estiver errada, o erro sai antes de a pessoa escolher
     *                    300 MB de video.
     *   senao         -> usa `alvo` como esta. Nada e criado: a pasta veio da
     *                    listagem, ja existe.
     */
    const definirPasta = async (alvo: Caminho, criarSubpasta: boolean) => {
        setEscolhendo(false);
        setErro('');

        // Abre o seletor em seguida: escolher a pasta e mandar o arquivo sao um
        // gesto so na cabeca de quem esta subindo material.
        const seguirParaArquivos = () => setTimeout(() => inputRef.current?.click(), 0);

        if (!criarSubpasta) {
            onPastaMidia(alvo);
            seguirParaArquivos();
            return;
        }

        if (!nomeDaPasta) {
            setErro('Dê um título à publicação primeiro: a subpasta recebe o nome dele.');
            return;
        }
        setPreparando(true);
        try {
            await criarPasta(empresaId, alvo, nomeDaPasta);
            onPastaMidia([...alvo, nomeDaPasta]);
            seguirParaArquivos();
        } catch (e) {
            console.error(e);
            setErro(e instanceof Error ? e.message : 'Não foi possível criar a pasta.');
        } finally {
            setPreparando(false);
        }
    };

    /** Pede a pasta se ainda nao houver; senao abre direto o seletor. */
    const pedirArquivos = () => {
        setErro('');
        if (pastaMidia?.length) inputRef.current?.click();
        else setEscolhendo(true);
    };

    const handleFiles = async (files: FileList | null) => {
        if (!files?.length) return;
        setErro('');

        // Post AINDA NAO GRAVADO exige pasta escolhida: sem ela o upload cairia no
        // caminho antigo `posts/{eventId}/`, e com eventId vazio o arquivo iria
        // para "posts//arquivo" - orfao, sem dono e impossivel de achar depois.
        // Com pasta, o destino e materiais/, que nao depende de id nenhum.
        if (!eventId && !pastaMidia?.length) {
            setErro('Escolha a pasta antes de enviar.');
            setEscolhendo(true);
            return;
        }

        // Um por vez, em serie. Em paralelo o navegador divide a banda entre os
        // uploads e TODOS ficam lentos, sem nenhum terminar - com um video de
        // 100 MB no meio, a barra parece travada.
        const novas: MidiaArquivo[] = [];
        for (const file of Array.from(files)) {
            try {
                setEnviando({ nome: file.name, pct: 0 });
                const enviada = await enviarMidiaDoPost(
                    empresaId, eventId, file,
                    pct => setEnviando({ nome: file.name, pct }),
                    // Sem pasta escolhida cai no caminho antigo (posts/{id}), que
                    // continua valendo para o que ja existe.
                    pastaMidia?.length ? pastaMidia : undefined
                );

                novas.push({
                    url: enviada.url,
                    path: enviada.path,
                    contentType: enviada.contentType,
                    bytes: enviada.bytes
                });

                // A primeira midia com capa possivel define a capa do post.
                // Gravada aqui, e nao no salvar do modal, porque a capa e o que
                // aparece na grade - perder isso por um "cancelar" seria pior
                // que gravar antes da hora.
                //
                // SEM eventId nao ha onde gravar: a capa vive em covers/{eventId} e
                // o post ainda nao tem id. Nesse caso ela sobe pelo onThumb e quem
                // criou o post grava depois, com o id em maos. Antes esta chamada
                // era incondicional - num post novo escreveria em covers/'' e o
                // Firestore recusaria o caminho, derrubando o upload inteiro.
                const jaTinhaCapa = midias.length > 0 || novas.length > 1;
                if (enviada.thumb && !jaTinhaCapa) {
                    if (eventId) await salvarThumb(empresaId, eventId, enviada.thumb);
                    onThumb(enviada.thumb);
                }
            } catch (e) {
                console.error(e);
                setErro(e instanceof MidiaInvalidaError
                    ? `${file.name}: ${e.message}`
                    : `Não foi possível enviar ${file.name}. Verifique sua conexão.`);
                break; // para na primeira falha: continuar esconderia o erro
            } finally {
                setEnviando(null);
            }
        }

        if (novas.length) onChange([...midias, ...novas]);
        // Limpa o input para permitir reenviar o MESMO arquivo depois de
        // remover: sem isto o onChange nao dispara para um value identico.
        if (inputRef.current) inputRef.current.value = '';
    };

    const handleRemover = async (midia: MidiaArquivo) => {
        if (!window.confirm(`Remover este arquivo da publicação?`)) return;
        setErro('');
        try {
            await removerMidia(midia.path);
            onChange(midias.filter(m => m.path !== midia.path));
        } catch (e) {
            console.error(e);
            // O arquivo continua no bucket. Tirar da lista de qualquer forma
            // deixaria um orfao invisivel, ocupando espaco para sempre.
            setErro('Não foi possível remover o arquivo. Ele continua na publicação.');
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between gap-2 mb-2">
                <label className="block text-xs font-semibold text-zinc-500">
                    Mídia da publicação
                    {midias.length > 0 && (
                        <span className="ml-2 text-zinc-600 font-normal">
                            {midias.length} arquivo(s) · a ordem é a do carrossel
                        </span>
                    )}
                </label>
                {!disabled && (
                    <button
                        type="button"
                        onClick={pedirArquivos}
                        disabled={Boolean(enviando) || preparando}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FABE01] hover:bg-[#FABE01]/10 px-2.5 py-1.5 rounded-full transition-colors disabled:opacity-40"
                    >
                        <Upload className="w-3.5 h-3.5" /> Enviar
                    </button>
                )}
            </div>

            <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={e => handleFiles(e.target.files)}
                className="hidden"
            />

            {/* ONDE OS ARQUIVOS ESTAO. Antes o destino era invisivel - a midia ia
                para posts/{id}/, um caminho com id de documento que ninguem acha
                no bucket. Agora o caminho e escolhido e fica escrito. */}
            {pastaMidia?.length ? (
                <div className="mb-2 bg-[#111111] border border-white/5 rounded-control px-3 py-2">
                    <div className="flex items-center gap-2">
                        <FolderOpen className="w-3.5 h-3.5 text-[#FABE01] shrink-0" />
                        <span className="min-w-0 flex-1 flex items-center gap-1 text-[11px] text-zinc-400 overflow-hidden">
                            <span className="shrink-0">Materiais</span>
                            {pastaMidia.map((seg, i) => (
                                <React.Fragment key={`${seg}-${i}`}>
                                    <ChevronRight className="w-2.5 h-2.5 text-zinc-700 shrink-0" />
                                    <span className={`truncate ${i === pastaMidia.length - 1 ? 'text-zinc-200 font-medium' : ''}`}>
                                        {seg}
                                    </span>
                                </React.Fragment>
                            ))}
                        </span>
                        {!disabled && midias.length === 0 && (
                            // So troca de pasta enquanto nao ha arquivo: com midia
                            // dentro, mudar o destino deixaria metade do carrossel
                            // numa pasta e metade em outra.
                            <button
                                type="button"
                                onClick={() => setEscolhendo(true)}
                                className="shrink-0 text-[10px] font-semibold text-zinc-400 hover:text-white transition-colors"
                            >
                                trocar
                            </button>
                        )}
                    </div>
                    {/* O MESMO ARQUIVO NOS DOIS LUGARES, dito na tela. Nao e copia:
                        a previa aqui e a lista em Arquivos & Materiais leem o mesmo
                        objeto no bucket. Sem esta linha, quem sobe pelo modal nao
                        tem como saber que o material ja esta na pasta do cliente. */}
                    <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed">
                        O que subir aqui aparece nesta pasta em Arquivos &amp; Materiais.
                    </p>
                </div>
            ) : null}

            {midias.length === 0 && !enviando && (
                <button
                    type="button"
                    onClick={() => !disabled && pedirArquivos()}
                    disabled={disabled || preparando}
                    className="w-full py-8 px-4 border border-dashed border-white/10 rounded-control text-center hover:border-[#FABE01]/40 transition-colors disabled:hover:border-white/10 disabled:cursor-not-allowed"
                >
                    {preparando ? (
                        <Loader2 className="w-6 h-6 text-[#FABE01] mx-auto mb-2 animate-spin" />
                    ) : pastaMidia?.length ? (
                        <Upload className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
                    ) : (
                        <Folder className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
                    )}
                    <p className="text-xs text-zinc-400 font-medium">
                        {disabled
                            ? 'Nenhuma mídia enviada'
                            : preparando
                                ? 'Criando a pasta...'
                                : pastaMidia?.length
                                    ? 'Enviar imagem ou vídeo'
                                    : 'Escolher a pasta e enviar'}
                    </p>
                    {!disabled && !preparando && (
                        <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed max-w-xs mx-auto">
                            {pastaMidia?.length
                                ? 'Imagem até 15 MB · vídeo até 300 MB · pode selecionar vários'
                                : 'Em Arquivos & Materiais: crie uma subpasta com o nome do conteúdo ou aproveite uma pasta que já existe.'}
                        </p>
                    )}
                </button>
            )}

            {midias.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {midias.map((midia, i) => (
                        <div key={midia.path} className="relative group aspect-square rounded-chip overflow-hidden bg-[#111111] border border-white/5">
                            {ehVideo({ type: midia.contentType } as File) ? (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                                    <Play className="w-5 h-5 text-zinc-500 fill-current" />
                                    <span className="text-[9px] text-zinc-600">{formatarBytes(midia.bytes)}</span>
                                </div>
                            ) : (
                                <img src={midia.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                            )}

                            {/* Numero da posicao: no carrossel a ordem importa e
                                nao da para inferir olhando a grade. */}
                            <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-black/70 text-white text-[9px] font-bold flex items-center justify-center">
                                {i + 1}
                            </span>

                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => handleRemover(midia)}
                                    aria-label="Remover arquivo"
                                    className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-zinc-300 hover:text-red-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {enviando && (
                <div className="mt-2 bg-[#111111] border border-white/5 rounded-control p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="w-3.5 h-3.5 text-[#FABE01] animate-spin shrink-0" />
                        <span className="text-xs text-zinc-300 truncate flex-1 min-w-0">{enviando.nome}</span>
                        <span className="text-xs text-zinc-500 shrink-0">{enviando.pct}%</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-[#FABE01] transition-all duration-200"
                            style={{ width: `${enviando.pct}%` }}
                        />
                    </div>
                </div>
            )}

            {erro && (
                <p className="text-red-400 text-xs mt-2 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {erro}
                </p>
            )}

            {escolhendo && (
                <PastaPicker
                    empresaId={empresaId}
                    nomeFinal={nomeDaPasta}
                    onEscolher={definirPasta}
                    onFechar={() => setEscolhendo(false)}
                />
            )}
        </div>
    );
};

export default MediaUpload;
