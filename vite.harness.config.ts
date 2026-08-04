import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const MOCK = path.resolve(__dirname, 'harness/mockFirebase.ts');
const REAL = path.resolve(__dirname, 'utils/firebase');

/**
 * Troca utils/firebase pelo mock, seja como o import for escrito.
 *
 * O alias anterior era a regex /^(\.\.\/)?utils\/firebase$/, que casava
 * `../utils/firebase` (usado pelos componentes) mas NAO `./firebase` - a forma
 * que utils/posts.ts, utils/reports.ts, utils/empresas.ts e utils/seed.ts usam,
 * por estarem na mesma pasta.
 *
 * Consequencia: esses modulos carregavam o Firebase DE VERDADE dentro do
 * harness. Sem rede eles falham calados, entao os contadores de pendencia e os
 * relatorios apareciam sempre zerados e a ficha de cliente nao gravava - e a
 * auditoria dava tudo por bom, porque nao havia erro nenhum no console.
 *
 * Resolver por caminho ABSOLUTO em vez de por texto do import elimina a classe
 * inteira do problema: nao importa como o especificador foi escrito.
 */
const mockFirebase = () => ({
    name: 'harness-mock-firebase',
    enforce: 'pre' as const,
    resolveId(source: string, importer?: string) {
        if (source === MOCK) return MOCK;
        // Nao mexer em 'firebase/compat/app' e afins: so no nosso modulo.
        if (!/(^\.|utils\/firebase$)/.test(source)) return null;
        const abs = source.startsWith('.') && importer
            ? path.resolve(path.dirname(importer), source)
            : source;
        return abs.replace(/\.(ts|js)$/, '') === REAL || /utils\/firebase$/.test(abs) ? MOCK : null;
    }
});

// Config SEPARADA do build de producao: troca o Firebase por um mock para
// conseguir renderizar as telas com conteudo e medir o layout de verdade.
export default defineConfig({
    root: '.',
    plugins: [mockFirebase(), react()],
    resolve: { alias: [{ find: '@', replacement: path.resolve(__dirname, '.') }] },
    build: { outDir: 'dist-harness', rollupOptions: { input: path.resolve(__dirname, 'harness/index.html') } }
});
