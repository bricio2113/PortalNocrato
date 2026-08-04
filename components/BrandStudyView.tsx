import React, { useState, useEffect, useRef } from 'react';
import {
    EstudoMarca, Persona, ESTUDO_VAZIO, ARQUETIPOS, personaVazia,
    subscribeEstudo, salvarEstudo, preenchimento
} from '../utils/marca';
import { Card } from './ui';
import {
    Sparkles, Users, Palette, Megaphone, Plus, Trash2, Loader2, Save,
    Check, AlertTriangle, Info
} from 'lucide-react';

interface BrandStudyViewProps {
    empresaId: string;
    autorEmail?: string | null;
    /** Nome de quem edita, so para a mensagem de "salvo por". */
    autorNome?: string | null;
}

const areaStyle = "w-full bg-[#111111] border border-white/10 rounded-control px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-[#FABE01] focus:ring-1 focus:ring-[#FABE01] transition-all resize-y";

/** Campo de texto longo com rotulo e dica. A dica e o que faz o campo ser preenchido. */
const Campo: React.FC<{
    rotulo: string;
    dica: string;
    valor: string;
    onChange: (v: string) => void;
    linhas?: number;
    className?: string;
}> = ({ rotulo, dica, valor, onChange, linhas = 3, className = '' }) => (
    <div className={className}>
        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">{rotulo}</label>
        <textarea
            rows={linhas}
            value={valor}
            onChange={e => onChange(e.target.value)}
            placeholder={dica}
            aria-label={rotulo}
            className={areaStyle}
        />
    </div>
);

const Secao: React.FC<{
    titulo: string;
    icone: React.ElementType;
    descricao: string;
    acao?: React.ReactNode;
    children: React.ReactNode;
}> = ({ titulo, icone: Icone, descricao, acao, children }) => (
    <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-3 mb-4">
            <span className="w-9 h-9 shrink-0 rounded-chip bg-[#FABE01]/10 text-[#FABE01] flex items-center justify-center">
                <Icone className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white tracking-tight">{titulo}</h3>
                <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{descricao}</p>
            </div>
            {acao}
        </div>
        {children}
    </Card>
);

/**
 * ESTUDO DE MARCA - o que direciona a criacao de conteudo.
 *
 * Esta informacao existia em conversa de reuniao, print de WhatsApp e na cabeca de
 * quem atende. Quem entrava na conta depois recomecava do zero: escrevia legenda
 * com o tom errado, prometia o que a marca nao promete, falava com um publico que
 * nao e o dela. Aqui ela vira campo, no mesmo lugar onde o material do cliente
 * mora.
 *
 * CLIENTE E AGENCIA EDITAM OS DOIS. E deliberado, e as regras do Firestore dizem o
 * mesmo (`allow read, write: if isAgency() || belongsTo(empresaId)`): o cliente
 * conhece o publico e a promessa, a agencia sabe traduzir isso em conteudo. Por
 * isso a tela mostra quem alterou por ultimo e AVISA quando a versao do servidor
 * muda com rascunho aberto - com duas mãos no mesmo texto, salvar por cima calado
 * seria apagar o trabalho do outro.
 *
 * SALVAR E EXPLICITO, nao automatico. Gravacao a cada tecla em texto longo produz
 * centenas de escritas por paragrafo e, pior, transmite frase pela metade para a
 * outra pessoa que esta lendo.
 */
