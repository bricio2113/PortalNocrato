import React, { useState, useEffect, useCallback } from 'react';
import { Caminho, listar, criarPasta, PROFUNDIDADE_MAX } from '../utils/pastas';
import {
    Folder, FolderPlus, ChevronRight, HardDrive, Loader2, AlertTriangle, X, Check
} from 'lucide-react';

interface PastaPickerProps {
    empresaId: string;
    /** Nome da pasta que sera criada dentro da escolhida. Vai no rodape. */
    nomeFinal: string;
    /**
     * Devolve a pasta em que estamos e O QUE FAZER com ela:
     *
     *   criarSubpasta = true  -> criar `nomeFinal` DENTRO dela e usar a nova
     *   criarSubpasta = false -> usar esta pasta como esta, sem criar nada
     */
    onEscolher: (caminho: Caminho, criarSubpasta: boolean) => void;
    onFechar: () => void;
}

/**
 * Escolher onde a midia do conteudo vai morar.
 *
 * Navega a arvore de Arquivos & Materiais. Nao e um select: um combo achatado com
 * "Imagens/2026/Agosto" em cada linha exigiria varrer a arvore inteira antes de
 * abrir - uma requisicao por pasta, em todos os niveis - e ficaria ilegivel com
 * dez pastas. Navegar custa uma requisicao por nivel VISITADO, e e o gesto que a
 * pessoa ja conhece do Drive.
 *
 * DOIS DESFECHOS, nao um. A primeira versao SEMPRE criava uma subpasta com o
 * titulo do conteudo: quem ja tinha "Imagens/Ensaio Agosto" pronta, com o material
 * dentro, era obrigado a ganhar uma pasta nova e vazia ao lado. Agora "usar esta
 * pasta" existe, e e o desfecho certo quando a pasta do material ja foi feita a
 * mao.
 *
 * O rodape mostra o caminho final ANTES de confirmar, em cada uma das duas opcoes.
 * Sem isso, "criar pasta com o titulo do conteudo" e uma promessa que so se
 * confere depois, no bucket.
 */
