import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db } from './firebase';

/**
 * CARGOS - lista fechada, definida pela agencia.
 *
 * Antes o cargo era texto livre: cada pessoa digitava o proprio. Em duas semanas
 * a equipe tinha "Social Media", "social midia", "Social" e "SM" convivendo, e
 * qualquer filtro ou contagem por funcao passava a mentir - sao quatro cargos
 * diferentes para o banco. Etiqueta que serve para agrupar nao pode ser digitada
 * a mao.
 *
 * A lista vive no BANCO (configuracoes/cargos), e nao no codigo, porque quem
 * decide os cargos e a agencia e a decisao muda sem programador. O que fica no
 * codigo e o PADRAO abaixo: enquanto ninguem tiver salvo nada, o app usa esta
 * lista - assim ele funciona no primeiro dia, sem migracao e sem tela vazia.
 */
export const CARGOS_PADRAO = [
    'Gestor de Tráfego',
    'Designer',
    'Social Mídia',
    'Editor',
    'Dev',
    'Administrador',
    'Financeiro',
    'Vendedor'
] as const;

const ref = () => db.collection('configuracoes').doc('cargos');

/**
 * Limpa um cargo digitado na tela de configuracoes.
 *
 * Colapsa espaco repetido e apara as pontas. Nao mexe em maiuscula/minuscula: a
 * agencia escolhe como escreve o proprio cargo, e um "title case" automatico
 * estragaria "Dev" ou uma sigla.
 */
export const normalizarCargo = (valor: string) => valor.replace(/\s+/g, ' ').trim();

/** Compara ignorando caixa e acento - "Editor" e "editor" sao o mesmo cargo. */
export const mesmoCargo = (a: string, b: string) =>
    a.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase() ===
    b.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * Assina a lista de cargos.
 *
 * Assinatura, e nao leitura unica: dois administradores mexendo na lista ao
 * mesmo tempo veriam telas diferentes, e o select de cargo de uma ficha aberta
 * ficaria com uma lista que nao existe mais.
 *
 * Documento ausente devolve o PADRAO em vez de lista vazia. Vazio deixaria o
 * select sem nenhuma opcao, e ninguem conseguiria definir cargo de ninguem ate
 * alguem descobrir a tela de configuracoes.
 */
export function subscribeCargos(
    onData: (cargos: string[]) => void,
    onError?: () => void
): () => void {
    return ref().onSnapshot(
        doc => {
            const lista = doc.exists ? (doc.data()?.lista as string[] | undefined) : undefined;
            onData(Array.isArray(lista) && lista.length > 0 ? lista : [...CARGOS_PADRAO]);
        },
        erro => {
            console.error('Erro ao carregar cargos:', erro);
            // Cai no padrao tambem no erro: uma ficha sem opcao de cargo e pior
            // que uma ficha com a lista de fabrica.
            onData([...CARGOS_PADRAO]);
            onError?.();
        }
    );
}

/** Grava a lista inteira. So admin - a regra recusa o resto. */
export async function salvarCargos(lista: string[], autorEmail?: string | null): Promise<void> {
    await ref().set({
        lista,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        atualizadoPor: autorEmail || null
    }, { merge: true });
}
