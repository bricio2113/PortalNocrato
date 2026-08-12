// Firebase falso para o harness visual. Nao entra no bundle da aplicacao:
// o vite.harness.config.ts troca ../utils/firebase por este arquivo apenas
// quando o harness e construido.
const hoje = new Date();
const d = (offset: number) => new Date(hoje.getFullYear(), hoje.getMonth(), Math.max(1, hoje.getDate() + offset));
// O codigo do app chama .toDate() nos campos de data, porque no Firestore real
// eles sao Timestamp. O mock precisa devolver o mesmo formato.
const ts = (date: Date) => ({ toDate: () => date });
const withHora = (date: Date, hora: number | null) => {
    if (hora === null) return date;
    const out = new Date(date);
    out.setHours(hora, hora % 2 ? 30 : 0, 0, 0);
    return out;
};

const EVENTS = Array.from({ length: 14 }, (_, i) => ({
    id: `ev${i}`,
    title: i % 3 === 0
        ? 'Carrossel institucional com um título bem comprido para testar quebra de linha'
        : `Publicação ${i + 1}`,
    // Hora definida em parte dos posts e ausente em outros: 00:00 e tratado
    // como "sem hora" e os dois caminhos precisam ser medidos.
    date: ts(withHora(d(i - 6), i % 3 === 0 ? null : 9 + (i % 10))),
    // Prazos espalhados: vencido, hoje, proximo, folgado e ausente.
    prazoProducao: i % 5 === 4 ? undefined : ts(d(i - 6 - (i % 5 === 0 ? 4 : i % 5))),
    type: ['Post', 'Reel', 'Story', 'Carrossel', 'Tráfego'][i % 5],
    status: ['Pendente', 'Concluído', 'Postado', 'Editado', 'Agendado'][i % 5],
    plataforma: 'Instagram',
    approval: i % 4 === 0 ? 'ajuste_solicitado' : undefined,
    approvalByName: 'Maria Silva',
    url: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrS',
    // Parte dos posts com capa e parte sem, de proposito: os dois caminhos do
    // card precisam ser medidos. Sem isto a grade so era exercitada no estado
    // "sem imagem" e a faixa de capa nunca aparecia na auditoria.
    // (Offline a imagem nao carrega e o onError a esconde; o que se valida
    // aqui e a altura e o espacamento que a faixa ocupa, nao o arquivo.)
    coverUrl: i % 2 === 0 ? `https://exemplo.invalido/capa-${i}.jpg` : undefined,
    // Parte com responsavel e parte SEM: o quadro precisa mostrar tanto a pilha
    // de rostos quanto o circulo tracejado de "ninguem atribuido".
    responsaveis: i % 3 === 0 ? ['u0', 'u3'] : i % 3 === 1 ? ['u0'] : undefined,
    // MIDIA NO DOCUMENTO, nao so na prop da tela.
    //
    // O documento do evento e onde a lista mora - e desde que a ordem do carrossel
    // passou a ser gravada na hora, e dele que a tela le. Enquanto o mock nao tinha
    // o campo, a tela de teste passava as pecas por prop e o documento dizia "sem
    // midia": incoerencia que so apareceu quando a leitura mudou de lugar.
    midias: i === 0 ? [
        { url: 'https://exemplo.invalido/peca-1.jpg', path: 'p1', contentType: 'image/jpeg', bytes: 1000 },
        { url: 'https://exemplo.invalido/peca-2.jpg', path: 'p2', contentType: 'image/jpeg', bytes: 1000 },
        { url: 'https://exemplo.invalido/peca-3.mp4', path: 'p3', contentType: 'video/mp4', bytes: 5000 }
    ] : undefined,
    pastaMidia: i === 0 ? ['Imagens', '2026', 'Estatico Captacao'] : undefined,
    // ev0 e o post de teste A/B: duas versoes secundarias, uma com metrica melhor
    // que a principal. Sem metrica nas duas, a comparacao nunca seria exercitada.
    variantes: i === 0 ? [
        {
            id: 'vb', rotulo: 'B', copy: 'Legenda da versão B, mais direta.',
            midias: [{ url: 'https://exemplo.invalido/b1.jpg', path: 'pb1', contentType: 'image/jpeg', bytes: 1000 }],
            pastaMidia: ['Imagens'], metrics: { alcance: 9000, interacoes: 780 }
        },
        { id: 'vc', rotulo: 'C', copy: '', midias: [], pastaMidia: null }
    ] : undefined,
    metrics: i === 0 ? { alcance: 12000, interacoes: 300 } : undefined,
    copy: 'Legenda de exemplo '.repeat(8)
}));

