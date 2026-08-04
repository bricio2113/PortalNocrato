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

await navegador.close();
servidor.close();

console.log('\nPASSOU:');
ok.forEach(m => console.log('  ok  ' + m));
if (falhas.length) {
    console.log('\nFALHOU:');
    falhas.forEach(m => console.log('  XX  ' + m));
}
process.exit(falhas.length ? 1 : 0);
