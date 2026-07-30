// Identidade visual e textual do usuario: nome, iniciais e foto.
//
// A foto e redimensionada no navegador e guardada como data URI no proprio
// documento do usuario, em vez de ir para o Cloud Storage. Motivo: o projeto
// esta no plano Spark, onde o Storage depende de billing, e um avatar de
// 256x256 em JPEG fica na casa de 10-20 KB - folga confortavel diante do limite
// de 1 MiB por documento do Firestore.
//
// Se um dia a foto precisar de resolucao maior (banner, galeria), a troca para
// Storage e local: sobem `fotoUrl` como URL https e o resto do app nao muda,
// porque tudo aqui aceita as duas formas.

/** Lado do quadrado final. 256 cobre tela retina em avatar de 64px. */
const AVATAR_SIZE = 256;
const JPEG_QUALITY = 0.82;

/** Teto de seguranca para o data URI. Bem abaixo do limite de 1 MiB do doc. */
export const MAX_AVATAR_BYTES = 200 * 1024;

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Aceitamos data URI apenas com mime de imagem explicito. `data:` em href seria
// perigoso (data:text/html executa), mas em <img src> com mime de imagem o
// navegador trata como midia inerte.
const SAFE_DATA_IMAGE = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;

/**
 * Diz se `value` pode ir para o src de uma <img>.
 *
 * Nao reaproveita toSafeHref: aquele recusa `data:` por ser feito para links, e
 * aqui data URI de imagem e justamente o caso principal.
 */
export function isSafeImageSrc(value?: string | null): boolean {
    if (!value) return false;
    const trimmed = value.trim();
    if (SAFE_DATA_IMAGE.test(trimmed)) return true;
    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Le um arquivo de imagem e devolve um data URI quadrado de 256x256.
 *
 * Recorta pelo centro (cover) em vez de distorcer: avatar esticado fica pior
 * que avatar cortado.
 */
export function fileToAvatarDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
            reject(new Error('Formato não suportado. Use JPG, PNG ou WEBP.'));
            return;
        }

        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
        reader.onload = () => {
            const image = new Image();
            image.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
            image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = AVATAR_SIZE;
                canvas.height = AVATAR_SIZE;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Seu navegador não suportou o recorte da imagem.'));
                    return;
                }

                // Recorte central: pega o maior quadrado que caiba na imagem.
                const side = Math.min(image.width, image.height);
                const sx = (image.width - side) / 2;
                const sy = (image.height - side) / 2;
                ctx.drawImage(image, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

                const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);

                // base64 carrega ~4 bytes por 3 bytes de dado; estimamos o
                // tamanho real para nao estourar o documento.
                const approxBytes = Math.ceil((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
                if (approxBytes > MAX_AVATAR_BYTES) {
                    reject(new Error('A imagem ficou grande demais depois do ajuste. Tente outra.'));
                    return;
                }

                resolve(dataUrl);
            };
            image.src = reader.result as string;
        };
        reader.readAsDataURL(file);
    });
}

// --- NOME ---

export interface NameParts {
    nome?: string | null;
    sobrenome?: string | null;
    email?: string | null;
}

/**
 * Nome de exibicao. Cai para a parte local do e-mail enquanto o perfil nao
 * estiver preenchido - melhor mostrar "joao.silva" que um espaco vazio.
 */
export function getDisplayName(parts: NameParts): string {
    const nome = (parts.nome || '').trim();
    const sobrenome = (parts.sobrenome || '').trim();
    const full = [nome, sobrenome].filter(Boolean).join(' ');
    if (full) return full;
    if (parts.email) return parts.email.split('@')[0];
    return 'Sem nome';
}

/** Nome curto para espacos apertados: "João S." */
export function getShortName(parts: NameParts): string {
    const nome = (parts.nome || '').trim();
    const sobrenome = (parts.sobrenome || '').trim();
    if (nome && sobrenome) return `${nome} ${sobrenome[0].toUpperCase()}.`;
    if (nome) return nome;
    return getDisplayName(parts);
}

/**
 * Iniciais de nome + sobrenome. Sem perfil preenchido, deriva do e-mail
 * ("maria.silva@x.com" -> "MS").
 */
export function getInitials(parts: NameParts): string {
    const nome = (parts.nome || '').trim();
    const sobrenome = (parts.sobrenome || '').trim();
    if (nome && sobrenome) return (nome[0] + sobrenome[0]).toUpperCase();
    if (nome.length >= 2) return nome.slice(0, 2).toUpperCase();

    const email = (parts.email || '').trim();
    if (!email) return '--';
    const local = email.split('@')[0];
    const chunks = local.split(/[._-]+/).filter(Boolean);
    if (chunks.length >= 2) return (chunks[0][0] + chunks[1][0]).toUpperCase();
    return local.slice(0, 2).toUpperCase();
}

/** Divide um displayName do Auth em nome e sobrenome. */
export function splitFullName(full?: string | null): { nome: string; sobrenome: string } {
    const clean = (full || '').trim().replace(/\s+/g, ' ');
    if (!clean) return { nome: '', sobrenome: '' };
    const parts = clean.split(' ');
    if (parts.length === 1) return { nome: parts[0], sobrenome: '' };
    return { nome: parts[0], sobrenome: parts.slice(1).join(' ') };
}
