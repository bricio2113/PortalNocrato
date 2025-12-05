import React, { useState } from 'react';
import { auth } from '../utils/firebase';
import firebase from 'firebase/compat/app';

const MailIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
);

interface VerificationPendingProps {
    user: firebase.User;
    handleLogout: () => void;
}

const VerificationPending: React.FC<VerificationPendingProps> = ({ user, handleLogout }) => {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleResend = async () => {
        setIsSending(true);
        setMessage('');
        try {
            await user.sendEmailVerification();
            setMessage('Um novo e-mail de verificação foi enviado. Verifique sua caixa de entrada e spam.');
        } catch (error) {
            console.error(error);
            setMessage('Ocorreu um erro ao reenviar o e-mail. Por favor, tente novamente mais tarde.');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-amber-50 dark:bg-slate-900 p-4">
            <div className="w-full max-w-lg text-center bg-white dark:bg-slate-800 shadow-lg rounded-xl p-8">
                <div className="flex justify-center mb-6">
                    <MailIcon />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Verifique seu E-mail</h1>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                    Enviamos um link de verificação para <strong>{user.email}</strong>. Por favor, clique no link para ativar sua conta e acessar o portal.
                </p>
                {message && <p className="text-sm bg-green-50 dark:bg-green-900/50 text-green-700 dark:text-green-300 p-3 rounded-md mb-6">{message}</p>}
                <div className="space-y-4">
                    <button
                        onClick={handleResend}
                        disabled={isSending}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed"
                    >
                        {isSending ? 'Enviando...' : 'Reenviar E-mail de Verificação'}
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-full flex justify-center py-3 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Sair
                    </button>
                </div>
                <p className="mt-6 text-xs text-slate-500">
                    Se você já verificou seu e-mail, por favor, atualize esta página.
                </p>
            </div>
        </div>
    );
};

export default VerificationPending;
