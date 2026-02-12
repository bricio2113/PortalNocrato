import React, { useState } from 'react';
// Mantendo a lógica original
import { auth } from '../utils/firebase';
// Ícones
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

// IMAGEM
// @ts-ignore
import favicon from '../assets/favicon.png';

interface LoginProps {
    onSwitchToSignup: () => void;
}

const Login: React.FC<LoginProps> = ({ onSwitchToSignup }) => {
    // --- ESTADOS ---
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

    // --- LÓGICA DE LOGIN ---
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            await auth.signInWithEmailAndPassword(email, password);
        } catch (err: any) {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError('E-mail ou senha inválidos.');
            } else {
                setError('Ocorreu um erro ao fazer login.');
            }
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // --- LÓGICA DE RESET ---
    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSendingReset(true);
        setResetMessage('');
        setResetError('');
        try {
            await auth.sendPasswordResetEmail(resetEmail);
            setResetMessage('Link enviado para seu e-mail.');
        } catch (err: any) {
            if (err.code === 'auth/user-not-found') {
                setResetError('E-mail não encontrado.');
            } else {
                setResetError('Erro ao enviar link.');
            }
        } finally {
            setIsSendingReset(false);
        }
    };

    const switchToReset = () => { setIsResettingPassword(true); setError(null); };
    const switchToLogin = () => { setIsResettingPassword(false); setResetMessage(''); setResetError(''); };

    // --- RENDERIZAÇÃO (Identidade Visual Brício Marketing) ---
    return (
        <div className="min-h-screen flex bg-[#111111] text-zinc-100 font-sans selection:bg-[#FABE01] selection:text-black">

            {/* LADO ESQUERDO: Banner com Estética "Hero" */}
            <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-black border-r border-white/5">
                {/* Fundo com imagem + overlay escuro (igual ao Hero da LP) */}
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay" />

                {/* Gradientes para dar o clima "Dark Mode Premium" */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/50 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#111111]/80 to-transparent" />

                {/* Conteúdo */}
                <div className="relative z-10 p-16 flex flex-col justify-between h-full w-full">

                    {/* Logo Branca */}
                    <div className="flex items-center gap-3">
                        <img src={favicon} alt="Nocrato" className="h-10 w-auto brightness-0 invert opacity-90" />
                    </div>

                    {/* Título com o Gradiente Dourado (Assinatura do outro projeto) */}
                    <div className="space-y-6 max-w-lg">
                        <h1 className="text-5xl font-bold leading-[1.1] tracking-tight">
                            Gestão de alta <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FABE01] to-[#DE7928]">
                                performance
                            </span>
                        </h1>
                        <p className="text-zinc-300 text-lg leading-relaxed font-medium">
                            Acesse seu painel exclusivo e acompanhe a evolução da sua clínica em tempo real.
                        </p>
                    </div>

                    {/* Elemento Decorativo (Linha Dourada) */}
                    <div className="w-24 h-1 bg-gradient-to-r from-[#FABE01] to-[#DE7928] rounded-full" />
                </div>
            </div>

            {/* LADO DIREITO: Formulário */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-16 bg-[#111111] relative">

                {/* Glow Dourado de Fundo (Sutil) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#FABE01]/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="w-full max-w-[400px] space-y-8 relative z-10">

                    {/* Logo Mobile */}
                    <div className="lg:hidden flex justify-center mb-8">
                        <img src={favicon} alt="Nocrato" className="h-14 w-auto brightness-0 invert" />
                    </div>

                    <div className="text-center lg:text-left space-y-1">
                        <h2 className="text-2xl font-bold text-white tracking-tight">
                            {isResettingPassword ? 'Recuperar Acesso' : 'Acesse sua conta'}
                        </h2>
                        <p className="text-zinc-400 text-sm">
                            {isResettingPassword ? 'Enviaremos as instruções por e-mail' : 'Bem-vindo ao Portal do Cliente'}
                        </p>
                    </div>

                    {/* Alertas */}
                    {(error || resetError) && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-sm text-sm flex items-center gap-3">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <p>{error || resetError}</p>
                        </div>
                    )}
                    {resetMessage && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-sm text-sm flex items-center gap-3">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <p>{resetMessage}</p>
                        </div>
                    )}

                    {isResettingPassword ? (
                        /* --- FORM RESET --- */
                        <form onSubmit={handlePasswordReset} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Email</label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-3.5 h-5 w-5 text-zinc-500 group-focus-within:text-[#FABE01] transition-colors" />
                                    {/* Input Estilo Brício: Fundo #1A1A1A, Borda Escura, Foco Dourado */}
                                    <input
                                        type="email"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        required
                                        className="w-full bg-[#1A1A1A] border border-[#333] text-white rounded-sm py-3 pl-10 pr-4 focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all placeholder:text-zinc-600"
                                        placeholder="seu@email.com"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSendingReset}
                                className="w-full bg-[#FABE01] hover:bg-[#FABE01]/90 text-[#111111] font-bold py-3 px-4 rounded-sm transition-all flex items-center justify-center gap-2 uppercase tracking-wide text-sm shadow-[0_0_15px_rgba(250,190,1,0.2)] hover:shadow-[0_0_20px_rgba(250,190,1,0.4)]"
                            >
                                {isSendingReset ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar Link'}
                            </button>

                            <button type="button" onClick={switchToLogin} className="w-full text-center text-sm text-zinc-500 hover:text-white transition-colors py-2">
                                Voltar para o Login
                            </button>
                        </form>
                    ) : (
                        /* --- FORM LOGIN --- */
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Email</label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-3.5 h-5 w-5 text-zinc-500 group-focus-within:text-[#FABE01] transition-colors" />
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full bg-[#1A1A1A] border border-[#333] text-white rounded-sm py-3 pl-10 pr-4 focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all placeholder:text-zinc-600"
                                        placeholder="seu@email.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Senha</label>
                                    <button type="button" onClick={switchToReset} className="text-xs font-medium text-[#FABE01] hover:text-[#FABE01]/80 transition-colors">
                                        Esqueceu?
                                    </button>
                                </div>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-3.5 h-5 w-5 text-zinc-500 group-focus-within:text-[#FABE01] transition-colors" />
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full bg-[#1A1A1A] border border-[#333] text-white rounded-sm py-3 pl-10 pr-10 focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all placeholder:text-zinc-600"
                                        placeholder="••••••••"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-zinc-500 hover:text-white transition-colors">
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-[#FABE01] hover:bg-[#FABE01]/90 text-[#111111] font-bold py-3.5 px-4 rounded-sm transition-all flex items-center justify-center gap-2 uppercase tracking-wide text-sm shadow-[0_0_15px_rgba(250,190,1,0.2)] hover:shadow-[0_0_20px_rgba(250,190,1,0.4)] hover:-translate-y-0.5"
                                >
                                    {isLoading ? (
                                        <> <Loader2 className="w-4 h-4 animate-spin" /> ACESSANDO... </>
                                    ) : (
                                        'ACESSAR PORTAL'
                                    )}
                                </button>
                            </div>
                        </form>
                    )}

                    {!isResettingPassword && (
                        <p className="text-center text-sm text-zinc-500 pt-6 border-t border-zinc-800/50">
                            Ainda não tem cadastro?{' '}
                            <button onClick={onSwitchToSignup} className="font-bold text-white hover:text-[#FABE01] transition-colors">
                                Solicite aqui
                            </button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Login;