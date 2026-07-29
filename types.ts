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