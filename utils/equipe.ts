import { db } from './firebase';
import { UserProfile } from '../types';
import { getDisplayName } from './avatar';

/**
 * Equipe da agencia, para atribuir responsavel.
 *
 * Uma leitura, nao assinatura: a lista de quem trabalha na agencia nao muda
 * durante uma sessao de trabalho no quadro, e uma assinatura viva sobre a
 * colecao de usuarios custaria por presenca em tela sem entregar nada.
 *
 * SO A EQUIPE, nunca contato de cliente: quem executa conteudo e a agencia.
 * Atribuir uma etapa de producao ao cliente seria cobrar dele um trabalho que
 * nao e dele - e ele nem ve estas telas.
 */
export async function lerEquipeAgencia(): Promise<UserProfile[]> {
    const snap = await db.collection('usuarios').where('role', '==', 'agencia').get();
    return snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as UserProfile))
        .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b), 'pt-BR'));
}

/** Indice uid -> pessoa, para o quadro resolver rosto sem varrer a lista. */
export const indexarPorUid = (pessoas: UserProfile[]): Record<string, UserProfile> =>
    pessoas.reduce((acc, p) => { acc[p.id] = p; return acc; }, {} as Record<string, UserProfile>);

/**
 * Resolve uids em pessoas, descartando quem nao existe mais.
 *
 * Uid de alguem removido da equipe continua gravado no conteudo; sem o descarte,
 * o quadro renderizaria um rosto sem nome nem iniciais.
 */
export const pessoasDeUids = (uids: string[] | null | undefined, indice: Record<string, UserProfile>) =>
    (uids || []).map(uid => indice[uid]).filter(Boolean);
