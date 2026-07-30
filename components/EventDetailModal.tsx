import React, { useState, useEffect, useRef } from 'react';
import { CalendarEvent } from '../types';
import { PLATAFORMA_OPTIONS, STATUS_OPTIONS, FORMATO_OPTIONS } from '../constants';
import { toSafeHref } from '../utils/url';
import { toDateInputValue, fromDateInputValue } from '../utils/date';
import {
    X, Trash2, Calendar, User, Link as LinkIcon,
    Save, ExternalLink, Instagram, Linkedin, Facebook,
    Youtube, Twitter, Globe, Check, Loader2, AlertTriangle
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
}

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

const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, onSave, onDelete, onClose, isSaving = false, errorMessage }) => {
    const [editableEvent, setEditableEvent] = useState<CalendarEvent>(event);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDiscardWarning, setShowDiscardWarning] = useState(false);
    const isCreating = !event.id;
    const titleRef = useRef<HTMLTextAreaElement>(null);

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
    const inputStyle = "w-full bg-[#111111] border border-zinc-700 rounded-sm px-3 py-3 text-base text-white focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all placeholder:text-zinc-600 appearance-none";

    return (
        <div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label={isCreating ? 'Nova publicação' : 'Editar publicação'}
        >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={requestClose} />
            <div className="relative w-full sm:max-w-3xl bg-[#1A1A1A] border-t sm:border border-white/10 rounded-t-xl sm:rounded-sm shadow-2xl flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 overflow-hidden">

                {isDeleting && (
                    <div className="absolute inset-0 z-10 bg-[#1A1A1A] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-200">
                        <h3 className="text-xl font-bold text-white mb-2">Excluir Agendamento?</h3>
                        {/* Antes dizia "Esta ação pode ser desfeita" - o oposto do que
                            acontece. A exclusao apaga o evento, o espelho e o card do
                            Kanban, sem retorno. */}
                        <p className="text-zinc-400 mb-8 max-w-xs leading-relaxed">
                            Esta ação <strong className="text-white">não pode</strong> ser desfeita. O agendamento e o card correspondente na produção serão removidos.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                            <button onClick={handleCancelDelete} disabled={isSaving} className="w-full py-3 rounded-sm border border-zinc-700 text-zinc-300 hover:text-white font-medium transition-colors disabled:opacity-50">Cancelar</button>
                            <button onClick={handleConfirmDelete} disabled={isSaving} className="w-full py-3 rounded-sm bg-red-500 hover:bg-red-600 text-white font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {isSaving ? 'Excluindo...' : 'Sim, Excluir'}
                            </button>
                        </div>
                        {errorMessage && <p className="text-red-400 text-sm mt-4 max-w-xs">{errorMessage}</p>}
                    </div>
                )}

                {showDiscardWarning && (
                    <div className="absolute inset-0 z-20 bg-[#1A1A1A] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-200">
                        <h3 className="text-xl font-bold text-white mb-2">Descartar alterações?</h3>
                        <p className="text-zinc-400 mb-8 max-w-xs leading-relaxed">
                            Você editou esta publicação e ainda não salvou. Se sair agora, as alterações são perdidas.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                            <button onClick={() => setShowDiscardWarning(false)} className="w-full py-3 rounded-sm border border-zinc-700 text-zinc-300 hover:text-white font-medium transition-colors">Continuar editando</button>
                            <button onClick={onClose} className="w-full py-3 rounded-sm bg-red-500 hover:bg-red-600 text-white font-bold transition-colors">Descartar</button>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-white/5 shrink-0 gap-4">
                    <div className="flex-1">
                        <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2 block">Título da Publicação</label>
                        <div className="relative w-full min-h-[40px]">
                            <div className="w-full text-xl sm:text-2xl font-bold text-transparent pointer-events-none whitespace-pre-wrap break-words px-0 py-0 leading-tight border-none" aria-hidden="true">
                                {editableEvent.title || 'Placeholder'}
                            </div>
                            <textarea
                                value={editableEvent.title}
                                onChange={(e) => handleChange('title', e.target.value)}
                                placeholder="Digite o título aqui..."
                                className="absolute inset-0 w-full h-full bg-transparent text-xl sm:text-2xl font-bold text-white placeholder:text-zinc-600 border-none focus:ring-0 p-0 resize-none overflow-hidden leading-tight break-words whitespace-pre-wrap"
                                autoFocus={isCreating}
                            />
                        </div>
                    </div>
                    <button onClick={requestClose} aria-label="Fechar" className="p-2 text-zinc-500 hover:text-white bg-white/5 rounded-full sm:bg-transparent sm:rounded-sm shrink-0"><X className="w-6 h-6" /></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                            <label className={labelStyle}>Data</label>
                            <div className="relative">
                                <input type="date" value={toDateInputValue(editableEvent.date)} onChange={(e) => { const parsed = fromDateInputValue(e.target.value); if (parsed) handleChange('date', parsed); }} className={`${inputStyle} [color-scheme:dark]`} />
                                <Calendar className="absolute right-3 top-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className={labelStyle}>Status</label>
                            <div className="relative">
                                <select value={editableEvent.status} onChange={(e) => handleChange('status', e.target.value)} className={inputStyle}>
                                    {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className={labelStyle}>Formato / Tipo</label>
                            <div className="relative">
                                <select value={editableEvent.type} onChange={(e) => handleChange('type', e.target.value)} className={inputStyle}>
                                    {FORMATO_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className={labelStyle}>Plataforma</label>
                            <div className="relative">
                                <select value={editableEvent.plataforma} onChange={(e) => handleChange('plataforma', e.target.value)} className={inputStyle}>
                                    {PLATAFORMA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <div className="absolute right-3 top-3.5 pointer-events-none text-zinc-500">{getPlatformIcon(editableEvent.plataforma)}</div>
                            </div>
                        </div>
                        <div className="col-span-1 sm:col-span-2 lg:col-span-4">
                            <label className={labelStyle}>Responsável</label>
                            <div className="relative">
                                <input type="text" value={editableEvent.proprietario || ''} onChange={(e) => handleChange('proprietario', e.target.value)} placeholder="Nome" className={inputStyle} />
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
                                    <input type="text" value={editableEvent.url || ''} onChange={(e) => handleChange('url', e.target.value)} placeholder="Pasta do Drive..." className={inputStyle} />
                                    <LinkIcon className="absolute right-3 top-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                                </div>
                                {toSafeHref(editableEvent.url) && (
                                    <a href={toSafeHref(editableEvent.url)!} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-[#FABE01]/10 text-[#FABE01] border border-[#FABE01]/20 rounded-sm flex items-center justify-center shrink-0" title="Acessar Material Bruto">
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
                                    <input type="text" value={editableEvent.finalUrl || ''} onChange={(e) => handleChange('finalUrl', e.target.value)} placeholder="Link aprovado/final..." className={inputStyle} />
                                    <LinkIcon className="absolute right-3 top-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                                </div>
                                {toSafeHref(editableEvent.finalUrl) && (
                                    <a href={toSafeHref(editableEvent.finalUrl)!} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-sm flex items-center justify-center shrink-0" title="Acessar Conteúdo Final">
                                        <ExternalLink className="w-5 h-5" />
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col flex-1 min-h-[150px]">
                        <label className={labelStyle}>Legenda / Copy</label>
                        <textarea
                            value={editableEvent.copy || ''}
                            onChange={(e) => handleChange('copy', e.target.value)}
                            placeholder="Escreva a legenda do post aqui..."
                            className={`${inputStyle} flex-1 resize-none min-h-[160px] leading-relaxed text-base`}
                        />
                    </div>
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
                            {!isCreating && (
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
                            {hasUnsavedChanges && !isSaving && (
                                <span className="hidden sm:inline text-xs text-[#FABE01] font-medium">Alterações não salvas</span>
                            )}
                            <button onClick={requestClose} disabled={isSaving} className="hidden sm:block px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 rounded-sm transition-colors disabled:opacity-50">Cancelar</button>
                            <button onClick={() => onSave(editableEvent)} disabled={isSaving} className="hidden sm:flex px-6 py-2 bg-[#FABE01] text-black font-bold text-sm rounded-sm shadow-[0_0_15px_rgba(250,190,1,0.2)] items-center gap-2 hover:bg-[#FABE01]/90 disabled:opacity-60 disabled:cursor-not-allowed">
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {isSaving ? 'Salvando...' : (isCreating ? 'Agendar' : 'Salvar')}
                            </button>
                            <button onClick={requestClose} disabled={isSaving} aria-label="Cancelar" className="flex sm:hidden w-12 h-12 bg-zinc-800 text-zinc-400 rounded-full items-center justify-center border border-zinc-700 active:scale-95 transition-transform disabled:opacity-50"><X className="w-6 h-6" /></button>
                            <button onClick={() => onSave(editableEvent)} disabled={isSaving} aria-label={isCreating ? 'Agendar' : 'Salvar'} className="flex sm:hidden w-12 h-12 bg-[#FABE01] text-black rounded-full items-center justify-center shadow-[0_0_15px_rgba(250,190,1,0.3)] active:scale-95 transition-transform disabled:opacity-60">
                                {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : (isCreating ? <Check className="w-6 h-6" /> : <Save className="w-6 h-6" />)}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EventDetailModal;