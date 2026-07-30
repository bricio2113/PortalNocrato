// Resolucao automatica da capa a partir da pasta do Drive do post.
//
// O campo de link do calendario sempre recebeu link de PASTA ("Pasta do
// Drive..."), e pasta nao tem thumbnail - so arquivo tem. Por isso a grade do
// feed aparecia inteira com placeholder. Aqui listamos a pasta pela Drive API,
// escolhemos qual arquivo e a capa e devolvemos a URL de thumbnail.
//
// Usa chave de API (nao OAuth) porque as pastas sao compartilhadas por link:
// nao ha usuario para autenticar nem consentimento a pedir. A chave e lida de
// variavel de ambiente e nunca fica no codigo - o repositorio e publico.
//
// LIMITE CONHECIDO: a pasta precisa estar em "qualquer pessoa com o link".
// Pasta restrita responde 404 mesmo com chave valida, e nao ha como saber a
// diferenca entre "restrita" e "inexistente" pela resposta.

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

const FOLDER_PATH = /\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]{10,})/;
const FILE_PATH = /\/file\/d\/([a-zA-Z0-9_-]{10,})/;

export const DRIVE_API_KEY: string | undefined =
    (import.meta as any).env?.VITE_GOOGLE_DRIVE_API_KEY || undefined;

export const hasDriveApiKey = () => Boolean(DRIVE_API_KEY);

/** URL de thumbnail publica de um arquivo do Drive. */
export const driveThumbnail = (fileId: string, width = 1200) =>
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
}

export type CoverResolution =
    | { ok: true; coverUrl: string; fileName: string }
    | { ok: false; reason: 'sem-chave' | 'nao-e-drive' | 'pasta-vazia' | 'sem-acesso' | 'erro'; detail?: string };

function parseDriveTarget(raw: string): { kind: 'folder' | 'file'; id: string } | null {
    let parsed: URL;
    try {
        parsed = new URL(raw.trim());
    } catch {
        return null;
    }
    if (!parsed.hostname.endsWith('drive.google.com')) return null;

    const folder = parsed.pathname.match(FOLDER_PATH);
    if (folder) return { kind: 'folder', id: folder[1] };

    const file = parsed.pathname.match(FILE_PATH);
    if (file) return { kind: 'file', id: file[1] };

    const byQuery = parsed.searchParams.get('id');
    if (byQuery && /^[a-zA-Z0-9_-]{10,}$/.test(byQuery)) return { kind: 'file', id: byQuery };

    return null;
}

/**
 * Escolhe qual arquivo da pasta e a capa.
 *
 * Imagem vence video: para carrossel a capa e o primeiro slide, e para Reel o
 * Drive tambem gera thumbnail do video, mas se houver uma imagem solta ela
 * costuma ser justamente a capa exportada.
 *
 * Dentro de cada grupo, nomes que anunciam capa vem primeiro; depois ordem
 * natural, que faz "01" vir antes de "10" - `localeCompare` com `numeric`
 * evita a ordenacao lexicografica que colocaria "10" antes de "2".
 */
const COVER_HINT = /^(capa|cover|thumb|thumbnail)|^0*1\b|^0*1[^0-9]/i;

export function pickCover(files: DriveFile[]): DriveFile | null {
    const usable = files.filter(f =>
        f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/')
    );
    if (usable.length === 0) return null;

    const score = (f: DriveFile) => {
        const isImage = f.mimeType.startsWith('image/');
        const hinted = COVER_HINT.test(f.name);
        if (isImage && hinted) return 0;
        if (isImage) return 1;
        if (hinted) return 2;
        return 3;
    };

    return [...usable].sort((a, b) => {
        const diff = score(a) - score(b);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name, 'pt-BR', { numeric: true });
    })[0];
}

/**
 * Descobre a capa de um post a partir do link do material.
 *
 * Link de arquivo resolve na hora, sem chamada de rede. Link de pasta exige
 * listar o conteudo.
 */
export async function resolveDriveCover(rawUrl?: string | null): Promise<CoverResolution> {
    if (!rawUrl) return { ok: false, reason: 'nao-e-drive' };

    const target = parseDriveTarget(rawUrl);
    if (!target) return { ok: false, reason: 'nao-e-drive' };

    // Arquivo unico: nao precisa de API nem de chave.
    if (target.kind === 'file') {
        return { ok: true, coverUrl: driveThumbnail(target.id), fileName: '' };
    }

    if (!DRIVE_API_KEY) return { ok: false, reason: 'sem-chave' };

    const params = new URLSearchParams({
        q: `'${target.id}' in parents and trashed = false`,
        fields: 'files(id,name,mimeType)',
        pageSize: '200',
        // Necessarios quando a pasta vive num drive compartilhado; inofensivos
        // para pasta pessoal.
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
        key: DRIVE_API_KEY
    });

    try {
        const response = await fetch(`${DRIVE_API}?${params.toString()}`);
        if (!response.ok) {
            // 404 aqui quase sempre significa pasta nao compartilhada por link,
            // e nao pasta inexistente - a API responde igual nos dois casos.
            if (response.status === 404 || response.status === 403) {
                return { ok: false, reason: 'sem-acesso', detail: `HTTP ${response.status}` };
            }
            return { ok: false, reason: 'erro', detail: `HTTP ${response.status}` };
        }

        const data = await response.json() as { files?: DriveFile[] };
        const cover = pickCover(data.files || []);
        if (!cover) return { ok: false, reason: 'pasta-vazia' };

        return { ok: true, coverUrl: driveThumbnail(cover.id), fileName: cover.name };
    } catch (error) {
        console.error('Falha ao listar pasta do Drive:', error);
        return { ok: false, reason: 'erro', detail: 'rede' };
    }
}

/** Texto para a interface a partir do motivo da falha. */
export function describeCoverFailure(reason: Exclude<CoverResolution, { ok: true }>['reason']): string {
    switch (reason) {
        case 'sem-chave':
            return 'A chave da API do Drive não está configurada neste ambiente.';
        case 'nao-e-drive':
            return 'O link do material não é do Google Drive.';
        case 'pasta-vazia':
            return 'A pasta não tem imagem nem vídeo.';
        case 'sem-acesso':
            return 'A pasta não está compartilhada por link (ou não existe).';
        default:
            return 'Não foi possível consultar o Drive agora.';
    }
}
