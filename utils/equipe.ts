import { db, auth, criarContaSemTrocarSessao } from './firebase';
import { UserProfile } from '../types';
import { getDisplayName } from './avatar';

/**
 * Equipe da agencia, para atribuir responsavel.
 *
 * Uma leitura, nao assinatura: a lista de quem trabalha na agencia nao muda
 * durante uma sessao de trabalho no quadro, e uma assinatura viva sobre a
 * colecao de usuarios custaria por presenca em tela sem entregar nada.
 *
 * SO A EQUIPE, nunca contato de cliente: quem executa conteudo e a agencia.
 * Atribuir uma etapa de producao ao cliente seria cobrar dele um trabalho que
 * nao e dele - e ele nem ve estas telas.
 */
export async function lerEquipeAgencia(): Promise<UserProfile[]> {
    const snap = await db.collection('usuarios').where('role', '==', 'agencia').get();
    return snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as UserProfile))
        .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b), 'pt-BR'));
}

export class ContaJaExisteError extends Error {
    constructor(public email: string) {
        super(`Já existe uma conta com o e-mail ${email}.`);
    }
}

export interface NovoColaborador {
    email: string;
    nome: string;
    sobrenome: string;
    cargo?: string | null;
    /** Vazio = colaborador da agencia. Preenchido = contato daquele cliente. */
    empresaId?: string | null;
}

/**
 * Senha inicial descartavel.
 *
 * NAO E PARA SER USADA NEM VISTA por ninguem: a pessoa define a propria senha pelo
 * e-mail que sai em seguida. Existe porque o Auth exige uma senha na criacao.
 * Gerada por `crypto.getRandomValues` e nunca exibida - se o admin escolhesse a
 * senha, ele saberia a senha de um colega, o que e pior que nao ter o recurso.
 */
function senhaDescartavel(): string {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('') + 'Aa1!';
}

/**
 * Cria a conta de uma pessoa da equipe, do painel.
 *
 * ANTES ISSO NAO EXISTIA. A conta so nascia pelo auto-cadastro - sempre como
 * cliente sem vinculo, porque a regra de criacao forca isso -, e a equipe dependia
 * de a pessoa se cadastrar sozinha e alguem promove-la depois. Quem monta a equipe
 * quer o contrario: cadastrar a pessoa e ela receber o acesso.
 *
 * TRES PASSOS, nesta ordem, e o motivo de cada um:
 *
 *   1. conta no Auth, em instancia secundaria (ver criarContaSemTrocarSessao) -
 *      primeiro porque e o passo que pode falhar por e-mail repetido, e falhar aqui
 *      nao deixa nada pela metade;
 *   2. documento `usuarios/{uid}` com role e cargo - so admin consegue, e a regra
 *      confere; sem ele a pessoa entra e nao e ninguem;
 *   3. e-mail para criar a senha - a senha inicial e descartavel de proposito.
 *
 * A pessoa recebe DOIS e-mails: confirmar o endereco (obrigatorio, `isVerified()`
 * nas regras) e criar a senha. Dizer isso na tela evita o suporte "recebi dois
 * e-mails, qual eu uso?".
 */
export async function criarPessoa(dados: NovoColaborador): Promise<string> {
    const email = dados.email.trim().toLowerCase();
    if (!email) throw new Error('Informe o e-mail da pessoa.');

    let uid: string;
    try {
        uid = await criarContaSemTrocarSessao(email, senhaDescartavel());
    } catch (erro) {
        const codigo = (erro as { code?: string })?.code;
        if (codigo === 'auth/email-already-in-use') throw new ContaJaExisteError(email);
        if (codigo === 'auth/invalid-email') throw new Error('E-mail inválido.');
        throw erro;
    }

    await db.collection('usuarios').doc(uid).set({
        email,
        role: dados.empresaId ? 'cliente' : 'agencia',
        empresaId: dados.empresaId || null,
        nome: dados.nome.trim() || null,
        sobrenome: dados.sobrenome.trim() || null,
        cargo: dados.cargo?.trim() || null
    });

    // O convite para criar a senha vem por ultimo e NAO derruba a criacao se
    // falhar: a conta existe e o admin pode reenviar pela ficha da pessoa
    // ("Enviar redefinição de senha"). Perder a conta por causa do e-mail seria
    // desfazer o que deu certo.
    try {
        await auth.sendPasswordResetEmail(email);
    } catch (erro) {
        console.error('Conta criada, mas o e-mail de senha não saiu:', erro);
    }

    return uid;
}

/** Indice uid -> pessoa, para o quadro resolver rosto sem varrer a lista. */
export const indexarPorUid = (pessoas: UserProfile[]): Record<string, UserProfile> =>
    pessoas.reduce((acc, p) => { acc[p.id] = p; return acc; }, {} as Record<string, UserProfile>);

/**
 * Resolve uids em pessoas, descartando quem nao existe mais.
 *
 * Uid de alguem removido da equipe continua gravado no conteudo; sem o descarte,
 * o quadro renderizaria um rosto sem nome nem iniciais.
 */
export const pessoasDeUids = (uids: string[] | null | undefined, indice: Record<string, UserProfile>) =>
    (uids || []).map(uid => indice[uid]).filter(Boolean);
