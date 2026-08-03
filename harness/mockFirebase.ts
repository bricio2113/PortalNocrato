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
    { id: 'h1', eventId: 'ev0', tipo: 'criado', para: 'Carrossel institucional', por: 'maria@x.com', porNome: 'Maria Silva', porPapel: 'agencia', em: ts(d(-6)) },
    { id: 'h2', eventId: 'ev0', tipo: 'status', de: 'Pendente', para: 'Em andamento', por: 'maria@x.com', porNome: 'Maria Silva', porPapel: 'agencia', em: ts(d(-4)) },
    { id: 'h3', eventId: 'ev0', tipo: 'midia', de: '0', para: '3', por: 'maria@x.com', porNome: 'Maria Silva', porPapel: 'agencia', em: ts(d(-3)) },
    { id: 'h4', eventId: 'ev0', tipo: 'data', de: d(-1).toISOString(), para: d(2).toISOString(), por: 'maria@x.com', porNome: 'Maria Silva', porPapel: 'agencia', em: ts(d(-2)) },
    { id: 'h5', eventId: 'ev0', tipo: 'aprovacao', para: 'ajuste_solicitado', por: 'cliente@x.com', porNome: 'João Almeida', porPapel: 'cliente', em: ts(d(-1)) },
    { id: 'h6', eventId: 'ev0', tipo: 'prazo', para: d(3).toISOString(), por: 'maria@x.com', porNome: 'Maria Silva', porPapel: 'agencia', em: ts(d(-1)) },
    { id: 'h7', eventId: 'ev0', tipo: 'aprovacao', para: 'aprovado', por: 'cliente@x.com', porNome: 'João Almeida', porPapel: 'cliente', em: ts(hoje) }
];

const pick = (path: string) => {
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

const makeCollection = (path: string): any => ({
    doc: (id: string) => makeDoc(`${path}/${id}`),
    add: async () => ({ id: 'novo' }),
    where: () => makeCollection(path),
    orderBy: () => makeCollection(path),
    get: async () => snap(pick(path)),
    onSnapshot: (cb: any) => { setTimeout(() => cb(snap(pick(path))), 0); return () => {}; }
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
// Pastas e arquivos falsos, para a tela de materiais ter o que listar.
const PASTAS_MOCK = ['Imagens', 'Vídeos', 'Identidade Visual', 'Contratos e Documentos'];
const ARQUIVOS_MOCK = ['capa-01.jpg', 'capa-02.jpg', 'briefing.pdf', 'reel-bruto.mp4', '.pasta'];
const tipoPorNome = (n: string) =>
    n.endsWith('.pdf') ? 'application/pdf' : n.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg';

export const storage: any = {
    ref: (caminho: string) => ({
        fullPath: caminho,
        listAll: async () => {
            // Raiz de materiais devolve PASTAS; dentro de uma pasta, ARQUIVOS.
            const dentroDePasta = /\/materiais\/[^/]+$/.test(caminho);
            return {
                prefixes: dentroDePasta ? [] : PASTAS_MOCK.map(nome => ({ name: nome, fullPath: `${caminho}/${nome}` })),
                items: dentroDePasta ? ARQUIVOS_MOCK.map(nome => ({
                    name: nome,
                    fullPath: `${caminho}/${nome}`,
                    getDownloadURL: async () => `https://exemplo.invalido/${encodeURIComponent(nome)}`,
                    getMetadata: async () => ({ size: 1024 * 420, contentType: tipoPorNome(nome) }),
                    delete: async () => registrar('delete-storage', `${caminho}/${nome}`)
                })) : []
            };
        },
        put: (arquivo: any) => {
            registrar('upload', caminho, { contentType: arquivo?.type, size: arquivo?.size });
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
        delete: async () => registrar('delete-storage', caminho),
        getDownloadURL: async () => `https://exemplo.invalido/${encodeURIComponent(caminho)}`
    })
};

export const db: any = { collection: (name: string) => makeCollection(name), batch: () => ({ update() {}, commit: async () => {} }) };
export const auth: any = {
    currentUser: { uid: 'u0', email: 'pedro.vidal2608@gmail.com', emailVerified: true, reload: async () => {}, getIdToken: async () => 'tok', sendEmailVerification: async () => {}, updateProfile: async () => {} },
    onAuthStateChanged: () => () => {},
    signOut: async () => {}, sendPasswordResetEmail: async () => {}
};
export default { db, auth, storage };
