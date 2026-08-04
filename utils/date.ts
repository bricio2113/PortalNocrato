// Conversao entre Date e o valor de <input type="date"> (YYYY-MM-DD).
//
// Nao use toISOString() para isso: ele converte para UTC. No Brasil
// (UTC-3), um evento das 22h de 29/07 vira 30/07 em UTC e o campo passa a
// mostrar o dia seguinte - enquanto a grade do calendario, que compara com
// toDateString() local, continua mostrando 29/07.

/** Date -> "YYYY-MM-DD" usando os componentes locais da data. */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * "YYYY-MM-DD" -> Date a meia-noite local.
 * Retorna null se o valor estiver vazio ou incompleto (o input permite
 * estados parciais enquanto o usuario digita).
 */
export function fromDateInputValue(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

// --- HORA DA PUBLICACAO ---------------------------------------------------
//
// O post so tinha data. Um calendario editorial sem horario nao responde "que
// horas sai?", que e a segunda pergunta que todo cliente faz - e sem hora nao
// da para ordenar dois posts do mesmo dia.
//
// A hora vive no proprio campo `date`, nao em um campo separado: assim toda
// ordenacao, filtro por mes e comparacao com "agora" que ja existem continuam
// valendo sem tocar em nada.

/** Date -> "HH:MM" local, para <input type="time">. */
export function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Combina o DIA de `date` com a hora "HH:MM". Retorna a data original se o
 * valor estiver incompleto - o input permite estados parciais durante a
 * digitacao, e trocar a hora nao pode zerar o dia.
 */
export function withTime(date: Date, value: string): Date {
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return date;
  const out = new Date(date);
  out.setHours(h, m, 0, 0);
  return out;
}

/**
 * Meia-noite exata e tratada como "hora nao definida".
 *
 * Todo post criado antes deste campo existir esta em 00:00, e exibir "00:00"
 * neles seria inventar um horario que ninguem escolheu. O custo e nao
 * conseguir representar um post genuinamente a meia-noite - troca aceitavel:
 * ninguem publica as 00:00, e quem quiser pode usar 00:01.
 */
export function hasTime(date: Date): boolean {
  return date.getHours() !== 0 || date.getMinutes() !== 0;
}

/** "18:00", ou null quando a hora nao foi definida. */
export function formatTime(date: Date): string | null {
  return hasTime(date) ? toTimeInputValue(date) : null;
}
