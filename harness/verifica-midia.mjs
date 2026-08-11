/**
 * Verifica COMPORTAMENTO (o audit.mjs mede layout):
 *
 *   1. campo de midia aparece em publicacao NOVA (sem id)
 *   2. seletor de pasta oferece os DOIS desfechos
 *   3. "usar esta pasta" NAO cria subpasta
 *   4. "criar a pasta do conteudo" cria e sobe dentro dela, e a capa viaja no save
 *   5. o arquivo enviado no conteudo APARECE na tela de pastas
 *   6. cliente novo nasce com as pastas padrao - sem elas, "escolha a pasta" no
 *      passo 2 nao teria o que oferecer
 *   7. o telefone do proprio perfil tem onde ser digitado e e gravado
 *   8. admin consegue TORNAR COLABORADOR uma conta nova - o unico jeito antes era
 *      editar `role` no console do Firebase
 *   9. peca que falhou na previa nao fica quebrada para sempre
 *  10. na tela de pastas, imagem e video ABREM em tamanho grande
 *  11. o calendario global da agencia troca de cliente pelo seletor
 *  12. admin CRIA a conta de um colaborador pelo painel
 *  13. "Tarefas abertas" abre a lista e cada linha leva ao conteudo da tarefa
 *  14. a tela de Tarefas agrupa por conteudo, mostra os dois prazos e filtra
 *  15. a etapa tem PRAZO, editavel na gestao do conteudo
 *  16. estudo de marca: secao dentro de Arquivos & Materiais, editavel pelos dois
 *  17. "Foco da Semana" saiu de todos os menus
 *  18. RESPONSAVEL: marcar o segundo nao apaga o primeiro, e reflete sem "Salvar"
 *  19. carrossel REORDENAVEL, e o template de pastas e de ENTREGA
 *  20. midia e ordem gravam NA HORA em post existente, e nao no "Salvar"
 *  21. atalho do Drive vive DENTRO da pasta
 *  22. TESTE A/B: as abas trocam o conteudo editado, "tornar principal" troca de
 *      lugar e "desligar" avisa antes de apagar
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = 'dist-harness';
const PORTA = 4599;
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

const servidor = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORTA}`);
    const arquivo = path.join(RAIZ, url.pathname === '/' ? 'harness/index.html' : url.pathname);
    fs.readFile(arquivo, (e, buf) => {
        if (e) { res.writeHead(404); res.end('nao encontrado'); return; }
        res.writeHead(200, { 'Content-Type': tipos[path.extname(arquivo)] || 'application/octet-stream' });
        res.end(buf);
    });
});
await new Promise(r => servidor.listen(PORTA, r));

// PNG 1x1 de verdade: um arquivo falso de 4 bytes faz a geracao de miniatura
// falhar e o upload nem comeca - ja aconteceu, e o teste mostrou "nada subiu".
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
    'base64'
);

// Binario do ambiente: o download automatico do Playwright nao roda aqui.
const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const falhas = [];
const ok = [];
const checar = (cond, msg) => (cond ? ok : falhas).push(msg);

/**
 * Existe AGORA, sem esperar.
 *
 * `click()` espera 30s por um elemento que nao existe e derruba o script inteiro -
 * o que esconde as checagens seguintes e, pior, transforma "a interface nao tem
 * esse botao" em stack trace em vez de linha de falha. Rodar este arquivo contra o
 * codigo antigo tem que RELATAR o que falta, nao explodir.
 */
const existe = async loc => (await loc.count()) > 0 && await loc.first().isVisible();

const abrir = async tela => {
    const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
    const erros = [];
    page.on('pageerror', e => erros.push(e.message));
    await page.goto(`http://localhost:${PORTA}/harness/index.html?screen=${tela}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    return { page, erros };
};
const writes = page => page.evaluate(() => globalThis.__writes || []);
const corpo = page => page.locator('body').innerText();

/**
 * As abas de VERSAO do teste A/B.
 *
 * Escopadas no tablist delas de proposito: o modal tem outras abas (Conteúdo,
 * Gestão, Conversa) e um `getByRole('tab')` solto conta as duas coisas juntas -
 * "3 versões" passava com 5 elementos na tela.
 */
const versoes = page => page.getByRole('tablist', { name: 'Versões do conteúdo' }).getByRole('tab');
// Pelo INICIO do nome: `hasText: 'C'` casa com "A · principal" (busca por trecho,
// sem diferenciar maiuscula) e a escolha da aba vira sorteio.
const versao = (page, rotulo) => page.getByRole('tablist', { name: 'Versões do conteúdo' })
    .getByRole('tab', { name: rotulo === 'principal' ? /principal/ : new RegExp(`^${rotulo}\\b`) });

// ---------------------------------------------------------------- 1 e 2 e 3
{
    const { page, erros } = await abrir('modal-novo');
    // `exact`: o texto novo do campo de link cita "Mídia da publicação", e sem isso
    // o localizador casa dois elementos e o modo estrito derruba o script.
    checar(await page.getByText('Mídia da publicação', { exact: true }).isVisible(),
        '1. campo "Mídia da publicação" aparece em publicação NOVA');

    await page.getByRole('button', { name: /Escolher a pasta e enviar/ }).click();
    await page.waitForTimeout(500);
    const picker = page.getByRole('dialog', { name: 'Escolher pasta' });
    checar(await picker.isVisible(), '2. seletor de pasta abre');

    const criar = picker.getByRole('button', { name: /Criar a pasta do conteúdo aqui/ });
    const usar = picker.getByRole('button', { name: /Usar esta pasta/ });
    checar(await criar.isEnabled(), '2. "criar a pasta do conteúdo" habilitado na raiz');
    checar(!(await usar.isEnabled()), '2. "usar esta pasta" DESABILITADO na raiz de Materiais');

    // Entra em Imagens e usa a pasta como esta.
    await picker.getByRole('button', { name: /^Imagens/ }).click();
    await page.waitForTimeout(500);
    const usarImagens = picker.getByRole('button', { name: /Usar “Imagens”/ });
    checar(await usarImagens.isEnabled(), '3. dentro de Imagens, "usar esta pasta" fica habilitado');
    await usarImagens.click();
    await page.waitForTimeout(500);

    const antes = await writes(page);
    checar(!antes.some(w => w.op === 'upload' && w.path.endsWith('.pasta')),
        '3. usar pasta existente NÃO criou subpasta nenhuma');

    const destino = await page.locator('text=/O que subir aqui aparece/').isVisible();
    checar(destino, '3. faixa do destino diz que o arquivo aparece em Arquivos & Materiais');

    // Sobe o arquivo.
    await page.locator('input[type=file]').first()
        .setInputFiles({ name: 'peca.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForTimeout(1200);

    const depois = await writes(page);
    const upload = depois.find(w => w.op === 'upload' && !w.path.endsWith('.pasta'));
    checar(Boolean(upload) && /empresas\/agencia-mara\/materiais\/Imagens\/\d+-peca\.png$/.test(upload.path),
        `4. upload foi para a pasta escolhida: ${upload ? upload.path : '(nenhum upload)'}`);
    checar(!depois.some(w => w.path.includes('/covers/') && w.path.endsWith('covers/')),
        '4. nenhuma escrita em covers/ com id vazio');
    checar((await page.locator('img[alt=""]').count()) >= 0 &&
        (await page.getByText(/1 arquivo\(s\)/).isVisible()),
        '4. a grade do modal mostra 1 arquivo');
    checar(erros.length === 0, `4. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);

    // A CAPA TEM QUE CHEGAR A QUEM CRIA O POST. Em publicacao sem id nao ha
    // covers/{id} para gravar; se a miniatura nao viajar no save, o post nasce sem
    // capa na grade e ninguem percebe ate olhar o calendario.
    await page.getByRole('button', { name: 'Agendar', exact: true }).click();
    await page.waitForTimeout(300);
    const salvo = await page.evaluate(() => globalThis.__save || null);
    checar(Boolean(salvo) && salvo.thumbBytes > 100,
        `4c. o save leva a miniatura para gravar em covers/ (${salvo ? salvo.thumbBytes : 0} bytes)`);
    checar(Boolean(salvo) && JSON.stringify(salvo.pastaMidia) === JSON.stringify(['Imagens']) && salvo.midias === 1,
        `4c. o save leva a pasta e a mídia: ${JSON.stringify(salvo && salvo.pastaMidia)} · ${salvo && salvo.midias} arquivo(s)`);
    await page.close();
}

