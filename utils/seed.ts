// Controle de seed de dados de exemplo.
//
// O padrao anterior era "colecao vazia => semeia". Isso confunde dois estados
// muito diferentes: "empresa nova, nunca usou" e "o cliente apagou tudo de
// proposito". Na segunda situacao os itens de demonstracao reapareciam sozinhos
// no proximo carregamento - e nao havia como o usuario se livrar deles.
//
// A marca fica em empresas/{id}/_meta/seed. Precisa ser subcolecao: as regras
// do Firestore permitem escrita do cliente em empresas/{id}/{sub}/{doc}, mas
// reservam o documento da empresa para a agencia.

import { db } from './firebase';

export type SeedKind = 'events' | 'tasks';

const seedMetaRef = (empresaId: string) =>
    db.collection('empresas').doc(empresaId).collection('_meta').doc('seed');

/**
 * Diz se ainda devemos semear `kind` para esta empresa.
 *
 * Em caso de erro de leitura responde `false` — semear por engano cria lixo
 * visivel para o cliente, enquanto nao semear apenas mostra o empty state,
 * que ja orienta a proxima acao.
 */
export async function shouldSeed(empresaId: string, kind: SeedKind): Promise<boolean> {
    try {
        const snapshot = await seedMetaRef(empresaId).get();
        if (!snapshot.exists) return true;
        return snapshot.data()?.[kind] !== true;
    } catch (error) {
        console.error('Falha ao ler marca de seed:', error);
        return false;
    }
}

/** Registra que `kind` ja foi semeado, para nao repetir em outra sessao. */
export async function markSeeded(empresaId: string, kind: SeedKind): Promise<void> {
    try {
        await seedMetaRef(empresaId).set({ [kind]: true }, { merge: true });
    } catch (error) {
        console.error('Falha ao gravar marca de seed:', error);
    }
}
