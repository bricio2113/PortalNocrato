import React, { useState, useEffect, useRef } from 'react';
import { ApprovalState, CalendarEvent, EventMetrics } from '../types';
import { PLATAFORMA_OPTIONS, STATUS_OPTIONS, FORMATO_OPTIONS } from '../constants';
import { toSafeHref } from '../utils/url';
import { toDateInputValue, fromDateInputValue, toTimeInputValue, withTime, hasTime } from '../utils/date';
import { deadlineState, deadlineClasses } from '../utils/deadline';
import { getMediaPreview, getLinkLabel } from '../utils/media';
import { getClientStage, getApproval, CLIENT_STAGES } from '../utils/eventState';
import { setApproval, saveMetrics } from '../utils/posts';
import PostComments from './PostComments';
import {
    X, Trash2, Calendar, User, Link as LinkIcon,
    Save, ExternalLink, Instagram, Linkedin, Facebook,
    Youtube, Twitter, Globe, Check, Loader2, AlertTriangle,
    ThumbsUp, MessageSquareWarning, ImageOff, BarChart3, FileVideo, Clock
} from 'lucide-react';

interface EventDetailModalProps {
    event: CalendarEvent;
    onSave: (event: CalendarEvent) => void;
    onDelete: (eventId: string) => void;
    onClose: () => void;
    /** Trava os botoes enquanto a gravacao esta em curso. */
    isSaving?: boolean;
    /** Erro vindo do save/delete; mantem o modal aberto para nao perder o texto. */
    errorMessage?: string;

    /** Necessarios para aprovacao e comentarios. */
    empresaId?: string;
    userEmail?: string | null;
    userRole?: 'agencia' | 'cliente';
    /** Nome de quem esta logado; vai para a aprovacao e para os comentarios. */
    userName?: string | null;
    /** Chamado apos o cliente aprovar ou pedir ajuste. */
    onApprovalChange?: (state: ApprovalState) => void;
}

const METRIC_FIELDS = [
    { key: 'alcance' as const, label: 'Alcance' },
    { key: 'interacoes' as const, label: 'Interações' },
    { key: 'cliques' as const, label: 'Cliques' }
];

const formatMetric = (value?: number | null) =>
    value === null || value === undefined ? '—' : value.toLocaleString('pt-BR');

const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
        case 'instagram': return <Instagram className="w-4 h-4" />;
        case 'linkedin': return <Linkedin className="w-4 h-4" />;
        case 'facebook': return <Facebook className="w-4 h-4" />;
        case 'youtube': return <Youtube className="w-4 h-4" />;
        case 'twitter': return <Twitter className="w-4 h-4" />;
        default: return <Globe className="w-4 h-4" />;
    }
};

