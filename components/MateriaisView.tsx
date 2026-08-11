import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Caminho, PastaMaterial, ArquivoMaterial, ConteudoPasta, listar, criarPasta,
    criarTemplate, enviarMaterial, removerArquivo, removerPasta,
    tipoDoArquivo, TEMPLATE_PASTAS, PROFUNDIDADE_MAX
} from '../utils/pastas';
import { PageHeader, EmptyState, Card, SegmentedTabs } from './ui';
import MediaViewer from './MediaViewer';
import BrandStudyView from './BrandStudyView';
import {
    Atalho, subscribeAtalhos, criarAtalho, removerAtalho, atalhosDaPasta, UrlInvalidaError
} from '../utils/atalhos';
import { toSafeHref } from '../utils/url';
import {
    Folder, FolderPlus, Upload, ArrowLeft, Trash2, Loader2, AlertTriangle,
    FileText, Play, Download, Sparkles, ExternalLink, Link as LinkIcon,
    ChevronRight, HardDrive, RefreshCw
} from 'lucide-react';

interface MateriaisViewProps {
    empresaId: string;
    /** Cliente sobe material, mas nao apaga nem cria/exclui pasta. */
    userRole: 'agencia' | 'cliente';
    /** Quem esta editando - vai para o "alterado por" do estudo de marca. */
    autorEmail?: string | null;
    autorNome?: string | null;
}

/**
 * As duas metades desta tela.
 *
 * ARQUIVO e o material bruto; ESTUDO e a direcao para usar esse material. Ficam
 * juntos porque a pergunta e a mesma - "o que eu tenho para criar deste cliente?" -
 * e separar em dois itens de menu faria o estudo virar aquela pagina que ninguem
 * abre.
 */
type Aba = 'pastas' | 'marca';

const formatarBytes = (bytes?: number) =>
    bytes === undefined ? '' :
    bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

/**
 * Materiais do cliente, em ARVORE de pastas, dentro do app.
 *
 * Substitui a lista de links do Drive: o arquivo mora no bucket, com as regras de
 * storage.rules valendo. O que o cliente enxerga e a propria pasta e nada mais - o
 * isolamento e por caminho, verificado no servidor.
 *
 * ERAM DUAS TELAS - "lista de pastas" e "dentro da pasta" -, uma por nivel, o que
 * so funcionava com um nivel. Agora e UMA tela navegando por caminho: pastas em
 * cima, arquivos embaixo, migalha para subir. Cada nivel pode ter os dois, como no
 * Drive.
 *
 * O CLIENTE SOBE, MAS NAO APAGA. Ele manda foto de produto, logo e referencia;
 * remover material que a producao esta usando nao e decisao dele. A regra do
 * Storage diz o mesmo - aqui a interface so nao oferece o botao que ia falhar.
 */
