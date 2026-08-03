import { db, storage } from './firebase';
import { arquivoParaThumb, ehImagem, ehVideo, dataUrlBytes } from './thumbnail';

/**
 * Upload de midia de uma publicacao.
 *
 * DUAS COISAS EM DOIS LUGARES DIFERENTES, de proposito:
 *
 *   arquivo original  -> Cloud Storage, em empresas/{id}/posts/{eventId}/
 *   miniatura (~40KB) -> Firestore, em empresas/{id}/covers/{eventId}
 *
 * A grade do calendario e a previa do feed leem SO a miniatura. Assim a tela que
 * carrega 30 imagens de uma vez nunca toca no bucket, e a saida de dados - a
 * linha mais cara do Storage - fica praticamente em zero. Ver o cabecalho de
 * utils/thumbnail.ts para os numeros.
 *
 * A miniatura fica em COLECAO PROPRIA, nao dentro do documento do evento. O
 * subscribePendingCounts le a colecao events inteira para contar pendencias; com
 * a miniatura lá dentro, cada contagem arrastaria 40 KB por post - com 20
 * clientes abertos no painel, dezenas de MB por abertura de tela. Seria trocar
 * um problema de custo por outro.
 */

const LIMITES = {
    imagem: 15 * 1024 * 1024,   // igual ao teto de storage.rules
    video: 300 * 1024 * 1024
};

export interface MidiaEnviada {
    /** URL https para download/exibicao do arquivo original. */
    url: string;
    /** Caminho no bucket, guardado para conseguir apagar depois. */
    path: string;
    contentType: string;
    bytes: number;
    /** Data URI da miniatura, ou null quando nao foi possivel gerar. */
    thumb: string | null;
}

/**
 * Nome de arquivo seguro e unico.
 *
 * Acentos e espacos em nome de objeto do Storage funcionam, mas viram
 * %C3%A7%20 na URL e transformam qualquer depuracao em sofrimento. O prefixo de
 * tempo evita que dois uploads do mesmo nome se sobrescrevam - subir
 * "capa.jpg" duas vezes apagaria a primeira sem avisar.
 */
export function nomeSeguro(nome: string): string {
    const limpo = nome
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(-80);
    return `${Date.now()}-${limpo || 'arquivo'}`;
}

export class MidiaInvalidaError extends Error {}

function validar(file: File) {
    if (!ehImagem(file) && !ehVideo(file)) {
        throw new MidiaInvalidaError('Só imagem ou vídeo. Para PDF e documentos use Arquivos & Materiais.');
    }
    const teto = ehVideo(file) ? LIMITES.video : LIMITES.imagem;
    if (file.size > teto) {
        const mb = Math.round(teto / 1024 / 1024);
        throw new MidiaInvalidaError(`Arquivo acima de ${mb} MB. Comprima antes de subir.`);
    }
}

/**
 * Sobe o arquivo e devolve URL e miniatura.
 *
 * A MINIATURA E GERADA ANTES DO UPLOAD. Se ela falhar, o upload nem comeca -
 * subir 40 MB de video e so depois descobrir que a capa nao dava certo gasta
 * banda do usuario e deixa lixo no bucket. Video sem capa possivel resolve como
 * `thumb: null`, que e um estado previsto e nao impede o envio.
 */
export async function enviarMidiaDoPost(
    empresaId: string,
    eventId: string,
    file: File,
    onProgress?: (pct: number) => void
): Promise<MidiaEnviada> {
    validar(file);

    const thumb = await arquivoParaThumb(file);

    const path = `empresas/${empresaId}/posts/${eventId}/${nomeSeguro(file.name)}`;
    const ref = storage.ref(path);

    const url = await new Promise<string>((resolve, reject) => {
        const task = ref.put(file);
        task.on(
            'state_changed',
            (snap: { bytesTransferred: number; totalBytes: number }) => {
                if (!onProgress || !snap.totalBytes) return;
                onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
            },
            (erro: unknown) => reject(erro),
            async () => {
                try {
                    resolve(await task.snapshot.ref.getDownloadURL());
                } catch (e) {
                    reject(e);
                }
            }
        );
    });

    return { url, path, contentType: file.type, bytes: file.size, thumb };
}

// --- MINIATURA NO FIRESTORE ---------------------------------------------

const coverRef = (empresaId: string, eventId: string) =>
    db.collection('empresas').doc(empresaId).collection('covers').doc(eventId);

export async function salvarThumb(empresaId: string, eventId: string, thumb: string): Promise<void> {
    await coverRef(empresaId, eventId).set({
        thumb,
        bytes: dataUrlBytes(thumb),
        atualizadoEm: new Date()
    });
}

export async function lerThumb(empresaId: string, eventId: string): Promise<string | null> {
    const doc = await coverRef(empresaId, eventId).get();
    return doc.exists ? (doc.data()?.thumb as string) || null : null;
}

/**
 * Assina TODAS as miniaturas de uma empresa, de uma vez.
 *
 * Uma assinatura por post seria uma leitura por post e um listener por card - com
 * 30 posts na tela, 30 conexoes. Uma assinatura da colecao inteira custa o mesmo
 * numero de leituras e mantem um listener so.
 */
export function subscribeThumbs(
    empresaId: string,
    onData: (mapa: Record<string, string>) => void
): () => void {
    return db.collection('empresas').doc(empresaId).collection('covers').onSnapshot(
        snapshot => {
            const mapa: Record<string, string> = {};
            snapshot.docs.forEach(doc => {
                const thumb = doc.data()?.thumb;
                if (typeof thumb === 'string') mapa[doc.id] = thumb;
            });
            onData(mapa);
        },
        erro => console.error('Erro ao carregar miniaturas:', erro)
    );
}

/**
 * Remove o arquivo do bucket.
 *
 * Falha de "objeto nao encontrado" e ignorada: apagar o post depois de o arquivo
 * ja ter sido removido nao e erro, e travar a exclusao por isso deixaria o
 * usuario preso com um post que nao sai.
 */
export async function removerMidia(path: string): Promise<void> {
    try {
        await storage.ref(path).delete();
    } catch (erro) {
        const codigo = (erro as { code?: string })?.code;
        if (codigo !== 'storage/object-not-found') throw erro;
    }
}
