export enum View {
  CALENDAR = 'CALENDAR',
  UPDATES = 'UPDATES',
  IDEAS = 'IDEAS',
  PROFILE = 'PROFILE',
}

/**
 * Documento de usuario em usuarios/{uid}.
 *
 * nome, sobrenome e fotoUrl ficam aqui e nao no perfil do Firebase Auth porque
 * o SDK cliente nao le o perfil Auth de outra pessoa - e o painel da agencia
 * precisa exibir o nome dos clientes.
 */
export interface UserProfile {
  id: string;
  email: string;
  role: 'agencia' | 'cliente' | string;
  empresaId: string | null;
  nome?: string | null;
  sobrenome?: string | null;
  /** Data URI da foto recortada, ou URL https. Vazio = usar iniciais. */
  fotoUrl?: string | null;
  /**
   * Cargo/profissao: "Social Media", "Designer", "Tráfego". Etiqueta no card.
   *
   * So admin altera - as regras congelam este campo para o proprio usuario,
   * junto de role e empresaId. Cargo define como a pessoa e vista pela equipe;
   * quem se auto-intitula "Diretor" cria confusao, nao hierarquia.
   */
  cargo?: string | null;
}

/** Situacao comercial do cliente. Nao confundir com estagio de conteudo. */
export type EmpresaStatus = 'ativo' | 'pausado' | 'encerrado';

/**
 * Ficha do cliente - documento empresas/{id}.
 *
 * Antes tinha um campo: `nome`. Toda informacao de contato e contrato vivia na
 * cabeca de quem atende, ou num WhatsApp.
 *
 * O FINANCEIRO NAO ESTA AQUI de proposito: ver DadosFinanceiros.
 */
export interface Empresa {
  id: string;
  nome: string;
  /** @ do Instagram, sem arroba. Alimenta a previa do perfil. */
  handle?: string | null;
  /** Nicho: "Saude e bem-estar", "Financas". Vira etiqueta no card. */
  segmento?: string | null;
  status?: EmpresaStatus;
  whatsapp?: string | null;
  email?: string | null;
  cidade?: string | null;
  /** Como o cliente chegou: indicacao, trafego, prospeccao. */
  origem?: string | null;
  /** Observacoes da equipe. O cliente LE o proprio documento - nao escreva
   *  aqui nada que voce nao diria na frente dele. Ver nota em firestore.rules. */
  notasInternas?: string | null;
  redes?: {
    instagram?: string | null;
    tiktok?: string | null;
    facebook?: string | null;
    linkedin?: string | null;
    youtube?: string | null;
    site?: string | null;
  };
  criadoEm?: Date | null;
  criadoPor?: string | null;
}

/**
 * Dados financeiros - vive em SUBCOLECAO, nao no documento principal.
 *
 * empresas/{id}/_financeiro/dados     - so admin le e escreve
 * usuarios/{uid}/_financeiro/dados    - admin e a propria pessoa
 *
 * POR QUE SUBCOLECAO: o Firestore nao tem permissao por campo na leitura. Quem
 * pode ler o documento le TODOS os campos dele. O cliente le o proprio
 * `empresas/{id}` (precisa, para o nome aparecer no portal), e a equipe inteira
 * le `usuarios/{uid}` (precisa, para o painel listar as pessoas). Um campo
 * `financeiro` dentro desses documentos seria visivel para eles - "so admin ve"
 * seria mentira da interface, com o dado trafegando no navegador de quem nao
 * deveria. Subcolecao propria e a unica forma de esconder de verdade.
 */
export interface DadosFinanceiros {
  /** Em centavos, para nao carregar erro de ponto flutuante em dinheiro. */
  valorMensalCentavos?: number | null;
  /** Dia do mes do vencimento, 1 a 31. */
  diaVencimento?: number | null;
  inicioContrato?: Date | null;
  /** O que esta contratado: "4 reels + 8 carrosseis/mes". */
  escopo?: string | null;
  observacoes?: string | null;
  atualizadoEm?: Date | null;
  atualizadoPor?: string | null;
}

export type EventStatus = 'Pendente' | 'Em andamento' | 'Concluído' | 'Agendado' | 'Postado' | 'Cancelado' | 'Editado';

