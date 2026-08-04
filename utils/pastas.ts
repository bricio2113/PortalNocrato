import { storage } from './firebase';
import { nomeSeguro } from './midia';
import { ehImagem, ehVideo } from './thumbnail';

/**
 * ARVORE de materiais de um cliente, dentro do proprio app.
 *
 * Substitui o link de pasta do Drive: o material vive em
 * `empresas/{empresaId}/materiais/...`, com storage.rules valendo - cliente le e
 * escreve na propria pasta, colaborador em todas, ninguem em pasta de outro
 * cliente. A regra usa `{arquivo=**}`, que casa qualquer profundidade, entao
 * aninhar pasta nao exigiu mexer em permissao.
 *
 * PROFUNDIDADE LIVRE. A primeira versao tinha UM nivel: o caminho era uma string
 * unica e `nomePastaSeguro` removia barras, entao "Imagens/Agosto" virava
 * "Imagens-Agosto". Agora o caminho e uma LISTA de segmentos, e pasta dentro de
 * pasta funciona como no Drive.
 *
 * NAO EXISTE "CRIAR PASTA" NO CLOUD STORAGE.
 * O bucket e uma lista plana de objetos; "pasta" e so um prefixo no nome. Por
 * isso a criacao grava um marcador vazio (`.pasta`): sem nenhum objeto com aquele
 * prefixo, a pasta nao existe para o listAll e desapareceria ao recarregar. E por
 * isso tambem que apagar pasta e RECURSIVO na mao - nao ha "delete prefix".
 */

export const TEMPLATE_PASTAS = [
    'Imagens',
    'Vídeos',
    'Identidade Visual',
    'Contratos e Documentos',
    'Referências'
];

/** Marcador que faz a pasta existir para o listAll. */
const MARCADOR = '.pasta';

/**
 * Teto de profundidade.
 *
 * Nao e limite do Storage - e para o app ter um fim. Sem teto, um caminho montado
 * errado (ou uma listagem que se referencia) faria a exclusao recursiva descer
 * para sempre, e a migalha de navegacao nao caberia em tela nenhuma. Oito niveis
 * e mais do que qualquer organizacao de material de agencia usa.
 */
export const PROFUNDIDADE_MAX = 8;

/** Caminho relativo a raiz de materiais. Vazio = raiz. */
export type Caminho = string[];

const raiz = (empresaId: string) => `empresas/${empresaId}/materiais`;

/** Caminho completo no bucket. */
export const prefixo = (empresaId: string, caminho: Caminho) =>
    [raiz(empresaId), ...caminho].join('/');

/**
 * Nome de pasta seguro.
 *
 * Barra continua proibida DENTRO do nome: aninhar e decisao de navegacao, feita
 * entrando na pasta, nao um efeito colateral de digitar "a/b" no campo de nome.
 * Acento e mantido - e nome que aparece na tela, e "Vídeos" com acento e o certo.
 */
export function nomePastaSeguro(nome: string): string {
    return nome.trim().replace(/[\/\\?%*:|"<>#]+/g, '-').replace(/^\.+/, '').slice(0, 60);
}

export interface ArquivoMaterial {
    nome: string;
    path: string;
    url: string;
    /** Ausente quando os metadados nao carregaram. */
    bytes?: number;
    contentType?: string;
}

export interface PastaMaterial {
    nome: string;
    /** Caminho completo, incluindo os pais. Usado para navegar e excluir. */
    caminho: Caminho;
}

export interface ConteudoPasta {
    pastas: PastaMaterial[];
    arquivos: ArquivoMaterial[];
}

type ItemStorage = {
    name: string;
    fullPath: string;
    getDownloadURL: () => Promise<string>;
    getMetadata: () => Promise<{ size?: number; contentType?: string }>;
};

/**
 * Lista pastas E arquivos de um nivel, numa ida so.
 *
 * Antes eram duas funcoes - uma para as pastas da raiz, outra para os arquivos de
 * dentro - porque o modelo tinha um nivel e cada tela mostrava um dos dois. Numa
 * arvore, todo nivel pode ter os dois ao mesmo tempo, e o `listAll` do Storage ja
 * devolve `prefixes` e `items` na mesma resposta: separar em duas chamadas seria
 * pagar duas vezes pelo mesmo dado.
 *
 * Url e metadados vao em paralelo por arquivo. Em serie, uma pasta com 40 fotos
 * faria 80 idas ao servidor uma depois da outra.
 */
export async function listar(empresaId: string, caminho: Caminho): Promise<ConteudoPasta> {
    const res = await storage.ref(prefixo(empresaId, caminho)).listAll();

    const pastas: PastaMaterial[] = (res.prefixes as { name: string }[])
        .map(p => ({ nome: p.name, caminho: [...caminho, p.name] }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));

    const itens = (res.items as ItemStorage[]).filter(item => item.name !== MARCADOR);

    const arquivos = await Promise.all(itens.map(async (item): Promise<ArquivoMaterial | null> => {
        try {
            const [url, meta] = await Promise.all([item.getDownloadURL(), item.getMetadata()]);
            return { nome: item.name, path: item.fullPath, url, bytes: meta.size, contentType: meta.contentType };
        } catch (erro) {
            // Um arquivo ilegivel nao derruba a pasta inteira: some da lista e o
            // resto aparece. Falhar tudo por causa de um objeto corrompido
            // deixaria o usuario sem acesso a nada.
            console.error('Falha ao ler', item.fullPath, erro);
            return null;
        }
    }));

    return {
        pastas,
        arquivos: arquivos
            .filter((a): a is ArquivoMaterial => a !== null)
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))
    };
}

