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
    copy: 'Legenda de exemplo '.repeat(8)
}));

const TASKS = EVENTS.map((e, i) => ({ id: `t${i}`, title: e.title, status: e.status, createdAt: ts(d(-i)), eventId: e.id, type: e.type, plataforma: 'Instagram' }));
const LINKS = Array.from({ length: 5 }, (_, i) => ({ id: `l${i}`, title: `Material ${i + 1} com nome longo`, url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrS/view', category: ['Mídia', 'Contratos', 'Relatórios', 'Outros'][i % 4], createdAt: ts(d(-i)) }));
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

// Subtarefas: um conteudo com progresso parcial, um concluido e um sem nenhuma.
// Sem os tres casos o quadro so exercitava um deles.
const SUBTAREFAS = [
    { id: 's1', eventId: 'ev0', titulo: 'Roteiro do carrossel', status: 'feita', responsavelUid: 'u0', criadoEm: ts(d(-5)) },
    { id: 's2', eventId: 'ev0', titulo: 'Design das 5 lâminas', status: 'fazendo', responsavelUid: 'u3', criadoEm: ts(d(-4)) },
    { id: 's3', eventId: 'ev0', titulo: 'Revisão ortográfica', status: 'aberta', responsavelUid: null, criadoEm: ts(d(-3)) },
    { id: 's4', eventId: 'ev1', titulo: 'Gravar o reel', status: 'feita', responsavelUid: 'u0', criadoEm: ts(d(-2)) },
    { id: 's5', eventId: 'ev1', titulo: 'Editar e legendar', status: 'feita', responsavelUid: 'u0', criadoEm: ts(d(-2)) }
];

const pick = (path: string) => {
    if (path.includes('subtarefas')) return SUBTAREFAS;
    if (path.includes('configuracoes')) return CONFIGURACOES;
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
    const w = (globalThis as any).__writes || ((globalThis as any).__writes = []);
    w.push({ op, path, data: data ? JSON.parse(JSON.stringify(data, (_k, v) => v instanceof Date ? v.toISOString() : v)) : undefined });
};

const makeDoc = (path: string): any => ({
    collection: (name: string) => makeCollection(`${path}/${name}`),
    // `exists` respondia true para QUALQUER caminho, inclusive documento que nao
    // existe. Isso escondia todo codigo que checa duplicata antes de criar: a
    // ficha de cliente novo batia em "ja existe" e nunca chegava a gravar, e a
    // auditoria via o formulario funcionando. Agora confere o id de verdade.
    get: async () => {
        const id = path.split('/').pop();
        const achado = pick(path).find((r: any) => r.id === id);
        return { exists: Boolean(achado), id, data: () => achado || pick(path)[0] || {} };
    },
    onSnapshot: (cb: any, _err?: any) => {
        const id = path.split('/').pop();
        const achado = pick(path).find((r: any) => r.id === id);
        setTimeout(() => cb({ exists: Boolean(achado), id, data: () => achado || {} }), 0);
        return () => {};
    },
    set: async (data: any) => registrar('set', path, data),
    update: async (data: any) => registrar('update', path, data),
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
                    getDownloadURL: async () => `https://exemplo.invalido/${encodeURIComponent(nome)}`,
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

export const db: any = { collection: (name: string) => makeCollection(name), batch: () => ({ update() {}, commit: async () => {} }) };
export const auth: any = {
    currentUser: { uid: 'u0', email: 'pedro.vidal2608@gmail.com', emailVerified: true, reload: async () => {}, getIdToken: async () => 'tok', sendEmailVerification: async () => {}, updateProfile: async () => {} },
    onAuthStateChanged: () => () => {},
    signOut: async () => {}, sendPasswordResetEmail: async () => {}
};
export default { db, auth, storage };