// ------------------------------------------------------- criar subpasta + 5
{
    const { page, erros } = await abrir('midia-e-pastas');
    const pastas = page.locator('nav[aria-label="Caminho"]').last();
    await pastas.waitFor();

    // A coluna da direita comeca na raiz: Imagens, Vídeos, Identidade Visual...
    await page.getByRole('button', { name: /Escolher a pasta e enviar/ }).click();
    await page.waitForTimeout(500);
    const picker = page.getByRole('dialog', { name: 'Escolher pasta' });
    await picker.getByRole('button', { name: /^Imagens/ }).click();
    await page.waitForTimeout(400);
    await picker.getByRole('button', { name: /Criar a pasta do conteúdo aqui/ }).click();
    await page.waitForTimeout(800);

    const w1 = await writes(page);
    const marcador = w1.find(w => w.op === 'upload' && w.path.endsWith('.pasta'));
    checar(Boolean(marcador) &&
        marcador.path === 'empresas/agencia-mara/materiais/Imagens/Reel de captação — agosto/.pasta',
        `4b. subpasta criada com o título: ${marcador ? marcador.path : '(nenhuma)'}`);

    await page.locator('input[type=file]').first()
        .setInputFiles({ name: 'reel.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForTimeout(1200);

    const w2 = await writes(page);
    const up = w2.find(w => w.op === 'upload' && w.path.endsWith('reel.png'));
    checar(Boolean(up) && up.path.includes('/Imagens/Reel de captação — agosto/'),
        `4b. arquivo subiu dentro da subpasta: ${up ? up.path : '(nenhum)'}`);

    // AGORA A PROVA DOS DOIS LUGARES: navegar na coluna da direita ate a pasta.
    await page.locator('button:has-text("Atualizar")').click();
    await page.waitForTimeout(600);
    await page.locator('button:has-text("Imagens")').last().click();
    await page.waitForTimeout(700);
    const temSubpasta = await page.getByText('Reel de captação — agosto', { exact: true }).count();
    checar(temSubpasta > 0, '5. a subpasta aparece na tela de Arquivos & Materiais');

    await page.locator('button:has-text("Reel de captação — agosto")').first().click();
    await page.waitForTimeout(800);
    const temArquivo = await page.getByTitle(/reel\.png/).count();
    checar(temArquivo > 0, '5. o arquivo enviado no conteúdo aparece dentro da pasta');
    checar(erros.length === 0, `5. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);

    await page.screenshot({ path: 'dist-harness/v-midia-pastas.png', fullPage: false });
    await page.close();
}

// ------------------------------------------------------------------------ 6
// CLIENTE NOVO TEM PASTA. E parte do mesmo fluxo: "escolha a pasta" sem pasta
// nenhuma para escolher nao e uma escolha. Antes a estrutura padrao dependia de
// alguem lembrar de clicar num botao na tela de materiais.
{
    const { page, erros } = await abrir('ficha-cliente');
    await page.getByPlaceholder('Ex: Dra. Sylvia Fisio').fill('Cliente Novo Teste');
    await page.getByRole('button', { name: /Criar cliente/ }).click();
    await page.waitForTimeout(1500);

    const w = await writes(page);
    const marcadores = w.filter(x => x.op === 'upload' && x.path.endsWith('/.pasta'));
    checar(marcadores.length === 5,
        `6. cliente novo nasce com as 5 pastas padrão (${marcadores.length} criadas)`);
    checar(marcadores.every(m => m.path.startsWith('empresas/cliente-novo-teste/materiais/')),
        `6. as pastas vão para o cliente criado: ${marcadores[0] ? marcadores[0].path : '(nenhuma)'}`);
    checar(erros.length === 0, `6. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.close();
}

// ------------------------------------------------------------------------ 7
// TELEFONE DO PROPRIO PERFIL. O campo existia no tipo e na ficha da pessoa, sem
// nenhum lugar para digitar - a ficha dizia "sem telefone" para todo mundo.
{
    const { page, erros } = await abrir('perfil');
    const campo = page.getByLabel('Telefone / WhatsApp');
    checar(await campo.isVisible(), '7. campo de telefone existe no Meu Perfil');
    await campo.fill('(13) 98888-7777');
    await page.getByRole('button', { name: /Salvar perfil/ }).click();
    await page.waitForTimeout(600);

    const w = await writes(page);
    const up = w.find(x => x.op === 'update' && x.path === 'usuarios/u0');
    checar(Boolean(up) && up.data.telefone === '(13) 98888-7777',
        `7. o telefone e gravado no proprio documento: ${up ? JSON.stringify(up.data.telefone) : '(nenhuma escrita)'}`);
    checar(erros.length === 0, `7. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.close();
}

// ------------------------------------------------------------------------ 8
// PROMOVER A COLABORADOR. Conta nasce como cliente sem vinculo (a regra forca),
// e nao havia tela que mudasse isso: equipe so existia mexendo no console.
{
    const { page, erros } = await abrir('painel');
    page.on('dialog', d => d.accept());

    await page.getByRole('button', { name: /^Equipe/ }).first().click();
    await page.waitForTimeout(700);

    // u2 e a conta sem empresa do mock: a fila "aguardando vinculo".
    await page.locator('text=Conta sem cliente').first().click();
    await page.waitForTimeout(700);

    const promover = page.getByRole('button', { name: /Tornar colaborador da agência/ });
    checar(await promover.isVisible(), '8. a ficha oferece tornar colaborador da agência');
    const vincular = page.getByText(/vincule aqui para liberar o portal/);
    checar(await vincular.isVisible(), '8. e a alternativa de vincular a um cliente segue lá');

    await promover.click();
    await page.waitForTimeout(800);

    const w = await writes(page);
    const up = w.filter(x => x.op === 'update' && x.path.startsWith('usuarios/')).pop();
    checar(Boolean(up) && up.data.role === 'agencia' && up.data.empresaId === null,
        `8. grava role=agencia e limpa o vínculo: ${up ? JSON.stringify(up.data) : '(nenhuma escrita)'}`);

    // E o caminho de volta, na ficha de quem ja e da equipe.
    await page.locator('text=/^Colaborador$/').first().click();
    await page.waitForTimeout(700);
    checar(await page.getByRole('button', { name: /Tirar da equipe/ }).isVisible(),
        '8. ficha de quem é da equipe oferece o caminho de volta');
    checar(erros.length === 0, `8. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.close();
}

// ------------------------------------------------------------------------ 9
// PECA 1 DO CARROSSEL PRESA EM "NAO FOI POSSIVEL CARREGAR". A marca de falha era
// por INDICE e so era limpa quando o post mudava - dentro do mesmo post, nada
// desfazia. Subir a peca 2 e a 3 nao ressuscitava a 1.
{
    const { page, erros } = await abrir('previa-carrossel');
    const previa = page.locator('.aspect-square').first();
    const quebrou = page.getByText('Não foi possível carregar esta peça.');

    checar(await previa.locator('img').count() === 1, '9. a peça 1 carrega antes da falha');

    // Falha provocada: e o que o navegador faz quando a URL ainda nao serve.
    const forcarErro = () => page.evaluate(() => {
        const img = document.querySelector('.aspect-square img');
        img?.dispatchEvent(new Event('error'));
    });
    await forcarErro();
    await page.waitForTimeout(300);
    checar(await quebrou.isVisible(), '9. a falha aparece na peça');

    const botaoTentar = page.getByRole('button', { name: /Tentar de novo/ });
    const temTentar = await existe(botaoTentar);
    checar(temTentar, '9. e existe "tentar de novo" - antes só fechando o post');
    if (temTentar) {
        await botaoTentar.click();
        await page.waitForTimeout(400);
        checar(!(await quebrou.isVisible()) && await previa.locator('img').count() === 1,
            '9. "tentar de novo" remonta a peça e ela volta');
    }

    // O CASO DO PRINT: falhou, e depois entram mais pecas no carrossel.
    await forcarErro();
    await page.waitForTimeout(300);
    checar(await quebrou.isVisible(), '9. falha de novo, para testar a chegada da peça seguinte');
    await page.getByRole('button', { name: 'adicionar peça' }).click();
    await page.waitForTimeout(500);
    checar(!(await quebrou.isVisible()) && await previa.locator('img').count() === 1,
        '9. peça nova no carrossel faz a peça 1 ser tentada outra vez');
    checar(erros.length === 0, `9. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.close();
}

// ----------------------------------------------------------------------- 10
// ABRIR A PECA NA TELA DE PASTAS. O card tinha miniatura de 100px e um botao de
// download: conferir se a foto e a certa exigia baixar o arquivo.
{
    const { page, erros } = await abrir('materiais');
    await page.locator('button:has-text("Imagens")').first().click();
    await page.waitForTimeout(800);

    // capa-01.jpg e capa-02.jpg estao em Imagens no mock.
    const cards = page.locator('button[aria-label^="Abrir capa-"]');
    checar(await cards.count() === 2, `10. a pasta lista os arquivos clicáveis (${await cards.count()})`);
    await cards.first().click();
    await page.waitForTimeout(500);

    const viewer = page.getByRole('dialog', { name: /Visualizar capa-01/ });
    checar(await existe(viewer), '10. clicar no arquivo abre o visualizador');
    checar(await viewer.locator('img').count() === 1, '10. e a imagem aparece em tamanho grande');
    checar(await page.getByText('1 de 2').isVisible(), '10. diz em que arquivo você está');

    await page.getByRole('button', { name: 'Próximo arquivo' }).click();
    await page.waitForTimeout(400);
    checar(await existe(page.getByRole('dialog', { name: /Visualizar capa-02/ })),
        '10. a seta avança para o arquivo seguinte, sem sair da pasta');

    // Teclado: conferir material e uma sequencia, e a mao fica na seta.
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
    checar(await existe(page.getByRole('dialog', { name: /Visualizar capa-01/ })), '10. seta do teclado volta');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    checar(!(await existe(page.getByRole('dialog', { name: /Visualizar/ }))), '10. Esc fecha');

    // VIDEO: o que precisa ser verificado e que abre um PLAYER com controles, nao
    // que o filme roda - nao existe mp4 para servir offline neste ambiente.
    //
    // A requisicao do video fica PENDURADA de proposito: solta, ela falha (o host
    // de exemplo nao existe), o onError marca a peca e o visualizador troca para a
    // tela de recuperacao - o teste mediria o estado de erro em vez do player. Com
    // a resposta pendente o elemento fica montado, que e o estado real de quem
    // abriu um video que ainda esta carregando.
    await page.route('**exemplo.invalido**', () => { /* sem responder, de proposito */ });
    await page.locator('nav[aria-label="Caminho"] button:has-text("Materiais")').click();
    await page.waitForTimeout(700);
    await page.locator('button:has-text("Vídeos")').first().click();
    await page.waitForTimeout(800);
    await page.locator('button[aria-label^="Abrir reel-bruto"]').click();
    await page.waitForTimeout(600);
    const player = page.locator('video[controls]');
    checar(await player.count() === 1, '10. vídeo abre em player com controles');
    checar(await existe(page.getByRole('dialog', { name: /Visualizar reel-bruto/ })),
        '10. e o visualizador identifica o arquivo aberto');
    checar(erros.length === 0, `10. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);

    await page.screenshot({ path: 'dist-harness/v-viewer.png' });
    await page.close();
}

// ----------------------------------------------------------------------- 11
// CALENDARIO GLOBAL. Voltou depois de eu ter removido: o valor dele nao era o
// componente (que e o mesmo CalendarView), era trocar de cliente em um clique.
{
    const { page, erros } = await abrir('painel');
    const item = page.getByRole('button', { name: /^Calendário/ }).first();
    checar(await existe(item), '11. o painel tem o item Calendário no menu');
    await item.click();
    await page.waitForTimeout(1200);

    const circulos = page.locator('button[aria-pressed]');
    checar(await circulos.count() >= 4,
        `11. o seletor lista os clientes em círculos (${await circulos.count()})`);
    checar(await page.getByText('Calendário Editorial').isVisible(),
        '11. e o calendário do cliente selecionado aparece embaixo');

    // Um cabecalho, nao dois: a tela tem o do calendario e nao repete o do painel.
    checar(await page.getByRole('heading', { name: 'Calendário', exact: true }).count() === 0,
        '11. sem cabeçalho duplicado do painel');

    // A previa do feed identifica de QUEM e a agenda - e como se prova que a troca
    // de cliente trocou o conteudo, e nao apenas o circulo destacado.
    checar(await page.locator('p:text("Agencia Mara")').first().count() > 0,
        '11. abre no cliente que espera a agência');

    await page.getByRole('button', { name: /^Marcio Fisio/ }).first().click();
    await page.waitForTimeout(1200);
    checar(await page.locator('p:text("Marcio Fisio")').first().count() > 0,
        '11. clicar em outro cliente troca a agenda mostrada');
    checar(erros.length === 0, `11. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);

    await page.screenshot({ path: 'dist-harness/v-calendario-global.png' });
    await page.close();
}

// ----------------------------------------------------------------------- 12
// CRIAR COLABORADOR. A tela Equipe listava a equipe e nao tinha caminho para
// incluir ninguem: dependia de a pessoa se cadastrar sozinha no portal.
{
    const { page, erros } = await abrir('painel');
    await page.getByRole('button', { name: /^Equipe/ }).first().click();
    await page.waitForTimeout(700);

    const botao = page.getByRole('button', { name: /Adicionar pessoa/ });
    checar(await existe(botao), '12. a aba Equipe tem "Adicionar pessoa"');
    await botao.click();
    await page.waitForTimeout(500);

    const form = page.getByRole('dialog', { name: 'Nova pessoa na equipe' });
    checar(await existe(form), '12. o cadastro abre');
    checar(!(await page.getByLabel(/senha/i).count()),
        '12. e NÃO pede senha - quem define é a pessoa, pelo e-mail');

    await page.getByLabel('E-mail *').fill('novo.colaborador@agencianocrato.com');
    await page.getByLabel('Nome *').fill('Rita');
    await page.getByLabel('Sobrenome').fill('Souza');
    await page.getByLabel('Cargo').selectOption('Designer');
    await page.getByRole('button', { name: /Criar acesso/ }).click();
    await page.waitForTimeout(1200);

    const w = await writes(page);
    const conta = w.find(x => x.op === 'criar-conta');
    checar(Boolean(conta) && conta.path === 'auth/novo.colaborador@agencianocrato.com',
        `12. cria a conta no Auth: ${conta ? conta.path : '(nenhuma)'}`);
    checar(Boolean(conta) && conta.data.verificacaoEnviada === true,
        '12. com e-mail de confirmação - sem isso as regras negam tudo');

    const doc = w.find(x => x.op === 'set' && x.path.startsWith('usuarios/uid-'));
    checar(Boolean(doc) && doc.data.role === 'agencia' && doc.data.empresaId === null
        && doc.data.cargo === 'Designer' && doc.data.nome === 'Rita',
        `12. e o documento nasce colaborador com cargo: ${doc ? JSON.stringify(doc.data) : '(nenhum)'}`);
    checar(w.some(x => x.op === 'reset-senha' && x.path.includes('novo.colaborador')),
        '12. e o convite para criar a senha sai');
    checar(erros.length === 0, `12. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.close();
}

// ----------------------------------------------------------------------- 13
// TAREFAS ABERTAS: o numero levava a lugar nenhum.
{
    const { page, erros } = await abrir('painel');
    const tile = page.getByRole('button', { name: /Tarefas abertas/ });
    checar(await existe(tile), '13. o número de tarefas abertas é clicável');
    await tile.click();
    await page.waitForTimeout(600);

    const lista = page.getByRole('dialog', { name: 'Tarefas abertas' });
    checar(await existe(lista), '13. abre a lista das tarefas');
    const linhas = lista.locator('li button');
    checar(await linhas.count() > 0, `13. com as tarefas em aberto (${await linhas.count()})`);
    checar(await lista.getByText(/sem responsável/).first().count() > 0,
        '13. e marca a que não tem responsável');

    await page.screenshot({ path: 'dist-harness/v-tarefas.png' });

    // Clicar PEDE o conteudo da tarefa. A navegacao em si vive no App (que o
    // harness nao monta), entao o que se verifica aqui e o pedido: cliente, secao
    // e o eventId da tarefa clicada.
    const alvo = await linhas.first().getAttribute('aria-label');
    await linhas.first().click();
    await page.waitForTimeout(600);
    checar(!(await existe(page.getByRole('dialog', { name: 'Tarefas abertas' }))),
        '13. a lista fecha ao escolher');
    const pedido = await page.evaluate(() => globalThis.__abriu || null);
    checar(Boolean(pedido) && pedido.section === 'production' && Boolean(pedido.eventId),
        `13. e pede o conteúdo da tarefa: ${JSON.stringify(pedido)}${alvo ? '' : ''}`);
    checar(erros.length === 0, `13. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.close();
}

// --------------------------------------------------------------------- 13b
// A OUTRA METADE: chegando com um conteudo pedido, o espaco de trabalho abre ELE,
// em vez de largar a pessoa no quadro procurando o card.
{
    const { page, erros } = await abrir('cliente-workspace-tarefa');
    await page.waitForTimeout(1800);
    checar(await existe(page.getByRole('dialog', { name: /publicação/i })),
        '13b. o conteúdo indicado abre sozinho ao entrar no cliente');
    // role="tab", nao "button": a aba declara o papel dela e o papel implicito de
    // <button> deixa de valer.
    checar(await existe(page.getByRole('tab', { name: /Gestão/ })),
        '13b. com a aba de gestão disponível, que é onde a tarefa vive');
    checar(await page.getByRole('tab', { name: /Gestão/ }).first().getAttribute('aria-selected') === 'true',
        '13b. e ela já vem ABERTA: quem vem de uma tarefa quer a gestão, não a legenda');
    checar(erros.length === 0, `13b. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.close();
}

// ----------------------------------------------------------------------- 14
// TELA DE TAREFAS. Agrupada pelo conteudo pai, com o prazo do post E o de cada
// etapa, filtravel por cliente e por pessoa.
{
    const { page, erros } = await abrir('tarefas');
    await page.waitForTimeout(1500);

    const grupos = page.locator('p:text("etapa(s) em aberto")');
    checar(await grupos.count() >= 2, `14. agrupa por conteúdo (${await grupos.count()} grupos)`);
    checar(await page.getByText(/publica 0/).first().count() > 0,
        '14. cada grupo mostra o prazo do conteúdo pai');
    checar(await page.getByText('vence hoje').first().count() > 0
        && await page.getByText(/atrasada/).first().count() > 0,
        '14. e o prazo de cada etapa, com atraso destacado');
    checar(await page.getByText('sem prazo').first().count() > 0,
        '14. etapa sem prazo diz "sem prazo" em vez de inventar data');

    // Somente o que NAO esta feito: 's1' esta feita e nao pode aparecer.
    checar(await page.getByText('Roteiro do carrossel').count() === 0,
        '14. etapa concluída fica fora da fila');

    const antes = await page.locator('li').count();
    // Filtro por pessoa: Carlos (u3) tem menos etapas que a equipe toda.
    await page.getByRole('button', { name: /Filtrar por responsável/ }).click();
    await page.waitForTimeout(400);
    await page.getByRole('option', { name: /Carlos/ }).click();
    await page.waitForTimeout(700);
    const depois = await page.locator('li').count();
    checar(depois > 0 && depois < antes,
        `14. filtrar por pessoa reduz a lista (${antes} → ${depois})`);
    checar(await page.getByText(/de 10/).count() > 0,
        '14. e a contagem diz que é um recorte do total');

    await page.getByRole('button', { name: /limpar/ }).click();
    await page.waitForTimeout(600);
    checar(await page.locator('li').count() === antes, '14. limpar devolve tudo');

    await page.getByRole('button', { name: /^abrir/ }).first().click();
    await page.waitForTimeout(400);
    const pedido = await page.evaluate(() => globalThis.__abriu || null);
    checar(Boolean(pedido) && pedido.section === 'production' && Boolean(pedido.eventId),
        `14. "abrir" leva ao conteúdo: ${JSON.stringify(pedido)}`);
    checar(erros.length === 0, `14. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);

    await page.screenshot({ path: 'dist-harness/v-tarefas-tela.png' });
    await page.close();
}

// ----------------------------------------------------------------------- 15
// PRAZO DA ETAPA, onde ela e gerenciada. Sem campo, nenhuma etapa teria prazo e a
// tela de tarefas nasceria com a coluna de datas vazia.
{
    const { page, erros } = await abrir('modal-gestao');
    const campo = page.getByLabel('Prazo de Design das 5 lâminas');
    checar(await existe(campo), '15. cada etapa tem campo de prazo na gestão do conteúdo');

    // A data nova e DERIVADA da que esta no campo, um dia antes.
    //
    // Antes eu escrevia '2026-08-10' fixo. As datas do mock sao relativas a HOJE, e
    // no dia em que hoje-1 caiu justamente em 10/08 o campo ja continha esse valor:
    // `fill` com o mesmo texto nao dispara mudanca, nenhuma escrita acontecia e o
    // teste acusava o codigo. Teste que depende do calendario acusa inocente.
    const atual = await campo.first().inputValue();
    const base = atual ? new Date(`${atual}T12:00:00`) : new Date();
    base.setDate(base.getDate() - 1);
    const nova = base.toISOString().slice(0, 10);

    await campo.fill(nova);
    await page.waitForTimeout(600);
    const w = await writes(page);
    const up = w.find(x => x.op === 'update' && x.path.includes('/subtarefas/'));
    checar(Boolean(up) && typeof up.data.prazo === 'string' && up.data.prazo.startsWith(nova),
        `15. e gravar o prazo escreve na subtarefa (${nova}): ${up ? JSON.stringify(up.data) : '(nada)'}`);

    const novo = page.getByLabel('Prazo da nova subtarefa');
    checar(await existe(novo), '15. a etapa nova também já nasce com prazo');
    checar(await novo.getAttribute('max') !== null,
        '15. limitado pela data de publicação - etapa não vence depois do post');
    checar(erros.length === 0, `15. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.close();
}

// ----------------------------------------------------------------------- 16
// ESTUDO DE MARCA. Seção dentro de Arquivos & Materiais, com personas, tom e
// estrategia - e editavel pelo CLIENTE tambem, que e o ponto do recurso.
{
    const { page, erros } = await abrir('materiais');
    // role="tab" tambem aqui (SegmentedTabs) - buscar por 'button' nao acha.
    const aba = page.getByRole('tab', { name: /Estudo de marca/ });
    checar(await existe(aba), '16. Arquivos & Materiais tem a aba Estudo de marca');
    await aba.click();
    await page.waitForTimeout(900);

    checar(await page.getByText('Personas').first().count() > 0
        && await page.getByText('Tom da marca').first().count() > 0
        && await page.getByText('Estratégia de conteúdo').first().count() > 0,
        '16. com as três seções pedidas');
    checar(await page.getByLabel('Dores').first().count() > 0
        && await page.getByLabel('O que procura').first().count() > 0,
        '16. persona tem dores e o que procura');
    checar(await page.getByLabel('Arquétipo').count() > 0
        && await page.getByLabel('Tom de voz').count() > 0
        && await page.getByLabel(/visualmente/).count() > 0
        && await page.getByLabel(/textualmente/).count() > 0,
        '16. tom tem arquétipo, voz e as duas leituras (visual e textual)');
    checar(await page.getByLabel('Gatilhos').count() > 0
        && await page.getByLabel('Palavras-chave').count() > 0
        && await page.getByLabel('Promessas').count() > 0,
        '16. estratégia tem promessas, gatilhos e palavras-chave');

    // Duas personas no mock: a lista aceita mais de uma, e o botao cria outra.
    const antesPersonas = await page.getByPlaceholder(/Nome da persona/).count();
    checar(antesPersonas === 2, `16. lista mais de uma persona (${antesPersonas})`);
    await page.getByRole('button', { name: /Nova persona/ }).click();
    await page.waitForTimeout(300);
    checar(await page.getByPlaceholder(/Nome da persona/).count() === antesPersonas + 1,
        '16. e dá para adicionar outra');

    // Salvar grava o estudo INTEIRO, com quem alterou.
    await page.getByLabel('Tom de voz').fill('Direto, sem jargão. Você no singular.');
    await page.waitForTimeout(200);
    checar(await page.getByText('Alterações não salvas').count() > 0,
        '16. avisa que há rascunho não salvo');
    await page.getByRole('button', { name: /Salvar estudo/ }).click();
    await page.waitForTimeout(800);

    const w = await writes(page);
    const gravado = w.find(x => x.op === 'set' && x.path.includes('/marca/estudo'));
    checar(Boolean(gravado) && gravado.data.tom.tomDeVoz.startsWith('Direto')
        && Array.isArray(gravado.data.personas) && gravado.data.personas.length === 3,
        `16. grava em marca/estudo: ${gravado ? `${gravado.data.personas.length} personas, voz "${gravado.data.tom.tomDeVoz.slice(0, 20)}..."` : '(nada)'}`);
    checar(Boolean(gravado) && Boolean(gravado.data.atualizadoPor),
        '16. e registra quem alterou - o texto é escrito a quatro mãos');
    checar(erros.length === 0, `16. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.screenshot({ path: 'dist-harness/v-marca.png', fullPage: false });
    await page.close();
}

// O CLIENTE edita o mesmo estudo. Se a tela abrisse em leitura para ele, o recurso
// nao seria trabalho conjunto - seria formulario da agencia.
{
    const { page, erros } = await abrir('marca-cliente');
    await page.waitForTimeout(900);
    const voz = page.getByLabel('Tom de voz');
    checar(await existe(voz) && !(await voz.isDisabled()),
        '16b. o cliente também edita o estudo');
    checar(await existe(page.getByRole('button', { name: /Nova persona/ })),
        '16b. inclusive criando persona');
    checar(erros.length === 0, `16b. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.close();
}

// ----------------------------------------------------------------------- 17
// FOCO DA SEMANA fora. Removido a pedido: some do menu do cliente e do espaco de
// trabalho da agencia.
{
    const { page } = await abrir('cliente-workspace');
    await page.waitForTimeout(900);
    checar(await page.getByText('Foco da Semana').count() === 0,
        '17. "Foco da Semana" não aparece mais no espaço de trabalho');
    checar(await page.getByText('Arquivos & Materiais').count() > 0,
        '17. e o resto do menu continua de pé');
    await page.close();
}

// ----------------------------------------------------------------------- 18
// O DEFEITO QUE O TIME ACHOU. A lista base vinha do rascunho do modal, que a
// escrita nunca atualizava: a etiqueta nao acendia (parecia que nada era
// selecionavel) e o segundo clique gravava `[] + [b]`, apagando o primeiro.
{
    const { page, erros } = await abrir('modal-gestao');
    await page.waitForTimeout(900);

    await page.getByRole('button', { name: 'Definir', exact: true }).click();
    await page.waitForTimeout(400);

    // ev0 no mock ja vem com u0 e u3; usar um post SEM responsavel isola o caso.
    const chips = page.locator('button[aria-pressed]');
    const total = await chips.count();
    checar(total >= 2, `18. a lista de pessoas aparece (${total})`);

    // Desmarca tudo o que veio marcado, para comecar do zero.
    for (let i = 0; i < total; i++) {
        const c = chips.nth(i);
        if (await c.getAttribute('aria-pressed') === 'true') {
            await c.click();
            await page.waitForTimeout(250);
        }
    }
    const marcadosZero = await page.locator('button[aria-pressed="true"]').count();
    checar(marcadosZero === 0, `18. começa sem ninguém marcado (${marcadosZero})`);

    // PRIMEIRO clique: a etiqueta tem que ACENDER sem passar por "Salvar".
    await chips.nth(0).click();
    await page.waitForTimeout(400);
    checar(await chips.nth(0).getAttribute('aria-pressed') === 'true',
        '18. o primeiro acende no clique, sem salvar');

    // SEGUNDO clique em OUTRA pessoa: o primeiro tem que continuar marcado.
    await chips.nth(1).click();
    await page.waitForTimeout(400);
    const doisMarcados = await page.locator('button[aria-pressed="true"]').count();
    checar(doisMarcados === 2,
        `18. marcar o segundo NÃO apaga o primeiro (${doisMarcados} marcados)`);

    // E a escrita tem que refletir os dois, nao so o ultimo.
    const w = await writes(page);
    const ultima = w.filter(x => x.op === 'update' && Array.isArray(x.data?.responsaveis)).pop();
    checar(Boolean(ultima) && ultima.data.responsaveis.length === 2,
        `18. a gravação leva os dois uids: ${ultima ? JSON.stringify(ultima.data.responsaveis) : '(nada)'}`);

    // E o "Salvar" do modal NAO pode reescrever este campo por cima.
    await page.getByRole('tab', { name: /Informação/ }).click();
    await page.waitForTimeout(400);
    const salvo = await page.evaluate(() => globalThis.__save || null);
    checar(salvo === null, '18. (controle) nada salvo ainda');
    await page.close();
}

// A prova de que o "Salvar" nao carrega mais `responsaveis`: o que o modal entrega
// nao tem o campo, entao gravar o texto do post nunca pode desfazer atribuicao.
{
    const { page, erros } = await abrir('modal-novo');
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Agendar', exact: true }).click();
    await page.waitForTimeout(300);
    const salvo = await page.evaluate(() => globalThis.__save || null);
    checar(Boolean(salvo) && !('responsaveis' in (salvo.campos || {})),
        '18b. o payload do Salvar não inclui responsaveis');
    checar(erros.length === 0, `18b. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.close();
}

// ----------------------------------------------------------------------- 19
// REORDENAR O CARROSSEL. A ordem era a de upload, sem volta: refazer a lamina 2
// mandava a peca corrigida para o fim e obrigava a subir as seis de novo.
{
    const { page, erros } = await abrir('modal-midia');
    await page.waitForTimeout(900);

    const posicoes = page.locator('select[aria-label^="Posição da peça"]');
    checar(await posicoes.count() === 3, `19. cada peça tem seletor de posição (${await posicoes.count()})`);
    checar(await page.getByText('capa', { exact: true }).count() === 1,
        '19. e a primeira peça é marcada como capa');

    /**
     * Ordem REAL das pecas na grade, pelo src.
     *
     * Le a grade que contem os seletores - nao qualquer `.grid` do modal - e usa o
     * src, que identifica o arquivo mesmo com a imagem sem carregar (o host de
     * exemplo nao existe). Antes eu tentava pelo `alt` da previa, que nessa tela
     * nem chega a ser renderizado.
     */
    const ordem = () => page.evaluate(() => {
        const sel = document.querySelector('select[aria-label^="Posição da peça"]');
        const grade = sel && sel.closest('.grid');
        return [...(grade ? grade.querySelectorAll('img') : [])]
            .map(i => (i.getAttribute('src') || '').split('/').pop());
    });

    const antes = await ordem();
    checar(antes.join(',') === 'peca-1.jpg,peca-2.jpg',
        `19. ordem inicial é a do upload: ${antes.join(', ')}`);

    // O caso do designer: a peca refeita esta atras e precisa ir para a frente.
    await posicoes.nth(1).selectOption('0');
    await page.waitForTimeout(700);
    const depois = await ordem();
    checar(depois.join(',') === 'peca-2.jpg,peca-1.jpg',
        `19. escolher a posição move a peça: ${depois.join(', ')}`);

    // Setas fazem o mesmo, um passo por vez.
    await page.getByRole('button', { name: /Mover peça 1 para frente/ }).click();
    await page.waitForTimeout(700);
    const comSeta = await ordem();
    checar(comSeta.join(',') === 'peca-1.jpg,peca-2.jpg',
        `19. e a seta devolve um passo: ${comSeta.join(', ')}`);

    checar(erros.length === 0, `19. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.screenshot({ path: 'dist-harness/v-reordenar.png' });
    await page.close();
}

// O TEMPLATE agora e de ENTREGA, por tipo de peca - e nao de acervo.
{
    const { page } = await abrir('ficha-cliente');
    await page.waitForTimeout(600);
    const texto = await page.locator('body').innerText();
    const esperados = ['Carrossel', 'Estático', 'Reels', 'Criativo', 'Contratos e Documentos'];
    checar(esperados.every(t => texto.includes(t)),
        `19b. o cadastro anuncia as pastas de entrega: ${esperados.filter(t => texto.includes(t)).join(', ')}`);
    checar(!texto.includes('Identidade Visual') && !texto.includes('Referências'),
        '19b. e não anuncia mais as de acervo (bruto foi para o Drive)');
    await page.close();
}

// ----------------------------------------------------------------------- 20
// MIDIA SEM DEPENDER DO "SALVAR". A ordem do carrossel ficava no rascunho: reordenar
// e fechar sem salvar perdia o trabalho.
{
    const { page, erros } = await abrir('modal-midia');
    await page.waitForTimeout(900);

    const posicoes = page.locator('select[aria-label^="Posição da peça"]');
    await posicoes.nth(1).selectOption('0');
    await page.waitForTimeout(800);

    const w = await writes(page);
    const gravou = w.filter(x => x.op === 'update' && Array.isArray(x.data?.midias)).pop();
    checar(Boolean(gravou) && gravou.path.includes('/events/ev0'),
        `20. reordenar grava no evento na hora: ${gravou ? gravou.path : '(nada)'}`);
    checar(Boolean(gravou) && gravou.data.midias.length === 3
        && gravou.data.midias[0].path === 'p2',
        `20. e a lista gravada está na ordem nova: ${gravou ? gravou.data.midias.map(m => m.path).join(',') : '-'}`);

    // A previa le a MESMA lista ao vivo: o contador do carrossel prova que as tres
    // pecas chegaram nela, e nao so na grade de upload.
    checar(await page.getByText('1/3').count() === 1,
        '20. a prévia do feed usa a lista ao vivo');
    checar(erros.length === 0, `20. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.close();
}

// Em post NOVO a midia continua no rascunho - sem id nao ha o que atualizar - e
// PRECISA viajar na criacao, senao a publicacao nasce sem as pecas.
{
    const { page } = await abrir('modal-novo');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Escolher a pasta e enviar/ }).click();
    await page.waitForTimeout(500);
    const picker = page.getByRole('dialog', { name: 'Escolher pasta' });
    await picker.getByRole('button', { name: /^Imagens/ }).click();
    await page.waitForTimeout(400);
    await picker.getByRole('button', { name: /Usar “Imagens”/ }).click();
    await page.waitForTimeout(400);
    await page.locator('input[type=file]').first()
        .setInputFiles({ name: 'nova.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Agendar', exact: true }).click();
    await page.waitForTimeout(400);
    const salvo = await page.evaluate(() => globalThis.__save || null);
    checar(Boolean(salvo) && salvo.midias === 1 && Array.isArray(salvo.campos?.midias),
        `20b. post novo leva a mídia na criação: ${salvo ? salvo.midias : '-'} arquivo(s)`);
    await page.close();
}

// ----------------------------------------------------------------------- 21
// ATALHO DO DRIVE DENTRO DA PASTA. Antes era uma lista separada na raiz - segunda
// navegacao na mesma tela, sem relacao com a arvore.
{
    const { page, erros } = await abrir('materiais');
    await page.waitForTimeout(900);

    // Na raiz aparecem os dois do cadastro ANTIGO (sem `caminho`).
    checar(await page.getByText('Atalhos · bruto no Drive').count() === 1,
        '21. a raiz mostra a seção de atalhos');
    checar(await page.getByText('Material antigo sem pasta').count() === 1,
        '21. atalho do cadastro antigo continua aparecendo (sem caminho = raiz)');

    // E DENTRO de Imagens aparece o atalho daquela pasta, nao o da raiz.
    await page.locator('button:has-text("Imagens")').first().click();
    await page.waitForTimeout(900);
    checar(await page.getByText('Captação Agosto (bruto)').count() === 1,
        '21. dentro da pasta aparece o atalho daquela pasta');
    checar(await page.getByText('Material antigo sem pasta').count() === 0,
        '21. e não os das outras pastas');

    // Criar um atalho aqui grava com o caminho da pasta aberta.
    await page.getByRole('button', { name: /Atalho do Drive/ }).click();
    await page.waitForTimeout(400);
    await page.getByLabel('Nome do atalho').fill('Ensaio outubro');
    await page.getByLabel('Link do Drive').fill('https://drive.google.com/drive/folders/xyz');
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await page.waitForTimeout(700);

    const w = await writes(page);
    const criado = w.find(x => x.op === 'add' && x.path.includes('drive_links'));
    checar(Boolean(criado) && JSON.stringify(criado.data.caminho) === JSON.stringify(['Imagens']),
        `21. o atalho nasce com o caminho da pasta: ${criado ? JSON.stringify(criado.data.caminho) : '(nada)'}`);

    // Link perigoso e RECUSADO na entrada.
    await page.getByRole('button', { name: /Atalho do Drive/ }).click();
    await page.waitForTimeout(300);
    await page.getByLabel('Nome do atalho').fill('Malicioso');
    await page.getByLabel('Link do Drive').fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Criar', exact: true }).click();
    await page.waitForTimeout(500);
    const depois = await writes(page);
    checar(depois.filter(x => x.op === 'add' && x.path.includes('drive_links')).length === 1,
        '21. link javascript: é recusado antes de gravar');
    checar(await page.getByText(/link http ou https válido/).count() > 0,
        '21. e a tela diz por quê');
    checar(erros.length === 0, `21. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.screenshot({ path: 'dist-harness/v-atalhos.png' });
    await page.close();
}

// ----------------------------------------------------------------------- 22
// TESTE A/B. O risco aqui nao e a tela nao aparecer: e ela aparecer e editar a
// versao ERRADA. Com duas legendas na mesma tela, trocar de aba e continuar
// digitando na principal grava o texto da B em cima do post que vai publicado -
// e ninguem percebe ate o post sair. Por isso cada checagem abaixo compara o que
// esta NO CAMPO com a versao que a aba diz estar aberta.
{
    const { page, erros } = await abrir('modal-ab');
    await page.waitForTimeout(900);

    // O modal tem OUTRAS abas (Conteúdo / Gestão / Conversa): sem escopar no
    // tablist das versões, `getByRole('tab')` conta as duas coisas juntas.
    const legenda = page.getByLabel('Legenda / Copy');
    const abas = versoes(page);
    checar(await abas.count() === 3,
        `22. o post A/B mostra uma aba por versão (${await abas.count()}: A, B, C)`);
    checar(await existe(abas.filter({ hasText: 'principal' })),
        '22. a principal é uma delas, marcada como principal');
    checar(await existe(page.getByRole('button', { name: 'Adicionar versão' })),
        '22. e há como acrescentar outra versão');

    // A VENCEDORA. 780 interacoes na B contra 300 na principal - e a principal tem
    // alcance maior, que nao pode decidir (alcance se compra com verba).
    checar(await existe(abas.filter({ hasText: '★' })),
        '22. a versão com mais interação é marcada na aba');
    checar((await corpo(page)).includes('Mais interação até agora: versão B'),
        '22. e a tela diz qual é, por extenso');

    // Aba A: legenda e midia DO POST.
    const naA = await legenda.inputValue();
    checar(naA.startsWith('Legenda de exemplo'),
        `22. na principal, a legenda é a do post: "${naA.slice(0, 30)}"`);
    checar((await corpo(page)).includes('3 arquivo(s)'),
        '22. e as peças são as três do post');

    // Aba B: o campo tem que TROCAR de conteudo - legenda e arquivo.
    await versao(page, 'B').click();
    await page.waitForTimeout(500);
    checar(await legenda.inputValue() === 'Legenda da versão B, mais direta.',
        `22. abrir a B troca a legenda editada: "${(await legenda.inputValue()).slice(0, 30)}"`);
    checar((await corpo(page)).includes('1 arquivo(s)'),
        '22. e troca também a peça (a B tem a sua)');
    checar((await corpo(page)).includes('Editando a versão B'),
        '22. a tela avisa qual versão está aberta');

    // Aba C, criada vazia: se a legenda da B vazasse para ca, apareceria aqui.
    await versao(page, 'C').click();
    await page.waitForTimeout(400);
    checar(await legenda.inputValue() === '',
        `22. a C está vazia, sem herdar da B: "${await legenda.inputValue()}"`);

    // E voltar para a principal devolve o texto dela, intacto.
    await versao(page, 'principal').click();
    await page.waitForTimeout(400);
    checar(await legenda.inputValue() === naA,
        '22. voltar para a principal devolve a legenda dela sem alteração');
    checar(erros.length === 0, `22. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.screenshot({ path: 'dist-harness/v-ab.png' });
    await page.close();
}

// A legenda da variante e TEXTO DIGITADO: espera o "Salvar", como a do post. O que
// nao pode e o Salvar levar a legenda nova e devolver a MIDIA velha - a variante
// vive dentro de um array, e gravar o array inteiro e a unica forma.
{
    const { page, erros } = await abrir('modal-ab');
    await page.waitForTimeout(900);
    const legenda = page.getByLabel('Legenda / Copy');
    const daPrincipal = await legenda.inputValue();

    await versao(page, 'B').click();
    await page.waitForTimeout(400);
    await legenda.fill('Legenda reescrita da B');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.waitForTimeout(400);

    const salvo = await page.evaluate(() => globalThis.__save?.campos || null);
    const vb = (salvo?.variantes || []).find(v => v.id === 'vb');
    checar(Boolean(vb) && vb.copy === 'Legenda reescrita da B',
        `22b. o Salvar leva a legenda digitada na variante: "${vb ? vb.copy : '(nada)'}"`);
    checar(Boolean(vb) && vb.midias?.[0]?.path === 'pb1',
        `22b. e devolve a peça da variante junto, do que está gravado: ${vb ? JSON.stringify(vb.midias?.map(m => m.path)) : '-'}`);
    checar(salvo?.copy === daPrincipal,
        '22b. editar a B não encosta na legenda da principal');
    checar((salvo?.variantes || []).length === 2,
        `22b. e nenhuma versão se perde no caminho (${(salvo?.variantes || []).length})`);
    checar(erros.length === 0, `22b. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.close();
}

// CRIAR versao e ESTRUTURA, nao texto: grava na hora. Se esperasse o "Salvar", duas
// pessoas com o modal aberto criariam a "B" cada uma e a segunda apagaria a primeira.
{
    const { page, erros } = await abrir('modal-ab');
    await page.waitForTimeout(900);
    await page.getByRole('button', { name: 'Adicionar versão' }).click();
    await page.waitForTimeout(700);

    const gravou = (await writes(page))
        .filter(x => x.op === 'update' && Array.isArray(x.data?.variantes)).pop();
    checar(Boolean(gravou) && gravou.path.includes('/events/ev0'),
        `22c. criar versão grava no evento na hora: ${gravou ? gravou.path : '(nada)'}`);
    checar(Boolean(gravou) && gravou.data.variantes.length === 3
        && gravou.data.variantes[2].rotulo === 'D',
        `22c. e a nova entra como D: ${gravou ? gravou.data.variantes.map(v => v.rotulo).join(',') : '-'}`);
    checar(await versoes(page).count() === 4,
        `22c. a aba nova aparece sem recarregar (${await versoes(page).count()})`);
    checar(await page.getByLabel('Legenda / Copy').inputValue() === '',
        '22c. e já abre nela, vazia, para escrever');
    checar(erros.length === 0, `22c. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.close();
}

// TORNAR PRINCIPAL. A principal e o que o cliente ve, o que a grade mostra e o que
// vai publicado - por isso promover TROCA o conteudo de lugar em vez de mudar um
// ponteiro: nenhuma dessas telas precisa saber que variante existe.
{
    const { page, erros } = await abrir('modal-ab');
    await page.waitForTimeout(900);
    const legenda = page.getByLabel('Legenda / Copy');
    const daPrincipal = await legenda.inputValue();

    await versao(page, 'B').click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'tornar principal' }).click();
    await page.waitForTimeout(800);

    const gravou = (await writes(page))
        .filter(x => x.op === 'update' && Array.isArray(x.data?.variantes)).pop();
    checar(Boolean(gravou) && gravou.data.copy === 'Legenda da versão B, mais direta.',
        `22d. a legenda da B sobe para o post, gravada na hora: "${gravou ? String(gravou.data.copy).slice(0, 30) : '(nada)'}"`);
    checar(Boolean(gravou) && gravou.data.variantes.find(v => v.id === 'vb')?.copy === daPrincipal,
        '22d. e a antiga principal desce para a versão B');
    checar(Boolean(gravou) && gravou.data.midias?.[0]?.path === 'pb1',
        `22d. a peça troca junto com a legenda: ${gravou ? JSON.stringify(gravou.data.midias?.map(m => m.path)) : '-'}`);

    // A tela volta para a principal - agora com o conteudo da B dentro dela.
    checar(await versao(page, 'principal').getAttribute('aria-selected') === 'true',
        '22d. depois de promover, a tela mostra a principal');
    checar(await legenda.inputValue() === 'Legenda da versão B, mais direta.',
        '22d. com o conteúdo que acabou de subir');
    checar(erros.length === 0, `22d. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.close();
}

// DESLIGAR apaga legenda e escolha de pecas das secundarias. Confirmacao nao e
// enfeite: um clique errado aqui joga fora o trabalho de outra pessoa.
{
    const { page, erros } = await abrir('modal-ab');
    await page.waitForTimeout(900);

    let perguntou = '';
    let responder = false;
    page.on('dialog', async d => { perguntou = d.message(); responder ? await d.accept() : await d.dismiss(); });

    await page.getByRole('button', { name: 'desligar', exact: true }).click();
    await page.waitForTimeout(600);
    checar(/vers(ã|a)o/i.test(perguntou) && /2/.test(perguntou),
        `22e. desligar pergunta antes, dizendo quantas versões saem: "${perguntou.slice(0, 60)}"`);
    checar(await versoes(page).count() === 3,
        `22e. recusar mantém as versões (${await versoes(page).count()})`);
    checar((await writes(page)).filter(x => Array.isArray(x.data?.variantes)).length === 0,
        '22e. e não grava nada');

    responder = true;
    await page.getByRole('button', { name: 'desligar', exact: true }).click();
    await page.waitForTimeout(800);
    const gravou = (await writes(page))
        .filter(x => x.op === 'update' && Array.isArray(x.data?.variantes)).pop();
    checar(Boolean(gravou) && gravou.data.variantes.length === 0,
        `22e. confirmar remove as secundárias: ${gravou ? gravou.data.variantes.length + ' restante(s)' : '(não gravou)'}`);
    checar(await versoes(page).count() === 0
        && await existe(page.getByRole('button', { name: /Criar versão B/ })),
        '22e. e a tela volta a oferecer o teste A/B em vez das abas');

    // O post continua inteiro: desligar tira as VERSOES, nao o conteudo.
    checar((await page.getByLabel('Legenda / Copy').inputValue()).startsWith('Legenda de exemplo'),
        '22e. a legenda da principal fica');
    checar(erros.length === 0, `22e. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.close();
}

// MARCAR O A/B JA NA CRIACAO. Em post novo nao ha documento para gravar na hora,
// entao as versoes viajam no rascunho ate o "Agendar" - se ficassem fora dele, a
// pessoa escreveria a versao B na criacao e ela nasceria sem nada.
{
    const { page, erros } = await abrir('modal-novo');
    await page.waitForTimeout(600);

    checar(await existe(page.getByRole('button', { name: /Criar versão B/ })),
        '22g. na criação já dá para marcar o conteúdo como A/B');
    await page.getByRole('button', { name: /Criar versão B/ }).click();
    await page.waitForTimeout(500);
    checar(await versoes(page).count() === 2,
        `22g. e as abas aparecem antes de o post existir (${await versoes(page).count()})`);

    await page.getByLabel('Legenda / Copy').fill('Legenda da B escrita na criação');
    await versao(page, 'principal').click();
    await page.waitForTimeout(300);
    await page.getByLabel('Legenda / Copy').fill('Legenda da principal');
    await page.getByRole('button', { name: 'Agendar', exact: true }).click();
    await page.waitForTimeout(400);

    const salvo = await page.evaluate(() => globalThis.__save?.campos || null);
    checar(salvo?.copy === 'Legenda da principal',
        `22g. o Agendar leva a legenda da principal: "${salvo ? salvo.copy : '(nada)'}"`);
    checar((salvo?.variantes || []).length === 1
        && salvo.variantes[0].copy === 'Legenda da B escrita na criação',
        `22g. e a versão B nasce junto, com o texto dela: "${salvo?.variantes?.[0]?.copy || '(nada)'}"`);
    checar(erros.length === 0, `22g. sem erro de JavaScript${erros.length ? ': ' + erros[0] : ''}`);
    await page.close();
}

// O CLIENTE nao ve versao nenhuma: ele aprova o post, e o post e a principal. Uma
// aba "B" na tela dele transformaria uma decisao interna em pergunta ao cliente.
{
    const { page } = await abrir('modal-cliente');
    await page.waitForTimeout(700);
    checar(await versoes(page).count() === 0 && !(await corpo(page)).includes('Teste A/B'),
        '22f. o cliente não vê o bloco de versões');
    await page.close();
}

await navegador.close();
servidor.close();

console.log('\nPASSOU:');
ok.forEach(m => console.log('  ok  ' + m));
if (falhas.length) {
    console.log('\nFALHOU:');
    falhas.forEach(m => console.log('  XX  ' + m));
}
process.exit(falhas.length ? 1 : 0);
