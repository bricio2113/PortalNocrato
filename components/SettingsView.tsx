import React, { useState, useEffect, useRef } from 'react';
import { CARGOS_PADRAO, subscribeCargos, salvarCargos, normalizarCargo, mesmoCargo } from '../utils/cargos';
import { ADMIN_EMAILS } from '../constants';
import { SLA } from '../utils/sla';
import { TEMPLATE_PASTAS } from '../utils/pastas';
import {
    Briefcase, Plus, X, Save, Loader2, AlertTriangle, Lock, Clock,
    FolderTree, RotateCcw, Check, ShieldCheck, Info
} from 'lucide-react';

interface SettingsViewProps {
    souAdmin: boolean;
    autorEmail?: string | null;
    /** Cargos em uso hoje, por pessoa. Alimenta o aviso de cargo orfao. */
    cargosEmUso: string[];
}

/**
 * Cartao de uma configuracao. O rodape explica ONDE a configuracao mora - a
 * pergunta que faz alguem procurar por dez minutos um botao que nao existe.
 */
const Cartao: React.FC<{
    titulo: string;
    descricao: string;
    icone: React.ElementType;
    editavel?: boolean;
    rodape?: string;
    acao?: React.ReactNode;
    children: React.ReactNode;
}> = ({ titulo, descricao, icone: Icone, editavel = true, rodape, acao, children }) => (
    <section className="bg-[#1A1A1A] border border-white/5 rounded-card overflow-hidden">
        <div className="flex items-start gap-3 p-5 border-b border-white/5">
            <span className={`w-10 h-10 shrink-0 rounded-control flex items-center justify-center ${
                editavel ? 'bg-[#FABE01]/10 text-[#FABE01]' : 'bg-white/5 text-zinc-400'
            }`}>
                <Icone className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-bold tracking-tight">{titulo}</h3>
                    {!editavel && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full">
                            <Lock className="w-2.5 h-2.5" /> definido no código
                        </span>
                    )}
                </div>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{descricao}</p>
            </div>
            {acao && <div className="shrink-0">{acao}</div>}
        </div>

        <div className="p-5">{children}</div>

        {rodape && (
            <p className="px-5 pb-4 -mt-1 text-[11px] text-zinc-600 leading-relaxed flex items-start gap-1.5">
                <Info className="w-3 h-3 shrink-0 mt-0.5" /> {rodape}
            </p>
        )}
    </section>
);

/**
 * CONFIGURACOES GERAIS - o lugar onde o admin mexe no app, e nao nos dados.
 *
 * Antes cada regra do sistema vivia escondida: o cargo era texto livre digitado
 * por quem quisesse, e prazos, administradores e o template de pastas so
 * existiam no codigo, sem nenhuma tela dizendo que existiam. Quem administrava
 * a agencia nao tinha como saber quais eram as regras, quanto mais muda-las.
 *
 * A tela mostra as duas coisas COM A MESMA CARA e marca a diferenca: o que da
 * para editar aqui, e o que e decisao de codigo (com o motivo). Esconder o
 * segundo grupo faria alguem procurar por muito tempo um botao inexistente.
 */