const MateriaisView: React.FC<MateriaisViewProps> = ({ empresaId, userRole, autorEmail, autorNome }) => {
    const ehAgencia = userRole === 'agencia';
    const [aba, setAba] = useState<Aba>('pastas');

    /** Onde estamos. Vazio = raiz de materiais. */
    const [caminho, setCaminho] = useState<Caminho>([]);
    const [conteudo, setConteudo] = useState<ConteudoPasta>({ pastas: [], arquivos: [] });
    const [carregando, setCarregando] = useState(true);
    const [ocupado, setOcupado] = useState('');
    const [erro, setErro] = useState('');
    const [enviando, setEnviando] = useState<{ nome: string; pct: number } | null>(null);
    const [criandoNome, setCriandoNome] = useState<string | null>(null);
    /** Arquivo aberto em tamanho grande. Indice na lista da pasta atual. */
    const [visualizando, setVisualizando] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    /**
     * Atalhos para o material bruto no Drive.
     *
     * A colecao nasceu como legado - links salvos antes das pastas existirem, que
     * ficariam sem leitor nenhum se a tela de links simplesmente sumisse. Hoje ela e
     * PARTE DO FLUXO: bruto, captacao e ensaio vivem no Drive (sync de desktop,
     * tamanho, edicao no lugar) e as pastas guardam a entrega pronta.
     *
     * E agora eles moram DENTRO DAS PASTAS, nao numa lista separada na raiz. Antes
     * eram duas navegacoes na mesma tela: a arvore em cima e uma caixinha de links
     * embaixo, sem relacao entre as duas. Como atalho, "Carrossel / Agosto" pode ter
     * as pecas prontas e, ao lado, o caminho para a captacao no Drive.
     */
    const [atalhos, setAtalhos] = useState<Atalho[]>([]);
    useEffect(() => {
        if (!empresaId) return;
        return subscribeAtalhos(empresaId, setAtalhos);
    }, [empresaId]);

    /** Formulario de atalho aberto: { title, url }. */
    const [novoAtalho, setNovoAtalho] = useState<{ title: string; url: string } | null>(null);

    const handleCriarAtalho = async () => {
        if (!novoAtalho) return;
        setOcupado('Criando atalho...');
        setErro('');
        try {
            await criarAtalho(empresaId, caminho, novoAtalho.title, novoAtalho.url, autorEmail);
            setNovoAtalho(null);
        } catch (e) {
            console.error(e);
            setErro(e instanceof UrlInvalidaError ? e.message : 'Não foi possível criar o atalho.');
        } finally { setOcupado(''); }
    };

    const handleRemoverAtalho = async (atalho: Atalho) => {
        if (!window.confirm(`Remover o atalho "${atalho.title}"? O material no Drive não é afetado.`)) return;
        setErro('');
        try {
            await removerAtalho(empresaId, atalho.id);
        } catch (e) {
            console.error(e);
            setErro('Não foi possível remover o atalho.');
        }
    };

    const carregar = useCallback(async (alvo: Caminho) => {
        setCarregando(true);
        setErro('');
        try {
            setConteudo(await listar(empresaId, alvo));
        } catch (e) {
            console.error(e);
            setErro('Não foi possível carregar esta pasta. Verifique sua conexão.');
            setConteudo({ pastas: [], arquivos: [] });
        } finally {
            setCarregando(false);
        }
    }, [empresaId]);

    // Recarrega a cada mudanca de caminho. A dependencia e o caminho SERIALIZADO:
    // o array e recriado a cada render e um efeito que dependesse dele rodaria
    // para sempre.
    const chave = caminho.join('/');
    useEffect(() => { void carregar(chave ? chave.split('/') : []); }, [chave, carregar]);

    const navegar = (alvo: Caminho) => {
        setCriandoNome(null);
        // O visualizador aponta para um INDICE da pasta atual: mantê-lo aberto ao
        // trocar de pasta mostraria o arquivo errado, ou nenhum.
        setVisualizando(null);
        setErro('');
        setCaminho(alvo);
    };

    const handleTemplate = async () => {
        setOcupado('Criando a estrutura padrão...');
        setErro('');
        try {
            await criarTemplate(empresaId);
            await carregar(caminho);
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
            await criarPasta(empresaId, caminho, nome);
            setCriandoNome(null);
            await carregar(caminho);
        } catch (e) {
            console.error(e);
            setErro(e instanceof Error ? e.message : 'Não foi possível criar a pasta.');
        } finally { setOcupado(''); }
    };

    const handleUpload = async (files: FileList | null) => {
        if (!files?.length) return;
        setErro('');
        // Em serie: em paralelo o navegador divide a banda e nenhum termina.
        for (const file of Array.from(files)) {
            try {
                setEnviando({ nome: file.name, pct: 0 });
                await enviarMaterial(empresaId, caminho, file, pct => setEnviando({ nome: file.name, pct }));
            } catch (e) {
                console.error(e);
                setErro(`Não foi possível enviar ${file.name}. Confira o tamanho e o tipo do arquivo.`);
                break;
            } finally { setEnviando(null); }
        }
        if (inputRef.current) inputRef.current.value = '';
        await carregar(caminho);
    };

    const handleRemoverArquivo = async (arquivo: ArquivoMaterial) => {
        if (!window.confirm(`Remover "${arquivo.nome}"?`)) return;
        setErro('');
        try {
            await removerArquivo(arquivo.path);
            setVisualizando(null);
            setConteudo(prev => ({ ...prev, arquivos: prev.arquivos.filter(a => a.path !== arquivo.path) }));
        } catch (e) {
            console.error(e);
            setErro('Não foi possível remover o arquivo.');
        }
    };

    const handleRemoverPasta = async (pasta: PastaMaterial) => {
        // O aviso diz SUBPASTAS: numa arvore, quem apaga "Imagens" pode nao ter
        // ideia de quantos niveis vao junto.
        if (!window.confirm(
            `Excluir a pasta "${pasta.nome}" com TODAS as subpastas e arquivos dentro dela? Isso não tem volta.`
        )) return;
        setOcupado('Excluindo pasta...');
        setErro('');
        try {
            await removerPasta(empresaId, pasta.caminho);
            await carregar(caminho);
        } catch (e) {
            console.error(e);
            setErro('Não foi possível excluir a pasta.');
        } finally { setOcupado(''); }
    };

    const daPasta = atalhosDaPasta(atalhos, caminho);
    // Pasta com SO um atalho nao esta vazia: dizer "pasta vazia" com um atalho na
    // tela seria a interface negando o que ela mesma mostra.
    const vazio = conteudo.pastas.length === 0 && conteudo.arquivos.length === 0 && daPasta.length === 0;
    const naRaiz = caminho.length === 0;
    const podeAninhar = caminho.length < PROFUNDIDADE_MAX;

    return (
        <div>
            <PageHeader
                title={aba === 'marca'
                    ? 'Arquivos & Materiais'
                    : naRaiz ? 'Arquivos & Materiais' : caminho[caminho.length - 1]}
                subtitle={aba === 'marca'
                    ? 'O estudo que direciona a criação deste cliente.'
                    : naRaiz
                        ? 'As entregas prontas do cliente. O bruto fica no Drive.'
                        : `${conteudo.pastas.length} pasta(s) · ${conteudo.arquivos.length} arquivo(s)`}
                actions={aba === 'marca' ? null : (
                    <>
                        {!naRaiz && (
                            <button
                                onClick={() => navegar(caminho.slice(0, -1))}
                                className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-full transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" /> Voltar
                            </button>
                        )}
                        {/* ATUALIZAR. O Cloud Storage nao tem onSnapshot: a
                            listagem e uma requisicao, tirada no momento em que a
                            pasta abriu. Quando a midia sobe pelo modal de conteudo -
                            para uma pasta daqui -, esta tela nao fica sabendo. Sem
                            este botao, a unica forma de ver o arquivo novo era sair
                            da pasta e voltar. */}
                        <button
                            onClick={() => carregar(caminho)}
                            disabled={carregando || Boolean(ocupado) || Boolean(enviando)}
                            className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-full transition-colors disabled:opacity-40"
                        >
                            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
                        </button>
                        {ehAgencia && naRaiz && conteudo.pastas.length === 0 && (
                            <button
                                onClick={handleTemplate}
                                disabled={Boolean(ocupado)}
                                className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-full transition-colors disabled:opacity-40"
                            >
                                <Sparkles className="w-4 h-4" /> Criar estrutura padrão
                            </button>
                        )}
                        {ehAgencia && podeAninhar && (
                            <button
                                onClick={() => setCriandoNome('')}
                                disabled={Boolean(ocupado)}
                                className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-full transition-colors disabled:opacity-40"
                            >
                                <FolderPlus className="w-4 h-4" /> Nova pasta
                            </button>
                        )}
                        {/* ATALHO PARA O DRIVE, na pasta em que se esta. O bruto vive
                            la; sem um caminho daqui para la, sao duas navegacoes sem
                            relacao. O cliente tambem pode criar: e comum ele mandar
                            "subi as fotos nesta pasta". */}
                        <button
                            onClick={() => setNovoAtalho({ title: '', url: '' })}
                            disabled={Boolean(ocupado)}
                            className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-full transition-colors disabled:opacity-40"
                        >
                            <LinkIcon className="w-4 h-4" /> Atalho do Drive
                        </button>
                        {/* Enviar em QUALQUER nivel, inclusive na raiz - no Drive
                            tambem da, e obrigar a entrar numa pasta para subir um
                            arquivo solto e uma trava sem motivo. */}
                        <button
                            onClick={() => inputRef.current?.click()}
                            disabled={Boolean(enviando)}
                            className="inline-flex items-center gap-2 text-sm font-semibold bg-[#FABE01] hover:bg-[#FABE01]/90 text-black px-5 py-2.5 rounded-full transition-colors disabled:opacity-40"
                        >
                            <Upload className="w-4 h-4" /> Enviar arquivos
                        </button>
                    </>
                )}
            />

            {/* ABAS. O estudo de marca e a outra metade desta tela: material bruto de
                um lado, direcao de uso do outro. */}
            <div className="mb-5">
                <SegmentedTabs
                    value={aba}
                    onChange={setAba}
                    options={[
                        { id: 'pastas', label: 'Pastas e arquivos', icon: Folder },
                        { id: 'marca', label: 'Estudo de marca', icon: Sparkles }
                    ]}
                />
            </div>

            {aba === 'marca' ? (
                <BrandStudyView empresaId={empresaId} autorEmail={autorEmail} autorNome={autorNome} />
            ) : (
            <>

            {/* MIGALHA. Numa arvore, "voltar" nao basta: sem ela, quem esta em
                Imagens > 2026 > Agosto nao sabe onde esta nem sobe dois niveis de
                uma vez. */}
            <nav aria-label="Caminho" className="flex items-center gap-1 flex-wrap mb-4 text-xs">
                <button
                    onClick={() => navegar([])}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full transition-colors ${
                        naRaiz ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <HardDrive className="w-3.5 h-3.5" /> Materiais
                </button>
                {caminho.map((segmento, i) => {
                    const ultimo = i === caminho.length - 1;
                    return (
                        <React.Fragment key={`${segmento}-${i}`}>
                            <ChevronRight className="w-3 h-3 text-zinc-700 shrink-0" />
                            <button
                                onClick={() => navegar(caminho.slice(0, i + 1))}
                                disabled={ultimo}
                                className={`px-2 py-1 rounded-full max-w-[12rem] truncate transition-colors ${
                                    ultimo ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {segmento}
                            </button>
                        </React.Fragment>
                    );
                })}
            </nav>

            <input ref={inputRef} type="file" multiple onChange={e => handleUpload(e.target.files)} className="hidden" />

            {criandoNome !== null && (
                <Card className="p-4 mb-4">
                    <label className="block text-[11px] font-semibold text-zinc-500 mb-1.5">
                        Nome da pasta {naRaiz ? '' : `dentro de “${caminho[caminho.length - 1]}”`}
                    </label>
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

            {novoAtalho && (
                <Card className="p-4 mb-4">
                    <label className="block text-[11px] font-semibold text-zinc-500 mb-1.5">
                        Atalho para o Drive {naRaiz ? 'na raiz' : `dentro de “${caminho[caminho.length - 1]}”`}
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input
                            autoFocus
                            value={novoAtalho.title}
                            onChange={e => setNovoAtalho({ ...novoAtalho, title: e.target.value })}
                            placeholder="Nome. Ex: Captação Agosto (bruto)"
                            aria-label="Nome do atalho"
                            className="sm:w-64 bg-[#111111] border border-zinc-700 rounded-control px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#FABE01] outline-none"
                        />
                        <input
                            value={novoAtalho.url}
                            onChange={e => setNovoAtalho({ ...novoAtalho, url: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') handleCriarAtalho(); if (e.key === 'Escape') setNovoAtalho(null); }}
                            placeholder="https://drive.google.com/drive/folders/..."
                            aria-label="Link do Drive"
                            className="flex-1 min-w-0 bg-[#111111] border border-zinc-700 rounded-control px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#FABE01] outline-none"
                        />
                        <button onClick={handleCriarAtalho} className="shrink-0 px-4 py-2.5 text-sm font-semibold bg-[#FABE01] text-black rounded-control">Criar</button>
                        <button onClick={() => setNovoAtalho(null)} className="shrink-0 px-4 py-2.5 text-sm font-semibold bg-white/5 text-zinc-300 rounded-control">Cancelar</button>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed">
                        O atalho aponta para o Drive — não copia nada para cá. Bruto, captação e arquivo
                        aberto ficam lá; aqui ficam as entregas.
                    </p>
                </Card>
            )}

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
            ) : vazio ? (
                <EmptyState
                    icon={naRaiz ? Folder : Upload}
                    title={naRaiz ? 'Nenhuma pasta ainda' : 'Pasta vazia'}
                    description={naRaiz
                        ? (ehAgencia
                            ? `Aqui ficam as ENTREGAS prontas, por tipo de peça (${TEMPLATE_PASTAS.join(', ')}). O material bruto fica no Drive.`
                            : 'A agência ainda não organizou as pastas deste cliente.')
                        : 'Envie arquivos ou crie uma subpasta. Imagem até 15 MB, vídeo até 300 MB, documento até 25 MB.'}
                />
            ) : (
                <div className="space-y-6">
                    {/* ATALHOS primeiro: material bruto e onde o trabalho comeca, e
                        quem entra na pasta procurando "de onde veio isso" olha aqui. */}
                    {daPasta.length > 0 && (
                        <section>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">
                                Atalhos · bruto no Drive
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {daPasta.map(atalho => {
                                    // Revalida na LEITURA: link do cadastro antigo pode
                                    // ter entrado antes da validacao existir.
                                    const href = toSafeHref(atalho.url);
                                    return (
                                        <div key={atalho.id} className="group relative bg-[#1A1A1A] border border-white/5 rounded-card p-4 flex items-center gap-3">
                                            <span className="w-10 h-10 shrink-0 rounded-chip bg-white/5 text-zinc-300 flex items-center justify-center">
                                                <ExternalLink className="w-4 h-4" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-semibold text-white truncate">{atalho.title}</span>
                                                <span className="block text-[11px] text-zinc-600 truncate">
                                                    {href ? 'abrir no Drive' : 'link inválido'}
                                                    {atalho.category ? ` · ${atalho.category}` : ''}
                                                </span>
                                            </span>
                                            {href && (
                                                <a
                                                    href={href}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    aria-label={`Abrir ${atalho.title}`}
                                                    className="absolute inset-0 rounded-card focus:outline-none focus-visible:ring-1 focus-visible:ring-[#FABE01]"
                                                />
                                            )}
                                            {ehAgencia && (
                                                <button
                                                    onClick={() => handleRemoverAtalho(atalho)}
                                                    aria-label={`Remover atalho ${atalho.title}`}
                                                    className="relative p-1.5 rounded-full text-zinc-700 hover:text-red-400 hover:bg-red-400/5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {conteudo.pastas.length > 0 && (
                        <section>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">
                                Pastas
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                {conteudo.pastas.map(pasta => (
                                    <div key={pasta.caminho.join('/')} className="group relative">
                                        <button
                                            onClick={() => navegar(pasta.caminho)}
                                            className="w-full text-left bg-[#1A1A1A] border border-white/5 hover:border-[#FABE01]/40 rounded-card p-4 flex items-center gap-3 transition-colors focus:outline-none focus-visible:border-[#FABE01]"
                                        >
                                            <span className="w-10 h-10 shrink-0 rounded-chip bg-[#FABE01]/10 text-[#FABE01] flex items-center justify-center">
                                                <Folder className="w-5 h-5" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-semibold text-white truncate">{pasta.nome}</span>
                                                <span className="block text-[11px] text-zinc-600">abrir</span>
                                            </span>
                                            <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-[#FABE01] shrink-0 transition-colors" />
                                        </button>
                                        {ehAgencia && (
                                            <button
                                                onClick={() => handleRemoverPasta(pasta)}
                                                aria-label={`Excluir pasta ${pasta.nome}`}
                                                className="absolute top-2 right-2 p-1.5 rounded-full text-zinc-700 hover:text-red-400 hover:bg-red-400/5 bg-[#1A1A1A] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {conteudo.arquivos.length > 0 && (
                        <section>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">
                                Arquivos
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                                {conteudo.arquivos.map((arquivo, i) => {
                                    const tipo = tipoDoArquivo(arquivo);
                                    return (
                                        <div key={arquivo.path} className="group relative bg-[#1A1A1A] border border-white/5 rounded-card overflow-hidden">
                                            {/* A PECA ABRE NO CLIQUE. Antes a miniatura era
                                                decoracao: para ver a foto inteira ou assistir
                                                o video, so baixando. Numa pasta com dez
                                                pecas, dez downloads para achar uma.

                                                Baixar e excluir ficam FORA deste botao, em
                                                camada propria sobre o card: <a> e <button>
                                                dentro de <button> e HTML invalido, e o
                                                clique de um vira o clique do outro. */}
                                            <button
                                                type="button"
                                                onClick={() => setVisualizando(i)}
                                                aria-label={`Abrir ${arquivo.nome}`}
                                                className="w-full aspect-square bg-[#111111] block cursor-zoom-in"
                                            >
                                                {tipo === 'imagem' ? (
                                                    <img src={arquivo.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        {tipo === 'video'
                                                            ? <Play className="w-7 h-7 text-zinc-600 fill-current" />
                                                            : <FileText className="w-7 h-7 text-zinc-600" />}
                                                    </div>
                                                )}
                                            </button>

                                            {/* Video precisa DIZER que toca: miniatura
                                                parada nao se distingue de imagem. */}
                                            {tipo === 'video' && (
                                                <span className="absolute bottom-11 left-1.5 text-[9px] font-semibold text-white bg-black/70 px-1.5 py-0.5 rounded-full pointer-events-none">
                                                    vídeo
                                                </span>
                                            )}

                                            <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <a
                                                    href={arquivo.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    aria-label={`Baixar ${arquivo.nome}`}
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

                                            <div className="p-2">
                                                <p className="text-[11px] text-zinc-300 truncate" title={arquivo.nome}>{arquivo.nome}</p>
                                                <p className="text-[10px] text-zinc-600">{formatarBytes(arquivo.bytes)}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </div>
            )}

            {/* VISUALIZADOR. Fora da grade de proposito: e camada sobre a tela
                inteira, e dentro do card herdaria o `overflow-hidden` dele. */}
            {visualizando !== null && conteudo.arquivos[visualizando] && (
                <MediaViewer
                    arquivos={conteudo.arquivos}
                    indice={visualizando}
                    onTrocar={setVisualizando}
                    onFechar={() => setVisualizando(null)}
                />
            )}

            {/* A LISTA SEPARADA DE LINKS NA RAIZ SAIU.
                Ela era a segunda navegacao desta tela: a arvore em cima, uma caixinha
                de links embaixo, sem relacao entre as duas. Os mesmos documentos
                aparecem agora como ATALHO dentro da pasta - e os do cadastro antigo,
                que nao tem `caminho`, caem na raiz, exatamente onde apareciam. */}
            {naRaiz && daPasta.length === 0 && ehAgencia && (
                <p className="text-[10px] text-zinc-600 mt-8 leading-relaxed max-w-xl">
                    Bruto, captação e arquivo aberto ficam no Drive — use “Atalho do Drive” para deixar o
                    caminho aqui, na pasta onde ele faz sentido.
                </p>
            )}

            </>
            )}
        </div>
    );
};

export default MateriaisView;
