export enum View {
  CALENDAR = 'CALENDAR',
  UPDATES = 'UPDATES',
  IDEAS = 'IDEAS',
}

export type EventStatus = 'Pendente' | 'Concluído' | 'Agendado' | 'Postado' | 'Cancelado' | 'Editado';

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'POST' | 'STORY' | 'REELS' | 'VIDEO' | 'OUTRO';
  status: EventStatus;
  plataforma: string;
  proprietario?: string | null;
  url?: string;
  finalUrl?: string; // NOVO CAMPO ADICIONADO
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