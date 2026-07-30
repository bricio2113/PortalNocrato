export enum View {
  CALENDAR = 'CALENDAR',
  UPDATES = 'UPDATES',
  IDEAS = 'IDEAS',
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
  approvalAt?: Date | null;

  /** Imagem/video de previa. Se vazio, caimos no `url` do material bruto. */
  previewUrl?: string;

  metrics?: EventMetrics;
}

/** Comentario de uma publicacao. Vive em empresas/{id}/post_comments. */
export interface PostComment {
  id: string;
  eventId: string;
  authorEmail: string;
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