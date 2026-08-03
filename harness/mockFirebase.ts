// Firebase falso para o harness visual. Nao entra no bundle da aplicacao:
// o vite.harness.config.ts troca ../utils/firebase por este arquivo apenas
// quando o harness e construido.
const hoje = new Date();
const d = (offset: number) => new Date(hoje.getFullYear(), hoje.getMonth(), Math.max(1, hoje.getDate() + offset));
// O codigo do app chama .toDate() nos campos de data, porque no Firestore real
// eles sao Timestamp. O mock precisa devolver o mesmo formato.
const ts = (date: Date) => ({ toDate: () => date });

const EVENTS = Array.from({ length: 14 }, (_, i) => ({
    id: `ev${i}`,
    title: i % 3 === 0
        ? 'Carrossel institucional com um título bem comprido para testar quebra de linha'
        : `Publicação ${i + 1}`,
    date: ts(d(i - 6)),
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
    role: i % 3 === 0 ? 'agencia' : 'cliente', empresaId: i % 3 === 0 ? null : (i % 4 === 1 ? 'empresa-que-nao-existe' : 'Agencia Mara'),
    nome: ['Maria', 'João', 'Ana', 'Carlos'][i % 4], sobrenome: ['Silva', 'Almeida', 'Nogueira', 'Teixeira'][i % 4]
}));
const EMPRESAS = ['Agencia Mara', 'Agencia Nocrato', 'Dra.SylviaFisio', 'MarcioFisio'].map(n => ({ id: n, nome: n }));
const RELATORIOS = [{ id: '2026-06', ano: 2026, mes: 6, resumo: 'Leitura do mês '.repeat(20), destaques: 'Reel bateu recorde\nCarrossel puxou salvamentos', alcance: 128400, interacoes: 9120, seguidores: 340, publicados: 18, criadoPor: 'Maria Silva', criadoEm: ts(hoje), atualizadoEm: ts(hoje) }];

const snap = (rows: any[]) => ({
    empty: rows.length === 0,
    size: rows.length,
    docs: rows.map(r => ({ id: r.id, exists: true, data: () => ({ ...r, toDate: undefined }), ref: { update: async () => {}, delete: async () => {} } }))
});

const pick = (path: string) => {
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
const makeDoc = (path: string): any => ({
    collection: (name: string) => makeCollection(`${path}/${name}`),
    get: async () => ({ exists: true, id: path.split('/').pop(), data: () => pick(path)[0] || {} }),
    set: async () => {}, update: async () => {}, delete: async () => {}
});

export const db: any = { collection: (name: string) => makeCollection(name), batch: () => ({ update() {}, commit: async () => {} }) };
export const auth: any = {
    currentUser: { uid: 'u0', email: 'pedro.vidal2608@gmail.com', emailVerified: true, reload: async () => {}, getIdToken: async () => 'tok', sendEmailVerification: async () => {}, updateProfile: async () => {} },
    onAuthStateChanged: () => () => {},
    signOut: async () => {}, sendPasswordResetEmail: async () => {}
};
export default { db, auth };
