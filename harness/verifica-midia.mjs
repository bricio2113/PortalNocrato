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

// ---------------------------------------------------------------- 1 e 2 e 3
{
    const { page, erros } = await abrir('modal-novo');
    checar(await page.getByText('Mídia da publicação').isVisible(),
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

await navegador.close();
servidor.close();

console.log('\nPASSOU:');
ok.forEach(m => console.log('  ok  ' + m));
if (falhas.length) {
    console.log('\nFALHOU:');
    falhas.forEach(m => console.log('  XX  ' + m));
}
process.exit(falhas.length ? 1 : 0);
