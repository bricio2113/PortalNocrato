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
