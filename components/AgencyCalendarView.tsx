import React, { useState, useMemo } from 'react';
import { Empresa } from '../types';
import { PendingCounts } from '../utils/posts';
import ClientSwitcher from './ClientSwitcher';
import CalendarView from './CalendarView';
import { EmptyState } from './ui';
import { CalendarDays } from 'lucide-react';

interface AgencyCalendarViewProps {
    empresas: Empresa[];
    /** Pendencias por cliente: acendem o anel de quem espera a agencia. */
    pendingByEmpresa: Record<string, PendingCounts>;
    userEmail?: string | null;
    userName?: string | null;
}

/**
 * Calendário de qualquer cliente, sem sair da tela.
 *
 * ESTA TELA JA EXISTIU E EU A REMOVI - errado. O argumento da remocao foi que ela
 * era "o mesmo CalendarView do cliente com um seletor em cima", e isso era verdade
 * sobre o COMPONENTE; nao era verdade sobre o que ela resolvia. Trocar de cliente
 * aqui e um clique; pelo caminho que sobrou sao quatro (voltar ao painel, achar o
 * cartao, entrar, ir em Calendário). Quem programa a semana de nove clientes faz
 * essa troca dezenas de vezes.
 *
 * A duplicacao que EXISTIA de verdade era outra: a tela antiga montava uma segunda
 * previa do feed ao lado, e o CalendarView ja tem a dele. Aqui nao ha nenhuma -
 * esta tela e o seletor mais o calendario, e o feed vem de dentro dele.
 *
 * O anel aceso nao e enfeite: e a mesma convencao do Instagram ("tem novidade
 * aqui") carregando informacao real - aquele cliente pediu ajuste e espera a
 * agencia. Por isso a tela ABRE no primeiro cliente que precisa de algo, em vez do
 * primeiro da ordem alfabetica.
 */
const AgencyCalendarView: React.FC<AgencyCalendarViewProps> = ({
    empresas, pendingByEmpresa, userEmail, userName
}) => {
    const [busca, setBusca] = useState('');
    /** null = ainda nao escolhido a mao; cai na sugestao. */
    const [escolhido, setEscolhido] = useState<string | null>(null);

    // Quem espera a agencia primeiro. Sem isto a tela abriria sempre no mesmo
    // cliente, e o que precisa de atencao ficaria escondido atras de um clique.
    const sugerido = useMemo(() => {
        const comPendencia = empresas.find(e => (pendingByEmpresa[e.id]?.aguardandoAgencia || 0) > 0);
        return comPendencia?.id || empresas[0]?.id || null;
    }, [empresas, pendingByEmpresa]);

    // `escolhido` so vale se o cliente ainda existe: excluir um cliente com a aba
    // aberta deixaria a tela apontando para um id morto.
    const selecionado = (escolhido && empresas.some(e => e.id === escolhido)) ? escolhido : sugerido;
    const empresa = empresas.find(e => e.id === selecionado) || null;

    if (empresas.length === 0) {
        return (
            <EmptyState
                icon={CalendarDays}
                title="Nenhum cliente cadastrado"
                description="O calendário mostra as publicações de um cliente. Cadastre o primeiro em Clientes."
            />
        );
    }

    return (
        <div>
            {/* Margem negativa: o seletor e uma faixa de ponta a ponta, como no
                topo do Instagram, e o miolo do painel tem respiro lateral. */}
            <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 mb-6">
                <ClientSwitcher
                    empresas={empresas.map(e => ({ id: e.id, nome: e.nome }))}
                    selectedId={selecionado}
                    onSelect={setEscolhido}
                    pendingByEmpresa={pendingByEmpresa}
                    search={busca}
                    onSearchChange={setBusca}
                />
            </div>

            {empresa && (
                <CalendarView
                    // key: trocar de cliente precisa REMONTAR o calendario. Sem
                    // isto o mes visitado, a publicacao aberta e as miniaturas do
                    // cliente anterior sobreviveriam a troca.
                    key={empresa.id}
                    empresaId={empresa.id}
                    empresaNome={empresa.nome}
                    perfilHandle={empresa.handle}
                    userRole="agencia"
                    userEmail={userEmail}
                    userName={userName}
                />
            )}
        </div>
    );
};

export default AgencyCalendarView;
