import React, { useState } from 'react';
import { db } from '../utils/firebase';
import { UserProfile } from '../types';
import { getInitials } from '../utils/avatar';
import { UserCircle, Save, Loader2, AlertTriangle, LogOut } from 'lucide-react';
// @ts-ignore
import favicon from '../assets/favicon.png';

interface CompleteProfileModalProps {
    profile: UserProfile;
    onSaved: (patch: Partial<UserProfile>) => void;
    /** Unica saida sem preencher. Ver nota sobre nao prender o usuario. */
    handleLogout: () => void;
}

/**
 * Passo obrigatorio de nome e sobrenome.
 *
 * Aparece para quem se cadastrou antes destes campos existirem. Sem isto, o
 * portal mostraria a primeira parte do e-mail no lugar do nome em aprovacoes e
 * comentarios - e, na pratica, quase ninguem passaria pela aba de perfil por
 * conta propria.
 *
 * Nao tem X, nao fecha no Esc e nao fecha clicando fora: e um passo, nao um
 * aviso. Mas tem "Sair da conta", porque se a gravacao falhar por permissao ou
 * rede o usuario ficaria preso numa tela sem saida nenhuma.
 *
 * Pede so nome e sobrenome. Foto fica de fora de proposito: exigir imagem para
 * entrar seria hostil, e ela nao muda como a pessoa e identificada.
 */
const CompleteProfileModal: React.FC<CompleteProfileModalProps> = ({ profile, onSaved, handleLogout }) => {
    const [nome, setNome] = useState(profile.nome || '');
    const [sobrenome, setSobrenome] = useState(profile.sobrenome || '');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const nomeOk = nome.trim().length >= 2;
    const sobrenomeOk = sobrenome.trim().length >= 2;
    const canSubmit = nomeOk && sobrenomeOk;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit || isSaving) return;
        setIsSaving(true);
        setError('');

        const patch = { nome: nome.trim(), sobrenome: sobrenome.trim() };
        try {
            await db.collection('usuarios').doc(profile.id).update(patch);
            onSaved(patch);
        } catch (err) {
            console.error(err);
            setError('Não foi possível salvar. Verifique sua conexão e tente novamente.');
            setIsSaving(false);
        }
        // Em caso de sucesso nao mexemos em isSaving: o componente sai de tela
        // quando o perfil passa a estar completo.
    };

    const inputStyle = "w-full bg-[#111111] border border-zinc-700 rounded-sm px-4 py-3 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all";

    return (
        <div
            className="min-h-screen bg-[#111111] flex flex-col items-center justify-center p-4 text-zinc-100 font-sans selection:bg-[#FABE01] selection:text-black"
            role="dialog"
            aria-modal="true"
            aria-labelledby="completar-perfil-titulo"
        >
            <div className="mb-8">
                <img src={favicon} alt="Nocrato" className="h-12 w-auto brightness-0 invert opacity-80" />
            </div>

            <div className="w-full max-w-md bg-[#1A1A1A] border border-white/5 shadow-2xl rounded-sm p-8 animate-in zoom-in-95 duration-300">

                <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#FABE01] to-[#DE7928] flex items-center justify-center text-black font-bold text-2xl">
                        {getInitials({ nome, sobrenome, email: profile.email })}
                    </div>
                </div>

                <h1 id="completar-perfil-titulo" className="text-2xl font-bold text-white mb-3 text-center flex items-center justify-center gap-2">
                    <UserCircle className="w-6 h-6 text-[#FABE01] shrink-0" />
                    Como podemos te chamar?
                </h1>

                <p className="text-zinc-400 text-sm text-center leading-relaxed mb-8">
                    Seu nome aparece nas aprovações e nos comentários das publicações. Leva dez segundos e é só uma vez.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="completar-nome" className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                            Nome
                        </label>
                        <input
                            id="completar-nome"
                            type="text"
                            value={nome}
                            onChange={(e) => { setNome(e.target.value); setError(''); }}
                            placeholder="Seu nome"
                            autoComplete="given-name"
                            autoFocus
                            className={inputStyle}
                        />
                    </div>

                    <div>
                        <label htmlFor="completar-sobrenome" className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                            Sobrenome
                        </label>
                        <input
                            id="completar-sobrenome"
                            type="text"
                            value={sobrenome}
                            onChange={(e) => { setSobrenome(e.target.value); setError(''); }}
                            placeholder="Seu sobrenome"
                            autoComplete="family-name"
                            className={inputStyle}
                        />
                    </div>

                    {error && (
                        <p className="text-red-400 text-sm flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={!canSubmit || isSaving}
                        className="w-full flex items-center justify-center gap-2 bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-bold py-3.5 rounded-sm uppercase tracking-wide text-sm shadow-[0_0_15px_rgba(250,190,1,0.2)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {isSaving ? 'Salvando...' : 'Continuar'}
                    </button>
                </form>

                <p className="text-zinc-600 text-xs text-center mt-4 leading-relaxed">
                    Você pode trocar isso depois, e adicionar uma foto, em <span className="text-zinc-500">Meu Perfil</span>.
                </p>
            </div>

            {/* Saida de emergencia: se a gravacao falhar de forma persistente, sem
                isto a conta ficaria inutilizavel sem nenhuma alternativa. */}
            <button
                onClick={handleLogout}
                className="mt-8 flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
                <LogOut className="w-3.5 h-3.5" />
                Sair da conta
            </button>
        </div>
    );
};

export default CompleteProfileModal;
