// Previa do criativo dentro do portal.
//
// Hoje o post guarda um link para o Drive, entao aprovar exigia sair do portal,
// abrir a pasta, voltar. Aqui descobrimos se o link da para exibir direto.
//
// Nao usamos iframe: embutir pagina de terceiro no portal e um vetor
// desnecessario. Imagem e video sao carregados como midia, que o navegador
// trata como dado inerte.

import { toSafeHref } from './url';

export type MediaKind = 'image' | 'video' | 'external';

export interface MediaPreview {
    kind: MediaKind;
    /** URL segura para exibir (image/video) ou abrir em nova aba (external). */
    src: string;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|ogg|mov)(\?|#|$)/i;

// Links de arquivo do Drive vem em duas formas:
//   drive.google.com/file/d/<ID>/view
//   drive.google.com/open?id=<ID>  |  ...?id=<ID>
const DRIVE_FILE_PATH = /\/file\/d\/([a-zA-Z0-9_-]{10,})/;

function extractDriveId(parsed: URL): string | null {
    if (!parsed.hostname.endsWith('drive.google.com')) return null;
    const fromPath = parsed.pathname.match(DRIVE_FILE_PATH);
    if (fromPath) return fromPath[1];
    const fromQuery = parsed.searchParams.get('id');
    if (fromQuery && /^[a-zA-Z0-9_-]{10,}$/.test(fromQuery)) return fromQuery;
    return null;
}

/**
 * Decide como exibir `raw`.
 *
 * Para arquivo do Drive devolvemos o endpoint de thumbnail, que responde a
 * imagem sem exigir iframe nem login quando o arquivo esta compartilhado por
 * link. Se falhar (arquivo restrito, ou e um video/pasta), quem renderiza cai
 * para o cartao 'external' via onError.
 */
export function getMediaPreview(raw?: string | null): MediaPreview | null {
    const safe = toSafeHref(raw);
    if (!safe) return null;

    let parsed: URL;
    try {
        parsed = new URL(safe);
    } catch {
        return null;
    }

    if (IMAGE_EXT.test(parsed.pathname)) return { kind: 'image', src: safe };
    if (VIDEO_EXT.test(parsed.pathname)) return { kind: 'video', src: safe };

    const driveId = extractDriveId(parsed);
    if (driveId) {
        return { kind: 'image', src: `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200` };
    }

    return { kind: 'external', src: safe };
}

/** Rotulo curto do destino, para o cartao de link que nao da previa. */
export function getLinkLabel(raw?: string | null): string {
    const safe = toSafeHref(raw);
    if (!safe) return 'Link';
    try {
        const host = new URL(safe).hostname.replace(/^www\./, '');
        if (host.endsWith('drive.google.com')) return 'Google Drive';
        if (host.endsWith('dropbox.com')) return 'Dropbox';
        if (host.endsWith('canva.com')) return 'Canva';
        if (host.endsWith('figma.com')) return 'Figma';
        return host;
    } catch {
        return 'Link';
    }
}
