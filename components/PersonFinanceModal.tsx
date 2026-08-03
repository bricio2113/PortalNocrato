import React, { useState, useEffect } from 'react';
import { DadosFinanceiros } from '../types';
import {
    lerFinanceiroUsuario, salvarFinanceiroUsuario,
    centavosParaTexto, textoParaCentavos
} from '../utils/empresas';
import { toDateInputValue, fromDateInputValue } from '../utils/date';
import { X, Save, Loader2, AlertTriangle, Lock } from 'lucide-react';

interface PersonFinanceModalProps {
    uid: string;
    nome: string;
    /** Rotulos mudam: colaborador recebe, cliente paga. */
    ehColaborador: boolean;
    autorEmail?: string | null;
    onClose: () => void;
    onSaved?: () => void;
}

const inputStyle = "w-full bg-[#111111] border border-zinc-700 rounded-control px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all placeholder:text-zinc-600";
const labelStyle = "block text-[11px] font-semibold text-zinc-500 mb-1.5";

/**
 * Ficha financeira de uma PESSOA - usuarios/{uid}/_financeiro/dados.
 *
 * Subcolecao, nao campo. O documento usuarios/{uid} e lido pela EQUIPE INTEIRA
 * (o painel precisa listar as pessoas), entao um campo `financeiro` ali dentro
 * chegaria no navegador de todo colaborador - o Firestore nao filtra campo na
 * leitura, e "so admin ve" seria mentira da interface.
 *
 * A regra permite que a PROPRIA PESSOA leia o dela, mas so admin escreve:
 * ninguem edita o proprio contrato.
 */
const PersonFinanceModal: React.FC<PersonFinanceModalProps> = ({
    uid, nome, ehColaborador, autorEmail, onClose, onSaved
}) => {
    const [dados, setDados] = useState<DadosFinanceiros>({});
    const [valorTexto, setValorTexto] = useState('');
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');

    useEffect(() => {
        let vivo = true;
        lerFinanceiroUsuario(uid)
            .then(lidos => {
                if (!vivo || !lidos) return;
                setDados(lidos);
                setValorTexto(centavosParaTexto(lidos.valorMensalCentavos));
            })
            .catch(e => {
                console.error(e);
                if (vivo) setErro('Não foi possível carregar os dados. Verifique se você é administrador.');
            })
            .finally(() => vivo && setCarregando(false));
        return () => { vivo = false; };
    }, [uid]);

    const handleSalvar = async () => {
        setSalvando(true);
        setErro('');
        try {
            await salvarFinanceiroUsuario(uid, dados, autorEmail);
            onSaved?.();
            onClose();
        } catch (e) {
            console.error(e);
            setErro('Não foi possível salvar. Só administradores escrevem aqui.');
            setSalvando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
            <div className="relative w-full sm:max-w-lg bg-[#1A1A1A] border-t sm:border border-white/10 rounded-t-card sm:rounded-card shadow-card flex flex-col max-h-[92dvh] overflow-hidden">
                <header className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-white/5 shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold text-white truncate">Financeiro</h2>
                        <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{nome}</p>
                    </div>
                    <button onClick={onClose} aria-label="Fechar" className="p-2 -m-2 text-zinc-400 hover:text-white shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-4">
                    <div className="flex items-start gap-2 bg-[#FABE01]/5 border border-[#FABE01]/20 rounded-control p-3">
                        <Lock className="w-4 h-4 text-[#FABE01] shrink-0 mt-0.5" />
                        <p className="text-[11px] text-zinc-300 leading-relaxed">
                            Coleção separada: só administradores e a própria pessoa conseguem ler.
                            Escrita é só de administrador — ninguém edita o próprio contrato.
                        </p>
                    </div>

                    {carregando ? (
                        <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
                            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelStyle}>
                                    {ehColaborador ? 'Valor mensal / cachê (R$)' : 'Valor mensal (R$)'}
                                </label>
                                <input
                                    value={valorTexto}
                                    onChange={e => {
                                        setValorTexto(e.target.value);
                                        setDados(d => ({ ...d, valorMensalCentavos: textoParaCentavos(e.target.value) }));
                                    }}
                                    placeholder="1.500,00"
                                    inputMode="decimal"
                                    className={inputStyle}
                                />
                            </div>
                            <div>
                                <label className={labelStyle}>
                                    {ehColaborador ? 'Dia do pagamento' : 'Dia do vencimento'}
                                </label>
                                <input
                                    type="number" min={1} max={31}
                                    value={dados.diaVencimento ?? ''}
                                    onChange={e => setDados(d => ({ ...d, diaVencimento: e.target.value ? Number(e.target.value) : null }))}
                                    placeholder="5"
                                    className={inputStyle}
                                />
                            </div>
                            <div>
                                <label className={labelStyle}>Início</label>
                                <input
                                    type="date"
                                    value={dados.inicioContrato ? toDateInputValue(dados.inicioContrato) : ''}
                                    onChange={e => setDados(d => ({ ...d, inicioContrato: fromDateInputValue(e.target.value) }))}
                                    className={`${inputStyle} [color-scheme:dark]`}
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className={labelStyle}>
                                    {ehColaborador ? 'Escopo do trabalho' : 'Escopo contratado'}
                                </label>
                                <input
                                    value={dados.escopo || ''}
                                    onChange={e => setDados(d => ({ ...d, escopo: e.target.value }))}
                                    placeholder={ehColaborador ? '20h/semana, edição de reels' : '4 reels + 8 carrosséis por mês'}
                                    className={inputStyle}
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className={labelStyle}>Observações</label>
                                <textarea
                                    rows={3}
                                    value={dados.observacoes || ''}
                                    onChange={e => setDados(d => ({ ...d, observacoes: e.target.value }))}
                                    className={`${inputStyle} resize-none`}
                                />
                            </div>
                            {dados.atualizadoEm && (
                                <p className="sm:col-span-2 text-[10px] text-zinc-600">
                                    Última alteração em {dados.atualizadoEm.toLocaleDateString('pt-BR')}
                                    {dados.atualizadoPor ? ` por ${dados.atualizadoPor}` : ''}.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <footer className="p-4 sm:p-5 border-t border-white/5 shrink-0 space-y-3">
                    {erro && (
                        <p className="text-red-400 text-xs flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {erro}
                        </p>
                    )}
                    <div className="flex gap-2">
                        <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold rounded-control bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors">
                            Cancelar
                        </button>
                        <button
                            onClick={handleSalvar}
                            disabled={salvando || carregando}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-control bg-[#FABE01] text-black hover:bg-[#FABE01]/90 transition-colors disabled:opacity-40"
                        >
                            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default PersonFinanceModal;
