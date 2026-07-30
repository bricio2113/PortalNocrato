import { EventStatus, EventType, CalendarEvent, WeeklyTask, Idea } from './types';

// Bootstrap da agencia. Estes e-mails ganham role 'agencia' no primeiro
// login, antes de existir documento em usuarios/.
//
// IMPORTANTE: a mesma lista existe em firestore.rules (isAgencyEmail).
// Alterar aqui exige alterar la e publicar as regras - caso contrario o
// front libera a tela de admin e o banco recusa as leituras.
export const AGENCY_EMAILS = [
  'briciomarketing@gmail.com',
  'briciomarketing@mail.com'
];

// Endpoint que remove o usuario do Firebase Auth (o documento em
// usuarios/ e apagado direto pelo cliente).
export const DELETE_USER_ENDPOINT =
  'https://us-central1-agencia-nocrato.cloudfunctions.net/deleteUser';

export const STATUS_OPTIONS: EventStatus[] = [
  'Pendente',
  'Agendado',
  'Em andamento',
  'Concluído',
  'Postado',
  'Editado',
  'Cancelado'
];

// Fonte unica dos formatos. Estava duplicado dentro do EventDetailModal.
export const FORMATO_OPTIONS: EventType[] = [
  'Post',
  'Reel',
  'Criativo',
  'Tráfego',
  'Story',
  'Vídeo',
  'Carrossel',
  'Outro'
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