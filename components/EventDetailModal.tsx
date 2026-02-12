import React, { useState, useEffect } from 'react';
import { CalendarEvent, EventStatus } from '../types';
// Assume que essas constantes existem no constants.ts
import { STATUS_OPTIONS, PLATAFORMA_OPTIONS } from '../constants';
// Ícones Lucide
import {
    X, Trash2, Calendar, User, Globe, Link as LinkIcon,
    FileText, CheckCircle2, AlertCircle, Save, ExternalLink,
    Instagram, Linkedin, Facebook, Youtube, Twitter
} from 'lucide-react';

interface EventDetailModalProps {
    event: CalendarEvent;
    onSave: (event: CalendarEvent) => void;
    onDelete: (eventId: string) => void;
    onClose: () => void;
}

// Helper para ícone da plataforma
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
    const isCreating = !event.id;

    useEffect(() => { setEditableEvent(event); }, [event]);

    const handleChange = (field: keyof CalendarEvent, value: any) => {
        setEditableEvent(prev => ({...prev, [field]: value}));
    };

    // Estilos comuns
    const labelStyle = "block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5";
    const inputStyle = "w-full bg-[#111111] border border-zinc-700 rounded-sm px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all placeholder:text-zinc-600";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            {/* BACKDROP com Blur */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* MODAL CARD */}
            <div className="relative w-full max-w-2xl bg-[#1A1A1A] border border-white/10 rounded-sm shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">

                {/* HEADER */}
                <div className="flex items-start justify-between p-6 border-b border-white/5">
                    <div className="flex-1 mr-8">
                        <input
                            type="text"
                            value={editableEvent.title}
                            onChange={(e) => handleChange('title', e.target.value)}
                            placeholder="Título da Publicação"
                            className="w-full bg-transparent text-2xl font-bold text-white placeholder:text-zinc-600 border-none focus:ring-0 p-0"
                            autoFocus={isCreating}
                        />
                        <p className="text-zinc-500 text-sm mt-1">
                            {isCreating ? 'Novo agendamento' : 'Editando detalhes da publicação'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-sm transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* BODY (Scrollável) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                    {/* GRID DE INFORMAÇÕES */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                        {/* Status */}
                        <div>
                            <label className={labelStyle}>Status</label>
                            <div className="relative">
                                <select
                                    value={editableEvent.status}
                                    onChange={(e) => handleChange('status', e.target.value as EventStatus)}
                                    className={`${inputStyle} appearance-none cursor-pointer`}
                                >
                                    {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <div className="absolute right-3 top-2.5 pointer-events-none text-zinc-500">
                                    {editableEvent.status === 'Concluído' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4" />}
                                </div>
                            </div>
                        </div>

                        {/* Data */}
                        <div>
                            <label className={labelStyle}>Data de Publicação</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={editableEvent.date.toISOString().split('T')[0]}
                                    onChange={(e) => {
                                        const [y, m, d] = e.target.value.split('-').map(Number);
                                        handleChange('date', new Date(y, m - 1, d));
                                    }}
                                    className={`${inputStyle} [color-scheme:dark]`} // Força calendário dark no Chrome
                                />
                                <Calendar className="absolute right-3 top-2.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                            </div>
                        </div>

                        {/* Plataforma */}
                        <div>
                            <label className={labelStyle}>Canal / Plataforma</label>
                            <div className="relative">
                                <select
                                    value={editableEvent.plataforma}
                                    onChange={(e) => handleChange('plataforma', e.target.value)}
                                    className={`${inputStyle} appearance-none cursor-pointer`}
                                >
                                    {PLATAFORMA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <div className="absolute right-3 top-2.5 pointer-events-none text-zinc-500">
                                    {getPlatformIcon(editableEvent.plataforma)}
                                </div>
                            </div>
                        </div>

                        {/* Responsável */}
                        <div>
                            <label className={labelStyle}>Responsável</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={editableEvent.proprietario || ''}
                                    onChange={(e) => handleChange('proprietario', e.target.value)}
                                    placeholder="Quem vai postar?"
                                    className={inputStyle}
                                />
                                <User className="absolute right-3 top-2.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* URL / LINK */}
                    <div>
                        <label className={labelStyle}>Link do Material (Drive/Canva)</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={editableEvent.url}
                                    onChange={(e) => handleChange('url', e.target.value)}
                                    placeholder="Cole o link aqui..."
                                    className={inputStyle}
                                />
                                <LinkIcon className="absolute right-3 top-2.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                            </div>
                            {editableEvent.url && (
                                <a
                                    href={editableEvent.url.startsWith('http') ? editableEvent.url : `https://${editableEvent.url}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3 py-2 bg-[#FABE01]/10 text-[#FABE01] border border-[#FABE01]/20 rounded-sm hover:bg-[#FABE01]/20 transition-colors flex items-center justify-center"
                                    title="Abrir Link"
                                >
                                    <ExternalLink className="w-5 h-5" />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* COPY / LEGENDA */}
                    <div className="flex flex-col flex-1 min-h-[150px]">
                        <label className={labelStyle}>Legenda / Copy</label>
                        <textarea
                            value={editableEvent.copy || ''}
                            onChange={(e) => handleChange('copy', e.target.value)}
                            placeholder="Escreva a legenda do post aqui..."
                            className={`${inputStyle} flex-1 resize-none h-40 leading-relaxed`}
                        />
                    </div>
                </div>

                {/* FOOTER DE AÇÕES */}
                <div className="p-6 border-t border-white/5 bg-[#111111] flex justify-between items-center">

                    {/* Botão Excluir (Esquerda) */}
                    {!isCreating ? (
                        <button
                            onClick={() => onDelete(event.id)}
                            className="text-zinc-500 hover:text-red-500 text-sm font-medium flex items-center gap-2 transition-colors px-2 py-1 rounded-sm hover:bg-red-500/10"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Excluir</span>
                        </button>
                    ) : (
                        <div /> /* Espaçador */
                    )}

                    {/* Ações Principais (Direita) */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => onSave(editableEvent)}
                            className="px-6 py-2 bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-bold text-sm rounded-sm shadow-[0_0_15px_rgba(250,190,1,0.2)] flex items-center gap-2 transition-all hover:-translate-y-0.5"
                        >
                            <Save className="w-4 h-4" />
                            {isCreating ? 'Agendar Post' : 'Salvar Alterações'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EventDetailModal;