import React, { useState, useEffect, useRef } from 'react';
import { CalendarEvent, EventStatus } from '../types';
import { STATUS_OPTIONS, PLATAFORMA_OPTIONS } from '../constants';
import {
    X, Trash2, Calendar, User, Link as LinkIcon,
    CheckCircle2, AlertCircle, Save, ExternalLink,
    Instagram, Linkedin, Facebook, Youtube, Twitter, Globe, Check, AlertTriangle
} from 'lucide-react';

interface EventDetailModalProps {
    event: CalendarEvent;
    onSave: (event: CalendarEvent) => void;
    onDelete: (eventId: string) => void;
    onClose: () => void;
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

const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, onSave, onDelete, onClose }) => {
    const [editableEvent, setEditableEvent] = useState<CalendarEvent>(event);
    // NOVO ESTADO: Controla se estamos vendo a confirmação de exclusão
    const [isDeleting, setIsDeleting] = useState(false);

    const isCreating = !event.id;
    const titleRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { setEditableEvent(event); }, [event]);

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
        setEditableEvent(prev => ({...prev, [field]: value}));
    };

    // --- FUNÇÕES DE EXCLUSÃO ---
    const handleDeleteClick = () => {
        setIsDeleting(true); // Ativa o modo de confirmação
    };

    const handleConfirmDelete = () => {
        onDelete(event.id); // Deleta de verdade
    };

    const handleCancelDelete = () => {
        setIsDeleting(false); // Volta para o modal normal
    };

    const labelStyle = "block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5";
    const inputStyle = "w-full bg-[#111111] border border-zinc-700 rounded-sm px-3 py-3 text-base text-white focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all placeholder:text-zinc-600 appearance-none";

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full sm:max-w-2xl bg-[#1A1A1A] border-t sm:border border-white/10 rounded-t-xl sm:rounded-sm shadow-2xl flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 overflow-hidden">

                {/* --- TELA DE CONFIRMAÇÃO DE EXCLUSÃO (Sobrepõe o formulário se isDeleting for true) --- */}
                {isDeleting && (
                    <div className="absolute inset-0 z-10 bg-[#1A1A1A] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-200">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Excluir Agendamento?</h3>
                        <p className="text-zinc-400 mb-8 max-w-xs leading-relaxed">
                            Tem certeza que deseja remover este post? Esta ação não pode ser desfeita.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                            <button
                                onClick={handleCancelDelete}
                                className="w-full py-3 rounded-sm border border-zinc-700 text-zinc-300 hover:text-white hover:bg-white/5 font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                className="w-full py-3 rounded-sm bg-red-500 hover:bg-red-600 text-white font-bold transition-colors shadow-lg shadow-red-900/20"
                            >
                                Sim, Excluir
                            </button>
                        </div>
                    </div>
                )}

                {/* --- CONTEÚDO DO FORMULÁRIO (Fica "borrado" ou oculto se estiver deletando, mas tecnicamente está embaixo) --- */}

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
                    <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white bg-white/5 rounded-full sm:bg-transparent sm:rounded-sm shrink-0"><X className="w-6 h-6" /></button>
                </div>

                {/* Body Scrollável */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className={labelStyle}>Status</label>
                            <div className="relative">
                                <select value={editableEvent.status} onChange={(e) => handleChange('status', e.target.value as EventStatus)} className={inputStyle}>
                                    {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <div className="absolute right-3 top-3.5 pointer-events-none text-zinc-500">
                                    {editableEvent.status === 'Concluído' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4" />}
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className={labelStyle}>Data</label>
                            <div className="relative">
                                <input type="date" value={editableEvent.date.toISOString().split('T')[0]} onChange={(e) => { const [y, m, d] = e.target.value.split('-').map(Number); handleChange('date', new Date(y, m - 1, d)); }} className={`${inputStyle} [color-scheme:dark]`} />
                                <Calendar className="absolute right-3 top-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
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
                        <div>
                            <label className={labelStyle}>Responsável</label>
                            <div className="relative">
                                <input type="text" value={editableEvent.proprietario || ''} onChange={(e) => handleChange('proprietario', e.target.value)} placeholder="Nome" className={inputStyle} />
                                <User className="absolute right-3 top-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className={labelStyle}>Link do Material</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input type="text" value={editableEvent.url} onChange={(e) => handleChange('url', e.target.value)} placeholder="Cole o link aqui..." className={inputStyle} />
                                <LinkIcon className="absolute right-3 top-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                            </div>
                            {editableEvent.url && (
                                <a href={editableEvent.url.startsWith('http') ? editableEvent.url : `https://${editableEvent.url}`} target="_blank" rel="noreferrer" className="px-3 py-2 bg-[#FABE01]/10 text-[#FABE01] border border-[#FABE01]/20 rounded-sm flex items-center justify-center shrink-0">
                                    <ExternalLink className="w-5 h-5" />
                                </a>
                            )}
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

                {/* Footer Desktop/Mobile */}
                <div className="p-4 sm:p-6 border-t border-white/5 bg-[#111111] flex justify-between items-center gap-3 shrink-0 pb-8 sm:pb-6">
                    {/* Botão Excluir (Só aparece se não for criação) */}
                    <div className="flex-1 sm:flex-none">
                        {!isCreating && (
                            <>
                                {/* Desktop: Texto */}
                                <button onClick={handleDeleteClick} className="hidden sm:flex text-zinc-500 hover:text-red-500 py-2 text-sm font-medium items-center gap-2 transition-colors">
                                    <Trash2 className="w-4 h-4" /> Excluir
                                </button>
                                {/* Mobile: Bola Vermelha */}
                                <button onClick={handleDeleteClick} className="flex sm:hidden w-12 h-12 bg-red-500/10 text-red-500 rounded-full items-center justify-center border border-red-500/20 active:scale-95 transition-transform">
                                    <Trash2 className="w-6 h-6" />
                                </button>
                            </>
                        )}
                    </div>

                    {/* Botões Ação (Direita) */}
                    <div className="flex gap-3 sm:gap-4">
                        {/* Desktop: Texto */}
                        <button onClick={onClose} className="hidden sm:block px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 rounded-sm transition-colors">
                            Cancelar
                        </button>
                        <button onClick={() => onSave(editableEvent)} className="hidden sm:flex px-6 py-2 bg-[#FABE01] text-black font-bold text-sm rounded-sm shadow-[0_0_15px_rgba(250,190,1,0.2)] items-center gap-2 hover:bg-[#FABE01]/90">
                            <Save className="w-4 h-4" /> {isCreating ? 'Agendar' : 'Salvar'}
                        </button>

                        {/* Mobile: Bolas Inline */}
                        <button onClick={onClose} className="flex sm:hidden w-12 h-12 bg-zinc-800 text-zinc-400 rounded-full items-center justify-center border border-zinc-700 active:scale-95 transition-transform">
                            <X className="w-6 h-6" />
                        </button>
                        <button onClick={() => onSave(editableEvent)} className="flex sm:hidden w-12 h-12 bg-[#FABE01] text-black rounded-full items-center justify-center shadow-[0_0_15px_rgba(250,190,1,0.3)] active:scale-95 transition-transform">
                            {isCreating ? <Check className="w-6 h-6" /> : <Save className="w-6 h-6" />}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default EventDetailModal;