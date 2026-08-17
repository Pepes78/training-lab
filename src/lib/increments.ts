import type { Equipment, Exercise } from '@/types/catalog'

/* ============================================================================
 *  Salto de carga por ejercicio
 * ----------------------------------------------------------------------------
 *  Ningun gimnasio sube de 2,5 en 2,5 en todo. Una barra sube por pares de
 *  discos, unas mancuernas van de 2 en 2, y una polea o una maquina de pines
 *  solo admite las placas que tiene. Ofrecer cargas que el aparato no puede dar
 *  es pedirle al usuario que haga la conversion mentalmente cada serie.
 *
 *  El salto se guarda EN EL EJERCICIO, no en la serie: se configura una vez y
 *  las semanas siguientes ya ofrecen las cargas correctas.
 *
 *  Prioridad: lo que haya elegido el usuario para ese ejercicio > el valor por
 *  defecto de su material > el incremento global de Ajustes.
 * ========================================================================== */

/** Salto tipico por material, en kilos. */
const BY_EQUIPMENT: Record<Equipment, number> = {
  barbell: 2.5, // par de discos de 1,25
  'ez-bar': 2.5,
  smith: 2.5,
  dumbbell: 2, // las mancuernas de gimnasio suelen ir de 2 en 2
  kettlebell: 4,
  machine: 5, // placas de la pila
  cable: 5,
  band: 0, // no hay carga discreta que ofrecer
  bodyweight: 1.25, // lastre
  other: 2.5,
}

/** Como se nombra el origen del salto, para el pie del control. */
const SOURCE_LABEL: Record<Equipment, (kg: number) => string> = {
  barbell: (kg) => `Barra · saltos de ${fmt(kg)} kg`,
  'ez-bar': (kg) => `Barra EZ · saltos de ${fmt(kg)} kg`,
  smith: (kg) => `Multipower · saltos de ${fmt(kg)} kg`,
  dumbbell: (kg) => `Mancuernas · pares de ${fmt(kg)} en ${fmt(kg)} kg`,
  kettlebell: (kg) => `Kettlebell · saltos de ${fmt(kg)} kg`,
  machine: (kg) => `Maquina · placas de ${fmt(kg)} kg`,
  cable: (kg) => `Polea · placas de ${fmt(kg)} kg`,
  band: () => 'Banda · sin carga discreta',
  bodyweight: (kg) => `Peso corporal · lastre de ${fmt(kg)} kg`,
  other: (kg) => `Saltos de ${fmt(kg)} kg`,
}

/** Formato espanol: coma decimal y sin ceros de relleno. */
export function fmt(kg: number): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(kg)
}

export function defaultIncrement(exercise: Exercise): number {
  return BY_EQUIPMENT[exercise.equipment]
}

/**
 * Salto efectivo de un ejercicio.
 * `overrides` son los saltos que el usuario ha fijado, por id de ejercicio.
 */
export function incrementFor(
  exercise: Exercise,
  overrides: Record<string, number>,
  fallback: number,
): number {
  const custom = overrides[exercise.id]
  if (custom !== undefined && custom > 0) return custom
  const byEquipment = defaultIncrement(exercise)
  return byEquipment > 0 ? byEquipment : fallback
}

/** Pie del control: de donde sale el salto y si esta guardado a mano. */
export function incrementSource(
  exercise: Exercise,
  overrides: Record<string, number>,
  fallback: number,
): string {
  const kg = incrementFor(exercise, overrides, fallback)
  const base = SOURCE_LABEL[exercise.equipment](kg)
  return overrides[exercise.id] !== undefined ? `${base} · guardado en el ejercicio` : base
}

/**
 * Saltos ofrecidos en la hoja de ajuste. Se parte de los habituales y se
 * incluye siempre el del material y el ya guardado, para que la opcion activa
 * este presente aunque sea inusual.
 */
export function incrementOptions(
  exercise: Exercise,
  overrides: Record<string, number>,
): number[] {
  const common = [1.25, 2.5, 5, 10]
  const set = new Set<number>(common)
  const byEquipment = defaultIncrement(exercise)
  if (byEquipment > 0) set.add(byEquipment)
  const custom = overrides[exercise.id]
  if (custom !== undefined && custom > 0) set.add(custom)
  return [...set].sort((a, b) => a - b)
}

/** Redondea al multiplo del salto mas cercano; nunca por debajo de cero. */
export function snapToIncrement(kg: number, increment: number): number {
  if (increment <= 0) return Math.max(0, Math.round(kg * 100) / 100)
  return Math.max(0, Math.round(kg / increment) * increment)
}

export interface LoadOption {
  kg: number
  /** Diferencia respecto al sugerido, ya formateada ("+2,5 kg"). Vacia en el central. */
  delta: string
  kind: 'lower' | 'suggested' | 'higher'
}

/**
 * Las tres cargas del control: una por debajo, la sugerida y una por encima.
 *
 * Cada lateral muestra la diferencia REAL respecto a la sugerida, que depende
 * del aparato: en polea sera -5 y en mancuernas -2. No se etiquetan como
 * "suave" o "exigente" porque el numero ya lo dice sin interpretar nada.
 */
export function loadOptions(suggested: number, increment: number): LoadOption[] {
  const step = increment > 0 ? increment : 1
  const lower = Math.max(0, snapToIncrement(suggested - step, step))
  const mid = snapToIncrement(suggested, step)
  const higher = snapToIncrement(suggested + step, step)

  const options: LoadOption[] = []
  // Con cargas muy bajas el lateral inferior puede coincidir con la sugerida:
  // en ese caso no se ofrece, porque un boton que no cambia nada confunde.
  if (lower < mid) options.push({ kg: lower, delta: `−${fmt(mid - lower)} kg`, kind: 'lower' })
  options.push({ kg: mid, delta: '', kind: 'suggested' })
  options.push({ kg: higher, delta: `+${fmt(higher - mid)} kg`, kind: 'higher' })
  return options
}
