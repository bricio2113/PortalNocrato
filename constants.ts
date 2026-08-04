import { EventStatus, EventType, CalendarEvent, WeeklyTask, Idea } from './types';

// ADMINISTRADORES DA AGENCIA.
//
// Duas funcoes ao mesmo tempo:
//   1. bootstrap - ganham role 'agencia' no primeiro login, antes de existir
//      documento em usuarios/;
//   2. poder administrativo - so estes e-mails alteram permissao de alguem,
//      vinculam empresa, criam/excluem cliente e removem conta.
//
// Todo o resto da equipe continua com role 'agencia' e faz o trabalho de
// conteudo normalmente, sem mexer em acesso. Ver utils/permissions.ts.
//
// IMPORTANTE: a mesma lista existe em firestore.rules (isAdminEmail).
// Alterar aqui exige alterar la e publicar as regras - caso contrario a
// interface libera o botao e o banco recusa a escrita.
//
// Sempre em minusculas: a comparacao normaliza para minusculas dos dois lados.
export const ADMIN_EMAILS = [
  'pedro.vidal2608@gmail.com',
  'briciomarketing@gmail.com'
];

/**
 * Mantido como alias de ADMIN_EMAILS porque o bootstrap e o mesmo conjunto.
 * @deprecated Use ADMIN_EMAILS, ou isAdmin()/isAgencyMember() de utils/permissions.
 */
export const AGENCY_EMAILS = ADMIN_EMAILS;

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