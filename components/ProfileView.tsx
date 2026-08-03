import React, { useState, useRef, useEffect } from 'react';
import { db } from '../utils/firebase';
import { UserProfile } from '../types';
import {
    fileToAvatarDataUrl, isSafeImageSrc, getInitials, getDisplayName,
    isProfileComplete, ACCEPTED_IMAGE_TYPES
} from '../utils/avatar';
import { permissionLevel, PERMISSION_LABEL, PERMISSION_HINT } from '../utils/permissions';
import {
    UserCircle, Camera, Trash2, Save, Loader2, Check,
    AlertTriangle, Mail, Building2, Shield
} from 'lucide-react';

interface ProfileViewProps {
    profile: UserProfile;
    /** Chamado depois de gravar, para o app refletir o nome novo na hora. */
    onSaved?: (patch: Partial<UserProfile>) => void;
}

/**
 * Perfil do proprio usuario: nome, sobrenome e foto.
 *
 * E-mail, permissao e empresa aparecem em leitura. Nao e limitacao de tela: as
 * regras do Firestore congelam role e empresaId no update do proprio documento,
 * entao um campo editavel ali produziria erro de permissao. E-mail pertence ao
 * Firebase Auth e trocar exige reautenticacao - fluxo proprio, fora deste.
 */
