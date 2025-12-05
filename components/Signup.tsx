




import React, { useState } from 'react';
// Fix: Use Firebase v8 namespaced API for auth and firestore
import { auth, db } from '../utils/firebase';

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

const SuccessIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

interface SignupProps {
    onSwitchToLogin: () => void;
}

const Signup: React.FC<SignupProps> = ({ onSwitchToLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [emailInUseError, setEmailInUseError] = useState(false);
    const [signupSuccess, setSignupSuccess] = useState(false);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setEmailInUseError(false);
        try {
            // Fix: Use Firebase v8 createUserWithEmailAndPassword method
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            if (user) {
                await user.sendEmailVerification();
            }

            const agencyEmails = ['briciomarketing@gmail.com', 'briciomarketing@mail.com'];
            const userRole = agencyEmails.includes(user.email || '') ? 'agencia' : 'cliente';

            // Create the user profile document in Firestore to link auth with data
            try {
                // Fix: Use Firebase v8 collection/doc/set methods
                const userDocRef = db.collection('usuarios').doc(user.uid);
                await userDocRef.set({
                    email: user.email,
                    empresaId: null, // Agency will fill this in later to grant access
                    role: userRole, 
                });
            } catch (firestoreError) {
                // Log the error, but don't block the user.
                // The user is created in Auth and can log in. They will see the welcome screen.
                console.error("Error creating user document in Firestore:", firestoreError);
            }
            
            setSignupSuccess(true);
            
        } catch (err: any) {
            if (err.code === 'auth/email-already-in-use') {
                setError('Este e-mail já está em uso.');
                setEmailInUseError(true);
            } else if (err.code === 'auth/weak-password') {
                setError('A senha deve ter no mínimo 6 caracteres.');
            } else if (err.code === 'auth/invalid-email') {
                setError('O e-mail fornecido não é válido.');
            } else {
                setError('Ocorreu um erro ao criar a conta.');
            }
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-amber-50 dark:bg-slate-800 p-4">
            <div className="w-full max-w-md">
                <div className="bg-white dark:bg-slate-900 shadow-lg rounded-xl p-8">
                    {signupSuccess ? (
                        <div className="text-center">
                            <div className="flex justify-center mb-4">
                                <SuccessIcon />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Conta Criada!</h1>
                            <p className="text-slate-600 dark:text-slate-400 mb-6">
                                Enviamos um link de verificação para <strong>{email}</strong>. Por favor, verifique sua caixa de entrada e spam para ativar sua conta.
                            </p>
                            <button
                                onClick={onSwitchToLogin}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Ir para o Login
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col items-center mb-6">
                                <div className="mb-4">
                                    <LogoIcon />
                                </div>
                                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Criar Nova Conta</h1>
                                <p className="text-slate-500 dark:text-slate-400 mt-1">Agência Nocrato</p>
                            </div>

                            <form onSubmit={handleSignup} className="space-y-6">
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                                    <input
                                        id="email"
                                        type="text"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        autoComplete="off"
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
                                        autoComplete="off"
                                        className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-800 dark:text-white"
                                        placeholder="Mínimo 6 caracteres"
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
                                <div className="relative">
                                    <label htmlFor="confirm-password"className="block text-sm font-medium text-slate-700 dark:text-slate-300">Confirmar Senha</label>
                                    <input
                                        id="confirm-password"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        autoComplete="off"
                                        className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-800 dark:text-white"
                                        placeholder="Repita sua senha"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute inset-y-0 right-0 top-6 pr-3 flex items-center text-sm leading-5"
                                        aria-label={showConfirmPassword ? "Esconder senha" : "Mostrar senha"}
                                    >
                                        {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                                    </button>
                                </div>

                                {error && (
                                    <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-md">
                                        {error}
                                        {emailInUseError && (
                                            <>
                                                {' '}
                                                <button onClick={onSwitchToLogin} className="font-semibold underline hover:text-red-500 transition-colors">
                                                    Tente fazer login.
                                                </button>
                                            </>
                                        )}
                                    </p>
                                )}
                                
                                <div>
                                    <button 
                                        type="submit" 
                                        disabled={isLoading}
                                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? 'Cadastrando...' : 'Cadastrar'}
                                    </button>
                                </div>
                            </form>
                            <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                                Já tem uma conta?{' '}
                                <button onClick={onSwitchToLogin} className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                                    Entrar
                                </button>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Signup;