// Formatos oferecidos pelo EventDetailModal (FORMATO_OPTIONS em constants.ts).
// O union anterior era 'POST' | 'STORY' | ... em caixa alta e nunca bateu com
// o que a interface grava; getTypeStyles normaliza com toUpperCase(), entao
// documentos antigos em caixa alta continuam sendo exibidos corretamente.
export type EventType = 'Post' | 'Reel' | 'Criativo' | 'Tráfego' | 'Story' | 'Vídeo' | 'Carrossel' | 'Outro';

// Estado de aprovacao do cliente. Separado de EventStatus de proposito:
// status descreve a producao interna da agencia, aprovacao descreve a decisao
// do cliente. Misturar os dois em um unico campo foi o que tornou a lista de
// status confusa ("Editado" e producao ou aprovacao?).
export type ApprovalState = 'aguardando' | 'aprovado' | 'ajuste_solicitado';

// Metricas do post depois de publicado. Preenchidas pela agencia; o portal
// existe para mostrar o que foi feito, e sem isto nunca responde se funcionou.
export interface EventMetrics {
  alcance?: number | null;
  interacoes?: number | null;
  cliques?: number | null;
  /** Quando as metricas foram atualizadas pela ultima vez. */
  atualizadoEm?: Date | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: EventType;
  status: EventStatus;
  plataforma: string;
  proprietario?: string | null;
  url?: string;
  finalUrl?: string;
  copy?: string;
  description?: string;

  /**
   * Prazo de PRODUCAO - quando a peca precisa estar pronta internamente.
   *
   * Separado de `date`, que e a data de publicacao acordada com o cliente.
   * Interno da agencia: ver utils/deadline.ts para o motivo de nao aparecer no
   * portal do cliente. Ausente = sem prazo definido, o que e um estado
   * legitimo e nao vira atraso.
   */
  prazoProducao?: Date | null;

  /** Ausente em posts criados antes da aprovacao existir: tratar como 'aguardando'. */
  approval?: ApprovalState;
  /** E-mail de quem aprovou ou pediu ajuste, para o historico. */
  approvalBy?: string | null;
  /** Nome de quem decidiu, copiado no momento da decisao (ver PostComment). */
  approvalByName?: string | null;
  approvalAt?: Date | null;

  /**
   * Imagem de previa definida a mao pela agencia. Tem prioridade sobre tudo:
   * e o conserto de quando a resolucao automatica escolhe o arquivo errado.
   */
  previewUrl?: string;

  /**
   * Capa resolvida automaticamente a partir da pasta do Drive (utils/driveCover).
   * Separada de previewUrl de proposito: reresolver nao pode sobrescrever a
   * escolha manual de ninguem.
   */
  coverUrl?: string | null;
  coverResolvedAt?: Date | null;

  metrics?: EventMetrics;
}

/** Comentario de uma publicacao. Vive em empresas/{id}/post_comments. */
export interface PostComment {
  id: string;
  eventId: string;
  authorEmail: string;
  /**
   * Nome do autor copiado para dentro do comentario.
   *
   * Nao e cache por preguica: as regras so deixam alguem ler usuarios/{uid} se
   * for o proprio documento ou se for da agencia. Logo o cliente NAO consegue
   * buscar o nome do membro da agencia que comentou. Sem copiar aqui, a conversa
   * apareceria com e-mail cru para um dos lados.
   */
  authorName?: string | null;
  authorRole: 'agencia' | 'cliente';
  text: string;
  createdAt: Date;
}

/**
 * Relatorio mensal de um cliente. Vive em empresas/{id}/relatorios/{aaaa-mm}.
 *
 * O id e o proprio periodo (ex.: "2026-07") de proposito: garante um relatorio
 * por mes sem precisar de consulta para checar duplicidade, e ordena
 * alfabeticamente na ordem cronologica.
 */
export interface MonthlyReport {
  /** "aaaa-mm" */
  id: string;
  ano: number;
  mes: number;
  /** Leitura do mes: o que aconteceu e o que isso significa. */
  resumo: string;
  /** Destaques em linhas curtas, uma por item. */
  destaques?: string | null;
  /** Link para material complementar (apresentacao, planilha). */
  linkUrl?: string | null;
  /** Numeros consolidados do mes, preenchidos pela agencia. */
  alcance?: number | null;
  interacoes?: number | null;
  seguidores?: number | null;
  publicados?: number | null;
  criadoPor?: string | null;
  criadoEm?: Date | null;
  atualizadoEm?: Date | null;
}

export interface WeeklyTask {
  id: string;
  text: string;
  completed: boolean;
}

export interface Idea {
  id: string;
  text: string;
  author: string;
  timestamp: Date;
}