const ProfileView: React.FC<ProfileViewProps> = ({ profile, onSaved }) => {
    const [nome, setNome] = useState(profile.nome || '');
    const [sobrenome, setSobrenome] = useState(profile.sobrenome || '');
    const [fotoUrl, setFotoUrl] = useState<string | null>(profile.fotoUrl || null);

    const [isSaving, setIsSaving] = useState(false);
    const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setNome(profile.nome || '');
        setSobrenome(profile.sobrenome || '');
        setFotoUrl(profile.fotoUrl || null);
    }, [profile.id, profile.nome, profile.sobrenome, profile.fotoUrl]);

    const isDirty =
        nome !== (profile.nome || '') ||
        sobrenome !== (profile.sobrenome || '') ||
        (fotoUrl || null) !== (profile.fotoUrl || null);

    const previewParts = { nome, sobrenome, email: profile.email };
    const hasPhoto = isSafeImageSrc(fotoUrl);

    const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // Zera o input para permitir escolher o mesmo arquivo novamente depois
        // de um erro - sem isto o onChange nao dispara na segunda tentativa.
        e.target.value = '';
        if (!file) return;

        setError('');
        setSaved(false);
        setIsProcessingPhoto(true);
        try {
            setFotoUrl(await fileToAvatarDataUrl(file));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível usar esta imagem.');
        } finally {
            setIsProcessingPhoto(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving) return;
        setError('');
        setSaved(false);

        // Mesma exigencia do passo obrigatorio de entrada. Sem alinhar as duas,
        // salvar aqui sem sobrenome prenderia o usuario no modal obrigatorio no
        // proximo carregamento.
        if (!isProfileComplete({ nome, sobrenome })) {
            setError('Informe nome e sobrenome (ao menos duas letras em cada).');
            return;
        }

        setIsSaving(true);
        const patch = {
            nome: nome.trim(),
            sobrenome: sobrenome.trim(),
            fotoUrl: fotoUrl || null
        };
        try {
            await db.collection('usuarios').doc(profile.id).update(patch);
            setSaved(true);
            onSaved?.(patch);
        } catch (err) {
            console.error(err);
            setError('Não foi possível salvar. Verifique sua conexão e tente novamente.');
        } finally {
            setIsSaving(false);
        }
    };

    const inputStyle = "w-full bg-[#111111] border border-zinc-700 rounded-control px-3 py-3 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all disabled:opacity-60";
    const labelStyle = "block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5";

    return (
        <div className="text-zinc-100 font-sans">
            <header className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight flex items-center gap-3">
                    <UserCircle className="w-8 h-8 text-[#FABE01] shrink-0" />
                    Meu Perfil
                </h1>
                <p className="text-zinc-400 mt-2 text-base max-w-2xl leading-relaxed">
                    Seu nome aparece nos comentários e nas aprovações. A foto é opcional — sem ela, usamos suas iniciais.
                </p>
            </header>

            <div className="max-w-2xl pb-20">
                {/* Perfil incompleto e o estado inicial de todo mundo que se
                    cadastrou antes destes campos existirem. */}
                {!isProfileComplete(profile) && (
                    <div className="border border-[#FABE01]/20 bg-[#FABE01]/5 rounded-card p-4 mb-6 flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-[#FABE01] shrink-0 mt-0.5" />
                        <p className="text-sm text-zinc-300 leading-relaxed">
                            Seu perfil ainda não tem nome. Enquanto isso, aparece a primeira parte do seu e-mail
                            (<span className="text-white font-medium">{profile.email.split('@')[0]}</span>) nos comentários.
                        </p>
                    </div>
                )}

                <form onSubmit={handleSave} className="bg-[#1A1A1A] border border-white/5 rounded-card p-4 sm:p-6 space-y-6 sm:space-y-8">

                    {/* FOTO */}
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                        <div className="relative shrink-0">
                            {hasPhoto ? (
                                <img
                                    src={fotoUrl!}
                                    alt="Sua foto de perfil"
                                    className="w-24 h-24 rounded-full object-cover border-2 border-white/10"
                                />
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#FABE01] to-[#DE7928] flex items-center justify-center text-black font-bold text-2xl">
                                    {getInitials(previewParts)}
                                </div>
                            )}
                            {isProcessingPhoto && (
                                <div className="absolute inset-0 rounded-full bg-black/70 flex items-center justify-center">
                                    <Loader2 className="w-6 h-6 text-[#FABE01] animate-spin" />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0 text-center sm:text-left">
                            <p className="text-white font-bold mb-1">{getDisplayName(previewParts)}</p>
                            <p className="text-zinc-500 text-xs mb-4">Prévia de como você aparece no portal.</p>

                            <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept={ACCEPTED_IMAGE_TYPES.join(',')}
                                    onChange={handlePickFile}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    disabled={isProcessingPhoto}
                                    className="inline-flex items-center gap-2 px-4 py-2 border border-white/10 hover:bg-white/5 text-zinc-300 text-xs font-bold uppercase tracking-wide rounded-control transition-colors disabled:opacity-50"
                                >
                                    <Camera className="w-3.5 h-3.5" />
                                    {hasPhoto ? 'Trocar foto' : 'Escolher foto'}
                                </button>
                                {hasPhoto && (
                                    <button
                                        type="button"
                                        onClick={() => { setFotoUrl(null); setSaved(false); }}
                                        className="inline-flex items-center gap-2 px-4 py-2 text-zinc-500 hover:text-red-400 text-xs font-bold uppercase tracking-wide rounded-control transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Remover
                                    </button>
                                )}
                            </div>
                            <p className="text-zinc-600 text-xs mt-3 leading-relaxed">
                                JPG, PNG ou WEBP. A imagem é recortada em quadrado e reduzida automaticamente.
                            </p>
                        </div>
                    </div>

                    {/* NOME */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelStyle} htmlFor="perfil-nome">Nome</label>
                            <input
                                id="perfil-nome"
                                type="text"
                                value={nome}
                                onChange={(e) => { setNome(e.target.value); setSaved(false); }}
                                placeholder="Seu nome"
                                autoComplete="given-name"
                                className={inputStyle}
                            />
                        </div>
                        <div>
                            <label className={labelStyle} htmlFor="perfil-sobrenome">Sobrenome</label>
                            <input
                                id="perfil-sobrenome"
                                type="text"
                                value={sobrenome}
                                onChange={(e) => { setSobrenome(e.target.value); setSaved(false); }}
                                placeholder="Seu sobrenome"
                                autoComplete="family-name"
                                className={inputStyle}
                            />
                        </div>
                    </div>

                    {/* CAMPOS EM LEITURA */}
                    <div className="border-t border-white/5 pt-6 space-y-3">
                        <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Dados da conta</p>

                        <div className="flex items-center gap-3 text-sm">
                            <Mail className="w-4 h-4 text-zinc-600 shrink-0" />
                            <span className="text-zinc-500 shrink-0">E-mail:</span>
                            <span className="text-zinc-300 truncate">{profile.email}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <Shield className="w-4 h-4 text-zinc-600 shrink-0" />
                            <span className="text-zinc-500 shrink-0">Permissão:</span>
                            {/* "Agência" nao distinguia quem gerencia acessos de
                                quem so trabalha nos clientes. */}
                            <span className="text-zinc-300">{PERMISSION_LABEL[permissionLevel(profile)]}</span>
                        </div>
                        <p className="text-zinc-600 text-xs leading-relaxed -mt-1 pl-7">
                            {PERMISSION_HINT[permissionLevel(profile)]}
                        </p>
                        {profile.empresaId && (
                            <div className="flex items-center gap-3 text-sm">
                                <Building2 className="w-4 h-4 text-zinc-600 shrink-0" />
                                <span className="text-zinc-500 shrink-0">Empresa:</span>
                                <span className="text-zinc-300 truncate">{profile.empresaId}</span>
                            </div>
                        )}
                        <p className="text-zinc-600 text-xs leading-relaxed pt-1">
                            Para alterar e-mail, permissão ou empresa, fale com a agência.
                        </p>
                    </div>

                    {error && (
                        <p className="text-red-400 text-sm flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                        </p>
                    )}

                    <div className="flex items-center gap-4 pt-2">
                        <button
                            type="submit"
                            disabled={isSaving || !isDirty}
                            className="inline-flex items-center gap-2 bg-[#FABE01] hover:bg-[#FABE01]/90 text-black font-bold text-sm px-6 py-3 rounded-control uppercase tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isSaving ? 'Salvando...' : 'Salvar perfil'}
                        </button>
                        {saved && !isDirty && (
                            <span className="text-emerald-400 text-sm font-medium flex items-center gap-1.5">
                                <Check className="w-4 h-4" /> Perfil salvo
                            </span>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfileView;