const TASKS = EVENTS.map((e, i) => ({ id: `t${i}`, title: e.title, status: e.status, createdAt: ts(d(-i)), eventId: e.id, type: e.type, plataforma: 'Instagram' }));
// Atalhos do Drive. Dois SEM `caminho` - o cadastro antigo, que tem que continuar
// aparecendo na raiz - e dois DENTRO de pastas, que e o formato novo. Sem os dois
// casos, a compatibilidade com o dado velho nao seria exercitada.
const LINKS = [
    { id: 'l0', title: 'Material antigo sem pasta', url: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrS', category: 'Mídia', createdAt: ts(d(-9)) },
    { id: 'l1', title: 'Contrato assinado (link)', url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrS/view', category: 'Contratos', createdAt: ts(d(-8)) },
    { id: 'l2', title: 'Captação Agosto (bruto)', url: 'https://drive.google.com/drive/folders/2BcDeFgHiJkLmNoPqRsT', caminho: ['Imagens'], createdAt: ts(d(-3)) },
    { id: 'l3', title: 'Ensaio na clínica (bruto)', url: 'https://drive.google.com/drive/folders/3CdEfGhIjKlMnOpQrStU', caminho: ['Imagens', '2026'], createdAt: ts(d(-2)) }
];
const WEEKLY = Array.from({ length: 6 }, (_, i) => ({ id: `w${i}`, text: `Tarefa da semana ${i + 1} com texto razoavelmente longo`, completed: i % 3 === 0 }));
// u0 e o proprio admin logado e u3 e o outro admin: os dois precisam aparecer
// com selo "Admin" enquanto o resto da equipe aparece como "Colaborador".
const ADMIN_MOCK = ['pedro.vidal2608@gmail.com', 'briciomarketing@gmail.com'];
const USERS = Array.from({ length: 8 }, (_, i) => ({
    id: `u${i}`,
    email: i === 0 ? ADMIN_MOCK[0] : i === 3 ? ADMIN_MOCK[1] : `usuario.numero${i}@umdominiobemlongo.com.br`,
    role: i % 3 === 0 ? 'agencia' : 'cliente',
    // u2 e cliente SEM empresa de proposito: e a fila "aguardando vinculo", que
    // sem este caso nunca era renderizada na auditoria.
    empresaId: i % 3 === 0 ? null : i === 2 ? null : (i % 4 === 1 ? 'empresa-que-nao-existe' : 'Agencia Mara'),
    nome: ['Maria', 'João', 'Ana', 'Carlos'][i % 4], sobrenome: ['Silva', 'Almeida', 'Nogueira', 'Teixeira'][i % 4],
    // Parte com cargo e parte sem: a etiqueta nao pode quebrar o card ausente.
    cargo: i % 3 === 0 ? ['Social Media', 'Designer', 'Tráfego'][i % 3] : undefined
}));
// Ficha completa, e uma empresa DELIBERADAMENTE sem @ nem segmento: o card
// precisa aguentar o cliente antigo que so tem nome.
const EMPRESAS = [
    { id: 'Agencia Mara', nome: 'Agencia Mara', handle: 'agenciamara', segmento: 'Marketing', status: 'ativo', whatsapp: '(13) 99999-9999', email: 'contato@mara.com', cidade: 'Santos / SP', origem: 'Indicação' },
    { id: 'Dra.SylviaFisio', nome: 'Dra. Sylvia Fisio', handle: 'drasylviafisio', segmento: 'Saúde e bem-estar', status: 'ativo' },
    { id: 'MarcioFisio', nome: 'Marcio Fisio', handle: 'marciofisio', segmento: 'Saúde e bem-estar', status: 'pausado' },
    { id: 'Agencia Nocrato', nome: 'Agencia Nocrato' }
];
const RELATORIOS = [{ id: '2026-06', ano: 2026, mes: 6, resumo: 'Leitura do mês '.repeat(20), destaques: 'Reel bateu recorde\nCarrossel puxou salvamentos', alcance: 128400, interacoes: 9120, seguidores: 340, publicados: 18, criadoPor: 'Maria Silva', criadoEm: ts(hoje), atualizadoEm: ts(hoje) }];

const snap = (rows: any[]) => ({
    empty: rows.length === 0,
    size: rows.length,
    docs: rows.map(r => ({ id: r.id, exists: true, data: () => ({ ...r, toDate: undefined }), ref: { update: async () => {}, delete: async () => {} } }))
});

// Historico de exemplo: um de cada tipo, para a linha do tempo mostrar todas as
// frases e nao so a mais comum.
const HISTORICO = [
    { id: 'h1', eventId: 'ev0', tipo: 'criado', para: 'Carrossel institucional', por: 'pedro.vidal2608@gmail.com', porNome: 'Maria Silva', porPapel: 'agencia', em: ts(d(-6)) },
    { id: 'h2', eventId: 'ev0', tipo: 'status', de: 'Pendente', para: 'Em andamento', por: 'pedro.vidal2608@gmail.com', porNome: 'Maria Silva', porPapel: 'agencia', em: ts(d(-4)) },
    { id: 'h3', eventId: 'ev0', tipo: 'midia', de: '0', para: '3', por: 'pedro.vidal2608@gmail.com', porNome: 'Maria Silva', porPapel: 'agencia', em: ts(d(-3)) },
    { id: 'h4', eventId: 'ev0', tipo: 'data', de: d(-1).toISOString(), para: d(2).toISOString(), por: 'pedro.vidal2608@gmail.com', porNome: 'Maria Silva', porPapel: 'agencia', em: ts(d(-2)) },
    { id: 'h5', eventId: 'ev0', tipo: 'aprovacao', para: 'ajuste_solicitado', por: 'usuario.numero1@umdominiobemlongo.com.br', porNome: 'João Almeida', porPapel: 'cliente', em: ts(d(-1)) },
    { id: 'h6', eventId: 'ev0', tipo: 'prazo', para: d(3).toISOString(), por: 'pedro.vidal2608@gmail.com', porNome: 'Maria Silva', porPapel: 'agencia', em: ts(d(-1)) },
    { id: 'h7', eventId: 'ev0', tipo: 'aprovacao', para: 'aprovado', por: 'usuario.numero1@umdominiobemlongo.com.br', porNome: 'João Almeida', porPapel: 'cliente', em: ts(hoje) }
];

// Ficha financeira de exemplo. Precisa vir ANTES de 'usuarios' no pick: o
// caminho e usuarios/{uid}/_financeiro/dados, e a regra de 'usuarios' casaria
// primeiro - a ficha abriria sempre vazia e o modo de leitura nunca apareceria
// na auditoria.
const FINANCEIRO = [{
    id: 'dados', valorMensalCentavos: 250000, diaVencimento: 5,
    inicioContrato: ts(new Date(hoje.getFullYear(), 3, 1)), escopo: '20h/semana, edição de reels e carrosséis',
    observacoes: 'Pagamento por Pix.\nRevisar valor em janeiro.',
    atualizadoEm: ts(d(-2)), atualizadoPor: 'pedro.vidal2608@gmail.com'
}];

// Lista de cargos gravada. A tela precisa exercitar o caminho "ja existe
// documento"; o caminho "nao existe, usa o padrao" e o do doc `cargos-vazio`.
const CONFIGURACOES = [{
    id: 'cargos',
    lista: ['Gestor de Tráfego', 'Designer', 'Social Mídia', 'Editor', 'Dev', 'Administrador', 'Financeiro', 'Vendedor'],
    atualizadoEm: ts(d(-1)), atualizadoPor: 'pedro.vidal2608@gmail.com'
}];

// Estudo de marca: PARCIALMENTE preenchido de proposito. Com tudo escrito, o
// estado "campo em branco" - que e o inicial de todo cliente - nao apareceria; com
// nada, a tela nunca mostraria texto de verdade nem o percentual avancando.
const MARCA = [{
    id: 'estudo',
    personas: [
        {
            id: 'p1', nome: 'Ana, 34, mãe e autônoma',
            quemE: 'Rotina apertada, resolve tudo pelo celular à noite.',
            dores: 'Dor lombar depois do dia inteiro sentada. Já tentou pilates e parou.',
            procura: 'Voltar a dormir sem dor, sem depender de remédio.',
            objecoes: 'Preço e horário: não consegue sair no meio da tarde.',
            canais: 'Instagram e indicação de amigas.'
        },
        {
            id: 'p2', nome: 'Roberto, 58, aposentado',
            quemE: 'Caminha todo dia, tem plano de saúde.',
            dores: 'Perdeu mobilidade no ombro depois de uma queda.',
            procura: '', objecoes: '', canais: ''
        }
    ],
    tom: {
        oQueE: 'Clínica de fisioterapia focada em dor crônica, com atendimento individual.',
        arquetipo: 'Cuidador',
        arquetipoPorque: 'A marca acolhe quem já tentou de tudo e desistiu.',
        tomDeVoz: 'Próximo e direto, sem jargão clínico. "Você" no singular.',
        personalidade: '', visual: '', textual: ''
    },
    estrategia: {
        comoPostar: '3 posts por semana: 1 educativo, 1 prova, 1 convite.',
        promessas: 'Avaliação sem compromisso. Nunca prometer cura.',
        gatilhos: '', palavrasChave: '', evitar: 'Comparação com outras clínicas e antes/depois de corpo.'
    },
    atualizadoEm: ts(d(-2)), atualizadoPor: 'usuario.numero1@umdominiobemlongo.com.br'
}];

// Subtarefas: um conteudo com progresso parcial, um concluido e um sem nenhuma.
// Sem os tres casos o quadro so exercitava um deles.
const SUBTAREFAS = [
    // Prazos espalhados de proposito: vencida, hoje, futura e SEM prazo. Sem os
    // quatro casos a tela de tarefas so exercitaria um deles, e "sem prazo" e
    // justamente o estado que a interface tem que mostrar sem inventar data.
    { id: 's1', eventId: 'ev0', titulo: 'Roteiro do carrossel', status: 'feita', responsavelUid: 'u0', prazo: ts(d(-4)), criadoEm: ts(d(-5)) },
    { id: 's2', eventId: 'ev0', titulo: 'Design das 5 lâminas', status: 'fazendo', responsavelUid: 'u3', prazo: ts(d(-1)), criadoEm: ts(d(-4)) },
    { id: 's3', eventId: 'ev0', titulo: 'Revisão ortográfica', status: 'aberta', responsavelUid: null, prazo: ts(hoje), criadoEm: ts(d(-3)) },
    { id: 's4', eventId: 'ev0', titulo: 'Agendar no Meta', status: 'aberta', responsavelUid: 'u0', prazo: ts(d(3)), criadoEm: ts(d(-2)) },
    { id: 's5', eventId: 'ev1', titulo: 'Gravar depoimento', status: 'aberta', responsavelUid: 'u3', criadoEm: ts(d(-1)) },
    { id: 's6', eventId: 'ev1', titulo: 'Edição do reel', status: 'fazendo', responsavelUid: 'u0', prazo: ts(d(1)), criadoEm: ts(d(-1)) }
];

const pick = (path: string) => {
    if (path.includes('subtarefas')) return SUBTAREFAS;
    if (path.includes('configuracoes')) return CONFIGURACOES;
    // Antes de 'empresas': o caminho e empresas/{id}/marca/estudo e a regra de
    // empresas casaria primeiro, devolvendo a lista de clientes como se fosse o
    // estudo.
    if (path.includes('/marca')) return MARCA;
    // u1 fica DELIBERADAMENTE sem ficha financeira: e o caso "nada cadastrado",
    // onde a ficha mostra os valores padrao com a etiqueta. Sem um uid sem dados,
    // esse caminho nunca aparecia na auditoria - e ele e a metade que da errado.
    if (path.includes('_financeiro')) return path.includes('/u1/') ? [] : FINANCEIRO;
    if (path.includes('historico')) return HISTORICO;
    if (path.includes('covers')) return [];
    if (path.includes('kanban_tasks')) return TASKS;
    if (path.includes('drive_links')) return LINKS;
    if (path.includes('post_comments')) return [{ id: 'c1', eventId: 'ev0', authorEmail: 'maria@x.com', authorName: 'Maria Silva', authorRole: 'agencia', text: 'Comentário de exemplo com um texto mais longo para ver a quebra.', createdAt: { toDate: () => hoje } }];
    if (path.includes('relatorios')) return RELATORIOS;
    if (path.includes('events')) return EVENTS;
    if (path.includes('tasks')) return WEEKLY;
    if (path.includes('usuarios')) return USERS;
    if (path.includes('empresas')) return EMPRESAS;
    return [];
};

/**
 * `where` FILTRA DE VERDADE (igualdade e `in`).
 *
 * Antes era `where: () => makeCollection(path)` - devolvia a colecao inteira. Uma
 * consulta filtrada mostrava na tela linhas que a consulta real nao traria, e o
 * caminho "nao achou nada" nunca era exercitado: a auditoria via lista cheia em
 * todo lugar e aprovava telas que em producao vem vazias.
 */
const aplicarFiltros = (rows: any[], filtros: [string, string, any][]) =>
    filtros.reduce((atual, [campo, op, valor]) => atual.filter(r => {
        if (op === 'in') return Array.isArray(valor) && valor.includes(r[campo]);
        if (op === '!=') return r[campo] !== valor;
        return r[campo] === valor;
    }), rows);

const makeCollection = (path: string, filtros: [string, string, any][] = []): any => ({
    doc: (id: string) => makeDoc(`${path}/${id}`),
    add: async (data: any) => { registrar('add', path, data); return { id: 'novo' }; },
    where: (campo: string, op: string, valor: any) => makeCollection(path, [...filtros, [campo, op, valor]]),
    orderBy: () => makeCollection(path, filtros),
    limit: (n: number) => makeCollection(path, [...filtros, ['__limite', 'limit', n]]),
    get: async () => snap(aplicarFiltros(pick(path), filtros.filter(f => f[1] !== 'limit'))),
    onSnapshot: (cb: any) => {
        setTimeout(() => cb(snap(aplicarFiltros(pick(path), filtros.filter(f => f[1] !== 'limit')))), 0);
        return () => {};
    }
});
// Registro das escritas, para a auditoria PROVAR que uma interacao gravou em
// vez de apenas nao ter dado erro. Foi o que faltava para verificar o arraste do
// calendario: sem isto, "nenhum erro no console" era todo o teste.
const registrar = (op: string, path: string, data?: any) => {
    if (data !== undefined) recusarUndefined(op, path, data);
    const w = (globalThis as any).__writes || ((globalThis as any).__writes = []);
    w.push({ op, path, data: data ? JSON.parse(JSON.stringify(data, (_k, v) => v instanceof Date ? v.toISOString() : v)) : undefined });
};

/**
 * Recusa `undefined` como o Firestore recusa - em QUALQUER profundidade.
 *
 * O mock aceitava tudo, e uma gravacao com `undefined` passava por todas as
 * verificacoes aqui para falhar em producao com "Unsupported field value:
 * undefined". O caso que motivou: o teste A/B guarda a variante DENTRO de um array,
 * onde o `stripUndefined` do projeto (um nivel so) nao alcanca, e `previewUrl` e
 * `metrics` faltam na maioria dos posts - ou seja, o caminho comum.
 *
 * Fica dentro do `registrar` porque toda escrita passa por ele. E nem no `__writes`
 * dava para ver o problema: `JSON.stringify` apaga a chave com undefined.
 */
const recusarUndefined = (op: string, path: string, valor: any, onde = ''): void => {
    if (valor === undefined) {
        throw new Error(`${op} em ${path}: "${onde || 'raiz'}" veio undefined — o Firestore recusa`);
    }
    if (Array.isArray(valor)) {
        valor.forEach((v, i) => recusarUndefined(op, path, v, `${onde}[${i}]`));
        return;
    }
    // Date e Timestamp sao valores, nao mapas para percorrer.
    if (valor && typeof valor === 'object' && !(valor instanceof Date) && typeof valor.toDate !== 'function') {
        Object.keys(valor).forEach(k => recusarUndefined(op, path, valor[k], onde ? `${onde}.${k}` : k));
    }
};

/**
 * Escritas feitas na sessao, por caminho de documento.
 *
 * O mock nao tinha memoria: `update` registrava a chamada e a leitura seguinte
 * devolvia o dado original. Isso bastava para provar "gravou no caminho certo" e era
 * incapaz de provar QUALQUER comportamento ao vivo - a interface que reage a
 * propria escrita parecia funcionar tanto certa quanto errada. Com o sobreposto e
 * os ouvintes abaixo, o clique que grava e o listener que recebe passam a ser
 * verificaveis.
 */
const sobreposto = new Map<string, any>();
const ouvintesDoc = new Map<string, Set<(dados: any) => void>>();

const baseDoDoc = (path: string) => {
    const id = path.split('/').pop();
    return pick(path).find((r: any) => r.id === id);
};

const dadosDoDoc = (path: string) => {
    const base = baseDoDoc(path);
    const extra = sobreposto.get(path);
    if (!base && !extra) return undefined;
    return { ...(base || {}), ...(extra || {}) };
};

const notificar = (path: string) => {
    const dados = dadosDoDoc(path);
    ouvintesDoc.get(path)?.forEach(cb =>
        cb({ exists: dados !== undefined, id: path.split('/').pop(), data: () => dados || {} })
    );
};

const makeDoc = (path: string): any => ({
    collection: (name: string) => makeCollection(`${path}/${name}`),
    // `exists` respondia true para QUALQUER caminho, inclusive documento que nao
    // existe. Isso escondia todo codigo que checa duplicata antes de criar: a
    // ficha de cliente novo batia em "ja existe" e nunca chegava a gravar, e a
    // auditoria via o formulario funcionando. Agora confere o id de verdade.
    get: async () => {
        const dados = dadosDoDoc(path);
        return {
            exists: dados !== undefined,
            id: path.split('/').pop(),
            data: () => dados || pick(path)[0] || {}
        };
    },
    onSnapshot: (cb: any, _err?: any) => {
        if (!ouvintesDoc.has(path)) ouvintesDoc.set(path, new Set());
        ouvintesDoc.get(path)!.add(cb);
        const dados = dadosDoDoc(path);
        setTimeout(() => cb({ exists: dados !== undefined, id: path.split('/').pop(), data: () => dados || {} }), 0);
        return () => { ouvintesDoc.get(path)?.delete(cb); };
    },
    // Guarda e NOTIFICA, como o SDK de verdade faz pelo cache local antes de a
    // escrita chegar ao servidor.
    set: async (data: any) => {
        registrar('set', path, data);
        sobreposto.set(path, { ...(sobreposto.get(path) || {}), ...data });
        notificar(path);
    },
    update: async (data: any) => {
        registrar('update', path, data);
        sobreposto.set(path, { ...(sobreposto.get(path) || {}), ...data });
        notificar(path);
    },
    delete: async () => registrar('delete', path)
});

/**
 * Cloud Storage falso.
 *
 * Registra a subida em __writes junto das escritas do Firestore, para a auditoria
 * conseguir provar que um upload chamou o caminho certo - e devolve uma URL
 * https plausivel, porque isSafeImageSrc recusa qualquer coisa que nao seja
 * https ou data URI de imagem.
 */
/**
 * ARVORE de materiais falsa.
 *
 * Era um par de listas com uma regex decidindo "raiz devolve pastas, dentro de
 * pasta devolve arquivos". Isso so descrevia o modelo de UM NIVEL: numa arvore,
 * qualquer nivel pode ter pasta E arquivo, e a navegacao de dois niveis para
 * baixo nao tinha o que devolver - a auditoria via a tela funcionando por acidente
 * porque nunca descia. Agora e uma arvore de verdade, entao migalha, subpasta e
 * exclusao recursiva sao exercitados.
 */
type NoArvore = { [nome: string]: NoArvore | null };

const ARVORE_MATERIAIS: NoArvore = {
    'Imagens': {
        '.pasta': null,
        'capa-01.jpg': null,
        'capa-02.jpg': null,
        '2026': {
            '.pasta': null,
            'Agosto': {
                '.pasta': null,
                'post-01.jpg': null,
                'post-02.jpg': null,
                'Selecionadas': { '.pasta': null, 'final.jpg': null }
            },
            'Setembro': { '.pasta': null }
        }
    },
    'Vídeos': { '.pasta': null, 'reel-bruto.mp4': null },
    'Identidade Visual': { '.pasta': null, 'manual-marca.pdf': null },
    'Contratos e Documentos': { '.pasta': null }
};

const tipoPorNome = (n: string) =>
    n.endsWith('.pdf') ? 'application/pdf' : n.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg';

/**
 * URL de arquivo de material.
 *
 * IMAGEM VIRA DATA URI, com o nome escrito dentro. Antes toda URL apontava para um
 * host inexistente: as miniaturas falhavam, e o estado "carregou" simplesmente nao
 * existia no harness - foi por isso que a peca presa em "nao foi possivel carregar"
 * passou pela auditoria. Com data URI a imagem aparece de verdade, offline, e da
 * para verificar que o visualizador mostra o arquivo CERTO.
 *
 * Video e documento continuam apontando para fora: nao ha como servir um mp4 aqui,
 * e o que precisa ser verificado neles e o elemento (<video controls>), nao o
 * quadro.
 */
const urlDoArquivo = (nome: string) => {
    if (tipoPorNome(nome) !== 'image/jpeg') return `https://exemplo.invalido/${encodeURIComponent(nome)}`;
    const rotulo = nome.replace(/\.[^.]+$/, '').slice(0, 14);
    return `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">`
        + `<rect width="240" height="240" fill="#2A2A2A"/>`
        + `<text x="120" y="128" font-family="sans-serif" font-size="16" fill="#FABE01" text-anchor="middle">${rotulo}</text>`
        + `</svg>`
    )}`;
};

/** Segmentos depois de `materiais/`, ou null se o caminho nao for de materiais. */
const segmentosDeMateriais = (caminho: string): string[] | null => {
    const marca = '/materiais';
    const i = caminho.indexOf(marca);
    if (i === -1) return null;
    const resto = caminho.slice(i + marca.length).replace(/^\/+/, '');
    return resto ? resto.split('/') : [];
};

/** Desce a arvore pelo caminho depois de `materiais/`. Null = nao existe. */
const noDoCaminho = (caminho: string): NoArvore | null => {
    const segs = segmentosDeMateriais(caminho);
    if (!segs) return null;
    let no: NoArvore | null = ARVORE_MATERIAIS;
    for (const seg of segs) {
        if (!no || typeof no[seg] === 'undefined' || no[seg] === null) return null;
        no = no[seg] as NoArvore;
    }
    return no;
};

/**
 * Insere o objeto na arvore, criando os pais que faltarem.
 *
 * O `put` so registrava a subida em __writes. Isso provava que a chamada
 * aconteceu com o caminho certo, e nada mais: no Storage de verdade o objeto passa
 * a APARECER no listAll, e era exatamente isso que precisava ser verificado - a
 * midia enviada pelo modal de conteudo tem que aparecer na tela de pastas. Sem
 * inserir, a auditoria nunca conseguiria distinguir "gravou na pasta certa" de
 * "gravou em lugar nenhum".
 *
 * Vale tambem para `criarPasta`, que sobe o marcador `.pasta`: criar pasta no
 * seletor agora faz a pasta existir na listagem seguinte, como no bucket.
 */
const removerDaArvore = (caminho: string) => {
    const segs = segmentosDeMateriais(caminho);
    if (!segs || segs.length === 0) return;
    const pai = noDoCaminho(caminho.split('/').slice(0, -1).join('/'));
    if (pai) delete pai[segs[segs.length - 1]];
};

const inserirNaArvore = (caminho: string) => {
    const segs = segmentosDeMateriais(caminho);
    if (!segs || segs.length === 0) return;
    let no = ARVORE_MATERIAIS;
    for (const pasta of segs.slice(0, -1)) {
        if (!no[pasta] || no[pasta] === null) no[pasta] = { '.pasta': null };
        no = no[pasta] as NoArvore;
    }
    no[segs[segs.length - 1]] = null;
};

export const storage: any = {
    ref: (caminho: string) => ({
        fullPath: caminho,
        listAll: async () => {
            const no = noDoCaminho(caminho);
            if (!no) return { prefixes: [], items: [] };
            const nomes = Object.keys(no);
            return {
                prefixes: nomes.filter(n => no[n] !== null).map(nome => ({ name: nome, fullPath: `${caminho}/${nome}` })),
                items: nomes.filter(n => no[n] === null).map(nome => ({
                    name: nome,
                    fullPath: `${caminho}/${nome}`,
                    getDownloadURL: async () => urlDoArquivo(nome),
                    getMetadata: async () => ({ size: 1024 * 420, contentType: tipoPorNome(nome) }),
                    delete: async () => {
                        registrar('delete-storage', `${caminho}/${nome}`);
                        removerDaArvore(`${caminho}/${nome}`);
                    }
                }))
            };
        },
        put: (arquivo: any) => {
            registrar('upload', caminho, { contentType: arquivo?.type, size: arquivo?.size });
            inserirNaArvore(caminho);
            const task: any = {
                on: (_ev: string, prog: any, _err: any, done: any) => {
                    prog?.({ bytesTransferred: arquivo?.size || 0, totalBytes: arquivo?.size || 1 });
                    setTimeout(() => done?.(), 0);
                },
                snapshot: { ref: { getDownloadURL: async () => `https://exemplo.invalido/${encodeURIComponent(caminho)}` } },
                then: (fn: any) => Promise.resolve(task.snapshot).then(fn)
            };
            return task;
        },
        delete: async () => { registrar('delete-storage', caminho); removerDaArvore(caminho); },
        getDownloadURL: async () => `https://exemplo.invalido/${encodeURIComponent(caminho)}`
    })
};

