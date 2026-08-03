import { storage } from './firebase';
import { nomeSeguro } from './midia';
import { ehImagem, ehVideo } from './thumbnail';

/**
 * Pastas de materiais de um cliente, dentro do proprio app.
 *
 * Substitui o link de pasta do Drive: o material passa a viver em
 * `empresas/{empresaId}/materiais/{pasta}/{arquivo}`, com as regras de
 * storage.rules valendo - cliente le e escreve na propria pasta, colaborador em
 * todas, ninguem em pasta de outro cliente.
 *
 * NAO EXISTE "CRIAR PASTA" NO CLOUD STORAGE.
 * O bucket e uma lista plana de objetos; "pasta" e so um prefixo no nome. Por
 * isso a criacao de pasta grava um marcador vazio (`.pasta`): sem nenhum objeto
 * com aquele prefixo, a pasta simplesmente nao existe para o listAll e
 * desapareceria da tela ao recarregar.
 *
 * O TEMPLATE PADRAO existe porque pasta vazia sem sugestao vira bagunca: cada
 * pessoa da equipe inventa um nome diferente para a mesma coisa, e seis meses
 * depois ninguem acha nada.
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

const raiz = (empresaId: string) => `empresas/${empresaId}/materiais`;

/**
 * Nome de pasta seguro.
 *
 * Barra criaria uma subpasta sem o usuario pedir, e o resto quebra a URL. Acento
 * e mantido: e nome que aparece na tela, e "Vídeos" com acento e o certo.
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
    path: string;
}

/** Lista as pastas de um cliente. Ignora arquivos soltos na raiz. */
export async function listarPastas(empresaId: string): Promise<PastaMaterial[]> {
    const res = await storage.ref(raiz(empresaId)).listAll();
    return (res.prefixes as { name: string; fullPath: string }[])
        .map(p => ({ nome: p.name, path: p.fullPath }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Lista os arquivos de uma pasta.
 *
 * Busca url e metadados em paralelo por arquivo. Em serie, uma pasta com 40
 * fotos faria 80 idas ao servidor uma depois da outra - a tela levaria dezenas
 * de segundos para pintar.
 */
export async function listarArquivos(empresaId: string, pasta: string): Promise<ArquivoMaterial[]> {
    const res = await storage.ref(`${raiz(empresaId)}/${pasta}`).listAll();
    const itens = (res.items as { name: string; fullPath: string; getDownloadURL: () => Promise<string>; getMetadata: () => Promise<{ size?: number; contentType?: string }> }[])
        .filter(item => item.name !== MARCADOR);

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

    return arquivos
        .filter((a): a is ArquivoMaterial => a !== null)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
}

/** Cria a pasta gravando o marcador. */
export async function criarPasta(empresaId: string, nome: string): Promise<string> {
    const limpo = nomePastaSeguro(nome);
    if (!limpo) throw new Error('Dê um nome à pasta.');
    // Blob vazio com content-type de texto: storage.rules aceita text/plain, e um
    // marcador com tipo desconhecido seria recusado pela regra de tipo.
    const vazio = new Blob([''], { type: 'text/plain' });
    await storage.ref(`${raiz(empresaId)}/${limpo}/${MARCADOR}`).put(vazio);
    return limpo;
}

/**
 * Cria a estrutura padrao. Idempotente: rodar de novo nao duplica nada, porque
 * gravar o mesmo marcador por cima e inofensivo.
 */
export async function criarTemplate(empresaId: string): Promise<void> {
    // Em serie de proposito: cinco uploads paralelos de 0 byte nao ganham nada e
    // multiplicam a chance de um estourar limite de requisicao.
    for (const nome of TEMPLATE_PASTAS) {
        await criarPasta(empresaId, nome);
    }
}

export async function enviarMaterial(
    empresaId: string,
    pasta: string,
    file: File,
    onProgress?: (pct: number) => void
): Promise<ArquivoMaterial> {
    const path = `${raiz(empresaId)}/${pasta}/${nomeSeguro(file.name)}`;
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
 * Apaga a pasta e tudo dentro.
 *
 * O Storage nao apaga prefixo: e preciso listar e apagar objeto por objeto. Sem
 * isto, "excluir pasta" removeria so o marcador e a pasta voltaria na proxima
 * listagem, com os arquivos intactos - o pior dos dois mundos.
 */
export async function removerPasta(empresaId: string, pasta: string): Promise<void> {
    const ref = storage.ref(`${raiz(empresaId)}/${pasta}`);
    const res = await ref.listAll();
    await Promise.all(
        (res.items as { delete: () => Promise<void> }[]).map(item => item.delete())
    );
}

/** Icone/categoria para a tela decidir como exibir. */
export function tipoDoArquivo(a: ArquivoMaterial): 'imagem' | 'video' | 'documento' {
    const fake = { type: a.contentType || '' } as File;
    if (ehImagem(fake)) return 'imagem';
    if (ehVideo(fake)) return 'video';
    return 'documento';
}
