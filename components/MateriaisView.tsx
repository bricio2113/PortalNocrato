import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    PastaMaterial, ArquivoMaterial, listarPastas, listarArquivos, criarPasta,
    criarTemplate, enviarMaterial, removerArquivo, removerPasta,
    tipoDoArquivo, TEMPLATE_PASTAS
} from '../utils/pastas';
import { PageHeader, EmptyState, Card } from './ui';
import { db } from '../utils/firebase';
import { toSafeHref } from '../utils/url';
import {
    Folder, FolderPlus, Upload, ArrowLeft, Trash2, Loader2, AlertTriangle,
    FileText, Play, Download, Sparkles, ExternalLink, Link as LinkIcon
} from 'lucide-react';

interface LinkLegado { id: string; title: string; url: string; category?: string }

interface MateriaisViewProps {
    empresaId: string;
    /** Cliente sobe material, mas nao apaga nem cria/exclui pasta. */
    userRole: 'agencia' | 'cliente';
}

const formatarBytes = (bytes?: number) =>
    bytes === undefined ? '' :
    bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

/**
 * Materiais do cliente, em pastas, dentro do app.
 *
 * Substitui a lista de links do Drive: o arquivo passa a morar no bucket, com as
 * regras de storage.rules valendo. O que o cliente enxerga e a propria pasta e
 * nada mais - o isolamento e por caminho, verificado no servidor.
 *
 * O CLIENTE SOBE, MAS NAO APAGA. Ele manda foto de produto, logo e referencia;
 * remover material que a producao esta usando nao e decisao dele. A regra do
 * Storage diz o mesmo - aqui a interface so nao oferece o botao que ia falhar.
 */
