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