import React, { useState } from 'react';
import { auth } from '../utils/firebase';
// Ícones Lucide
import { Eye, EyeOff, Loader2, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
// Logo
// @ts-ignore
import favicon from '../assets/favicon.png';

interface SignupProps {
    onSwitchToLogin: () => void;
}

const Signup: React.FC<SignupProps> = ({ onSwitchToLogin }) => {
    // --- ESTADOS ---
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // --- LÓGICA DE CADASTRO ---
    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validações básicas
        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }
        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }

        setIsLoading(true);

        try {
            // Cria usuário no Firebase
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);

            // Envia e-mail de verificação
            await userCredential.user?.sendEmailVerification();

            // Opcional: Você pode forçar o logout aqui para garantir que o usuário precise logar novamente
            // await auth.signOut();

            // A tela "VerificationPending" será mostrada automaticamente pelo App.tsx
            // assim que o estado de user for atualizado.

        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                setError('Este e-mail já está cadastrado.');
            } else if (err.code === 'auth/invalid-email') {
                setError('E-mail inválido.');
            } else {
                setError('Ocorreu um erro ao criar a conta. Tente novamente.');
            }
            setIsLoading(false); // Só para o loading se der erro
        }
    };

    return (
        <div className="min-h-screen flex bg-[#111111] text-zinc-100 font-sans selection:bg-[#FABE01] selection:text-black">

            {/* LADO ESQUERDO: Banner Visual (Escondido em mobile) */}
            <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-black border-r border-white/5">
                {/* Imagem de Fundo (Mesma do Login para consistência) */}
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay" />

                {/* Gradientes */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/50 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#111111]/80 to-transparent" />

                {/* Conteúdo */}
                <div className="relative z-10 p-16 flex flex-col justify-between h-full w-full">
                    <div className="flex items-center gap-3">
                        <img src={favicon} alt="Nocrato" className="h-10 w-auto brightness-0 invert opacity-90" />
                    </div>

                    <div className="space-y-6 max-w-lg">
                        <h1 className="text-5xl font-bold leading-[1.1] tracking-tight">
                            Junte-se à <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FABE01] to-[#DE7928]">
                                revolução digital
                            </span>
                        </h1>
                        <p className="text-zinc-300 text-lg leading-relaxed font-medium">
                            Crie sua conta agora e tenha controle total sobre a performance e gestão da sua marca.
                        </p>
                    </div>

                    <div className="w-24 h-1 bg-gradient-to-r from-[#FABE01] to-[#DE7928] rounded-full" />
                </div>
            </div>

            {/* LADO DIREITO: Formulário */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-16 bg-[#111111] relative">

                {/* Glow de Fundo */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#FABE01]/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="w-full max-w-[400px] space-y-8 relative z-10">

                    {/* Logo Mobile */}
                    <div className="lg:hidden flex justify-center mb-8">
                        <img src={favicon} alt="Nocrato" className="h-14 w-auto brightness-0 invert" />
                    </div>

                    <div className="text-center lg:text-left space-y-1">
                        <h2 className="text-2xl font-bold text-white tracking-tight">Crie sua conta</h2>
                        <p className="text-zinc-400 text-sm">Preencha os dados abaixo para começar.</p>
                    </div>

                    {/* Alerta de Erro */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-sm text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSignup} className="space-y-5">

                        {/* Campo Email */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Email Corporativo</label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-3.5 h-5 w-5 text-zinc-500 group-focus-within:text-[#FABE01] transition-colors" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full bg-[#1A1A1A] border border-[#333] text-white rounded-sm py-3 pl-10 pr-4 focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all placeholder:text-zinc-600"
                                    placeholder="seu@empresa.com"
                                />
                            </div>
                        </div>

                        {/* Campo Senha */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Senha</label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-zinc-500 group-focus-within:text-[#FABE01] transition-colors" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full bg-[#1A1A1A] border border-[#333] text-white rounded-sm py-3 pl-10 pr-10 focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all placeholder:text-zinc-600"
                                    placeholder="No mínimo 6 caracteres"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3.5 text-zinc-500 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Campo Confirmar Senha */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Confirmar Senha</label>
                            <div className="relative group">
                                <CheckCircle2 className="absolute left-3 top-3.5 h-5 w-5 text-zinc-500 group-focus-within:text-[#FABE01] transition-colors" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    className="w-full bg-[#1A1A1A] border border-[#333] text-white rounded-sm py-3 pl-10 pr-10 focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all placeholder:text-zinc-600"
                                    placeholder="Repita a senha"
                                />
                            </div>
                        </div>

                        {/* Botão de Ação */}
                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-bold py-3.5 px-4 rounded-sm transition-all flex items-center justify-center gap-2 uppercase tracking-wide text-sm shadow-[0_0_15px_rgba(250,190,1,0.2)] hover:shadow-[0_0_20px_rgba(250,190,1,0.4)] hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <> <Loader2 className="w-4 h-4 animate-spin" /> CRIANDO CONTA... </>
                                ) : (
                                    'CADASTRAR'
                                )}
                            </button>
                        </div>
                    </form>

                    <p className="text-center text-sm text-zinc-500 pt-6 border-t border-zinc-800/50">
                        Já tem uma conta?{' '}
                        <button
                            onClick={onSwitchToLogin}
                            className="font-bold text-white hover:text-[#FABE01] transition-colors"
                        >
                            Faça Login
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Signup;