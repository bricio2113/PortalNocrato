import { ADMIN_EMAILS } from '../constants';

/**
 * Quem pode o que dentro da agencia.
 *
 * Ate agora `role: 'agencia'` dava TUDO: qualquer pessoa da equipe podia mudar
 * a permissao de outra, se promover, excluir um cliente inteiro com os posts
 * dentro e apagar contas do Auth. Nao existia degrau entre "trabalha aqui" e
 * "manda aqui".
 *
 * Agora sao dois niveis:
 *
 *   admin        - gerencia pessoas e clientes: permissao, vinculo de empresa,
 *                  criar/excluir empresa, remover usuario.
 *   colaborador  - faz o trabalho: calendario, producao, aprovacao, relatorios,
 *                  arquivos, comentarios. Nao mexe em quem tem acesso ao que.
 *
 * POR QUE POR E-MAIL, E NAO POR CAMPO NO BANCO:
 * um `isAdmin: true` em usuarios/{uid} precisaria de uma regra protegendo esse
 * campo especifico, e um esquecimento ali devolve a escalacao de privilegio que
 * estas funcoes existem para fechar. Lista fixa no codigo ninguem escreve pelo
 * SDK. O preco e que promover alguem exige deploy - aceitavel para uma lista de
 * duas pessoas, e a decisao pode ser revista quando existirem cargos internos.
 *
 * A MESMA LISTA vive em firestore.rules (isAdminEmail). Mexer aqui sem mexer
 * la deixa a interface liberando o botao e o banco recusando a escrita.
 */

const normalizar = (email?: string | null) => (email || '').trim().toLowerCase();

/** Administrador da agencia. */
export function isAdmin(email?: string | null): boolean {
    const e = normalizar(email);
    return e !== '' && ADMIN_EMAILS.includes(e);
}

/**
 * Faz parte da equipe da agencia (admin ou colaborador).
 *
 * Continua olhando `role` porque e o que distingue equipe de cliente; o que
 * mudou e que `role: 'agencia'` sozinho nao e mais poder administrativo.
 */
export function isAgencyMember(role?: string | null): boolean {
    return role === 'agencia';
}

export type PermissionLevel = 'admin' | 'colaborador' | 'cliente';

export function permissionLevel(user: { role?: string | null; email?: string | null }): PermissionLevel {
    if (!isAgencyMember(user.role)) return 'cliente';
    return isAdmin(user.email) ? 'admin' : 'colaborador';
}

export const PERMISSION_LABEL: Record<PermissionLevel, string> = {
    admin: 'Administrador',
    colaborador: 'Colaborador',
    cliente: 'Cliente'
};

/**
 * Explica o nivel em uma linha, para a tela nao deixar o usuario adivinhando
 * por que um botao esta apagado.
 */
export const PERMISSION_HINT: Record<PermissionLevel, string> = {
    admin: 'Gerencia pessoas, clientes e permissões.',
    colaborador: 'Trabalha em todos os clientes. Não altera acessos nem exclui clientes.',
    cliente: 'Vê apenas a própria empresa.'
};
