import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db } from './firebase';
import { Caminho } from './pastas';
import { toSafeHref } from './url';

/**
 * ATALHOS para material que vive fora do portal - na pratica, o Drive.
 *
 * A divisao de trabalho e deliberada: bruto no Drive (captacao, ensaio, arquivo
 * aberto, o que ainda vai ser editado), entrega no portal. O problema disso e
 * navegacao: sao DOIS lugares para procurar, e nada ligando um ao outro.
 *
 * O atalho resolve como o proprio Drive resolve - um item que aponta para outro
 * lugar, dentro da pasta onde faz sentido. Assim existe UMA arvore: "Carrossel /
 * Agosto" pode conter as pecas prontas e, ao lado, o atalho para a pasta de
 * captacao no Drive.
 *
 * NAO E SINCRONIZACAO, e nao deve virar. Espelhar Drive e Storage exigiria servidor,
 * OAuth por pessoa e resolucao de conflito, e divergiria em silencio - o pior tipo
 * de falha, porque ninguem percebe ate aprovar a versao errada. Atalho e honesto:
 * diz onde a coisa esta, sem prometer que e uma copia.
 *
 * A COLECAO E A MESMA de antes (`drive_links`). Ela nasceu como legado - links
 * salvos antes das pastas existirem - e ganhou `caminho`. Documento antigo, sem
 * esse campo, aparece na RAIZ, que e exatamente onde ele aparecia; nada desaparece
 * da tela de ninguem.
 */

export interface Atalho {
    id: string;
    title: string;
    url: string;
    /** Pasta onde o atalho mora. Ausente/vazio = raiz de Materiais. */
    caminho: Caminho;
    /** Campo do cadastro antigo. So exibido quando existe. */
    category?: string | null;
    criadoPor?: string | null;
    criadoEm?: Date | null;
}

const ref = (empresaId: string) =>
    db.collection('empresas').doc(empresaId).collection('drive_links');

export function subscribeAtalhos(
    empresaId: string,
    onData: (atalhos: Atalho[]) => void,
    onError?: () => void
): () => void {
    return ref(empresaId).onSnapshot(
        snap => onData(snap.docs.map(doc => {
            const data = doc.data() || {};
            return {
                id: doc.id,
                title: (data.title as string) || 'Sem título',
                url: (data.url as string) || '',
                // Documento do cadastro antigo nao tem `caminho`: raiz.
                caminho: Array.isArray(data.caminho) ? data.caminho as Caminho : [],
                category: (data.category as string) || null,
                criadoPor: (data.criadoPor as string) || null,
                criadoEm: (data.criadoEm as firebase.firestore.Timestamp | undefined)?.toDate() || null
            };
        })),
        erro => {
            console.error('Erro ao carregar atalhos:', erro);
            onError?.();
        }
    );
}

export class UrlInvalidaError extends Error {}

/**
 * Cria o atalho na pasta indicada.
 *
 * A URL passa por `toSafeHref` ANTES de gravar: sem isso daria para salvar
 * `javascript:` num link que a tela renderiza para o cliente clicar. A validacao na
 * leitura tambem existe (o link antigo pode ter vindo sem ela), mas recusar na
 * entrada e o que impede o dado ruim de nascer.
 */
export async function criarAtalho(
    empresaId: string,
    caminho: Caminho,
    title: string,
    url: string,
    criadoPor?: string | null
): Promise<void> {
    const nome = title.trim();
    const seguro = toSafeHref(url.trim());
    if (!nome) throw new UrlInvalidaError('Dê um nome ao atalho.');
    if (!seguro) throw new UrlInvalidaError('Cole um link http ou https válido.');

    await ref(empresaId).add({
        title: nome,
        url: seguro,
        caminho,
        criadoPor: criadoPor || null,
        criadoEm: new Date()
    });
}

export async function removerAtalho(empresaId: string, id: string): Promise<void> {
    await ref(empresaId).doc(id).delete();
}

/** Atalhos de UM nivel. A comparacao e pelo caminho serializado. */
export const atalhosDaPasta = (atalhos: Atalho[], caminho: Caminho) =>
    atalhos.filter(a => a.caminho.join('/') === caminho.join('/'));
