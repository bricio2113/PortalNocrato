// Relatorios mensais por cliente.
//
// Ficam em empresas/{id}/relatorios/{aaaa-mm}. Usar o periodo como id do
// documento resolve tres coisas de graca: um relatorio por mes sem consulta de
// duplicidade, ordenacao cronologica pela ordem alfabetica do id, e leitura
// direta de um mes especifico sem query.

import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db } from './firebase';
import { MonthlyReport } from '../types';
import { stripUndefined } from './firestore';

const relatoriosRef = (empresaId: string) =>
    db.collection('empresas').doc(empresaId).collection('relatorios');

export const MESES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/** "2026-07" a partir de ano e mes (mes 1-12). */
export const periodoId = (ano: number, mes: number) =>
    `${ano}-${String(mes).padStart(2, '0')}`;

export const formatPeriodo = (ano: number, mes: number) =>
    `${MESES[mes - 1] || '?'} de ${ano}`;

const toDate = (value: unknown): Date | null =>
    (value as firebase.firestore.Timestamp | undefined)?.toDate?.() || null;

export function subscribeReports(
    empresaId: string,
    onData: (reports: MonthlyReport[]) => void,
    onError?: (error: Error) => void
): () => void {
    return relatoriosRef(empresaId).onSnapshot(
        snapshot => {
            const reports = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ano: data.ano,
                    mes: data.mes,
                    resumo: data.resumo || '',
                    destaques: data.destaques || null,
                    linkUrl: data.linkUrl || null,
                    alcance: data.alcance ?? null,
                    interacoes: data.interacoes ?? null,
                    seguidores: data.seguidores ?? null,
                    publicados: data.publicados ?? null,
                    criadoPor: data.criadoPor || null,
                    criadoEm: toDate(data.criadoEm),
                    atualizadoEm: toDate(data.atualizadoEm)
                } as MonthlyReport;
            });
            // Mais recente primeiro: e o que alguem quer ver ao abrir a tela.
            reports.sort((a, b) => b.id.localeCompare(a.id));
            onData(reports);
        },
        error => {
            console.error('Erro ao assinar relatórios:', error);
            onError?.(error);
        }
    );
}

/**
 * Grava ou atualiza o relatorio de um periodo.
 *
 * set com merge, e nao add: o id e o periodo, entao lancar o mesmo mes duas
 * vezes atualiza em vez de duplicar - que e o comportamento esperado de "lancar
 * o relatorio de julho".
 */
export async function saveReport(
    empresaId: string,
    report: Omit<MonthlyReport, 'id' | 'criadoEm' | 'atualizadoEm'>,
    autor: string | null
): Promise<string> {
    const id = periodoId(report.ano, report.mes);
    const existing = await relatoriosRef(empresaId).doc(id).get();

    await relatoriosRef(empresaId).doc(id).set(stripUndefined({
        ...report,
        criadoPor: existing.exists ? (existing.data()?.criadoPor || autor) : autor,
        criadoEm: existing.exists ? (existing.data()?.criadoEm || new Date()) : new Date(),
        atualizadoEm: new Date()
    }), { merge: true });

    return id;
}

export async function deleteReport(empresaId: string, id: string): Promise<void> {
    await relatoriosRef(empresaId).doc(id).delete();
}