const BrandStudyView: React.FC<BrandStudyViewProps> = ({ empresaId, autorEmail, autorNome }) => {
    const [estudo, setEstudo] = useState<EstudoMarca>(ESTUDO_VAZIO);
    const [rascunho, setRascunho] = useState<EstudoMarca>(ESTUDO_VAZIO);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [salvo, setSalvo] = useState(false);
    const [erro, setErro] = useState('');
    /** Mudou no servidor enquanto havia rascunho aberto. */
    const [conflito, setConflito] = useState(false);

    /**
     * Rascunho sujo, lido DENTRO da assinatura.
     *
     * Em estado, a callback capturaria o valor do primeiro render e adotaria a
     * versao remota por cima do que a pessoa esta digitando. Em ref, ela le o valor
     * de agora.
     */
    const sujoRef = useRef(false);

    useEffect(() => {
        if (!empresaId) return;
        setCarregando(true);
        return subscribeEstudo(empresaId, remoto => {
            setEstudo(remoto);
            setCarregando(false);
            if (sujoRef.current) {
                // Nao sobrescreve o que esta sendo digitado; avisa.
                setConflito(true);
                return;
            }
            setRascunho(remoto);
        }, () => {
            setCarregando(false);
            setErro('Não foi possível carregar o estudo de marca.');
        });
    }, [empresaId]);

    const sujo = JSON.stringify({ p: rascunho.personas, t: rascunho.tom, e: rascunho.estrategia })
        !== JSON.stringify({ p: estudo.personas, t: estudo.tom, e: estudo.estrategia });
    sujoRef.current = sujo;

    const mexer = (fn: (r: EstudoMarca) => EstudoMarca) => {
        setSalvo(false);
        setRascunho(fn);
    };
    const setTom = (campo: keyof EstudoMarca['tom'], v: string) =>
        mexer(r => ({ ...r, tom: { ...r.tom, [campo]: v } }));
    const setEstrategia = (campo: keyof EstudoMarca['estrategia'], v: string) =>
        mexer(r => ({ ...r, estrategia: { ...r.estrategia, [campo]: v } }));
    const setPersona = (id: string, campo: keyof Persona, v: string) =>
        mexer(r => ({ ...r, personas: r.personas.map(p => p.id === id ? { ...p, [campo]: v } : p) }));

    const removerPersona = (p: Persona) => {
        const nome = p.nome.trim() || 'esta persona';
        if (!window.confirm(`Remover ${nome} do estudo?`)) return;
        mexer(r => ({ ...r, personas: r.personas.filter(x => x.id !== p.id) }));
    };

    const salvar = async () => {
        setSalvando(true);
        setErro('');
        try {
            await salvarEstudo(empresaId, rascunho, autorEmail);
            setSalvo(true);
            setConflito(false);
        } catch (e) {
            console.error(e);
            setErro('Não foi possível salvar. Confira sua conexão e tente de novo.');
        } finally {
            setSalvando(false);
        }
    };

    const prog = preenchimento(rascunho);

    if (carregando) {
        return <div className="py-16 flex justify-center"><Loader2 className="w-7 h-7 text-[#FABE01] animate-spin" /></div>;
    }

    return (
        <div className="space-y-4 max-w-4xl">
            {/* CABECALHO: o que e, quanto esta preenchido e quem mexeu por ultimo. */}
            <Card className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[#FABE01]" /> Estudo de marca
                        </h2>
                        <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed max-w-xl">
                            O que direciona a criação: para quem se fala, com que voz e o que se promete.
                            <strong className="text-zinc-300"> Cliente e agência editam juntos</strong> — quem
                            conhece o público é o cliente, quem traduz em conteúdo é a agência.
                        </p>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-2xl font-bold text-white leading-none">{prog.pct}%</p>
                        <p className="text-[10px] text-zinc-500 mt-1">
                            {prog.feitos} de {prog.total} preenchidos
                        </p>
                    </div>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-3.5">
                    <div className="h-full bg-[#FABE01] rounded-full transition-all" style={{ width: `${prog.pct}%` }} />
                </div>
                {estudo.atualizadoEm && (
                    <p className="text-[10px] text-zinc-600 mt-2.5">
                        Última alteração em {estudo.atualizadoEm.toLocaleDateString('pt-BR')}
                        {estudo.atualizadoPor ? ` por ${estudo.atualizadoPor}` : ''}.
                    </p>
                )}
            </Card>

            {conflito && (
                <div className="flex items-start gap-2.5 bg-amber-500/[0.07] border border-amber-500/25 rounded-card p-3.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-zinc-300 leading-relaxed">
                        <p className="font-semibold text-amber-300 mb-0.5">Alguém alterou este estudo agora</p>
                        <p>
                            Você tem mudanças não salvas. Salvar vai gravar a SUA versão por cima da outra —
                            confira com a pessoa antes, ou recarregue a página para ver o que mudou.
                        </p>
                    </div>
                </div>
            )}

            {/* PERSONAS */}
            <Secao
                titulo="Personas"
                icone={Users}
                descricao="Para quem se fala. Pode ter mais de uma — cada público decide por motivos diferentes."
                acao={
                    <button
                        onClick={() => mexer(r => ({ ...r, personas: [...r.personas, personaVazia()] }))}
                        className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#FABE01] hover:bg-[#FABE01]/10 px-2.5 py-1.5 rounded-full transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" /> Nova persona
                    </button>
                }
            >
                {rascunho.personas.length === 0 ? (
                    <p className="text-xs text-zinc-500 leading-relaxed py-2">
                        Nenhuma persona ainda. Comece pela que mais compra hoje — nome, o que dói nela e o que
                        ela procura já bastam para orientar uma legenda.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {rascunho.personas.map((p, i) => (
                            <div key={p.id} className="bg-black/25 border border-white/10 rounded-card p-3.5">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="w-6 h-6 shrink-0 rounded-full bg-white/5 text-[10px] font-bold text-zinc-400 flex items-center justify-center">
                                        {i + 1}
                                    </span>
                                    <input
                                        value={p.nome}
                                        onChange={e => setPersona(p.id, 'nome', e.target.value)}
                                        placeholder="Nome da persona. Ex: Ana, 34, mãe e autônoma"
                                        aria-label={`Nome da persona ${i + 1}`}
                                        className="min-w-0 flex-1 bg-transparent border-b border-white/10 focus:border-[#FABE01] px-1 py-1 text-sm font-semibold text-white placeholder:text-zinc-600 outline-none transition-colors"
                                    />
                                    <button
                                        onClick={() => removerPersona(p)}
                                        aria-label={`Remover persona ${i + 1}`}
                                        className="shrink-0 p-1.5 rounded-full text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Campo
                                        rotulo="Como ela é"
                                        dica="Rotina, contexto, o que valoriza."
                                        valor={p.quemE}
                                        onChange={v => setPersona(p.id, 'quemE', v)}
                                    />
                                    <Campo
                                        rotulo="Dores"
                                        dica="O que incomoda hoje e a faz procurar uma solução."
                                        valor={p.dores}
                                        onChange={v => setPersona(p.id, 'dores', v)}
                                    />
                                    <Campo
                                        rotulo="O que procura"
                                        dica="O resultado que ela quer — não o serviço, o resultado."
                                        valor={p.procura}
                                        onChange={v => setPersona(p.id, 'procura', v)}
                                    />
                                    <Campo
                                        rotulo="Objeções"
                                        dica="O que a segura na hora de decidir: preço, medo, tempo."
                                        valor={p.objecoes}
                                        onChange={v => setPersona(p.id, 'objecoes', v)}
                                    />
                                    <Campo
                                        rotulo="Onde ela está"
                                        dica="Redes, grupos, indicação, busca no Google."
                                        valor={p.canais}
                                        onChange={v => setPersona(p.id, 'canais', v)}
                                        linhas={2}
                                        className="sm:col-span-2"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Secao>

            {/* TOM DA MARCA */}
            <Secao
                titulo="Tom da marca"
                icone={Palette}
                descricao="Quem a marca é e como ela aparece — no texto e na imagem."
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Campo
                        rotulo="O que é a marca"
                        dica="Em uma frase: o que ela faz e para quem."
                        valor={rascunho.tom.oQueE}
                        onChange={v => setTom('oQueE', v)}
                        className="sm:col-span-2"
                    />

                    <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1" htmlFor="marca-arquetipo">
                            Arquétipo
                        </label>
                        <select
                            id="marca-arquetipo"
                            value={rascunho.tom.arquetipo}
                            onChange={e => setTom('arquetipo', e.target.value)}
                            className="w-full bg-[#111111] border border-white/10 rounded-control px-3 py-2.5 text-sm text-white outline-none focus:border-[#FABE01]"
                        >
                            <option value="">— não definido —</option>
                            {ARQUETIPOS.map(a => (
                                <option key={a.id} value={a.id}>{a.id} — {a.descricao}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-zinc-600 mt-1 leading-relaxed">
                            Lista fechada: arquétipo serve para a equipe inteira ler do mesmo jeito.
                        </p>
                    </div>
                    <Campo
                        rotulo="Por que esse arquétipo"
                        dica="O rótulo sozinho não orienta ninguém — diga como isso aparece na prática."
                        valor={rascunho.tom.arquetipoPorque}
                        onChange={v => setTom('arquetipoPorque', v)}
                    />

                    <Campo
                        rotulo="Tom de voz"
                        dica="Formal, próximo, técnico, provocativo? Com exemplo de frase, se possível."
                        valor={rascunho.tom.tomDeVoz}
                        onChange={v => setTom('tomDeVoz', v)}
                    />
                    <Campo
                        rotulo="Personalidade"
                        dica="Se a marca fosse uma pessoa, como ela seria?"
                        valor={rascunho.tom.personalidade}
                        onChange={v => setTom('personalidade', v)}
                    />
                    <Campo
                        rotulo="Como quer ser vista — visualmente"
                        dica="Cores, tipografia, tipo de imagem, o que não combina."
                        valor={rascunho.tom.visual}
                        onChange={v => setTom('visual', v)}
                    />
                    <Campo
                        rotulo="Como quer ser vista — textualmente"
                        dica="Tamanho de legenda, uso de emoji, gírias, tratamento (você/vocês)."
                        valor={rascunho.tom.textual}
                        onChange={v => setTom('textual', v)}
                    />
                </div>
            </Secao>

            {/* ESTRATEGIA DE CONTEUDO */}
            <Secao
                titulo="Estratégia de conteúdo"
                icone={Megaphone}
                descricao="Como isso vira post: o que se promete, o que se repete e o que fica de fora."
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Campo
                        rotulo="Como deve ser postado"
                        dica="Frequência, formatos, o que abre e o que fecha cada peça."
                        valor={rascunho.estrategia.comoPostar}
                        onChange={v => setEstrategia('comoPostar', v)}
                        className="sm:col-span-2"
                    />
                    <Campo
                        rotulo="Promessas"
                        dica="O que a marca garante — e o que ela não pode prometer."
                        valor={rascunho.estrategia.promessas}
                        onChange={v => setEstrategia('promessas', v)}
                    />
                    <Campo
                        rotulo="Gatilhos"
                        dica="Prova, urgência, autoridade, pertencimento: quais funcionam aqui."
                        valor={rascunho.estrategia.gatilhos}
                        onChange={v => setEstrategia('gatilhos', v)}
                    />
                    <Campo
                        rotulo="Palavras-chave"
                        dica="Termos que a persona usa, e os que a marca usa por padrão."
                        valor={rascunho.estrategia.palavrasChave}
                        onChange={v => setEstrategia('palavrasChave', v)}
                    />
                    <Campo
                        rotulo="Evitar"
                        dica="Palavras, temas e comparações proibidas. Costuma ser o campo mais útil."
                        valor={rascunho.estrategia.evitar}
                        onChange={v => setEstrategia('evitar', v)}
                    />
                </div>
            </Secao>

            {erro && (
                <p className="text-red-400 text-xs flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {erro}
                </p>
            )}

            {/* BARRA DE SALVAR. Fixa embaixo: o formulario e longo, e um botao no fim
                da pagina obrigaria a rolar tudo para gravar uma frase. */}
            <div className="sticky bottom-0 -mx-1 px-1 pb-1 pt-3 bg-gradient-to-t from-[#111111] via-[#111111] to-transparent">
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={salvar}
                        disabled={!sujo || salvando}
                        className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-control bg-[#FABE01] text-black hover:bg-[#FABE01]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {salvando ? 'Salvando...' : 'Salvar estudo'}
                    </button>
                    {sujo && !salvando && (
                        <span className="text-[11px] text-amber-400/90 font-semibold">Alterações não salvas</span>
                    )}
                    {salvo && !sujo && (
                        <span className="text-emerald-400 text-xs font-medium flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5" /> Estudo salvo
                            {autorNome ? ` por ${autorNome}` : ''}
                        </span>
                    )}
                    <span className="inline-flex items-start gap-1.5 text-[10px] text-zinc-600 leading-relaxed ml-auto max-w-xs">
                        <Info className="w-3 h-3 shrink-0 mt-0.5" />
                        Salvar grava o estudo inteiro. Campo vazio é estado válido — ninguém precisa
                        preencher tudo de uma vez.
                    </span>
                </div>
            </div>
        </div>
    );
};

export default BrandStudyView;
