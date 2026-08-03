import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db } from './firebase';
import { Empresa, EmpresaStatus, DadosFinanceiros } from '../types';
import { stripUndefined } from './firestore';

/**
 * Ficha do cliente.
 *
 * A ficha vive em `empresas/{id}`; o financeiro em `empresas/{id}/_financeiro/dados`.
 * A separacao nao e organizacao, e seguranca: o cliente le o proprio documento
 * de empresa por inteiro, e o Firestore nao filtra campo na leitura. Ver a nota
 * em types.ts (DadosFinanceiros) e as regras.
 */

const ref = (empresaId: string) => db.collection('empresas').doc(empresaId);
const financeiroRef = (empresaId: string) => ref(empresaId).collection('_financeiro').doc('dados');

/**
 * Nome legivel -> id de documento.
 *
 * IDs do Firestore nao aceitam "/", nao podem ser "." ou "..", e um nome com
 * espacos gera caminho fragil. O nome legivel fica no campo `nome`.
 */
export function slugify(nome: string): string {
    return nome
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}

/** @ do Instagram sem arroba, sem URL e sem espaco. */
export function normalizeHandle(valor?: string | null): string | null {
    const limpo = (valor || '')
        .trim()
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
        .replace(/^@/, '')
        .replace(/\/.*$/, '')
        .trim();
    return limpo || null;
}

export const EMPRESA_STATUS: { id: EmpresaStatus; label: string; cor: string }[] = [
    { id: 'ativo', label: 'Ativo', cor: 'bg-emerald-500/15 text-emerald-400' },
    { id: 'pausado', label: 'Pausado', cor: 'bg-amber-500/15 text-amber-400' },
    { id: 'encerrado', label: 'Encerrado', cor: 'bg-white/5 text-zinc-500' }
];

export const statusLabel = (status?: EmpresaStatus | null) =>
    EMPRESA_STATUS.find(s => s.id === (status || 'ativo')) || EMPRESA_STATUS[0];

export const ORIGEM_OPTIONS = [
    'Indicação', 'Instagram', 'Tráfego pago', 'Prospecção ativa', 'Evento', 'Outro'
];

/** Converte o documento cru, resolvendo Timestamp. */
export function parseEmpresa(id: string, data: firebase.firestore.DocumentData): Empresa {
    return {
        ...data,
        id,
        nome: data.nome || id,
        criadoEm: (data.criadoEm as firebase.firestore.Timestamp | undefined)?.toDate() || null
    } as Empresa;
}

/**
 * Campo de texto vazio vira null.
 *
 * Sem isto o documento acumula `segmento: ""`, `whatsapp: ""` e afins - lixo que
 * ocupa espaco e obriga toda leitura a testar os dois casos ("" e ausente) para
 * decidir se ha valor.
 */
function limparVazios<T extends Record<string, unknown>>(obj: T): T {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') out[k] = v.trim() || null;
        else if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
            out[k] = limparVazios(v as Record<string, unknown>);
        } else out[k] = v;
    }
    return out as T;
}

export class EmpresaJaExisteError extends Error {
    constructor(public readonly empresaId: string) {
        super(`Já existe um cliente com o ID "${empresaId}".`);
        this.name = 'EmpresaJaExisteError';
    }
}

/**
 * Cria o cliente. Recusa se o id ja existir.
 *
 * Sem essa checagem, criar por cima de um cliente existente reatribuiria o
 * calendario, os relatorios e o historico de aprovacao dele para outro cliente,
 * sem aviso nenhum.
 */
export async function criarEmpresa(
    ficha: Omit<Empresa, 'id' | 'criadoEm' | 'criadoPor'>,
    autorEmail?: string | null
): Promise<string> {
    const empresaId = slugify(ficha.nome);
    if (!empresaId) throw new Error('Use ao menos uma letra ou número no nome.');

    const existente = await ref(empresaId).get();
    if (existente.exists) throw new EmpresaJaExisteError(empresaId);

    await ref(empresaId).set(stripUndefined(limparVazios({
        ...ficha,
        handle: normalizeHandle(ficha.handle),
        status: ficha.status || 'ativo',
        criadoEm: new Date(),
        criadoPor: autorEmail || null
    })));
    return empresaId;
}

/** Atualiza a ficha. `id` nunca muda: renomear so troca o campo `nome`. */
export async function salvarEmpresa(empresaId: string, ficha: Partial<Empresa>): Promise<void> {
    const { id, criadoEm, criadoPor, ...resto } = ficha;
    await ref(empresaId).set(stripUndefined(limparVazios({
        ...resto,
        ...(resto.handle !== undefined ? { handle: normalizeHandle(resto.handle) } : {})
    })), { merge: true });
}

// --- FINANCEIRO ----------------------------------------------------------

export async function lerFinanceiro(empresaId: string): Promise<DadosFinanceiros | null> {
    const doc = await financeiroRef(empresaId).get();
    if (!doc.exists) return null;
    const data = doc.data() || {};
    return {
        ...data,
        inicioContrato: (data.inicioContrato as firebase.firestore.Timestamp | undefined)?.toDate() || null,
        atualizadoEm: (data.atualizadoEm as firebase.firestore.Timestamp | undefined)?.toDate() || null
    } as DadosFinanceiros;
}

export async function salvarFinanceiro(
    empresaId: string,
    dados: DadosFinanceiros,
    autorEmail?: string | null
): Promise<void> {
    await financeiroRef(empresaId).set(stripUndefined({
        ...dados,
        atualizadoEm: new Date(),
        atualizadoPor: autorEmail || null
    }), { merge: true });
}

/** Financeiro de uma PESSOA da equipe: usuarios/{uid}/_financeiro/dados. */
const financeiroUsuarioRef = (uid: string) =>
    db.collection('usuarios').doc(uid).collection('_financeiro').doc('dados');

export async function lerFinanceiroUsuario(uid: string): Promise<DadosFinanceiros | null> {
    const doc = await financeiroUsuarioRef(uid).get();
    if (!doc.exists) return null;
    const data = doc.data() || {};
    return {
        ...data,
        inicioContrato: (data.inicioContrato as firebase.firestore.Timestamp | undefined)?.toDate() || null,
        atualizadoEm: (data.atualizadoEm as firebase.firestore.Timestamp | undefined)?.toDate() || null
    } as DadosFinanceiros;
}

export async function salvarFinanceiroUsuario(
    uid: string,
    dados: DadosFinanceiros,
    autorEmail?: string | null
): Promise<void> {
    await financeiroUsuarioRef(uid).set(stripUndefined({
        ...dados,
        atualizadoEm: new Date(),
        atualizadoPor: autorEmail || null
    }), { merge: true });
}

// --- DINHEIRO ------------------------------------------------------------
//
// Guardado em CENTAVOS como inteiro. Reais em float acumulam erro de ponto
// flutuante (0.1 + 0.2 !== 0.3), e em valor de contrato isso vira divergencia
// de centavos que ninguem consegue explicar depois.

export function centavosParaTexto(centavos?: number | null): string {
    if (centavos === null || centavos === undefined) return '';
    return (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function textoParaCentavos(texto: string): number | null {
    const limpo = texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    if (!limpo) return null;
    const valor = Number(limpo);
    return Number.isFinite(valor) ? Math.round(valor * 100) : null;
}

export const formatarMoeda = (centavos?: number | null) =>
    centavos === null || centavos === undefined
        ? '—'
        : (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