const PastaPicker: React.FC<PastaPickerProps> = ({ empresaId, nomeFinal, onEscolher, onFechar }) => {
    const [caminho, setCaminho] = useState<Caminho>([]);
    const [pastas, setPastas] = useState<{ nome: string; caminho: Caminho }[]>([]);
    /**
     * Quantos arquivos JA existem no nivel aberto.
     *
     * O seletor lista pastas e joga os arquivos fora - navegar e o que importa. Mas
     * "usar esta pasta" e uma decisao sobre onde a peca vai morar, e uma pasta vazia
     * e uma pasta com 40 fotos dentro sao escolhas diferentes. O `listar` ja traz a
     * contagem na mesma resposta: mostrar custa zero requisicao.
     */
    const [arquivos, setArquivos] = useState(0);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');
    const [criando, setCriando] = useState<string | null>(null);
    const [ocupado, setOcupado] = useState(false);

    const carregar = useCallback(async (alvo: Caminho) => {
        setCarregando(true);
        setErro('');
        try {
            const { pastas: lista, arquivos: nivel } = await listar(empresaId, alvo);
            setPastas(lista);
            setArquivos(nivel.length);
        } catch (e) {
            console.error(e);
            setErro('Não foi possível listar as pastas.');
            setPastas([]);
            setArquivos(0);
        } finally {
            setCarregando(false);
        }
    }, [empresaId]);

    const chave = caminho.join('/');
    useEffect(() => { void carregar(chave ? chave.split('/') : []); }, [chave, carregar]);

    useEffect(() => {
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
        document.addEventListener('keydown', esc);
        return () => document.removeEventListener('keydown', esc);
    }, [onFechar]);

    const criarAqui = async () => {
        const nome = (criando || '').trim();
        if (!nome) return;
        setOcupado(true);
        setErro('');
        try {
            await criarPasta(empresaId, caminho, nome);
            setCriando(null);
            await carregar(caminho);
        } catch (e) {
            console.error(e);
            setErro(e instanceof Error ? e.message : 'Não foi possível criar a pasta.');
        } finally { setOcupado(false); }
    };

    // Reserva um nivel para a pasta do conteudo, que sera criada DENTRO desta.
    const cabeMaisUm = caminho.length < PROFUNDIDADE_MAX;

    return (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md sm:p-4 animate-in fade-in">
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Escolher pasta"
                className="w-full sm:max-w-lg bg-[#1A1A1A] border-t sm:border border-white/15 rounded-t-card sm:rounded-card shadow-[0_24px_80px_rgba(0,0,0,0.6)] flex flex-col max-h-[85dvh] overflow-hidden"
            >
                <header className="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-white/5">
                    <span className="w-1 h-5 rounded-full bg-[#FABE01] shrink-0" />
                    <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-bold text-white tracking-tight">Onde salvar a mídia</h2>
                        <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                            Crie uma subpasta com o nome do conteúdo ou use uma pasta que já existe.
                        </p>
                    </div>
                    <button
                        onClick={onFechar}
                        aria-label="Fechar"
                        className="p-2 -mr-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </header>

                <nav aria-label="Caminho" className="shrink-0 flex items-center gap-1 flex-wrap px-5 py-3 border-b border-white/5 text-xs">
                    <button
                        onClick={() => setCaminho([])}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full transition-colors ${
                            caminho.length === 0 ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <HardDrive className="w-3.5 h-3.5" /> Materiais
                    </button>
                    {caminho.map((seg, i) => (
                        <React.Fragment key={`${seg}-${i}`}>
                            <ChevronRight className="w-3 h-3 text-zinc-700 shrink-0" />
                            <button
                                onClick={() => setCaminho(caminho.slice(0, i + 1))}
                                disabled={i === caminho.length - 1}
                                className={`px-2 py-1 rounded-full max-w-[10rem] truncate transition-colors ${
                                    i === caminho.length - 1
                                        ? 'text-white font-semibold'
                                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {seg}
                            </button>
                        </React.Fragment>
                    ))}
                </nav>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                    {carregando ? (
                        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-[#FABE01] animate-spin" /></div>
                    ) : (
                        <>
                            {pastas.length === 0 && (
                                <p className="text-xs text-zinc-500 text-center py-6 px-4 leading-relaxed">
                                    {caminho.length === 0
                                        ? 'Nenhuma pasta em Materiais ainda. Crie uma aqui.'
                                        : 'Sem subpastas. Você pode salvar aqui mesmo.'}
                                </p>
                            )}
                            <ul className="space-y-1">
                                {pastas.map(pasta => (
                                    <li key={pasta.caminho.join('/')}>
                                        <button
                                            onClick={() => setCaminho(pasta.caminho)}
                                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-control hover:bg-white/[0.04] transition-colors text-left group"
                                        >
                                            <Folder className="w-4 h-4 text-[#FABE01] shrink-0" />
                                            <span className="text-sm text-zinc-100 truncate flex-1">{pasta.nome}</span>
                                            <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-[#FABE01] shrink-0 transition-colors" />
                                        </button>
                                    </li>
                                ))}
                            </ul>

                            {criando !== null ? (
                                <div className="mt-2 p-3 bg-[#111111] border border-white/10 rounded-control">
                                    <div className="flex gap-2">
                                        <input
                                            autoFocus
                                            value={criando}
                                            onChange={e => setCriando(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') { e.preventDefault(); criarAqui(); }
                                                if (e.key === 'Escape') { e.preventDefault(); setCriando(null); }
                                            }}
                                            placeholder="Nome da pasta"
                                            className="min-w-0 flex-1 bg-black/40 border border-white/10 rounded-control px-2.5 py-1.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-[#FABE01]"
                                        />
                                        <button
                                            onClick={criarAqui}
                                            disabled={ocupado || !criando.trim()}
                                            className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-[#FABE01] text-black rounded-control disabled:opacity-40"
                                        >
                                            {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Criar'}
                                        </button>
                                    </div>
                                </div>
                            ) : cabeMaisUm && (
                                <button
                                    onClick={() => setCriando('')}
                                    className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-zinc-400 hover:text-white border border-dashed border-white/10 hover:border-white/25 rounded-control transition-colors"
                                >
                                    <FolderPlus className="w-3.5 h-3.5" /> Nova pasta aqui
                                </button>
                            )}
                        </>
                    )}

                    {erro && (
                        <p className="text-red-400 text-xs mt-3 flex items-start gap-1.5 px-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {erro}
                        </p>
                    )}
                </div>

                <footer className="shrink-0 border-t border-white/5 p-3 bg-white/[0.02] space-y-2">
                    {/* CRIAR SUBPASTA - o caminho principal: material novo, pasta
                        propria com o nome do conteudo. */}
                    <button
                        onClick={() => onEscolher(caminho, true)}
                        disabled={!nomeFinal || !cabeMaisUm}
                        className="w-full text-left px-3.5 py-2.5 rounded-control bg-[#FABE01] text-black hover:bg-[#FABE01]/90 transition-colors disabled:opacity-40"
                    >
                        <span className="flex items-center gap-2 text-sm font-semibold">
                            <FolderPlus className="w-4 h-4 shrink-0" />
                            Criar a pasta do conteúdo aqui
                        </span>
                        <span className="block text-[10px] font-mono text-black/70 mt-0.5 truncate">
                            Materiais/{caminho.length ? `${caminho.join('/')}/` : ''}
                            <strong>{nomeFinal || '(título do conteúdo)'}</strong>
                        </span>
                    </button>

                    {/* USAR ESTA PASTA - para quando a pasta do material ja existe.
                        Desligada na raiz: jogar midia de post soltas em Materiais/
                        e o oposto de organizar, e sem pasta nao ha o que "usar". */}
                    <button
                        onClick={() => onEscolher(caminho, false)}
                        disabled={caminho.length === 0}
                        className="w-full text-left px-3.5 py-2.5 rounded-control bg-white/5 text-zinc-200 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-40"
                    >
                        <span className="flex items-center gap-2 text-sm font-semibold">
                            <Check className="w-4 h-4 shrink-0" />
                            {caminho.length === 0
                                ? 'Usar esta pasta'
                                : `Usar “${caminho[caminho.length - 1]}”`}
                        </span>
                        <span className="block text-[10px] font-mono text-zinc-500 mt-0.5 truncate">
                            {caminho.length === 0
                                ? 'entre em uma pasta para usá-la como está'
                                : `Materiais/${caminho.join('/')}${arquivos ? ` · já tem ${arquivos} arquivo(s)` : ' · vazia'}`}
                        </span>
                    </button>

                    {!nomeFinal && (
                        <p className="text-[10px] text-zinc-500 leading-relaxed px-1">
                            Sem título na publicação não há nome para a subpasta — dê um título ou
                            use uma pasta existente.
                        </p>
                    )}
                    {!cabeMaisUm && (
                        <p className="text-[10px] text-amber-400/90 leading-relaxed px-1">
                            Limite de {PROFUNDIDADE_MAX} níveis: aqui só cabe “usar esta pasta”.
                            Para criar a pasta do conteúdo, escolha um nível acima.
                        </p>
                    )}
                </footer>
            </div>
        </div>
    );
};

export default PastaPicker;
