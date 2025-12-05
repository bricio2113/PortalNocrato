import React, { useState, useEffect } from 'react';
import { CalendarEvent, EventStatus } from '../types';
import { STATUS_OPTIONS, PLATAFORMA_OPTIONS } from '../constants';

interface EventDetailModalProps {
  event: CalendarEvent;
  onSave: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
  onClose: () => void;
}

// Helper function to check for URL
const isUrl = (text: string): boolean => {
    if (!text) return false;
    const trimmedText = text.trim();
    return trimmedText.startsWith('http://') || trimmedText.startsWith('https://') || trimmedText.startsWith('www.');
};

// Helper function to format URL for href
const getHref = (text: string): string => {
    const trimmedText = text.trim();
    if (trimmedText.startsWith('http://') || trimmedText.startsWith('https://')) {
        return trimmedText;
    }
    return `https://${trimmedText}`;
};


const PageIconLarge = () => (
    <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
         <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-purple-600 dark:text-purple-400">
                <path d="M8 9H16M8 13H16M8 17H12M6 3H18C19.6569 3 21 4.34315 21 6V18C21 19.6569 19.6569 21 18 21H6C4.34315 21 3 19.6569 3 18V6C3 4.34315 4.34315 3 6 3Z"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
        </div>
    </div>
);


const DetailItem: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
    <div className="text-sm">
        <div className="flex items-center text-slate-500 dark:text-slate-400 mb-1.5">
            {icon}
            <span className="ml-2 font-medium">{label}</span>
        </div>
        <div>{children}</div>
    </div>
);

const baseInputStyles = "w-full text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 dark:text-slate-200 font-medium";
const selectStyles = `${baseInputStyles} appearance-none`;


const StatusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const ProprietarioIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const DataIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const PlataformaIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const UrlIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;


const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, onSave, onDelete, onClose }) => {
    const [editableEvent, setEditableEvent] = useState<CalendarEvent>(event);
    const isCreating = !event.id;

    useEffect(() => {
        setEditableEvent(event);
    }, [event]);

    const handleChange = (field: keyof CalendarEvent, value: any) => {
        setEditableEvent(prev => ({...prev, [field]: value}));
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const dateString = e.target.value;
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        handleChange('date', date);
    };

    const handleSave = () => {
        onSave(editableEvent);
    };

    const handleDelete = () => {
        if (event.id) {
            onDelete(event.id);
        }
    };
    
    return (
        <div 
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-2xl m-4 animate-fade-in flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-8 overflow-y-auto">
                    <div className="flex items-start mb-6">
                        <PageIconLarge />
                        <div className="ml-2 w-full pt-2">
                             <input 
                                type="text"
                                value={editableEvent.title}
                                onChange={(e) => handleChange('title', e.target.value)}
                                placeholder="Adicionar um título..."
                                className="text-2xl font-bold text-slate-800 dark:text-white break-words w-full border-none focus:outline-none bg-transparent p-0"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-8 mb-8">
                         <DetailItem icon={<StatusIcon />} label="Status">
                            <div className="relative">
                                <select value={editableEvent.status} onChange={(e) => handleChange('status', e.target.value as EventStatus)} className={selectStyles}>
                                    {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                </div>
                            </div>
                        </DetailItem>
                        <DetailItem icon={<ProprietarioIcon />} label="Proprietário">
                            <input type="text" value={editableEvent.proprietario || ''} onChange={(e) => handleChange('proprietario', e.target.value)} placeholder="Vazio" className={baseInputStyles} />
                        </DetailItem>
                        <DetailItem icon={<DataIcon />} label="Data do post">
                           <div className="relative">
                                <input 
                                    type="date" 
                                    value={editableEvent.date.toISOString().split('T')[0]} 
                                    onChange={handleDateChange} 
                                    className={`${baseInputStyles} pr-8`}
                                />
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                    <DataIcon />
                                </div>
                           </div>
                        </DetailItem>
                        <DetailItem icon={<PlataformaIcon />} label="Plataforma">
                            <div className="relative">
                                <select value={editableEvent.plataforma} onChange={(e) => handleChange('plataforma', e.target.value)} className={selectStyles}>
                                    {PLATAFORMA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                 <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                </div>
                            </div>
                        </DetailItem>
                    </div>

                    <div className="mb-8 space-y-2">
                        <label className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center"><UrlIcon /><span className="ml-2">URL do post</span></label>
                        <input type="text" value={editableEvent.url} onChange={(e) => handleChange('url', e.target.value)} placeholder="drive.google.com/..." className={baseInputStyles} />
                        {isUrl(editableEvent.url) && (
                            <a 
                                href={getHref(editableEvent.url)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center group max-w-full"
                            >
                                <span className="truncate">{editableEvent.url}</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1.5 flex-shrink-0 opacity-75 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                        )}
                    </div>
                    
                    <div className="space-y-2">
                         <label className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center">Copy do Conteúdo</label>
                        <textarea
                            rows={8}
                            value={editableEvent.copy || ''}
                            onChange={(e) => handleChange('copy', e.target.value)}
                            placeholder="Adicionar a copy do post aqui..."
                            className={`${baseInputStyles} h-auto`}
                        />
                    </div>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex justify-between items-center mt-auto">
                    {!isCreating ? (
                        <button 
                            onClick={handleDelete} 
                            className="px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 rounded-md hover:bg-red-100 flex items-center"
                            aria-label="Remover evento"
                        >
                            <TrashIcon />
                            Remover
                        </button>
                    ) : (
                        <div /> // Placeholder to keep alignment
                    )}
                    <div className="space-x-3">
                        <button onClick={onClose} className="px-5 py-2 text-sm font-semibold bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-600">
                            Cancelar
                        </button>
                        <button onClick={handleSave} className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700">
                            {isCreating ? 'Criar Tarefa' : 'Salvar Alterações'}
                        </button>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out forwards;
                }
                input[type="date"]::-webkit-calendar-picker-indicator {
                    display: none;
                }
            `}</style>
        </div>
    );
};

export default EventDetailModal;