const EventDetailModal: React.FC<EventDetailModalProps> = ({
    event, onSave, onDelete, onClose, isSaving = false, errorMessage,
    empresaId, userEmail, userRole = 'agencia', userName, onApprovalChange
}) => {
    const [editableEvent, setEditableEvent] = useState<CalendarEvent>(event);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDiscardWarning, setShowDiscardWarning] = useState(false);
    const isCreating = !event.id;
    const titleRef = useRef<HTMLTextAreaElement>(null);

    const isClient = userRole === 'cliente';
    // Aprovacao e comentarios exigem um post ja gravado: sem id nao ha o que
    // referenciar.
    const canReview = Boolean(empresaId && event.id);

    const [approvalBusy, setApprovalBusy] = useState<ApprovalState | null>(null);
    const [approvalError, setApprovalError] = useState('');
    const [localApproval, setLocalApproval] = useState<ApprovalState>(getApproval(event));

    const [previewFailed, setPreviewFailed] = useState(false);
    const [metricsBusy, setMetricsBusy] = useState(false);
    const [metricsSaved, setMetricsSaved] = useState(false);

    useEffect(() => {
        setLocalApproval(getApproval(event));
        setApprovalError('');
        setPreviewFailed(false);
        setMetricsSaved(false);
    }, [event]);

    // Previa: o campo dedicado tem prioridade; sem ele, tentamos o material
    // bruto, que na pratica e o link do Drive.
    const preview = getMediaPreview(
        editableEvent.previewUrl || editableEvent.coverUrl || editableEvent.finalUrl || editableEvent.url
    );
    const hasMetrics = METRIC_FIELDS.some(({ key }) => {
        const v = editableEvent.metrics?.[key];
        return v !== null && v !== undefined;
    });
    const stage = getClientStage({ status: editableEvent.status, approval: localApproval });
    const stageStyle = CLIENT_STAGES[stage];

    const handleApproval = async (state: ApprovalState) => {
        if (!empresaId || !event.id || approvalBusy) return;
        setApprovalBusy(state);
        setApprovalError('');
        try {
            await setApproval(empresaId, event.id, state, userEmail || null, userName || null);
            setLocalApproval(state);
            onApprovalChange?.(state);
        } catch (err) {
            console.error(err);
            setApprovalError('Não foi possível registrar sua resposta. Tente novamente.');
        } finally {
            setApprovalBusy(null);
        }
    };

    const handleMetricsChange = (field: keyof EventMetrics, raw: string) => {
        // Campo vazio guarda null, nao 0: "sem dado" e "zero de alcance" sao
        // informacoes diferentes para o cliente.
        const parsed = raw.trim() === '' ? null : Number(raw);
        const value = parsed === null || Number.isNaN(parsed) ? null : Math.max(0, Math.round(parsed));
        setEditableEvent(prev => ({ ...prev, metrics: { ...prev.metrics, [field]: value } }));
        setMetricsSaved(false);
    };

    const handleSaveMetrics = async () => {
        if (!empresaId || !event.id || metricsBusy) return;
        setMetricsBusy(true);
        try {
            await saveMetrics(empresaId, event.id, editableEvent.metrics || {});
            setMetricsSaved(true);
        } catch (err) {
            console.error(err);
            setApprovalError('Não foi possível salvar as métricas.');
        } finally {
            setMetricsBusy(false);
        }
    };

    useEffect(() => { setEditableEvent(event); setShowDiscardWarning(false); }, [event]);

    // Ha edicao pendente? Comparar o objeto serializado cobre todos os campos
    // sem precisar manter uma lista manual que envelhece a cada campo novo.
    const hasUnsavedChanges = JSON.stringify(editableEvent) !== JSON.stringify(event);

    // Fechar descartando texto digitado e a perda de trabalho mais facil de
    // acontecer aqui: a legenda costuma ser longa e o clique no fundo do modal
    // e involuntario. Com alteracao pendente, confirmamos antes.
    const requestClose = () => {
        if (hasUnsavedChanges) {
            setShowDiscardWarning(true);
            return;
        }
        onClose();
    };

    // Esc fecha o modal - era impossivel sair pelo teclado.
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (isDeleting) { setIsDeleting(false); return; }
            if (showDiscardWarning) { setShowDiscardWarning(false); return; }
            requestClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isDeleting, showDiscardWarning, hasUnsavedChanges]);

    // Sem isto a pagina atras do modal continuava rolando junto no celular.
    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, []);

    const adjustHeight = (element: HTMLTextAreaElement) => {
        element.style.height = 'auto';
        element.style.height = `${element.scrollHeight}px`;
    };

    useEffect(() => {
        if (titleRef.current) {
            adjustHeight(titleRef.current);
        }
    }, [editableEvent.title]);

    const handleChange = (field: keyof CalendarEvent, value: any) => {
        setEditableEvent(prev => ({ ...prev, [field]: value }));
    };

    const handleDeleteClick = () => setIsDeleting(true);
    const handleConfirmDelete = () => onDelete(event.id);
    const handleCancelDelete = () => setIsDeleting(false);

    const labelStyle = "block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5";
    // disabled:* cobre o modo leitura do cliente: as regras do Firestore ja
    // recusam a escrita dele nestes campos, e um formulario que parece editavel
    // mas falha ao salvar e pior que um formulario visivelmente travado.
    const inputStyle = "w-full bg-[#111111] border border-zinc-700 rounded-control px-3 py-3 text-base text-white focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all placeholder:text-zinc-600 appearance-none disabled:opacity-60 disabled:cursor-not-allowed read-only:opacity-60";

    return (
        <div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label={isCreating ? 'Nova publicação' : 'Editar publicação'}
        >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={requestClose} />
            <div className="relative w-full sm:max-w-3xl bg-[#1A1A1A] border-t sm:border border-white/10 rounded-t-card sm:rounded-card shadow-2xl flex flex-col h-[90dvh] sm:h-auto sm:max-h-[90dvh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 overflow-hidden">

                {isDeleting && (
                    <div className="absolute inset-0 z-10 bg-[#1A1A1A] flex flex-col items-center justify-center p-6 sm:p-8 text-center animate-in fade-in duration-200">
                        <h3 className="text-xl font-bold text-white mb-2">Excluir Agendamento?</h3>
                        {/* Antes dizia "Esta ação pode ser desfeita" - o oposto do que
                            acontece. A exclusao apaga o evento, o espelho e o card do
                            Kanban, sem retorno. */}
                        <p className="text-zinc-400 mb-8 max-w-xs leading-relaxed">
                            Esta ação <strong className="text-white">não pode</strong> ser desfeita. O agendamento e o card correspondente na produção serão removidos.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                            <button onClick={handleCancelDelete} disabled={isSaving} className="w-full py-3 rounded-control border border-zinc-700 text-zinc-300 hover:text-white font-medium transition-colors disabled:opacity-50">Cancelar</button>
                            <button onClick={handleConfirmDelete} disabled={isSaving} className="w-full py-3 rounded-control bg-red-500 hover:bg-red-600 text-white font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {isSaving ? 'Excluindo...' : 'Sim, Excluir'}
                            </button>
                        </div>
                        {errorMessage && <p className="text-red-400 text-sm mt-4 max-w-xs">{errorMessage}</p>}
                    </div>
                )}

                {showDiscardWarning && (
                    <div className="absolute inset-0 z-20 bg-[#1A1A1A] flex flex-col items-center justify-center p-6 sm:p-8 text-center animate-in fade-in duration-200">
                        <h3 className="text-xl font-bold text-white mb-2">Descartar alterações?</h3>
                        <p className="text-zinc-400 mb-8 max-w-xs leading-relaxed">
                            Você editou esta publicação e ainda não salvou. Se sair agora, as alterações são perdidas.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                            <button onClick={() => setShowDiscardWarning(false)} className="w-full py-3 rounded-control border border-zinc-700 text-zinc-300 hover:text-white font-medium transition-colors">Continuar editando</button>
                            <button onClick={onClose} className="w-full py-3 rounded-control bg-red-500 hover:bg-red-600 text-white font-bold transition-colors">Descartar</button>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-start justify-between p-4 sm:p-6 border-b border-white/5 shrink-0 gap-3 sm:gap-4">
                    <div className="flex-1">
                        <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2 block">Título da Publicação</label>
                        <div className="relative w-full min-h-[40px]">
                            <div className="w-full text-xl sm:text-2xl font-bold text-transparent pointer-events-none whitespace-pre-wrap break-words px-0 py-0 leading-tight border-none" aria-hidden="true">
                                {editableEvent.title || 'Placeholder'}
                            </div>
                            <textarea
                                value={editableEvent.title}
                                readOnly={isClient}
                                onChange={(e) => handleChange('title', e.target.value)}
                                placeholder="Digite o título aqui..."
                                className="absolute inset-0 w-full h-full bg-transparent text-xl sm:text-2xl font-bold text-white placeholder:text-zinc-600 border-none focus:ring-0 p-0 resize-none overflow-hidden leading-tight break-words whitespace-pre-wrap"
                                autoFocus={isCreating}
                            />
                        </div>
                    </div>
                    <button onClick={requestClose} aria-label="Fechar" className="p-2 text-zinc-500 hover:text-white bg-white/5 rounded-full sm:bg-transparent sm:rounded-control shrink-0"><X className="w-6 h-6" /></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8 custom-scrollbar">

                    {/* ESTAGIO + APROVACAO
                        O cliente nao precisa entender os sete status internos da
                        agencia; precisa saber se a bola esta com ele. */}
                    {canReview && (
                        <div className={`border rounded-card p-4 ${stageStyle.bg} ${stageStyle.border}`}>
                            <div className="flex items-start gap-3">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${stageStyle.dot}`} />
                                <div className="flex-1 min-w-0">
                                    <p className={`font-bold text-sm ${stageStyle.text}`}>{stageStyle.label}</p>
                                    <p className="text-zinc-400 text-xs mt-0.5 leading-relaxed">{stageStyle.hint}</p>

                                    {localApproval === 'ajuste_solicitado' && (
                                        <p className="text-amber-400 text-xs mt-2 font-medium">
                                            Ajuste solicitado{event.approvalByName || event.approvalBy ? ` por ${event.approvalByName || event.approvalBy}` : ''}. Detalhe o que mudar na conversa abaixo.
                                        </p>
                                    )}
                                    {localApproval === 'aprovado' && (event.approvalByName || event.approvalBy) && (
                                        <p className="text-emerald-400/80 text-xs mt-2">
                                            Aprovado por {event.approvalByName || event.approvalBy}
                                            {event.approvalAt ? ` em ${event.approvalAt.toLocaleDateString('pt-BR')}` : ''}.
                                        </p>
                                    )}

                                    {/* Só o cliente decide. A agência vê o estado, não vota. */}
                                    {isClient && stage !== 'publicado' && stage !== 'cancelado' && (
                                        <div className="flex flex-col sm:flex-row gap-2 mt-4">
                                            <button
                                                onClick={() => handleApproval('aprovado')}
                                                disabled={approvalBusy !== null || localApproval === 'aprovado'}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-control uppercase tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                {approvalBusy === 'aprovado' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                                                {localApproval === 'aprovado' ? 'Aprovado' : 'Aprovar'}
                                            </button>
                                            <button
                                                onClick={() => handleApproval('ajuste_solicitado')}
                                                disabled={approvalBusy !== null || localApproval === 'ajuste_solicitado'}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border border-amber-500/40 hover:bg-amber-500/10 text-amber-400 font-bold text-sm rounded-control uppercase tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                {approvalBusy === 'ajuste_solicitado' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquareWarning className="w-4 h-4" />}
                                                Pedir ajuste
                                            </button>
                                        </div>
                                    )}

                                    {approvalError && (
                                        <p className="text-red-400 text-xs mt-2 flex items-center gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {approvalError}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PREVIA DO CRIATIVO
                        Antes o cliente precisava sair do portal, abrir o Drive e
                        voltar para aprovar. */}
                    <div>
                        <label className={labelStyle}>Prévia</label>
                        {preview && preview.kind === 'image' && !previewFailed && (
                            <img
                                src={preview.src}
                                alt={`Prévia de ${editableEvent.title || 'publicação'}`}
                                onError={() => setPreviewFailed(true)}
                                loading="lazy"
                                className="w-full max-h-[420px] object-contain bg-[#111111] border border-white/10 rounded-control"
                            />
                        )}
                        {preview && preview.kind === 'video' && !previewFailed && (
                            <video
                                src={preview.src}
                                controls
                                onError={() => setPreviewFailed(true)}
                                className="w-full max-h-[420px] bg-[#111111] border border-white/10 rounded-control"
                            />
                        )}
                        {(!preview || preview.kind === 'external' || previewFailed) && (
                            <div className="border border-dashed border-white/10 rounded-card p-6 text-center">
                                {preview ? (
                                    <>
                                        {previewFailed ? <ImageOff className="w-8 h-8 text-zinc-700 mx-auto mb-2" /> : <FileVideo className="w-8 h-8 text-zinc-700 mx-auto mb-2" />}
                                        <p className="text-zinc-400 text-sm mb-1">
                                            {previewFailed
                                                ? 'Não foi possível exibir a prévia aqui.'
                                                : `O material está no ${getLinkLabel(preview.src)}.`}
                                        </p>
                                        <p className="text-zinc-600 text-xs mb-4">
                                            {previewFailed
                                                ? 'Verifique se o arquivo está compartilhado por link.'
                                                : 'Arquivos de imagem e vídeo compartilhados por link aparecem direto nesta área.'}
                                        </p>
                                        <a
                                            href={preview.src}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 text-sm font-bold text-[#FABE01] hover:underline"
                                        >
                                            Abrir material <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </>
                                ) : (
                                    <>
                                        <ImageOff className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                                        <p className="text-zinc-500 text-sm">
                                            {isClient
                                                ? 'A equipe ainda não anexou o material desta publicação.'
                                                : 'Preencha um dos links abaixo para a prévia aparecer aqui.'}
                                        </p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                            <label className={labelStyle}>Publicação</label>
                            {/* Data e hora no mesmo campo `date`. A hora nao virou
                                coluna propria porque toda ordenacao, filtro de mes
                                e comparacao com "agora" que ja existem passam a
                                considerar o horario sem nenhuma mudanca. */}
                            <div className="flex gap-2">
                                <div className="relative flex-1 min-w-0">
                                    <input
                                        type="date"
                                        disabled={isClient}
                                        value={toDateInputValue(editableEvent.date)}
                                        onChange={(e) => {
                                            const parsed = fromDateInputValue(e.target.value);
                                            // Preserva a hora ja escolhida: sem isto trocar o
                                            // dia jogava a publicacao de volta para 00:00.
                                            if (parsed) handleChange('date', hasTime(editableEvent.date)
                                                ? withTime(parsed, toTimeInputValue(editableEvent.date))
                                                : parsed);
                                        }}
                                        className={`${inputStyle} [color-scheme:dark]`}
                                    />
                                    <Calendar className="absolute right-3 top-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                                </div>
                                <input
                                    type="time"
                                    disabled={isClient}
                                    aria-label="Horário da publicação"
                                    value={hasTime(editableEvent.date) ? toTimeInputValue(editableEvent.date) : ''}
                                    onChange={(e) => handleChange('date', withTime(editableEvent.date, e.target.value))}
                                    className={`${inputStyle} [color-scheme:dark] w-[7.5rem] shrink-0`}
                                />
                            </div>
                        </div>
                        <div>
                            <label className={labelStyle}>Status</label>
                            <div className="relative">
                                <select disabled={isClient} value={editableEvent.status} onChange={(e) => handleChange('status', e.target.value)} className={inputStyle}>
                                    {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* PRAZO DE PRODUCAO - so a agencia ve.
                            Nao e a data de publicacao: e quando a peca precisa
                            estar pronta por dentro. Mostrar "atrasado 3 dias" ao
                            cliente cria um problema que ele nao tem, num post que
                            ainda vai sair no prazo. Ver utils/deadline.ts. */}
                        {!isClient && (
                            <div>
                                <label className={labelStyle}>Prazo de produção</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={editableEvent.prazoProducao ? toDateInputValue(editableEvent.prazoProducao) : ''}
                                        onChange={(e) => handleChange('prazoProducao', fromDateInputValue(e.target.value))}
                                        className={`${inputStyle} [color-scheme:dark]`}
                                    />
                                    <Clock className="absolute right-3 top-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                                </div>
                                {(() => {
                                    const prazo = deadlineState(editableEvent);
                                    return prazo ? (
                                        <span className={`inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${deadlineClasses(prazo.tone)}`}>
                                            {prazo.label}
                                        </span>
                                    ) : (
                                        <p className="text-[11px] text-zinc-600 mt-2 leading-snug">
                                            Sem prazo definido. Interno — o cliente não vê.
                                        </p>
                                    );
                                })()}
                            </div>
                        )}
                        <div>
                            <label className={labelStyle}>Formato / Tipo</label>
                            <div className="relative">
                                <select disabled={isClient} value={editableEvent.type} onChange={(e) => handleChange('type', e.target.value)} className={inputStyle}>
                                    {FORMATO_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className={labelStyle}>Plataforma</label>
                            <div className="relative">
                                <select disabled={isClient} value={editableEvent.plataforma} onChange={(e) => handleChange('plataforma', e.target.value)} className={inputStyle}>
                                    {PLATAFORMA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <div className="absolute right-3 top-3.5 pointer-events-none text-zinc-500">{getPlatformIcon(editableEvent.plataforma)}</div>
                            </div>
                        </div>
                        <div className="col-span-1 sm:col-span-2 lg:col-span-4">
                            <label className={labelStyle}>Responsável</label>
                            <div className="relative">
                                <input type="text" disabled={isClient} value={editableEvent.proprietario || ''} onChange={(e) => handleChange('proprietario', e.target.value)} placeholder="Nome" className={inputStyle} />
                                <User className="absolute right-3 top-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* LINKS: MATERIAL BRUTO E FINALIZADO */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Link Material Bruto */}
                        <div>
                            <label className={labelStyle}>Link do Material (Bruto)</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input type="text" disabled={isClient} value={editableEvent.url || ''} onChange={(e) => handleChange('url', e.target.value)} placeholder="Pasta do Drive..." className={inputStyle} />
                                    <LinkIcon className="absolute right-3 top-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                                </div>
                                {toSafeHref(editableEvent.url) && (
                                    <a href={toSafeHref(editableEvent.url)!} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-[#FABE01]/10 text-[#FABE01] border border-[#FABE01]/20 rounded-control flex items-center justify-center shrink-0" title="Acessar Material Bruto">
                                        <ExternalLink className="w-5 h-5" />
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Link Conteúdo Finalizado */}
                        <div>
                            <label className={labelStyle}>Link do Conteúdo Finalizado</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input type="text" disabled={isClient} value={editableEvent.finalUrl || ''} onChange={(e) => handleChange('finalUrl', e.target.value)} placeholder="Link aprovado/final..." className={inputStyle} />
                                    <LinkIcon className="absolute right-3 top-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                                </div>
                                {toSafeHref(editableEvent.finalUrl) && (
                                    <a href={toSafeHref(editableEvent.finalUrl)!} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-control flex items-center justify-center shrink-0" title="Acessar Conteúdo Final">
                                        <ExternalLink className="w-5 h-5" />
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Imagem dedicada da previa.
                        Sem este campo o previewUrl era inalcancavel: a previa e o
                        grid do feed dependiam de o link do Drive responder como
                        thumbnail, o que falha em arquivo restrito. Aqui a agencia
                        aponta uma imagem direta quando o Drive nao colabora. */}
                    {!isClient && (
                        <div>
                            <label className={labelStyle}>Imagem da prévia (opcional)</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={editableEvent.previewUrl || ''}
                                    onChange={(e) => handleChange('previewUrl', e.target.value)}
                                    placeholder="Link direto de imagem (.jpg, .png)..."
                                    className={inputStyle}
                                />
                                <LinkIcon className="absolute right-3 top-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                            </div>
                            <p className="text-zinc-600 text-xs mt-1.5 leading-relaxed">
                                Tem prioridade sobre os links acima na prévia e na grade do feed. Use quando o arquivo do Drive não aparecer.
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col flex-1 min-h-[150px]">
                        <label className={labelStyle}>Legenda / Copy</label>
                        <textarea
                            value={editableEvent.copy || ''}
                            readOnly={isClient}
                            onChange={(e) => handleChange('copy', e.target.value)}
                            placeholder="Escreva a legenda do post aqui..."
                            className={`${inputStyle} flex-1 resize-none min-h-[160px] leading-relaxed text-base`}
                        />
                    </div>

                    {/* METRICAS
                        O portal respondia "o que foi feito" e nunca "isso
                        funcionou". A agencia preenche depois de publicar; o
                        cliente sempre ve em leitura. */}
                    {(!isClient || hasMetrics) && (
                        <div>
                            <label className={`${labelStyle} flex items-center gap-2`}>
                                <BarChart3 className="w-4 h-4" /> Resultado
                            </label>

                            {isClient ? (
                                hasMetrics ? (
                                    <div className="grid grid-cols-3 gap-3">
                                        {METRIC_FIELDS.map(({ key, label }) => (
                                            <div key={key} className="bg-[#111111] border border-white/10 rounded-card p-4">
                                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
                                                <p className="text-xl font-bold text-white">
                                                    {formatMetric(editableEvent.metrics?.[key])}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : null
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {METRIC_FIELDS.map(({ key, label }) => (
                                            <div key={key}>
                                                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1 block">{label}</label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    inputMode="numeric"
                                                    value={editableEvent.metrics?.[key] ?? ''}
                                                    onChange={(e) => handleMetricsChange(key, e.target.value)}
                                                    placeholder="—"
                                                    className={inputStyle}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    {canReview && (
                                        <div className="flex items-center gap-3 mt-3">
                                            <button
                                                type="button"
                                                onClick={handleSaveMetrics}
                                                disabled={metricsBusy}
                                                className="inline-flex items-center gap-2 px-4 py-2 border border-white/10 hover:bg-white/5 text-zinc-300 text-xs font-bold uppercase tracking-wide rounded-control transition-colors disabled:opacity-50"
                                            >
                                                {metricsBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                                Salvar resultado
                                            </button>
                                            {metricsSaved && (
                                                <span className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                                                    <Check className="w-3.5 h-3.5" /> Salvo
                                                </span>
                                            )}
                                            {editableEvent.metrics?.atualizadoEm && (
                                                <span className="text-zinc-600 text-xs">
                                                    Atualizado em {editableEvent.metrics.atualizadoEm.toLocaleDateString('pt-BR')}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* CONVERSA */}
                    {canReview && empresaId && (
                        <div className="border-t border-white/5 pt-6">
                            <PostComments
                                empresaId={empresaId}
                                eventId={event.id}
                                userEmail={userEmail || 'desconhecido'}
                                userRole={userRole}
                                authorName={userName}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-white/5 bg-[#111111] shrink-0">
                    {/* O erro precisa aparecer junto do botao que falhou, nao num
                        alert() que o usuario fecha antes de ler. */}
                    {errorMessage && !isDeleting && (
                        <div className="px-4 sm:px-6 pt-4 flex items-start gap-2 text-red-400 text-sm">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                    )}
                    <div className="p-4 sm:p-6 flex justify-between items-center gap-3 pb-8 sm:pb-6">
                        <div className="flex-1 sm:flex-none">
                            {/* Excluir e criar sao da agencia. O cliente aprova. */}
                            {!isCreating && !isClient && (
                                <>
                                    <button onClick={handleDeleteClick} disabled={isSaving} className="hidden sm:flex text-zinc-500 hover:text-red-500 py-2 text-sm font-medium items-center gap-2 transition-colors disabled:opacity-50">
                                        <Trash2 className="w-4 h-4" /> Excluir
                                    </button>
                                    <button onClick={handleDeleteClick} disabled={isSaving} aria-label="Excluir" className="flex sm:hidden w-12 h-12 bg-red-500/10 text-red-500 rounded-full items-center justify-center border border-red-500/20 active:scale-95 transition-transform disabled:opacity-50">
                                        <Trash2 className="w-6 h-6" />
                                    </button>
                                </>
                            )}
                        </div>
                        <div className="flex gap-3 sm:gap-4 items-center">
                            {/* Indicador de alteracao pendente: sem ele nada distingue
                                "ja salvei" de "esqueci de salvar". */}
                            {hasUnsavedChanges && !isSaving && !isClient && (
                                <span className="hidden sm:inline text-xs text-[#FABE01] font-medium">Alterações não salvas</span>
                            )}
                            <button onClick={requestClose} disabled={isSaving} className="hidden sm:block px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 rounded-control transition-colors disabled:opacity-50">{isClient ? 'Fechar' : 'Cancelar'}</button>
                            {/* Salvar campos e privilegio da agencia: as regras do
                                Firestore recusam a escrita do cliente aqui, entao
                                exibir o botao so produziria erro de permissao. */}
                            {!isClient && (
                                <button onClick={() => onSave(editableEvent)} disabled={isSaving} className="hidden sm:flex px-6 py-2 bg-[#FABE01] text-black font-bold text-sm rounded-control shadow-[0_0_15px_rgba(250,190,1,0.2)] items-center gap-2 hover:bg-[#FABE01]/90 disabled:opacity-60 disabled:cursor-not-allowed">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {isSaving ? 'Salvando...' : (isCreating ? 'Agendar' : 'Salvar')}
                                </button>
                            )}
                            <button onClick={requestClose} disabled={isSaving} aria-label="Fechar" className="flex sm:hidden w-12 h-12 bg-zinc-800 text-zinc-400 rounded-full items-center justify-center border border-zinc-700 active:scale-95 transition-transform disabled:opacity-50"><X className="w-6 h-6" /></button>
                            {!isClient && (
                                <button onClick={() => onSave(editableEvent)} disabled={isSaving} aria-label={isCreating ? 'Agendar' : 'Salvar'} className="flex sm:hidden w-12 h-12 bg-[#FABE01] text-black rounded-full items-center justify-center shadow-[0_0_15px_rgba(250,190,1,0.3)] active:scale-95 transition-transform disabled:opacity-60">
                                    {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : (isCreating ? <Check className="w-6 h-6" /> : <Save className="w-6 h-6" />)}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EventDetailModal;