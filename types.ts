
export enum View {
  CALENDAR,
  UPDATES,
  IDEAS,
}

export type EventType = 'REELS' | 'POST' | 'INSTAGRAM' | 'TIKTOK' | 'BLOG' | 'GRAVACAO' | 'REUNIAO';
export type EventStatus = 'Agendado' | 'Pendente' | 'Em produção' | 'Gravado' | 'Editado' | 'Postado';


export interface CalendarEvent {
  id: string;
  date: Date;
  title: string;
  type: EventType;
  description?: string;
  status: EventStatus;
  proprietario: string | null;
  plataforma: string;
  url: string;
  copy?: string;
}

export interface WeeklyTask {
  id: string;
  text: string;
  completed: boolean;
}

// Fix: Add Idea interface
export interface Idea {
  id: string;
  text: string;
  author: string;
  timestamp: Date;
}