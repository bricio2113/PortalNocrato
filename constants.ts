import { EventStatus, CalendarEvent, WeeklyTask, Idea } from './types';

// ATUALIZADO
export const STATUS_OPTIONS: EventStatus[] = [
  'Pendente',
  'Concluído',
  'Agendado',
  'Postado',
  'Editado',
  'Cancelado'
];

export const PLATAFORMA_OPTIONS = [
  'Instagram',
  'Facebook',
  'LinkedIn',
  'YouTube',
  'TikTok',
  'Blog',
  'Email',
  'Outro'
];

export const INITIAL_EVENTS: Omit<CalendarEvent, 'id'>[] = [];
export const INITIAL_TASKS: Omit<WeeklyTask, 'id'>[] = [];
export const INITIAL_IDEAS: Omit<Idea, 'id'>[] = [];