// Arvore exposta para a auditoria conferir o bucket depois da interacao, em vez
// de so contar chamadas.
(globalThis as any).__arvore = ARVORE_MATERIAIS;

/**
 * Criacao de conta falsa.
 *
 * O util de verdade abre uma SEGUNDA instancia do Firebase para nao derrubar a
 * sessao de quem esta logado. Aqui isso nao pode acontecer: `initializeApp` com a
 * config real faria o harness falar com o projeto de producao - criando usuario de
 * teste no Auth de verdade. Por isso a funcao e trocada junto do resto do modulo, e
 * a auditoria consegue verificar o cadastro sem sair da maquina.
 */
export async function criarContaSemTrocarSessao(email: string, _senha: string): Promise<string> {
    registrar('criar-conta', `auth/${email}`, { verificacaoEnviada: true });
    return `uid-${email.replace(/[^a-z0-9]/gi, '-')}`;
}

export const db: any = { collection: (name: string) => makeCollection(name), batch: () => ({ update() {}, commit: async () => {} }) };
export const auth: any = {
    currentUser: { uid: 'u0', email: 'pedro.vidal2608@gmail.com', emailVerified: true, reload: async () => {}, getIdToken: async () => 'tok', sendEmailVerification: async () => {}, updateProfile: async () => {} },
    onAuthStateChanged: () => () => {},
    signOut: async () => {},
    sendPasswordResetEmail: async (email: string) => registrar('reset-senha', `auth/${email}`)
};
export default { db, auth, storage };
