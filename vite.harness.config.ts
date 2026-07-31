import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config SEPARADA do build de producao: troca o Firebase por um mock para
// conseguir renderizar as telas com conteudo e medir o layout de verdade.
export default defineConfig({
    root: '.',
    plugins: [react()],
    resolve: {
        alias: [
            { find: /^(\.\.\/)?utils\/firebase$/, replacement: path.resolve(__dirname, 'harness/mockFirebase.ts') },
            { find: '@', replacement: path.resolve(__dirname, '.') }
        ]
    },
    build: { outDir: 'dist-harness', rollupOptions: { input: path.resolve(__dirname, 'harness/index.html') } }
});
