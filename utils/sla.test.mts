/**
 * Testes das regras de SLA.
 *
 *   npx tsx utils/sla.test.mts
 *
 * Sem framework e sem `tsx` no package.json de proposito - a mesma politica do
 * harness visual: ferramenta de verificacao nao entra no bundle de producao.
 *
 * Estas regras sao data aritmetica com precedencia e dono, e errar de quem e a
 * bola tem consequencia real: a versao anterior acusava a agencia de atraso
 * enquanto o post estava parado esperando o cliente. O primeiro caso abaixo
 * existe exatamente para travar essa regressao.
 */
import { slaAtual, janelaRevisao, somarDiasUteis, SLA } from './sla';

const AGORA = new Date(2026, 7, 5, 10, 0); // quarta, 05/ago/2026
const d = (dia: number, h = 12) => new Date(2026, 7, dia, h, 0);
let falhas = 0;
const check = (nome: string, real: any, esperado: any) => {
    const ok = JSON.stringify(real) === JSON.stringify(esperado);
    if (!ok) { falhas++; console.log(`✗ ${nome}\n   esperado ${JSON.stringify(esperado)}\n   veio     ${JSON.stringify(real)}`); }
    else console.log(`✓ ${nome}`);
};

// 1. O BUG QUE A CONVERSA ACHOU: post com o cliente nao acusa a agencia.
const comCliente = { status: 'Concluído' as const, approval: 'aguardando' as const, approvalAt: null,
    date: d(20), type: 'Post' as const };
const s1 = slaAtual(comCliente, AGORA)!;
check('post esperando cliente: dono e o CLIENTE, nao a agencia', [s1.tipo, s1.dono], ['aprovacao', 'cliente']);

// 2. Em producao: O PRAZO E A DATA DE PUBLICACAO. Publicar era dia 1, hoje e 5.
const atrasado = { ...comCliente, status: 'Em andamento' as const, date: d(1) };
const s2 = slaAtual(atrasado, AGORA)!;
check('em producao passado da data: agencia, 4 dias atrasado', [s2.tipo, s2.dono, s2.dias], ['producao', 'agencia', -4]);
check('atraso de producao diz atrasado em QUE', s2.label, '4 dias atrasado para a publicação');

// 2b. Em producao com a data no futuro: nao inventa atraso.
const s2b = slaAtual({ ...comCliente, status: 'Em andamento' as const, date: d(12) }, AGORA)!;
check('em producao antes da data: nao estourado, limite = data de publicacao',
    [s2b.estourado, s2b.limite?.getDate()], [false, 12]);

// 3. Ajuste pedido vence o prazo de producao.
const s3 = slaAtual({ ...atrasado, approval: 'ajuste_solicitado' as const, approvalAt: d(4) }, AGORA)!;
check('ajuste pedido tem precedencia sobre producao', s3.tipo, 'ajuste');

// 4. SLA de ajuste em DIAS UTEIS: pedido na sexta 07/ago vence terca 11/ago.
const sexta = new Date(2026, 7, 7, 18, 0);
check('2 dias uteis a partir de sexta cai na terca', somarDiasUteis(sexta, 2).getDate(), 11);

// 5. Janela de revisao: imagem 1 dia, video 2 dias.
check('imagem publicada dia 10: janela ate dia 9',  janelaRevisao({ date: d(10), type: 'Post' as any }, AGORA).limite.getDate(), 9);
check('reel publicado dia 10: janela ate dia 8',    janelaRevisao({ date: d(10), type: 'Reel' as any }, AGORA).limite.getDate(), 8);
check('video tratado como reel',                    janelaRevisao({ date: d(10), type: 'Vídeo' as any }, AGORA).antecedencia, SLA.janelaRevisaoVideo);

// 6. Janela fechada quando a publicacao e amanha e o formato e video.
check('reel publicando dia 6: janela ja fechou', janelaRevisao({ date: d(6), type: 'Reel' as any }, AGORA).aberta, false);
check('imagem publicando dia 6: janela ainda aberta', janelaRevisao({ date: d(6), type: 'Post' as any }, AGORA).aberta, true);

// 7. Post aprovado/publicado/cancelado: sem relogio.
check('aprovado nao tem SLA',  slaAtual({ ...comCliente, approval: 'aprovado' }, AGORA), null);
check('publicado nao tem SLA', slaAtual({ ...comCliente, status: 'Postado' }, AGORA), null);
check('cancelado nao tem SLA', slaAtual({ ...comCliente, status: 'Cancelado' }, AGORA), null);

// 8. NAO EXISTE MAIS "sem prazo": todo post em producao tem data de publicacao,
// entao todo post em producao tem prazo. O caso que sumiu era o ponto cego -
// post sem prazoProducao nunca aparecia como atrasado.
const s8 = slaAtual({ ...comCliente, status: 'Pendente' as const, date: d(3) }, AGORA)!;
check('producao sempre tem limite: a data de publicacao', s8.limite?.getDate(), 3);
check('producao vencida e estourada, sem excecao', s8.estourado, true);

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntodos passaram');
process.exit(falhas ? 1 : 0);
