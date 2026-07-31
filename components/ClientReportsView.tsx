import React, { useState, useEffect, useMemo } from 'react';
import { MonthlyReport } from '../types';
import { subscribeReports, saveReport, deleteReport, MESES, formatPeriodo, periodoId } from '../utils/reports';
import { toSafeHref } from '../utils/url';
import {
    FileBarChart, Plus, Save, Loader2, Trash2, AlertTriangle,
    ExternalLink, Check, X, Pencil
} from 'lucide-react';

interface ClientReportsViewProps {
    empresaId: string;
    userRole: 'agencia' | 'cliente';
    userName?: string | null;
}

const emptyForm = () => {
    const now = new Date();
    // Padrao no mes ANTERIOR: relatorio se lanca sobre um periodo fechado, e no
    // dia 3 de agosto quem abre a tela quer lancar julho, nao agosto.
    const ref = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
        ano: ref.getFullYear(),
        mes: ref.getMonth() + 1,
        resumo: '',
        destaques: '',
        linkUrl: '',
        alcance: '' as string,
        interacoes: '' as string,
        seguidores: '' as string,
        publicados: '' as string
    };
};

const parseNumber = (raw: string): number | null => {
    if (raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : Math.max(0, Math.round(n));
};

const formatNumber = (value?: number | null) =>
    value === null || value === undefined ? '—' : value.toLocaleString('pt-BR');

/**
 * Relatorios mensais de um cliente.
 *
 * O portal mostrava o que foi produzido e nunca o que aquilo rendeu. Aqui a
 * agencia lanca a leitura do mes; o cliente le. A escrita e bloqueada nas
 * regras do Firestore, entao o formulario simplesmente nao existe para ele -
 * exibir e depois falhar por permissao seria pior.
 */
const ClientReportsView: React.FC<ClientReportsViewProps> = ({ empresaId, userRole, userName }) => {
    const [reports, setReports] = useState<MonthlyReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const isAgency = userRole === 'agencia';

    useEffect(() => {
        if (!empresaId) return;
        setIsLoading(true);
        const unsubscribe = subscribeReports(
            empresaId,
            data => { setReports(data); setIsLoading(false); },
            () => { setLoadError('Não foi possível carregar os relatórios.'); setIsLoading(false); }
        );
        return unsubscribe;
    }, [empresaId]);

    // Anos disponiveis no seletor: dos ultimos 3 ate o proximo, o que cobre
    // lancamento retroativo sem oferecer uma lista infinita.
    const anos = useMemo(() => {
        const atual = new Date().getFullYear();
        return [atual + 1, atual, atual - 1, atual - 2];
    }, []);

    const openNew = () => {
        setForm(emptyForm());
        setEditingId(null);
        setFormError('');
        setIsFormOpen(true);
    };

    const openEdit = (report: MonthlyReport) => {
        setForm({
            ano: report.ano,
            mes: report.mes,
            resumo: report.resumo,
            destaques: report.destaques || '',
            linkUrl: report.linkUrl || '',
            alcance: report.alcance?.toString() ?? '',
            interacoes: report.interacoes?.toString() ?? '',
            seguidores: report.seguidores?.toString() ?? '',
            publicados: report.publicados?.toString() ?? ''
        });
        setEditingId(report.id);
        setFormError('');
        setIsFormOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving) return;

        if (!form.resumo.trim()) {
            setFormError('Escreva a leitura do mês — é o que o cliente vai ler.');
            return;
        }
        if (form.linkUrl.trim() && !toSafeHref(form.linkUrl)) {
            setFormError('O link complementar não é um endereço válido.');
            return;
        }

        // Lancar sobre um periodo que ja existe sobrescreve, e isso precisa ser
        // dito antes - o id do documento e o proprio periodo.
        const alvo = periodoId(form.ano, form.mes);
        if (!editingId && reports.some(r => r.id === alvo)) {
            const confirmado = window.confirm(
                `Já existe relatório de ${formatPeriodo(form.ano, form.mes)}. Substituir o conteúdo dele?`
            );
            if (!confirmado) return;
        }

        setIsSaving(true);
        setFormError('');
        try {
            await saveReport(empresaId, {
                ano: form.ano,
                mes: form.mes,
                resumo: form.resumo.trim(),
                destaques: form.destaques.trim() || null,
                linkUrl: toSafeHref(form.linkUrl) || null,
                alcance: parseNumber(form.alcance),
                interacoes: parseNumber(form.interacoes),
                seguidores: parseNumber(form.seguidores),
                publicados: parseNumber(form.publicados)
            }, userName || null);
            setIsFormOpen(false);
            setEditingId(null);
        } catch (error) {
            console.error(error);
            setFormError('Não foi possível salvar. Verifique sua conexão e tente novamente.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (report: MonthlyReport) => {
        if (!window.confirm(`Excluir o relatório de ${formatPeriodo(report.ano, report.mes)}? Esta ação não pode ser desfeita.`)) return;
        try {
            await deleteReport(empresaId, report.id);
        } catch (error) {
            console.error(error);
            setLoadError('Não foi possível excluir o relatório.');
        }
    };

    const inputStyle = "w-full bg-[#111111] border border-zinc-700 rounded-control px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all";
    const labelStyle = "block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5";

    return (
        <div className="text-zinc-100">
            <header className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                        <FileBarChart className="w-7 h-7 text-[#FABE01] shrink-0" />
                        Relatórios
                    </h1>
                    <p className="text-zinc-400 mt-2 text-sm max-w-xl leading-relaxed">
                        {isAgency
                            ? 'Lance a leitura de cada mês fechado. O cliente vê aqui o que foi entregue e o que aquilo rendeu.'
                            : 'Leitura mensal do trabalho: o que foi publicado e o resultado que gerou.'}
                    </p>
                </div>
                {isAgency && !isFormOpen && (
                    <button
                        onClick={openNew}
                        className="inline-flex items-center gap-2 bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-bold text-sm px-5 py-2.5 rounded-control uppercase tracking-wide transition-colors shrink-0"
                    >
                        <Plus className="w-4 h-4" /> Lançar relatório
                    </button>
                )}
            </header>

            {isAgency && isFormOpen && (
                <form onSubmit={handleSubmit} className="bg-[#1A1A1A] border border-[#FABE01]/20 rounded-card p-4 sm:p-6 mb-8 space-y-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-white font-bold">
                            {editingId ? `Editando ${formatPeriodo(form.ano, form.mes)}` : 'Novo relatório'}
                        </h2>
                        <button
                            type="button"
                            onClick={() => { setIsFormOpen(false); setEditingId(null); }}
                            aria-label="Fechar formulário"
                            className="text-zinc-500 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                            <label className={labelStyle}>Mês</label>
                            <select
                                value={form.mes}
                                onChange={(e) => setForm({ ...form, mes: Number(e.target.value) })}
                                disabled={Boolean(editingId)}
                                className={inputStyle}
                            >
                                {MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelStyle}>Ano</label>
                            <select
                                value={form.ano}
                                onChange={(e) => setForm({ ...form, ano: Number(e.target.value) })}
                                disabled={Boolean(editingId)}
                                className={inputStyle}
                            >
                                {anos.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                    </div>
                    {editingId && (
                        <p className="text-zinc-600 text-xs">
                            O período identifica o relatório, então não muda na edição. Para trocar de mês, exclua e lance de novo.
                        </p>
                    )}

                    <div>
                        <label className={labelStyle}>Leitura do mês</label>
                        <textarea
                            value={form.resumo}
                            onChange={(e) => setForm({ ...form, resumo: e.target.value })}
                            rows={5}
                            placeholder="O que aconteceu no mês, o que funcionou e o que muda no próximo."
                            className={`${inputStyle} resize-y leading-relaxed`}
                        />
                    </div>

                    <div>
                        <label className={labelStyle}>Destaques (um por linha)</label>
                        <textarea
                            value={form.destaques}
                            onChange={(e) => setForm({ ...form, destaques: e.target.value })}
                            rows={4}
                            placeholder={'Reel do dia 12 foi o melhor alcance do mês\nCarrossel de bastidores puxou salvamentos'}
                            className={`${inputStyle} resize-y leading-relaxed`}
                        />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {([
                            ['alcance', 'Alcance'],
                            ['interacoes', 'Interações'],
                            ['seguidores', 'Novos seguidores'],
                            ['publicados', 'Publicados']
                        ] as const).map(([key, label]) => (
                            <div key={key}>
                                <label className={labelStyle}>{label}</label>
                                <input
                                    type="number"
                                    min={0}
                                    inputMode="numeric"
                                    value={form[key]}
                                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                                    placeholder="—"
                                    className={inputStyle}
                                />
                            </div>
                        ))}
                    </div>

                    <div>
                        <label className={labelStyle}>Link complementar (opcional)</label>
                        <input
                            type="text"
                            value={form.linkUrl}
                            onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                            placeholder="Apresentação, planilha, dashboard..."
                            className={inputStyle}
                        />
                    </div>

                    {formError && (
                        <p className="text-red-400 text-sm flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {formError}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex items-center gap-2 bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-bold text-sm px-6 py-3 rounded-control uppercase tracking-wide transition-colors disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {isSaving ? 'Salvando...' : 'Salvar relatório'}
                    </button>
                </form>
            )}

            {isLoading ? (
                <div className="py-16 flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-[#FABE01] animate-spin" />
                    <p className="text-zinc-500 text-sm">Carregando relatórios...</p>
                </div>
            ) : loadError ? (
                <div className="py-16 flex flex-col items-center gap-3 text-center px-6">
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                    <p className="text-zinc-300 text-sm max-w-sm">{loadError}</p>
                </div>
            ) : reports.length === 0 ? (
                <div className="py-16 px-6 text-center border border-dashed border-white/10 rounded-card">
                    <FileBarChart className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-300 font-bold mb-1">Nenhum relatório lançado</p>
                    <p className="text-zinc-500 text-sm max-w-md mx-auto leading-relaxed">
                        {isAgency
                            ? 'Use "Lançar relatório" para registrar o fechamento de um mês.'
                            : 'Assim que a equipe fechar o mês, o relatório aparece aqui.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {reports.map(report => (
                        <article key={report.id} className="bg-[#1A1A1A] border border-white/5 rounded-card p-4 sm:p-6 group">
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div>
                                    <h2 className="text-white font-bold text-lg">{formatPeriodo(report.ano, report.mes)}</h2>
                                    {report.criadoPor && (
                                        <p className="text-zinc-600 text-xs mt-0.5">
                                            Lançado por {report.criadoPor}
                                            {report.atualizadoEm ? ` · atualizado em ${report.atualizadoEm.toLocaleDateString('pt-BR')}` : ''}
                                        </p>
                                    )}
                                </div>
                                {isAgency && (
                                    <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                                        <button onClick={() => openEdit(report)} aria-label="Editar relatório" className="p-2 text-zinc-500 hover:text-[#FABE01] transition-colors">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(report)} aria-label="Excluir relatório" className="p-2 text-zinc-500 hover:text-red-400 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                                {([
                                    ['Alcance', report.alcance],
                                    ['Interações', report.interacoes],
                                    ['Novos seguidores', report.seguidores],
                                    ['Publicados', report.publicados]
                                ] as const).map(([label, value]) => (
                                    <div key={label} className="bg-[#111111] border border-white/5 rounded-control p-3">
                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
                                        <p className="text-lg font-bold text-white">{formatNumber(value)}</p>
                                    </div>
                                ))}
                            </div>

                            <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{report.resumo}</p>

                            {report.destaques && (
                                <ul className="mt-4 space-y-1.5">
                                    {report.destaques.split('\n').filter(l => l.trim()).map((linha, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                                            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                            <span className="leading-relaxed">{linha.trim()}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {report.linkUrl && toSafeHref(report.linkUrl) && (
                                <a
                                    href={toSafeHref(report.linkUrl)!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#FABE01] hover:underline"
                                >
                                    Abrir material complementar <ExternalLink className="w-4 h-4" />
                                </a>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ClientReportsView;
