
import React, { useState } from 'react';
// Fix: Use Firebase v8 namespaced API for auth
import { auth } from '../utils/firebase';

const LogoIcon = () => (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="8" fill="black"/>
        <g stroke="#FBBF24" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            {/* Hand-drawn Hexagon */}
            <path d="M30 9 C35 10 41 16 40 24 C39 32 32 40 24 40 C16 40 9 34 8 26 C7 18 13 10 21 9 C24 8.5 27 8.5 30 9 Z" />
            {/* Hand-drawn N */}
            <path d="M19 33 L19.5 15" />
            <path d="M19.5 15 L28.5 33" />
            <path d="M28.5 33 L29 15" />
        </g>
    </svg>
);

const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
);

const EyeOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274 4.057 5.064 7-9.542 7 .847 0 1.673.124 2.464.352M6.58 6.58A1.98 1.98 0 008 8.5a1.982 1.982 0 003.42 1.42M12 15a3 3 0 110-6 3 3 0 010 6z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 1l22 22" />
    </svg>
);

interface LoginProps {
    onSwitchToSignup: () => void;
}


const Login: React.FC<LoginProps> = ({ onSwitchToSignup }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetMessage, setResetMessage] = useState('');
    const [resetError, setResetError] = useState('');
    const [isSendingReset, setIsSendingReset] = useState(false);


    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            // Fix: Use Firebase v8 signInWithEmailAndPassword method
            await auth.signInWithEmailAndPassword(email, password);
        } catch (err: any) {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError('E-mail ou senha inválidos. Por favor, verifique seus dados e tente novamente.');
            } else {
                setError('Ocorreu um erro ao fazer login.');
            }
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSendingReset(true);
        setResetMessage('');
        setResetError('');
        try {
            // Fix: Use Firebase v8 sendPasswordResetEmail method
            await auth.sendPasswordResetEmail(resetEmail);
            setResetMessage('Um link para redefinição de senha foi enviado para o seu e-mail.');
        } catch (err: any) {
            if (err.code === 'auth/user-not-found') {
                setResetError('O e-mail informado não foi encontrado.');
            } else {
                setResetError('Ocorreu um erro ao tentar redefinir a senha.');
            }
            console.error(err);
        } finally {
            setIsSendingReset(false);
        }
    };
    
    const switchToReset = () => {
        setIsResettingPassword(true);
        setError(null);
    };

    const switchToLogin = () => {
        setIsResettingPassword(false);
        setResetMessage('');
        setResetError('');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200 dark:from-slate-800 dark:via-slate-900 dark:to-black p-4">
            <div className="w-full max-w-md">
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-2xl rounded-2xl p-8 sm:p-10">
                    <div className="flex flex-col items-center mb-8">
                         <div className="mb-4">
                            <LogoIcon />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Portal do Cliente</h1>
                        <p className="text-amber-500 dark:text-amber-400 mt-1 font-semibold tracking-wide">Agência Nocrato</p>
                    </div>

                    {isResettingPassword ? (
                        <>
                            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4 text-center">Redefinir Senha</h2>
                            <form onSubmit={handlePasswordReset} className="space-y-6">
                                <div>
                                    <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                                    <input
                                        id="reset-email"
                                        type="email"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        required
                                        autoComplete="email"
                                        className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-800 dark:text-white"
                                        placeholder="seu@email.com"
                                    />
                                </div>
                                {resetMessage && <p className="text-sm text-green-600 bg-green-50 dark:bg-green-900/50 dark:text-green-300 p-3 rounded-md">{resetMessage}</p>}
                                {resetError && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-md">{resetError}</p>}
                                <div>
                                    <button
                                        type="submit"
                                        disabled={isSendingReset}
                                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg focus:scale-105 focus:shadow-lg"
                                    >
                                        {isSendingReset ? 'Enviando...' : 'Enviar Link de Redefinição'}
                                    </button>
                                </div>
                            </form>
                             <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                                <button onClick={switchToLogin} className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200">
                                    Voltar para o Login
                                </button>
                            </p>
                        </>
                    ) : (
                        <>
                            <form onSubmit={handleLogin} className="space-y-6">
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoComplete="email"
                                        className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-800 dark:text-white"
                                        placeholder="seu@email.com"
                                    />
                                </div>
                                <div className="relative">
                                    <label htmlFor="password"className="block text-sm font-medium text-slate-700 dark:text-slate-300">Senha</label>
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        autoComplete="current-password"
                                        className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-800 dark:text-white"
                                        placeholder="Sua senha"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 top-6 pr-3 flex items-center text-sm leading-5"
                                        aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                                    >
                                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                                    </button>
                                </div>

                                {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-md">{error}</p>}
                                
                                <div className="pt-2">
                                    <button 
                                        type="submit" 
                                        disabled={isLoading}
                                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg focus:scale-105 focus:shadow-lg"
                                    >
                                        {isLoading ? 'Entrando...' : 'Entrar'}
                                    </button>
                                </div>
                                 <div className="text-sm text-center">
                                    <button onClick={switchToReset} className="font-medium text-slate-500 dark:text-slate-400 hover:text-blue-500 transition-colors duration-200">
                                        Esqueceu sua senha?
                                    </button>
                                </div>
                            </form>
                            <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                Não tem uma conta?{' '}
                                <button onClick={onSwitchToSignup} className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200">
                                    Cadastre-se
                                </button>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Login;
