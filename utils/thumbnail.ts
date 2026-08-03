/**
 * Miniatura gerada NO NAVEGADOR, antes de qualquer upload.
 *
 * ESTA E A DECISAO QUE DEFINE A FATURA.
 *
 * A grade do mes carrega ~25 capas e a previa do feed carrega 9 tiles: uma
 * abertura de tela pede mais de 30 imagens. Servindo o arquivo original de 3 MB
 * nesses lugares, cada abertura baixa ~100 MB. Tres pessoas da equipe abrindo
 * 20 vezes por dia sao ~180 GB/mes, acima da cota gratuita de saida - e a saida
 * e a linha mais cara do Storage, nao o armazenamento.
 *
 * Com miniatura de ~40 KB a mesma tela baixa 1,4 MB. Sao 60x menos, na mesma
 * feature. Nao e otimizacao prematura: e a diferenca entre a conta ficar em zero
 * e passar de R$ 200/ano.
 *
 * A miniatura vai para o Firestore como data URI, nao para o Storage. Assim a
 * grade nem toca no bucket, e a leitura entra na cota do Firestore, que e
 * generosa (10 GiB/mes de saida).
 *
 * Reaproveita a mesma tecnica de canvas do utils/avatar.ts. O que muda: aqui a
 * proporcao ORIGINAL e preservada - recortar quadrado como no avatar cortaria a
 * peca, e a razao de existir da previa e mostrar como a peca vai ficar.
 */

/** Lado maior da miniatura. 400 cobre com folga os ~157px do card em retina. */
const THUMB_MAX = 400;
const JPEG_QUALITY = 0.72;

/**
 * Teto do data URI. O limite do documento do Firestore e 1 MiB; 120 KB deixa
 * folga larga e ainda e 25x menor que uma foto de celular.
 */
export const MAX_THUMB_BYTES = 120 * 1024;

export const IMAGENS_ACEITAS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
export const VIDEOS_ACEITOS = ['video/mp4', 'video/webm', 'video/quicktime'];

export const ehImagem = (file: File) => file.type.startsWith('image/');
export const ehVideo = (file: File) => file.type.startsWith('video/');

/** Bytes reais de um data URI base64, sem contar o prefixo. */
export function dataUrlBytes(dataUrl: string): number {
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    return Math.floor(base64.length * 0.75);
}

/** Reduz mantendo a proporcao. Nunca AMPLIA: peca pequena fica como esta. */
function escalar(largura: number, altura: number, max: number) {
    if (largura <= max && altura <= max) return { largura, altura };
    const fator = max / Math.max(largura, altura);
    return { largura: Math.round(largura * fator), altura: Math.round(altura * fator) };
}

function desenhar(fonte: CanvasImageSource, largura: number, altura: number, qualidade: number): string {
    const alvo = escalar(largura, altura, THUMB_MAX);
    const canvas = document.createElement('canvas');
    canvas.width = alvo.largura;
    canvas.height = alvo.altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível processar a imagem neste navegador.');
    ctx.drawImage(fonte, 0, 0, alvo.largura, alvo.altura);
    return canvas.toDataURL('image/jpeg', qualidade);
}

/**
 * Comprime ate caber em MAX_THUMB_BYTES.
 *
 * Uma unica passada em qualidade fixa nao garante o teto: PNG com ruido ou foto
 * muito detalhada estoura mesmo em 400px. Sem esta reducao progressiva, o
 * documento seria recusado pelo Firestore no meio do upload - erro que aparece
 * depois de o arquivo grande ja ter subido.
 */
function comprimirAteCaber(fonte: CanvasImageSource, largura: number, altura: number): string {
    let qualidade = JPEG_QUALITY;
    let saida = desenhar(fonte, largura, altura, qualidade);
    while (dataUrlBytes(saida) > MAX_THUMB_BYTES && qualidade > 0.3) {
        qualidade -= 0.12;
        saida = desenhar(fonte, largura, altura, qualidade);
    }
    return saida;
}

/** Miniatura de um arquivo de imagem. */
export function imagemParaThumb(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem.')); };
        img.onload = () => {
            try {
                resolve(comprimirAteCaber(img, img.naturalWidth, img.naturalHeight));
            } catch (e) {
                reject(e);
            } finally {
                // Sem revoke a URL do blob segura o arquivo inteiro em memoria
                // ate a aba fechar. Subindo 20 videos, isso e RAM de verdade.
                URL.revokeObjectURL(url);
            }
        };
        img.src = url;
    });
}

/**
 * Miniatura de um VIDEO: primeiro quadro visivel.
 *
 * Busca 0,2s em vez do quadro zero porque muito arquivo comeca em preto - o
 * quadro zero renderiza um retangulo vazio e a previa do feed fica com um buraco
 * exatamente onde deveria estar o reel.
 *
 * Se o navegador nao decodificar o codec (quicktime/HEVC costuma falhar no
 * Chrome), resolve como `null` em vez de rejeitar: nao ter capa e um estado
 * previsto, e o upload do video em si nao deve falhar por causa da miniatura.
 */
export function videoParaThumb(file: File): Promise<string | null> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        let encerrado = false;

        const finalizar = (valor: string | null) => {
            if (encerrado) return;
            encerrado = true;
            URL.revokeObjectURL(url);
            resolve(valor);
        };

        // Rede pode falhar, codec pode nao existir, e `seeked` pode simplesmente
        // nunca disparar. Sem este teto o upload ficaria pendurado para sempre
        // esperando um evento que nao vem.
        const limite = setTimeout(() => finalizar(null), 10000);

        video.onerror = () => { clearTimeout(limite); finalizar(null); };
        video.onloadeddata = () => {
            // Video mais curto que 0,2s existe (boomerang, sticker).
            video.currentTime = Math.min(0.2, (video.duration || 1) / 2);
        };
        video.onseeked = () => {
            clearTimeout(limite);
            try {
                finalizar(comprimirAteCaber(video, video.videoWidth, video.videoHeight));
            } catch {
                finalizar(null);
            }
        };

        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.src = url;
    });
}

/** Miniatura de qualquer arquivo suportado. `null` quando nao da para gerar. */
export function arquivoParaThumb(file: File): Promise<string | null> {
    if (ehImagem(file)) return imagemParaThumb(file);
    if (ehVideo(file)) return videoParaThumb(file);
    return Promise.resolve(null);
}
