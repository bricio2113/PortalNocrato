import React, { useEffect, useState } from 'react';
import { imagemParaThumb, dataUrlBytes, MAX_THUMB_BYTES } from '../utils/thumbnail';

/**
 * Banco de provas do redimensionamento.
 *
 * A afirmacao "60x menos saida de dados" e a razao de existir da miniatura, e
 * ela e mensuravel: gera imagens sinteticas de tamanhos e conteudos diferentes,
 * roda o mesmo codigo que o app roda, e mede o resultado. Sem isto a economia
 * seria so uma conta no comentario.
 *
 * Ruido aleatorio de proposito num dos casos: foto real comprime bem, ruido
 * comprime pessimo. Se o teto de 120 KB aguenta ruido, aguenta qualquer foto.
 */
const gerar = (largura: number, altura: number, ruido: boolean): Promise<File> =>
    new Promise(resolve => {
        const canvas = document.createElement('canvas');
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext('2d')!;
        if (ruido) {
            const img = ctx.createImageData(largura, altura);
            for (let i = 0; i < img.data.length; i += 4) {
                img.data[i] = Math.random() * 255;
                img.data[i + 1] = Math.random() * 255;
                img.data[i + 2] = Math.random() * 255;
                img.data[i + 3] = 255;
            }
            ctx.putImageData(img, 0, 0);
        } else {
            const grad = ctx.createLinearGradient(0, 0, largura, altura);
            grad.addColorStop(0, '#FABE01');
            grad.addColorStop(1, '#111111');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, largura, altura);
        }
        canvas.toBlob(b => resolve(new File([b!], 'teste.png', { type: 'image/png' })), 'image/png');
    });

const CASOS: [string, number, number, boolean][] = [
    ['foto de celular 4032x3024', 4032, 3024, false],
    ['quadrado 2048x2048 com ruido', 2048, 2048, true],
    ['story vertical 1080x1920', 1080, 1920, false],
    ['ja pequena 300x300', 300, 300, false]
];

const ThumbBench: React.FC = () => {
    const [linhas, setLinhas] = useState<string[]>([]);

    useEffect(() => {
        (async () => {
            const saida: string[] = [];
            for (const [nome, w, h, ruido] of CASOS) {
                try {
                    const file = await gerar(w, h, ruido);
                    const t0 = performance.now();
                    const thumb = await imagemParaThumb(file);
                    const ms = Math.round(performance.now() - t0);
                    const bytes = dataUrlBytes(thumb);
                    const img = new Image();
                    await new Promise(r => { img.onload = r; img.src = thumb; });
                    saida.push(JSON.stringify({
                        caso: nome,
                        originalKB: Math.round(file.size / 1024),
                        thumbKB: Math.round(bytes / 1024),
                        reducao: `${(file.size / bytes).toFixed(1)}x`,
                        dimensoes: `${img.naturalWidth}x${img.naturalHeight}`,
                        proporcaoMantida: Math.abs((img.naturalWidth / img.naturalHeight) - (w / h)) < 0.02,
                        dentroDoTeto: bytes <= MAX_THUMB_BYTES,
                        ms
                    }));
                } catch (e) {
                    saida.push(JSON.stringify({ caso: nome, erro: String(e) }));
                }
            }
            setLinhas(saida);
        })();
    }, []);

    return (
        <div className="p-6 bg-[#111111] min-h-screen text-zinc-200 font-mono text-xs">
            <h1 className="text-white font-bold mb-4">Banco de provas: miniatura</h1>
            <div id="resultado">{linhas.map((l, i) => <div key={i} className="mb-1">{l}</div>)}</div>
            {linhas.length === CASOS.length && <div id="pronto">pronto</div>}
        </div>
    );
};

export default ThumbBench;
