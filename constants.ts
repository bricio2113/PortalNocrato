// Fix: Import Idea type
import { CalendarEvent, EventType, EventStatus, WeeklyTask, Idea } from './types';

export const EVENT_TYPE_DETAILS: Record<EventType, { label: string; bg: string; text: string; border: string }> = {
  REELS: { label: 'Reels', bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
  POST: { label: 'Post', bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
  INSTAGRAM: { label: 'Instagram', bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-500' },
  TIKTOK: { label: 'TikTok', bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-500' },
  BLOG: { label: 'Blog', bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-500' },
  GRAVACAO: { label: 'Gravação', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500' },
  REUNIAO: { label: 'Reunião', bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-500' },
};

export const STATUS_OPTIONS: EventStatus[] = ['Agendado', 'Postado', 'Em produção', 'Gravado', 'Editado', 'Pendente'];
export const PLATAFORMA_OPTIONS: string[] = ['Instagram', 'TikTok', 'Blog', 'Facebook', 'YouTube'];


export const INITIAL_EVENTS: Omit<CalendarEvent, 'id'>[] = [
  { date: new Date(2025, 9, 20), title: 'Novo(a) post', type: 'POST', status: 'Pendente', proprietario: 'Carlos', plataforma: 'Blog', url: 'drive.google.com/...', copy: '' },
];

export const INITIAL_TASKS: Omit<WeeklyTask, 'id'>[] = [
  { text: 'Planejamento de conteúdo da próxima semana', completed: true },
  { text: 'Análise de métricas da campanha X', completed: false },
  { text: 'Criação dos criativos para anúncios', completed: false },
  { text: 'Agendamento de posts da semana', completed: true },
  { text: 'Relatório de performance mensal', completed: false },
];

// Fix: Add INITIAL_IDEAS constant
export const INITIAL_IDEAS: Omit<Idea, 'id'>[] = [
  { text: 'Uma campanha de reels mostrando os bastidores da empresa.', author: 'Cliente', timestamp: new Date(2025, 9, 1) },
  { text: 'Fazer uma live com especialistas do mercado para discutir tendências.', author: 'Agência', timestamp: new Date(2025, 8, 25) },
  { text: 'Criar um e-book com dicas exclusivas para nossos seguidores.', author: 'Cliente', timestamp: new Date(2025, 8, 15) },
];