const SettingsView: React.FC<SettingsViewProps> = ({ souAdmin, autorEmail, cargosEmUso }) => {
    const [cargos, setCargos] = useState<string[]>([...CARGOS_PADRAO]);
    const [carregando, setCarregando] = useState(true);
    const [novo, setNovo] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');
    const [salvo, setSalvo] = useState(false);
    /** Lista gravada, para saber se ha alteracao pendente. */
    const [original, setOriginal] = useState<string[]>([...CARGOS_PADRAO]);

    /**
     * Ha rascunho aberto nesta tela.
     *
     * Precisa ser ref, e nao estado: quem le esta bandeira e o callback da
     * assinatura, criado uma vez. Com estado ele leria para sempre o valor do
     * primeiro render - e a tela pararia de receber a mudanca feita por OUTRO
     * administrador, calada, sem nada na tela indicando que esta desatualizada.
     */
    const rascunhoAberto = useRef(false);

    useEffect(() => subscribeCargos(lista => {
        setCarregando(false);
        setOriginal(lista);
        // Com edicao aberta, a lista que chega nao entra: a assinatura dispara
        // depois do proprio save e tambem quando outro admin salva, e nos dois
        // casos sobrescrever apagaria o que esta sendo montado aqui.
        if (!rascunhoAberto.current) setCargos(lista);
    }), []);

    const alterado = sujo(cargos, original);

    const adicionar = () => {
        const limpo = normalizarCargo(novo);
        if (!limpo) return;
        if (cargos.some(c => mesmoCargo(c, limpo))) {
            setErro(`"${limpo}" já está na lista.`);
            return;
        }
        rascunhoAberto.current = true;
        setCargos(prev => [...prev, limpo]);
        setNovo('');
        setErro('');
    };

    const remover = (cargo: string) => {
        rascunhoAberto.current = true;
        setCargos(prev => prev.filter(c => c !== cargo));
        setErro('');
    };

    const descartar = () => {
        rascunhoAberto.current = false;
        setCargos(original);
        setErro('');
    };

    const salvar = async () => {
        setSalvando(true);
        setErro('');
        try {
            await salvarCargos(cargos, autorEmail);
            setOriginal(cargos);
            // Volta a aceitar o que vier da assinatura: nao ha mais nada aqui
            // que se perca.
            rascunhoAberto.current = false;
            setSalvo(true);
            setTimeout(() => setSalvo(false), 2500);
        } catch (e) {
            console.error(e);
            setErro('Não foi possível salvar. Só administradores alteram os cargos.');
        } finally {
            setSalvando(false);
        }
    };

    // CARGO ORFAO: alguem tem um cargo que nao esta mais na lista. Nao apagamos o
    // cargo da pessoa quando o cargo sai da lista - isso perderia informacao sem
    // avisar. A ficha continua exibindo o que esta gravado, e este aviso mostra
    // onde arrumar.
    const orfaos = [...new Set(cargosEmUso.filter(c => c && !cargos.some(l => mesmoCargo(l, c))))];

    return (
        <div className="space-y-4 max-w-4xl animate-in fade-in">
            {!souAdmin && (
                <div className="flex items-start gap-2.5 bg-amber-500/5 border border-amber-500/20 rounded-card p-4">
                    <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-zinc-300 leading-relaxed">
                        Você está vendo as configurações em modo leitura. Só administradores alteram
                        o que vale para a agência inteira.
                    </p>
                </div>
            )}

            <Cartao
                titulo="Cargos"
                icone={Briefcase}
                descricao="A lista que aparece na ficha de cada pessoa. Cargo é escolhido, nunca digitado — texto livre vira “Social Media”, “social midia” e “SM” convivendo, e aí nenhuma contagem por função fecha."
                editavel={souAdmin}
                acao={souAdmin && alterado ? (
                    <button
                        onClick={salvar}
                        disabled={salvando}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full bg-[#FABE01] text-black hover:bg-[#FABE01]/90 transition-colors disabled:opacity-40"
                    >
                        {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Salvar
                    </button>
                ) : salvo ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                        <Check className="w-3.5 h-3.5" /> Salvo
                    </span>
                ) : undefined}
                rodape="Tirar um cargo da lista não apaga o cargo de quem já o tem — o que estiver gravado continua aparecendo na ficha da pessoa."
            >
                {carregando ? (
                    <div className="flex items-center gap-2 text-zinc-500 text-sm py-3">
                        <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap gap-2">
                            {cargos.map(cargo => (
                                <span
                                    key={cargo}
                                    className="group inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-zinc-200 text-sm rounded-full pl-3.5 pr-2 py-1.5"
                                >
                                    {cargo}
                                    {souAdmin && (
                                        <button
                                            onClick={() => remover(cargo)}
                                            aria-label={`Remover cargo ${cargo}`}
                                            className="p-1 -mr-0.5 rounded-full text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </span>
                            ))}
                            {cargos.length === 0 && (
                                <p className="text-xs text-zinc-500 py-1">
                                    Nenhum cargo na lista. Sem pelo menos um, ninguém consegue definir o cargo de ninguém.
                                </p>
                            )}
                        </div>

                        {souAdmin && (
                            <div className="flex gap-2 mt-4">
                                <input
                                    value={novo}
                                    onChange={e => { setNovo(e.target.value); setErro(''); }}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } }}
                                    placeholder="Novo cargo. Ex: Copywriter"
                                    className="min-w-0 flex-1 bg-[#111111] border border-white/10 rounded-control px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all"
                                />
                                <button
                                    onClick={adicionar}
                                    disabled={!normalizarCargo(novo)}
                                    className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-control bg-white/5 text-zinc-200 hover:bg-white/10 transition-colors disabled:opacity-30"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Adicionar
                                </button>
                            </div>
                        )}

                        {erro && (
                            <p className="text-red-400 text-xs mt-3 flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {erro}
                            </p>
                        )}

                        {orfaos.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-white/5">
                                <p className="text-[11px] text-amber-400/90 leading-relaxed">
                                    Fora da lista, mas em uso por alguém: {orfaos.map(o => `“${o}”`).join(', ')}.
                                    Traga de volta à lista ou troque o cargo dessas pessoas na ficha delas.
                                </p>
                            </div>
                        )}

                        {souAdmin && alterado && (
                            <button
                                onClick={descartar}
                                className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 hover:text-white transition-colors"
                            >
                                <RotateCcw className="w-3 h-3" /> Descartar alterações
                            </button>
                        )}
                    </>
                )}
            </Cartao>

            <Cartao
                titulo="Prazos (SLA)"
                icone={Clock}
                descricao="O relógio que decide quando um conteúdo aparece como atrasado, e de quem é a bola."
                editavel={false}
                rodape="Está no código porque cada número é coberto por teste automático — mudar aqui sem os testes acompanharem faria o portal acusar atraso na pessoa errada. Peça a alteração e ela sai numa publicação."
            >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                        { n: SLA.ajusteAgencia, u: 'dias úteis', t: 'Ajuste pela agência', d: 'Contados do pedido do cliente' },
                        { n: SLA.janelaRevisaoImagem, u: 'dia antes', t: 'Revisão de imagem', d: 'Limite para o cliente pedir ajuste' },
                        { n: SLA.janelaRevisaoVideo, u: 'dias antes', t: 'Revisão de vídeo', d: 'Reeditar e renderizar não cabe em um dia' }
                    ].map(item => (
                        <div key={item.t} className="bg-[#111111] border border-white/5 rounded-control p-3.5">
                            <p className="text-2xl font-bold text-white leading-none">
                                {item.n} <span className="text-xs font-medium text-zinc-500">{item.u}</span>
                            </p>
                            <p className="text-xs text-zinc-300 font-medium mt-2">{item.t}</p>
                            <p className="text-[10px] text-zinc-600 mt-0.5 leading-relaxed">{item.d}</p>
                        </div>
                    ))}
                </div>
            </Cartao>

            <Cartao
                titulo="Administradores"
                icone={ShieldCheck}
                descricao="Quem gerencia pessoas, clientes e estas configurações. O resto da equipe é colaborador."
                editavel={false}
                rodape="É uma lista de e-mails no código, e não um campo no banco, de propósito: um campo “é admin” precisaria de uma regra protegendo ele mesmo, e um esquecimento ali deixaria qualquer pessoa se promover. O preço é que incluir alguém exige publicar uma versão."
            >
                <div className="flex flex-wrap gap-2">
                    {ADMIN_EMAILS.map(email => (
                        <span key={email} className="inline-flex items-center gap-2 bg-[#FABE01]/10 border border-[#FABE01]/20 text-[#FABE01] text-xs font-medium rounded-full px-3 py-1.5">
                            <ShieldCheck className="w-3 h-3" /> {email}
                        </span>
                    ))}
                </div>
            </Cartao>

            <Cartao
                titulo="Pastas padrão do cliente"
                icone={FolderTree}
                descricao="As pastas criadas em Arquivos & Materiais quando um cliente novo é aberto."
                editavel={false}
                rodape="Vale para clientes criados de agora em diante; quem já existe mantém as pastas que tem. Novas pastas podem ser criadas à mão dentro de cada cliente."
            >
                <div className="flex flex-wrap gap-2">
                    {TEMPLATE_PASTAS.map(pasta => (
                        <span key={pasta} className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-zinc-300 text-xs rounded-full px-3 py-1.5">
                            <FolderTree className="w-3 h-3 text-zinc-500" /> {pasta}
                        </span>
                    ))}
                </div>
            </Cartao>
        </div>
    );
};

/** Duas listas diferem em conteudo ou ordem. */
function sujo(a: string[], b: string[]) {
    return a.length !== b.length || a.some((v, i) => v !== b[i]);
}

export default SettingsView;
