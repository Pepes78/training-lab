/* ============================================================================
 *  Fechas
 * ----------------------------------------------------------------------------
 *  Todo se guarda como ISO yyyy-mm-dd en hora LOCAL. Usar toISOString() seria
 *  un error: convierte a UTC y a partir de las 22:00 en Espana un entreno
 *  aparece registrado al dia siguiente.
 * ========================================================================== */

export function toISODate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / 86_400_000)
}

/** Semana del ciclo (1-indexada) en la que cae una fecha. */
export function weekOf(startDate: string, date: string): number {
  return Math.floor(daysBetween(startDate, date) / 7) + 1
}

/** Lunes de la semana n de un ciclo. */
export function weekStart(startDate: string, week: number): string {
  return addDays(startDate, (week - 1) * 7)
}

/** Lunes de la semana en curso, para arrancar un ciclo en un limite limpio. */
export function mondayOfCurrentWeek(): string {
  const d = new Date()
  const dow = (d.getDay() + 6) % 7 // 0 = lunes
  d.setDate(d.getDate() - dow)
  return toISODate(d)
}

const MONTHS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

export function formatShort(iso: string): string {
  const d = fromISODate(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function formatLong(iso: string): string {
  const d = fromISODate(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const DOW = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

export function weekdayName(iso: string): string {
  const d = fromISODate(iso)
  return DOW[(d.getDay() + 6) % 7]
}
