import React, { useState } from 'react';
import firebase from 'firebase/compat/app';
// Ícones Lucide
import { Mail, RefreshCw, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';
// Logo (Opcional, mas dá um toque de marca)
// @ts-ignore
import favicon from '../assets/favicon.png';

interface VerificationPendingProps {
    user: firebase.User;
    handleLogout: () => void;
}

const VerificationPending: React.FC<VerificationPendingProps> = ({ user, handleLogout: onLogout }) => {
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isSending, setIsSending] = useState(false);

    const handleResend = async () => {
        setIsSending(true);
        setMessage(null);
        try {
            await user.sendEmailVerification();
            setMessage({ type: 'success', text: 'E-mail de verificação reenviado! Cheque sua caixa de entrada.' });
        } catch (error: any) {
            // Tratamento de erro comum (muitas tentativas)
            if (error.code === 'auth/too-many-requests') {
                setMessage({ type: 'error', text: 'Muitas tentativas. Aguarde alguns instantes.' });
            } else {
                setMessage({ type: 'error', text: 'Erro ao enviar. Tente novamente mais tarde.' });
            }
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#111111] p-4 text-zinc-100 font-sans selection:bg-[#FABE01] selection:text-black">

            {/* Logo no Topo */}
            <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
                <img src={favicon} alt="Nocrato" className="h-12 w-auto brightness-0 invert opacity-80" />
            </div>

            {/* Card Principal */}
            <div className="w-full max-w-md bg-[#1A1A1A] border border-white/5 shadow-2xl rounded-sm p-8 text-center animate-in zoom-in-95 duration-500">

                {/* Ícone de Destaque */}
                <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 bg-[#FABE01]/10 rounded-full flex items-center justify-center relative">
                        <Mail className="w-10 h-10 text-[#FABE01]" />
                        {/* Bolinha de notificação animada */}
                        <span className="absolute top-0 right-0 flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FABE01] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-[#FABE01]"></span>
                        </span>
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-white mb-3">Verifique seu E-mail</h1>

                <p className="text-zinc-400 mb-6 leading-relaxed">
                    Enviamos um link de confirmação para:<br/>
                    <span className="text-white font-medium bg-white/5 px-2 py-0.5 rounded-sm mt-1 inline-block">{user.email}</span>
                </p>

                <p className="text-sm text-zinc-500 mb-8">
                    Clique no link recebido para ativar sua conta e liberar o acesso ao Portal do Cliente.
                </p>

                {/* Mensagens de Feedback */}
                {message && (
                    <div className={`flex items-center gap-3 p-3 rounded-sm text-sm font-medium mb-6 text-left animate-in fade-in slide-in-from-top-2 ${
                        message.type === 'success'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                        {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                        {message.text}
                    </div>
                )}

                {/* Ações */}
                <div className="space-y-3">
                    <button
                        onClick={handleResend}
                        disabled={isSending}
                        className="w-full flex justify-center items-center gap-2 py-3 px-4 bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-bold text-sm rounded-sm shadow-[0_0_15px_rgba(250,190,1,0.2)] transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSending ? (
                            <> <RefreshCw className="w-4 h-4 animate-spin" /> Enviando... </>
                        ) : (
                            'Reenviar E-mail'
                        )}
                    </button>

                    <button
                        onClick={onLogout}
                        className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white text-sm font-medium rounded-sm transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair da conta
                    </button>
                </div>
            </div>

            {/* Rodapé */}
            <p className="mt-8 text-xs text-zinc-600">
                Já confirmou? <button onClick={() => window.location.reload()} className="text-[#FABE01] hover:underline font-bold">Atualize a página</button>
            </p>
        </div>
    );
};

export default VerificationPending;