/** Cria a pasta DENTRO de `caminho`, gravando o marcador. */
export async function criarPasta(empresaId: string, caminho: Caminho, nome: string): Promise<string> {
    const limpo = nomePastaSeguro(nome);
    if (!limpo) throw new Error('Dê um nome à pasta.');
    if (caminho.length >= PROFUNDIDADE_MAX) {
        throw new Error(`Limite de ${PROFUNDIDADE_MAX} níveis de pasta.`);
    }
    // Blob vazio com content-type de texto: storage.rules aceita text/plain, e um
    // marcador com tipo desconhecido seria recusado pela regra de tipo.
    const vazio = new Blob([''], { type: 'text/plain' });
    await storage.ref(`${prefixo(empresaId, [...caminho, limpo])}/${MARCADOR}`).put(vazio);
    return limpo;
}

/**
 * Cria a estrutura padrao na raiz. Idempotente: rodar de novo nao duplica nada,
 * porque gravar o mesmo marcador por cima e inofensivo.
 */
export async function criarTemplate(empresaId: string): Promise<void> {
    // Em serie de proposito: cinco uploads paralelos de 0 byte nao ganham nada e
    // multiplicam a chance de um estourar limite de requisicao.
    for (const nome of TEMPLATE_PASTAS) {
        await criarPasta(empresaId, [], nome);
    }
}

export async function enviarMaterial(
    empresaId: string,
    caminho: Caminho,
    file: File,
    onProgress?: (pct: number) => void
): Promise<ArquivoMaterial> {
    const path = `${prefixo(empresaId, caminho)}/${nomeSeguro(file.name)}`;
    const ref = storage.ref(path);

    const url = await new Promise<string>((resolve, reject) => {
        const task = ref.put(file);
        task.on(
            'state_changed',
            (snap: { bytesTransferred: number; totalBytes: number }) => {
                if (onProgress && snap.totalBytes) {
                    onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
                }
            },
            (erro: unknown) => reject(erro),
            async () => {
                try { resolve(await task.snapshot.ref.getDownloadURL()); }
                catch (e) { reject(e); }
            }
        );
    });

    return { nome: file.name, path, url, bytes: file.size, contentType: file.type };
}

export async function removerArquivo(path: string): Promise<void> {
    try {
        await storage.ref(path).delete();
    } catch (erro) {
        if ((erro as { code?: string })?.code !== 'storage/object-not-found') throw erro;
    }
}

/**
 * Apaga a pasta, as subpastas e todos os arquivos.
 *
 * DESCE A ARVORE. O Storage nao apaga prefixo: e preciso listar e apagar objeto
 * por objeto, e `listAll` de um nivel NAO traz o conteudo dos filhos - so os
 * nomes deles. A versao anterior apagava um nivel e pronto; numa arvore isso
 * deixaria as subpastas orfas, invisiveis na tela e ocupando espaco pago, com a
 * pasta "excluida" reaparecendo na proxima listagem por causa delas.
 *
 * Os filhos vao em paralelo, os objetos de cada nivel tambem: sao dezenas de
 * DELETEs independentes e em serie a exclusao de uma pasta grande levaria minutos.
 */
export async function removerPasta(
    empresaId: string,
    caminho: Caminho,
    profundidade = 0
): Promise<void> {
    if (profundidade > PROFUNDIDADE_MAX) {
        console.error('Profundidade máxima atingida ao excluir', caminho.join('/'));
        return;
    }
    const res = await storage.ref(prefixo(empresaId, caminho)).listAll();

    await Promise.all([
        ...(res.items as { delete: () => Promise<void> }[]).map(item =>
            item.delete().catch(erro => {
                // Objeto que ja nao existe nao e falha: a exclusao continua.
                if ((erro as { code?: string })?.code !== 'storage/object-not-found') throw erro;
            })
        ),
        ...(res.prefixes as { name: string }[]).map(sub =>
            removerPasta(empresaId, [...caminho, sub.name], profundidade + 1)
        )
    ]);
}

/** Icone/categoria para a tela decidir como exibir. */
export function tipoDoArquivo(a: ArquivoMaterial): 'imagem' | 'video' | 'documento' {
    const fake = { type: a.contentType || '' } as File;
    if (ehImagem(fake)) return 'imagem';
    if (ehVideo(fake)) return 'video';
    return 'documento';
}
