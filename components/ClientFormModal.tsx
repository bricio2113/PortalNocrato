import React, { useState, useEffect } from 'react';
import { Empresa, EmpresaStatus, DadosFinanceiros } from '../types';
import {
    criarEmpresa, salvarEmpresa, lerFinanceiro, salvarFinanceiro,
    EmpresaJaExisteError, EMPRESA_STATUS, ORIGEM_OPTIONS,
    slugify, centavosParaTexto, textoParaCentavos
} from '../utils/empresas';
import { toDateInputValue, fromDateInputValue } from '../utils/date';
import { SegmentedTabs } from './ui';
import {
    X, Save, Loader2, AlertTriangle, Building2, Instagram, DollarSign, Lock
} from 'lucide-react';

type Aba = 'basico' | 'redes' | 'financeiro';

interface ClientFormModalProps {
    /** Ausente = criando. Presente = editando a ficha existente. */
    empresa?: Empresa | null;
    /** Nome sugerido, quando aberto a partir de "+ Nova empresa" no vínculo. */
    nomeInicial?: string;
    /** Somente admin vê e escreve a aba financeiro. */
    isAdmin: boolean;
    autorEmail?: string | null;
    onClose: () => void;
    onSaved: (empresaId: string, nome: string) => void;
}

const inputStyle = "w-full bg-[#111111] border border-zinc-700 rounded-control px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all placeholder:text-zinc-600";
const labelStyle = "block text-[11px] font-semibold text-zinc-500 mb-1.5";

const Campo: React.FC<{ label: string; children: React.ReactNode; hint?: string; className?: string }> =
    ({ label, children, hint, className = '' }) => (
    <div className={className}>
        <label className={labelStyle}>{label}</label>
        {children}
        {hint && <p className="text-[10px] text-zinc-600 mt-1 leading-snug">{hint}</p>}
    </div>
);

/**
 * Ficha do cliente: cadastro e edicao.
 *
 * Antes o cliente nascia de um campo de texto solto dentro do select de vinculo
 * de usuario - so o nome, e o resto (contato, nicho, contrato) vivia na cabeca
 * de quem atende. E o mesmo formulario serve para criar e para editar de
 * proposito: dois formularios divergem, e um deles sempre fica esquecido.
 *
 * O FINANCEIRO vive em subcolecao propria, nao neste documento. O cliente le o
 * proprio `empresas/{id}` inteiro - o Firestore nao filtra campo na leitura -,
 * entao valor e contrato dentro dele seriam visiveis para ele. Ver types.ts.
 */
