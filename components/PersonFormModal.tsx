import React, { useState, useEffect } from 'react';
import { criarPessoa, ContaJaExisteError } from '../utils/equipe';
import { subscribeCargos } from '../utils/cargos';
import { X, Loader2, AlertTriangle, UserPlus, Mail, Info } from 'lucide-react';

interface PersonFormModalProps {
    onClose: () => void;
    /** Chamado depois de criar, com o nome para a mensagem de sucesso. */
    onCriado: (nome: string) => void;
}

const inputStyle = "w-full bg-[#111111] border border-zinc-700 rounded-control px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all placeholder:text-zinc-600";
const labelStyle = "block text-[11px] font-semibold text-zinc-500 mb-1.5";

/**
 * Cadastro de uma pessoa da equipe, pelo painel.
 *
 * A tela Equipe listava quem existe e nao tinha NENHUM caminho para adicionar
 * alguem: dependia de a pessoa se cadastrar sozinha no portal e de um admin
 * promove-la depois. Quem monta equipe faz o contrario - cadastra a pessoa.
 *
 * SO PEDE O QUE E DECISAO DA AGENCIA: e-mail, nome e cargo. Senha nao aparece
 * porque quem escolhe e a pessoa, pelo e-mail; foto e telefone sao dela e ficam no
 * proprio perfil. Um formulario que pedisse senha faria o admin conhecer a senha
 * de um colega.
 */
const PersonFormModal: React.FC<PersonFormModalProps> = ({ onClose, onCriado }) => {
    const [email, setEmail] = useState('');
    const [nome, setNome] = useState('');
    const [sobrenome, setSobrenome] = useState('');
    const [cargo, setCargo] = useState('');
    const [cargos, setCargos] = useState<string[]>([]);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');

    // A lista de cargos e a mesma de Gestão › Configurações: cargo digitado a mao
    // vira etiqueta solta que ninguem mais usa.
    useEffect(() => subscribeCargos(setCargos), []);

    useEffect(() => {
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !salvando) onClose(); };
        document.addEventListener('keydown', esc);
        return () => document.removeEventListener('keydown', esc);
    }, [onClose, salvando]);

    const podeSalvar = email.trim().length > 3 && nome.trim().length >= 2 && !salvando;

    const handleCriar = async () => {
        if (!podeSalvar) return;
        setSalvando(true);
        setErro('');
        try {
            await criarPessoa({ email, nome, sobrenome, cargo: cargo || null });
            onCriado([nome.trim(), sobrenome.trim()].filter(Boolean).join(' '));
        } catch (e) {
            console.error(e);
            setErro(e instanceof ContaJaExisteError
                // O caminho de recuperacao vai escrito: "já existe" sem dizer o que
                // fazer manda a pessoa procurar.
                ? `${e.message} Se for alguém do time, abra a ficha dela em Aguardando vínculo e use “Tornar colaborador da agência”.`
                : e instanceof Error ? e.message : 'Não foi possível criar o acesso. Tente novamente.');
            setSalvando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Nova pessoa na equipe"
                className="w-full sm:max-w-lg bg-[#1A1A1A] border-t sm:border border-white/10 rounded-t-card sm:rounded-card shadow-card flex flex-col max-h-[92dvh] overflow-hidden"
            >
                <header className="shrink-0 flex items-start gap-3 px-5 py-4 border-b border-white/5">
                    <span className="w-9 h-9 shrink-0 rounded-chip bg-[#FABE01]/10 text-[#FABE01] flex items-center justify-center">
                        <UserPlus className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base font-bold text-white tracking-tight">Nova pessoa na equipe</h2>
                        <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                            Acesso de colaborador: vê e edita o conteúdo de todos os clientes.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={salvando}
                        aria-label="Fechar"
                        className="shrink-0 p-2 -mr-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                    <div>
                        <label className={labelStyle} htmlFor="pessoa-email">E-mail *</label>
                        <input
                            id="pessoa-email"
                            autoFocus
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="nome@agencianocrato.com"
                            className={inputStyle}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelStyle} htmlFor="pessoa-nome">Nome *</label>
                            <input
                                id="pessoa-nome"
                                value={nome}
                                onChange={e => setNome(e.target.value)}
                                placeholder="Maria"
                                className={inputStyle}
                            />
                        </div>
                        <div>
                            <label className={labelStyle} htmlFor="pessoa-sobrenome">Sobrenome</label>
                            <input
                                id="pessoa-sobrenome"
                                value={sobrenome}
                                onChange={e => setSobrenome(e.target.value)}
                                placeholder="Silva"
                                className={inputStyle}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelStyle} htmlFor="pessoa-cargo">Cargo</label>
                        <select
                            id="pessoa-cargo"
                            value={cargo}
                            onChange={e => setCargo(e.target.value)}
                            className={inputStyle}
                        >
                            <option value="">— definir depois —</option>
                            {cargos.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed">
                            A lista é mantida em Gestão › Configurações.
                        </p>
                    </div>

                    {/* O QUE ACONTECE DEPOIS, escrito antes. Sao dois e-mails, e sem
                        avisar isso o suporte vira "recebi dois, qual eu uso?". */}
                    <div className="flex items-start gap-2.5 bg-[#111111] border border-white/5 rounded-control p-3.5">
                        <Mail className="w-4 h-4 text-[#FABE01] shrink-0 mt-0.5" />
                        <div className="text-[11px] text-zinc-400 leading-relaxed">
                            <p className="text-zinc-200 font-semibold mb-1">A pessoa recebe dois e-mails</p>
                            <p>Um para confirmar o endereço — obrigatório, sem isso o acesso não abre — e outro
                            para criar a senha. Você não define senha nenhuma.</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-2.5 px-1">
                        <Info className="w-3.5 h-3.5 text-zinc-600 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-zinc-600 leading-relaxed">
                            Para dar acesso a alguém <strong className="text-zinc-500">do cliente</strong>, use a
                            aba Acessos dentro do cliente — o acesso dele pertence a ele, não à equipe.
                            Administrador continua vindo da lista de e-mails do sistema.
                        </p>
                    </div>

                    {erro && (
                        <p className="text-red-400 text-xs flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {erro}
                        </p>
                    )}
                </div>

                <footer className="shrink-0 flex gap-2 p-4 border-t border-white/5">
                    <button
                        onClick={onClose}
                        disabled={salvando}
                        className="flex-1 py-2.5 text-sm font-semibold rounded-control bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors disabled:opacity-40"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleCriar}
                        disabled={!podeSalvar}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-control bg-[#FABE01] text-black hover:bg-[#FABE01]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        {salvando ? 'Criando acesso...' : 'Criar acesso'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default PersonFormModal;
