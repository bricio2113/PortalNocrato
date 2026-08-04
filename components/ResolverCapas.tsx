import React, { useState, useMemo } from 'react';
import { db } from '../utils/firebase';
import { CalendarEvent } from '../types';
import { resolveDriveCover, describeCoverFailure, hasDriveApiKey } from '../utils/driveCover';
import { ImageDown, Loader2, Check, AlertTriangle, X } from 'lucide-react';

interface ResolverCapasProps {
    empresaId: string;
    events: CalendarEvent[];
}

/**
 * Busca a capa de cada post na pasta do Drive e grava.
 *
 * Vivia dentro da tela de calendarios da agencia - uma tela que era o proprio
 * CalendarView com um seletor de cliente em cima. Quando essa tela saiu (era o
 * MESMO calendario do cliente, mais uma segunda previa do feed), esta ferramenta
 * era a unica coisa que so existia la. Virou componente para nao ir embora junto.
 *
 * NAO RODA SOZINHA no carregamento: sao N chamadas de rede por cliente, e
 * disparar isso a cada abertura de tela queimaria cota da API sem ninguem pedir.
 */
const ResolverCapas: React.FC<ResolverCapasProps> = ({ empresaId, events }) => {
    const [rodando, setRodando] = useState(false);
    const [progresso, setProgresso] = useState({ feito: 0, total: 0, ok: 0 });
    const [relatorio, setRelatorio] = useState('');

    // Posts sem capa resolvida e sem escolha manual, mas com link de material
    // para tentar. Nao inclui quem ja tem previewUrl: sobrescrever a escolha
    // manual de alguem seria destruir trabalho.
    const pendentes = useMemo(
        () => events.filter(e => !e.previewUrl && !e.coverUrl && (e.url || e.finalUrl)),
        [events]
    );

    /**
     * Em serie, nao em paralelo.
     *
     * Disparar 80 fetches de uma vez rende 429 da Drive API e metade das capas
     * falha sem motivo aparente. Em serie leva mais tempo e termina.
     */
    const resolver = async () => {
        if (rodando || pendentes.length === 0) return;
        setRodando(true);
        setRelatorio('');
        setProgresso({ feito: 0, total: pendentes.length, ok: 0 });

        const falhas: Record<string, number> = {};
        let ok = 0;

        for (let i = 0; i < pendentes.length; i++) {
            const event = pendentes[i];
            const result = await resolveDriveCover(event.url || event.finalUrl);

            if (result.ok) {
                try {
                    await db.collection('empresas').doc(empresaId).collection('events').doc(event.id)
                        .update({ coverUrl: result.coverUrl, coverResolvedAt: new Date() });
                    ok++;
                } catch (error) {
                    console.error('Falha ao gravar capa:', error);
                    falhas['erro'] = (falhas['erro'] || 0) + 1;
                }
            } else {
                falhas[result.reason] = (falhas[result.reason] || 0) + 1;
            }
            setProgresso({ feito: i + 1, total: pendentes.length, ok });
        }

        const partes = [`${ok} de ${pendentes.length} capas resolvidas.`];
        Object.entries(falhas).forEach(([reason, count]) => {
            partes.push(`${count}: ${describeCoverFailure(reason as any)}`);
        });
        setRelatorio(partes.join(' '));
        setRodando(false);
    };

    // Sem chave da API a acao nao tem como funcionar; o botao apagado so geraria
    // a pergunta "por que nao faz nada".
    if (!hasDriveApiKey() || (pendentes.length === 0 && !relatorio)) return null;

    return (
        <div className="mb-4">
            {pendentes.length > 0 && (
                <button
                    onClick={resolver}
                    disabled={rodando}
                    title="Busca a capa na pasta do Drive de cada publicação"
                    className="flex items-center gap-2 text-xs font-semibold bg-white/5 hover:bg-white/10 text-zinc-300 px-3.5 py-2 rounded-full transition-colors disabled:opacity-50"
                >
                    {rodando
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {progresso.feito}/{progresso.total}</>
                        : <><ImageDown className="w-3.5 h-3.5" /> Resolver {pendentes.length} capa(s) pelo Drive</>}
                </button>
            )}

            {relatorio && (
                <div className="mt-2 flex items-start gap-2 text-xs bg-[#1A1A1A] border border-white/5 rounded-control px-3 py-2.5">
                    {progresso.ok === progresso.total
                        ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />}
                    <span className="text-zinc-400 leading-relaxed flex-1">{relatorio}</span>
                    <button onClick={() => setRelatorio('')} aria-label="Fechar" className="text-zinc-600 hover:text-zinc-300 shrink-0">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default ResolverCapas;
