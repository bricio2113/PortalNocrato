import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT = 'dist-harness';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' || p === '/harness/' ) p = '/harness/index.html';
    const file = path.join(ROOT, p);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(4173, r));

const SCREENS = ['login','signup','verificacao','perfil-obrigatorio','perfil','painel','cliente-workspace','calendario','producao','semana','arquivos','relatorios','modal'];
const VIEWPORTS = [{ name: '360', width: 360, height: 740 }, { name: '390', width: 390, height: 844 }];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const problemas = [];

for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    for (const screen of SCREENS) {
        const page = await ctx.newPage();
        const erros = [];
        page.on('pageerror', e => erros.push(String(e).slice(0, 120)));
        await page.goto(`http://localhost:4173/harness/index.html?screen=${screen}`, { waitUntil: 'load' });
        await page.waitForTimeout(500);

        const r = await page.evaluate(() => {
            const doc = document.documentElement;
            const overflow = doc.scrollWidth - doc.clientWidth;
            const culpados = [];
            if (overflow > 1) {
                document.querySelectorAll('*').forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.right > doc.clientWidth + 1 && rect.width > 40) {
                        // so o mais externo interessa
                        const pai = el.parentElement;
                        const paiRect = pai?.getBoundingClientRect();
                        if (!paiRect || paiRect.right <= doc.clientWidth + 1) {
                            culpados.push({
                                tag: el.tagName.toLowerCase(),
                                cls: (el.className?.toString?.() || '').slice(0, 90),
                                largura: Math.round(rect.width),
                                excesso: Math.round(rect.right - doc.clientWidth)
                            });
                        }
                    }
                });
            }
            // alvos de toque pequenos demais (< 32px)
            const pequenos = [];
            document.querySelectorAll('button, a, [role="button"]').forEach(el => {
                const rc = el.getBoundingClientRect();
                if (rc.width > 0 && (rc.width < 32 || rc.height < 32)) {
                    pequenos.push(`${Math.round(rc.width)}x${Math.round(rc.height)} ${(el.textContent||el.getAttribute('aria-label')||el.tagName).trim().slice(0,28)}`);
                }
            });
            return { overflow, culpados: culpados.slice(0, 4), pequenos: [...new Set(pequenos)].slice(0, 5) };
        });

        if (r.overflow > 1 || erros.length) {
            problemas.push({ vp: vp.name, screen, ...r, erros });
        }
        if (vp.name === '390') {
            await page.screenshot({ path: `dist-harness/shot-${screen}.png`, fullPage: false });
        }
        await page.close();
    }
    await ctx.close();
}
await browser.close();
server.close();

console.log('\n===== OVERFLOW HORIZONTAL / ERROS =====');
if (problemas.length === 0) console.log('  nenhum overflow detectado');
for (const p of problemas) {
    console.log(`\n[${p.vp}px] ${p.screen}  excesso=${p.overflow}px`);
    p.culpados.forEach(c => console.log(`    <${c.tag}> ${c.largura}px (+${c.excesso}) .${c.cls}`));
    p.erros.forEach(e => console.log(`    ERRO JS: ${e}`));
}