const MateriaisView: React.FC<MateriaisViewProps> = ({ empresaId, userRole }) => {
    const ehAgencia = userRole === 'agencia';
    const [pastas, setPastas] = useState<PastaMaterial[]>([]);
    const [aberta, setAberta] = useState<string | null>(null);
    const [arquivos, setArquivos] = useState<ArquivoMaterial[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [ocupado, setOcupado] = useState('');
    const [erro, setErro] = useState('');
    const [enviando, setEnviando] = useState<{ nome: string; pct: number } | null>(null);
    const [criandoNome, setCriandoNome] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    /**
     * Links do Drive salvos antes das pastas existirem.
     *
     * Esta secao existe porque trocar a tela de links pelas pastas fez o material
     * ja cadastrado DESAPARECER da interface - o dado continuava em drive_links,
     * mas sem nenhum leitor. Isso e perda de acesso, nao migracao. Os links
     * continuam aqui, marcados como antigos, ate a equipe subir os arquivos.
     */
    const [legados, setLegados] = useState<LinkLegado[]>([]);
    useEffect(() => {
        if (!empresaId) return;
        return db.collection('empresas').doc(empresaId).collection('drive_links')
            .onSnapshot(
                snap => setLegados(snap.docs.map(d => ({ id: d.id, ...d.data() } as LinkLegado))),
                erro => console.error('Falha ao ler links antigos:', erro)
            );
    }, [empresaId]);

    const recarregarPastas = useCallback(async () => {
        setCarregando(true);
        setErro('');
        try {
            setPastas(await listarPastas(empresaId));
        } catch (e) {
            console.error(e);
            setErro('Não foi possível carregar as pastas. Verifique sua conexão.');
        } finally {
            setCarregando(false);
        }
    }, [empresaId]);

    useEffect(() => { void recarregarPastas(); }, [recarregarPastas]);

    const abrirPasta = async (nome: string) => {
        setAberta(nome);
        setCarregando(true);
        setErro('');
        try {
            setArquivos(await listarArquivos(empresaId, nome));
        } catch (e) {
            console.error(e);
            setErro('Não foi possível listar os arquivos desta pasta.');
        } finally {
            setCarregando(false);
        }
    };

    const handleTemplate = async () => {
        setOcupado('Criando a estrutura padrão...');
        setErro('');
        try {
            await criarTemplate(empresaId);
            await recarregarPastas();
        } catch (e) {
            console.error(e);
            setErro('Não foi possível criar as pastas. Verifique as permissões.');
        } finally { setOcupado(''); }
    };

    const handleCriar = async () => {
        const nome = (criandoNome || '').trim();
        if (!nome) return;
        setOcupado('Criando pasta...');
        setErro('');
        try {
            await criarPasta(empresaId, nome);
            setCriandoNome(null);
            await recarregarPastas();
        } catch (e) {
            console.error(e);
            setErro(e instanceof Error ? e.message : 'Não foi possível criar a pasta.');
        } finally { setOcupado(''); }
    };

    const handleUpload = async (files: FileList | null) => {
        if (!files?.length || !aberta) return;
        setErro('');
        // Em serie: em paralelo o navegador divide a banda e nenhum termina.
        for (const file of Array.from(files)) {
            try {
                setEnviando({ nome: file.name, pct: 0 });
                await enviarMaterial(empresaId, aberta, file, pct => setEnviando({ nome: file.name, pct }));
            } catch (e) {
                console.error(e);
                setErro(`Não foi possível enviar ${file.name}. Confira o tamanho e o tipo do arquivo.`);
                break;
            } finally { setEnviando(null); }
        }
        if (inputRef.current) inputRef.current.value = '';
        await abrirPasta(aberta);
    };

    const handleRemoverArquivo = async (arquivo: ArquivoMaterial) => {
        if (!window.confirm(`Remover "${arquivo.nome}"?`)) return;
        setErro('');
        try {
            await removerArquivo(arquivo.path);
            setArquivos(prev => prev.filter(a => a.path !== arquivo.path));
        } catch (e) {
            console.error(e);
            setErro('Não foi possível remover o arquivo.');
        }
    };

    const handleRemoverPasta = async (nome: string) => {
        if (!window.confirm(`Excluir a pasta "${nome}" e TODOS os arquivos dentro dela? Isso não tem volta.`)) return;
        setOcupado('Excluindo pasta...');
        setErro('');
        try {
            await removerPasta(empresaId, nome);
            if (aberta === nome) { setAberta(null); setArquivos([]); }
            await recarregarPastas();
        } catch (e) {
            console.error(e);
            setErro('Não foi possível excluir a pasta.');
        } finally { setOcupado(''); }
    };

    // --- PASTA ABERTA ---
    if (aberta) {
        return (
            <div>
                <PageHeader
                    title={aberta}
                    subtitle={`${arquivos.length} arquivo(s)`}
                    actions={
                        <>
                            <button
                                onClick={() => { setAberta(null); setArquivos([]); setErro(''); }}
                                className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-full transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" /> Pastas
                            </button>
                            <button
                                onClick={() => inputRef.current?.click()}
                                disabled={Boolean(enviando)}
                                className="inline-flex items-center gap-2 text-sm font-semibold bg-[#FABE01] hover:bg-[#FABE01]/90 text-black px-5 py-2.5 rounded-full transition-colors disabled:opacity-40"
                            >
                                <Upload className="w-4 h-4" /> Enviar arquivos
                            </button>
                        </>
                    }
                />

                <input ref={inputRef} type="file" multiple onChange={e => handleUpload(e.target.files)} className="hidden" />

                {enviando && (
                    <Card className="p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Loader2 className="w-4 h-4 text-[#FABE01] animate-spin shrink-0" />
                            <span className="text-sm text-zinc-300 truncate flex-1">{enviando.nome}</span>
                            <span className="text-sm text-zinc-500">{enviando.pct}%</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-[#FABE01] transition-all" style={{ width: `${enviando.pct}%` }} />
                        </div>
                    </Card>
                )}

                {erro && (
                    <p className="text-red-400 text-sm mb-4 flex items-start gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {erro}
                    </p>
                )}

                {carregando ? (
                    <div className="py-16 flex justify-center"><Loader2 className="w-7 h-7 text-[#FABE01] animate-spin" /></div>
                ) : arquivos.length === 0 ? (
                    <EmptyState
                        icon={Upload}
                        title="Pasta vazia"
                        description="Envie imagens, vídeos ou documentos. Imagem até 15 MB, vídeo até 300 MB, documento até 25 MB."
                    />
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                        {arquivos.map(arquivo => {
                            const tipo = tipoDoArquivo(arquivo);
                            return (
                                <div key={arquivo.path} className="group bg-[#1A1A1A] border border-white/5 rounded-card overflow-hidden">
                                    <div className="aspect-square bg-[#111111] relative">
                                        {tipo === 'imagem' ? (
                                            <img src={arquivo.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                {tipo === 'video'
                                                    ? <Play className="w-7 h-7 text-zinc-600 fill-current" />
                                                    : <FileText className="w-7 h-7 text-zinc-600" />}
                                            </div>
                                        )}
                                        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <a
                                                href={arquivo.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label={`Abrir ${arquivo.nome}`}
                                                className="p-1.5 rounded-full bg-black/70 text-zinc-300 hover:text-white"
                                            >
                                                <Download className="w-3 h-3" />
                                            </a>
                                            {/* O cliente nao apaga: nao remove material que a
                                                producao esta usando. A regra do Storage recusa
                                                de qualquer forma. */}
                                            {ehAgencia && (
                                                <button
                                                    onClick={() => handleRemoverArquivo(arquivo)}
                                                    aria-label={`Remover ${arquivo.nome}`}
                                                    className="p-1.5 rounded-full bg-black/70 text-zinc-300 hover:text-red-400"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-2">
                                        <p className="text-[11px] text-zinc-300 truncate" title={arquivo.nome}>{arquivo.nome}</p>
                                        <p className="text-[10px] text-zinc-600">{formatarBytes(arquivo.bytes)}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // --- LISTA DE PASTAS ---
    return (
        <div>
            <PageHeader
                title="Arquivos & Materiais"
                subtitle="Tudo do cliente em um lugar só, sem sair do portal."
                actions={ehAgencia ? (
                    <>
                        {pastas.length === 0 && (
                            <button
                                onClick={handleTemplate}
                                disabled={Boolean(ocupado)}
                                className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-full transition-colors disabled:opacity-40"
                            >
                                <Sparkles className="w-4 h-4" /> Criar estrutura padrão
                            </button>
                        )}
                        <button
                            onClick={() => setCriandoNome('')}
                            disabled={Boolean(ocupado)}
                            className="inline-flex items-center gap-2 text-sm font-semibold bg-[#FABE01] hover:bg-[#FABE01]/90 text-black px-5 py-2.5 rounded-full transition-colors disabled:opacity-40"
                        >
                            <FolderPlus className="w-4 h-4" /> Nova pasta
                        </button>
                    </>
                ) : undefined}
            />

            {criandoNome !== null && (
                <Card className="p-4 mb-4">
                    <label className="block text-[11px] font-semibold text-zinc-500 mb-1.5">Nome da pasta</label>
                    <div className="flex gap-2">
                        <input
                            autoFocus
                            value={criandoNome}
                            onChange={e => setCriandoNome(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleCriar(); if (e.key === 'Escape') setCriandoNome(null); }}
                            placeholder="Ex: Ensaio Fotográfico Março"
                            className="flex-1 min-w-0 bg-[#111111] border border-zinc-700 rounded-control px-3 py-2.5 text-sm text-white focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] outline-none"
                        />
                        <button onClick={handleCriar} className="shrink-0 px-4 py-2.5 text-sm font-semibold bg-[#FABE01] text-black rounded-control">Criar</button>
                        <button onClick={() => setCriandoNome(null)} className="shrink-0 px-4 py-2.5 text-sm font-semibold bg-white/5 text-zinc-300 rounded-control">Cancelar</button>
                    </div>
                </Card>
            )}

            {ocupado && (
                <p className="text-zinc-400 text-sm mb-4 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> {ocupado}
                </p>
            )}
            {erro && (
                <p className="text-red-400 text-sm mb-4 flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {erro}
                </p>
            )}

            {carregando ? (
                <div className="py-16 flex justify-center"><Loader2 className="w-7 h-7 text-[#FABE01] animate-spin" /></div>
            ) : pastas.length === 0 ? (
                <EmptyState
                    icon={Folder}
                    title="Nenhuma pasta ainda"
                    description={ehAgencia
                        ? `Crie a estrutura padrão (${TEMPLATE_PASTAS.join(', ')}) ou monte as suas.`
                        : 'A agência ainda não organizou as pastas deste cliente.'}
                />
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {pastas.map(pasta => (
                        <div key={pasta.path} className="group relative">
                            <button
                                onClick={() => abrirPasta(pasta.nome)}
                                className="w-full text-left bg-[#1A1A1A] border border-white/5 hover:border-[#FABE01]/40 rounded-card p-4 flex items-center gap-3 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#FABE01]"
                            >
                                <span className="w-10 h-10 shrink-0 rounded-chip bg-[#FABE01]/10 text-[#FABE01] flex items-center justify-center">
                                    <Folder className="w-5 h-5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold text-white truncate">{pasta.nome}</span>
                                    <span className="block text-[11px] text-zinc-600">abrir</span>
                                </span>
                            </button>
                            {ehAgencia && (
                                <button
                                    onClick={() => handleRemoverPasta(pasta.nome)}
                                    aria-label={`Excluir pasta ${pasta.nome}`}
                                    className="absolute top-2 right-2 p-1.5 rounded-full text-zinc-700 hover:text-red-400 hover:bg-red-400/5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {legados.length > 0 && (
                <div className="mt-8">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-white">Links do Drive</h3>
                        <span className="text-[10px] font-semibold text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full">
                            {legados.length} · cadastro antigo
                        </span>
                    </div>
                    <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
                        Salvos antes das pastas existirem. Continuam funcionando; conforme os
                        arquivos subirem para as pastas acima, dá para removê-los.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {legados.map(link => {
                            // Revalida o esquema na leitura: link gravado antes da
                            // validacao existir pode conter javascript: ou data:.
                            const href = toSafeHref(link.url);
                            return (
                                <div key={link.id} className="bg-[#1A1A1A] border border-white/5 rounded-control p-3 flex items-center gap-2.5">
                                    <LinkIcon className="w-4 h-4 text-zinc-600 shrink-0" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm text-zinc-200 truncate">{link.title}</span>
                                        {link.category && <span className="block text-[10px] text-zinc-600">{link.category}</span>}
                                    </span>
                                    {href ? (
                                        <a
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={`Abrir ${link.title}`}
                                            className="shrink-0 p-1.5 rounded-full text-zinc-500 hover:text-[#FABE01] hover:bg-[#FABE01]/10 transition-colors"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    ) : (
                                        <span className="shrink-0 text-[10px] text-red-400">inválido</span>
                                    )}
                                    {ehAgencia && (
                                        <button
                                            onClick={async () => {
                                                if (!window.confirm(`Remover o link "${link.title}"?`)) return;
                                                try {
                                                    await db.collection('empresas').doc(empresaId)
                                                        .collection('drive_links').doc(link.id).delete();
                                                } catch (e) {
                                                    console.error(e);
                                                    setErro('Não foi possível remover o link.');
                                                }
                                            }}
                                            aria-label={`Remover link ${link.title}`}
                                            className="shrink-0 p-1.5 rounded-full text-zinc-700 hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MateriaisView;
