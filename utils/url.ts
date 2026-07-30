// Normalizacao de URLs digitadas pelo usuario (links do Drive, material
// bruto, conteudo final). Tudo isso vira href, entao precisa passar por
// aqui antes de ir para a tela.

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'];

// Detecta se a string ja comeca com um esquema (https:, javascript:, ...).
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Devolve uma URL segura para usar em href, ou null se o valor for vazio
 * ou usar um esquema perigoso (javascript:, data:, vbscript:).
 *
 * Sem esquema, assume https:// - e o caso comum de "drive.google.com/...".
 */
export function toSafeHref(raw?: string | null): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const candidate = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (!SAFE_PROTOCOLS.includes(parsed.protocol.toLowerCase())) return null;
    return parsed.toString();
  } catch {
    // URL malformada - melhor nao renderizar link nenhum.
    return null;
  }
}

/** Conveniencia para validar antes de salvar no Firestore. */
export function isSafeUrl(raw?: string | null): boolean {
  return toSafeHref(raw) !== null;
}
