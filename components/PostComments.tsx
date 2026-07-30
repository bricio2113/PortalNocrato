import React, { useState, useEffect, useRef } from 'react';
import { PostComment } from '../types';
import { subscribeComments, addComment, deleteComment } from '../utils/posts';
import { MessageSquare, Send, Trash2, Loader2, AlertTriangle } from 'lucide-react';

interface PostCommentsProps {
    empresaId: string;
    eventId: string;
    userEmail: string;
    userRole: 'agencia' | 'cliente';
}

// Iniciais do e-mail, mesma regra da sidebar.
const initials = (email: string) => {
    const local = email.split('@')[0];
    const parts = local.split(/[._-]+/).filter(Boolean);
    return (parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2)).toUpperCase();
};

const formatWhen = (date: Date) => {
    const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin} min`;
    if (diffMin < 60 * 24) return `${Math.round(diffMin / 60)} h`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

/**
 * Conversa de uma publicacao.
 *
 * Antes o feedback ia por WhatsApp, pelo link na sidebar: o pedido de ajuste
 * chegava solto, sem dizer de qual post falava, e nao ficava registrado em
 * nenhum lugar consultavel depois.
 */
const PostComments: React.FC<PostCommentsProps> = ({ empresaId, eventId, userEmail, userRole }) => {
    const [comments, setComments] = useState<PostComment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [text, setText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!eventId) return;
        setIsLoading(true);
        const unsubscribe = subscribeComments(
            empresaId,
            eventId,
            data => { setComments(data); setIsLoading(false); },
            () => { setError('Não foi possível carregar os comentários.'); setIsLoading(false); }
        );
        return unsubscribe;
    }, [empresaId, eventId]);

    // Mantem a conversa rolada no fim quando chega mensagem nova.
    useEffect(() => {
        endRef.current?.scrollIntoView({ block: 'nearest' });
    }, [comments.length]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const body = text.trim();
        if (!body || isSending) return;
        setIsSending(true);
        setError('');
        try {
            await addComment(empresaId, eventId, userEmail, userRole, body);
            setText('');
        } catch (err) {
            console.error(err);
            setError('Não foi possível enviar. O texto continua no campo.');
        } finally {
            setIsSending(false);
        }
    };

    const handleDelete = async (commentId: string) => {
        try {
            await deleteComment(empresaId, commentId);
        } catch (err) {
            console.error(err);
            setError('Não foi possível remover o comentário.');
        }
    };

    return (
        <div>
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
                <MessageSquare className="w-4 h-4" />
                Conversa
                {comments.length > 0 && (
                    <span className="bg-white/10 text-zinc-300 px-1.5 py-0.5 rounded-full text-[10px]">{comments.length}</span>
                )}
            </label>

            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
                        <Loader2 className="w-4 h-4 animate-spin" /> Carregando conversa...
                    </div>
                ) : comments.length === 0 ? (
                    <p className="text-zinc-600 text-sm py-3">
                        Nenhum comentário ainda. Use este espaço para registrar ajustes e decisões — fica tudo ligado a esta publicação.
                    </p>
                ) : (
                    comments.map(comment => {
                        const isAgency = comment.authorRole === 'agencia';
                        const isMine = comment.authorEmail === userEmail;
                        return (
                            <div key={comment.id} className="flex items-start gap-3 group">
                                <div
                                    className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                        isAgency ? 'bg-[#FABE01] text-black' : 'bg-zinc-700 text-zinc-200'
                                    }`}
                                    aria-hidden="true"
                                >
                                    {initials(comment.authorEmail)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold text-white truncate">{comment.authorEmail}</span>
                                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                                            isAgency ? 'bg-[#FABE01]/15 text-[#FABE01]' : 'bg-white/5 text-zinc-400'
                                        }`}>
                                            {isAgency ? 'Agência' : 'Cliente'}
                                        </span>
                                        <span className="text-[10px] text-zinc-600">{formatWhen(comment.createdAt)}</span>
                                    </div>
                                    <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap break-words mt-0.5">
                                        {comment.text}
                                    </p>
                                </div>
                                {(isMine || userRole === 'agencia') && (
                                    <button
                                        onClick={() => handleDelete(comment.id)}
                                        aria-label="Remover comentário"
                                        className="text-zinc-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
                <div ref={endRef} />
            </div>

            <form onSubmit={handleSend} className="flex items-end gap-2">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Escreva um comentário..."
                    rows={2}
                    // Enter envia, Shift+Enter quebra linha - convencao de chat.
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend(e as unknown as React.FormEvent);
                        }
                    }}
                    className="flex-1 bg-[#111111] border border-zinc-700 rounded-sm px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all resize-none"
                />
                <button
                    type="submit"
                    disabled={!text.trim() || isSending}
                    aria-label="Enviar comentário"
                    className="h-10 px-4 bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-bold rounded-sm flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
            </form>

            {error && (
                <p className="text-red-400 text-xs mt-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
                </p>
            )}
        </div>
    );
};

export default PostComments;