const ClientFormModal: React.FC<ClientFormModalProps> = ({
    empresa, nomeInicial, isAdmin, autorEmail, onClose, onSaved
}) => {
    const editando = Boolean(empresa);
    const [aba, setAba] = useState<Aba>('basico');
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');

    const [ficha, setFicha] = useState<Partial<Empresa>>({
        nome: empresa?.nome || nomeInicial || '',
        handle: empresa?.handle || '',
        segmento: empresa?.segmento || '',
        status: empresa?.status || 'ativo',
        whatsapp: empresa?.whatsapp || '',
        email: empresa?.email || '',
        cidade: empresa?.cidade || '',
        origem: empresa?.origem || '',
        notasInternas: empresa?.notasInternas || '',
        redes: empresa?.redes || {}
    });

    const [financeiro, setFinanceiro] = useState<DadosFinanceiros>({});
    const [valorTexto, setValorTexto] = useState('');
    const [carregandoFinanceiro, setCarregandoFinanceiro] = useState(false);

    // O financeiro so e buscado quando a aba abre, e so por admin: um `get` que
    // a regra vai recusar polui o console de erro e nao serve para nada.
    useEffect(() => {
        if (!editando || !isAdmin || aba !== 'financeiro' || !empresa) return;
        let vivo = true;
        setCarregandoFinanceiro(true);
        lerFinanceiro(empresa.id)
            .then(dados => {
                if (!vivo || !dados) return;
                setFinanceiro(dados);
                setValorTexto(centavosParaTexto(dados.valorMensalCentavos));
            })
            .catch(console.error)
            .finally(() => vivo && setCarregandoFinanceiro(false));
        return () => { vivo = false; };
    }, [editando, isAdmin, aba, empresa]);

    const set = (campo: keyof Empresa, valor: unknown) => setFicha(f => ({ ...f, [campo]: valor }));
    const setRede = (rede: string, valor: string) =>
        setFicha(f => ({ ...f, redes: { ...f.redes, [rede]: valor } }));

    const idPrevisto = slugify(ficha.nome || '');

    const handleSalvar = async () => {
        const nome = (ficha.nome || '').trim();
        if (!nome) { setAba('basico'); return setErro('O nome do cliente é obrigatório.'); }

        setSalvando(true);
        setErro('');
        try {
            const empresaId = editando
                ? empresa!.id
                : await criarEmpresa({ ...ficha, nome } as Omit<Empresa, 'id' | 'criadoEm' | 'criadoPor'>, autorEmail);

            if (editando) await salvarEmpresa(empresaId, { ...ficha, nome });

            // Financeiro em escrita separada, porque e outro documento. Falhar
            // aqui nao pode desfazer a ficha ja gravada, entao o erro e
            // reportado sem derrubar o resto.
            if (isAdmin && (financeiro.valorMensalCentavos !== undefined
                || financeiro.diaVencimento !== undefined
                || financeiro.escopo || financeiro.observacoes || financeiro.inicioContrato)) {
                try {
                    await salvarFinanceiro(empresaId, financeiro, autorEmail);
                } catch (e) {
                    console.error(e);
                    setErro('A ficha foi salva, mas o financeiro não. Reabra a aba Financeiro e tente de novo.');
                    setSalvando(false);
                    return;
                }
            }

            onSaved(empresaId, nome);
        } catch (e) {
            console.error(e);
            setErro(e instanceof EmpresaJaExisteError
                ? `Já existe um cliente com o ID "${e.empresaId}". Escolha outro nome.`
                : e instanceof Error ? e.message : 'Não foi possível salvar. Tente novamente.');
            setSalvando(false);
        }
    };

    const abas: { id: Aba; label: string; icon: React.ElementType }[] = [
        { id: 'basico', label: 'Básico', icon: Building2 },
        { id: 'redes', label: 'Redes', icon: Instagram },
        ...(isAdmin ? [{ id: 'financeiro' as Aba, label: 'Financeiro', icon: DollarSign }] : [])
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
            <div className="relative w-full sm:max-w-2xl bg-[#1A1A1A] border-t sm:border border-white/10 rounded-t-card sm:rounded-card shadow-card flex flex-col h-[92dvh] sm:h-auto sm:max-h-[90dvh] overflow-hidden">
                <header className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-white/5 shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold text-white truncate">
                            {editando ? ficha.nome || empresa!.nome : 'Novo cliente'}
                        </h2>
                        <p className="text-[11px] text-zinc-500 mt-0.5 font-mono truncate">
                            {editando
                                ? `ID: ${empresa!.id}`
                                : idPrevisto ? `ID: ${idPrevisto}` : 'O ID é gerado a partir do nome'}
                        </p>
                    </div>
                    <button onClick={onClose} aria-label="Fechar" className="p-2 -m-2 text-zinc-400 hover:text-white shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <div className="px-4 sm:px-5 pt-4 shrink-0">
                    <SegmentedTabs options={abas} value={aba} onChange={setAba} size="sm" />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5">
                    {aba === 'basico' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Campo label="Nome do cliente *" className="sm:col-span-2">
                                <input
                                    autoFocus
                                    value={ficha.nome || ''}
                                    onChange={e => set('nome', e.target.value)}
                                    placeholder="Ex: Dra. Sylvia Fisio"
                                    className={inputStyle}
                                />
                            </Campo>
                            <Campo label="@ do Instagram" hint="Alimenta a prévia do perfil no calendário.">
                                <input
                                    value={ficha.handle || ''}
                                    onChange={e => set('handle', e.target.value)}
                                    placeholder="@perfil"
                                    className={inputStyle}
                                />
                            </Campo>
                            <Campo label="Segmento / nicho" hint="Vira etiqueta no card do cliente.">
                                <input
                                    value={ficha.segmento || ''}
                                    onChange={e => set('segmento', e.target.value)}
                                    placeholder="Ex: Saúde e bem-estar"
                                    className={inputStyle}
                                />
                            </Campo>
                            <Campo label="Situação">
                                <select
                                    value={ficha.status || 'ativo'}
                                    onChange={e => set('status', e.target.value as EmpresaStatus)}
                                    className={inputStyle}
                                >
                                    {EMPRESA_STATUS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                </select>
                            </Campo>
                            <Campo label="Origem">
                                <select
                                    value={ficha.origem || ''}
                                    onChange={e => set('origem', e.target.value)}
                                    className={inputStyle}
                                >
                                    <option value="">— não informado —</option>
                                    {ORIGEM_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </Campo>
                            <Campo label="WhatsApp">
                                <input
                                    value={ficha.whatsapp || ''}
                                    onChange={e => set('whatsapp', e.target.value)}
                                    placeholder="(13) 99999-9999"
                                    className={inputStyle}
                                />
                            </Campo>
                            <Campo label="E-mail de contato">
                                <input
                                    type="email"
                                    value={ficha.email || ''}
                                    onChange={e => set('email', e.target.value)}
                                    placeholder="contato@empresa.com"
                                    className={inputStyle}
                                />
                            </Campo>
                            <Campo label="Cidade / estado" className="sm:col-span-2">
                                <input
                                    value={ficha.cidade || ''}
                                    onChange={e => set('cidade', e.target.value)}
                                    placeholder="Santos / SP"
                                    className={inputStyle}
                                />
                            </Campo>
                            <Campo
                                label="Observações"
                                className="sm:col-span-2"
                                // Nome honesto: "notas internas" seria mentira. O cliente le o
                                // documento da empresa dele por inteiro, e o Firestore nao filtra
                                // campo na leitura. Segredo vai para a aba Financeiro, que e
                                // subcolecao restrita.
                                hint="O cliente consegue ler este campo. Para dado sigiloso use a aba Financeiro."
                            >
                                <textarea
                                    rows={3}
                                    value={ficha.notasInternas || ''}
                                    onChange={e => set('notasInternas', e.target.value)}
                                    placeholder="Preferências, tom de voz, combinados..."
                                    className={`${inputStyle} resize-none`}
                                />
                            </Campo>
                        </div>
                    )}

                    {aba === 'redes' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {([
                                ['instagram', 'Instagram'], ['tiktok', 'TikTok'],
                                ['facebook', 'Facebook'], ['linkedin', 'LinkedIn'],
                                ['youtube', 'YouTube'], ['site', 'Site']
                            ] as const).map(([campo, label]) => (
                                <Campo key={campo} label={label}>
                                    <input
                                        value={(ficha.redes as Record<string, string> | undefined)?.[campo] || ''}
                                        onChange={e => setRede(campo, e.target.value)}
                                        placeholder={campo === 'site' ? 'https://...' : '@perfil ou link'}
                                        className={inputStyle}
                                    />
                                </Campo>
                            ))}
                        </div>
                    )}

                    {aba === 'financeiro' && isAdmin && (
                        <div className="space-y-4">
                            <div className="flex items-start gap-2 bg-[#FABE01]/5 border border-[#FABE01]/20 rounded-control p-3">
                                <Lock className="w-4 h-4 text-[#FABE01] shrink-0 mt-0.5" />
                                <p className="text-[11px] text-zinc-300 leading-relaxed">
                                    Visível só para administradores. Fica em coleção separada — nem o
                                    cliente nem os colaboradores conseguem ler, nem pelo console.
                                </p>
                            </div>

                            {!editando && (
                                <p className="text-[11px] text-zinc-500 leading-relaxed">
                                    Estes dados são gravados junto com o cliente ao salvar.
                                </p>
                            )}

                            {carregandoFinanceiro ? (
                                <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Campo label="Valor mensal (R$)">
                                        <input
                                            value={valorTexto}
                                            onChange={e => {
                                                setValorTexto(e.target.value);
                                                setFinanceiro(f => ({ ...f, valorMensalCentavos: textoParaCentavos(e.target.value) }));
                                            }}
                                            placeholder="1.500,00"
                                            inputMode="decimal"
                                            className={inputStyle}
                                        />
                                    </Campo>
                                    <Campo label="Dia do vencimento">
                                        <input
                                            type="number"
                                            min={1}
                                            max={31}
                                            value={financeiro.diaVencimento ?? ''}
                                            onChange={e => setFinanceiro(f => ({
                                                ...f,
                                                diaVencimento: e.target.value ? Number(e.target.value) : null
                                            }))}
                                            placeholder="10"
                                            className={inputStyle}
                                        />
                                    </Campo>
                                    <Campo label="Início do contrato">
                                        <input
                                            type="date"
                                            value={financeiro.inicioContrato ? toDateInputValue(financeiro.inicioContrato) : ''}
                                            onChange={e => setFinanceiro(f => ({ ...f, inicioContrato: fromDateInputValue(e.target.value) }))}
                                            className={`${inputStyle} [color-scheme:dark]`}
                                        />
                                    </Campo>
                                    <Campo label="Escopo contratado" className="sm:col-span-2">
                                        <input
                                            value={financeiro.escopo || ''}
                                            onChange={e => setFinanceiro(f => ({ ...f, escopo: e.target.value }))}
                                            placeholder="4 reels + 8 carrosséis por mês"
                                            className={inputStyle}
                                        />
                                    </Campo>
                                    <Campo label="Observações do contrato" className="sm:col-span-2">
                                        <textarea
                                            rows={3}
                                            value={financeiro.observacoes || ''}
                                            onChange={e => setFinanceiro(f => ({ ...f, observacoes: e.target.value }))}
                                            className={`${inputStyle} resize-none`}
                                        />
                                    </Campo>
                                </div>
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
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 text-sm font-semibold rounded-control bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSalvar}
                            disabled={salvando || !(ficha.nome || '').trim()}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-control bg-[#FABE01] text-black hover:bg-[#FABE01]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {editando ? 'Salvar' : 'Criar cliente'}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default ClientFormModal;
