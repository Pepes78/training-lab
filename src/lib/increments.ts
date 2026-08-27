import type { Equipment, Exercise } from '@/types/catalog'

/* ============================================================================
 *  Escalera de cargas de un ejercicio
 * ----------------------------------------------------------------------------
 *  Un aparato no admite cualquier peso: admite una lista concreta. Y esa lista
 *  casi nunca empieza en cero.
 *
 *  Una barra vacia ya pesa 20 kg y sube de 2,5 en 2,5. Una polea cuyo primer
 *  disco son 5 kg y va de 8 en 8 da 5, 13, 21, 29... nunca 8 ni 16. Modelar
 *  solo el salto e ir contando desde cero descuadra los numeros justo cuando
 *  miras la pila para comprobarlos.
 *
 *  Por eso la escalera son DOS datos:
 *      base  la carga mas baja que admite el aparato
 *      step  lo que sube de una posicion a la siguiente
 *
 *  Se guarda EN EL EJERCICIO: se configura una vez y las semanas siguientes ya
 *  ofrecen cargas que se pueden montar.
 * ========================================================================== */

export interface LoadLadder {
  /** Carga mas baja: barra vacia, primer disco de la pila, mancuerna mas ligera. */
  base: number
  /** Salto entre dos posiciones consecutivas. */
  step: number
}

/** Escalera tipica por material. Punto de partida, editable por ejercicio. */
const BY_EQUIPMENT: Record<Equipment, LoadLadder> = {
  barbell: { base: 20, step: 2.5 }, // barra olimpica + pares de 1,25
  'ez-bar': { base: 10, step: 2.5 },
  smith: { base: 20, step: 2.5 },
  dumbbell: { base: 2, step: 2 },
  kettlebell: { base: 4, step: 4 },
  machine: { base: 5, step: 5 }, // pila de discos
  cable: { base: 5, step: 5 },
  band: { base: 0, step: 0 }, // sin cargas discretas
  bodyweight: { base: 0, step: 1.25 }, // 0 = el propio cuerpo, luego lastre
  other: { base: 0, step: 2.5 },
}

/** Aparatos cuya pila se lee por numero de disco, no por kilos. */
export function usesPlateNumbers(exercise: Exercise): boolean {
  return exercise.equipment === 'machine' || exercise.equipment === 'cable'
}

const EQUIPMENT_NOUN: Record<Equipment, string> = {
  barbell: 'Barra',
  'ez-bar': 'Barra EZ',
  smith: 'Multipower',
  dumbbell: 'Mancuernas',
  kettlebell: 'Kettlebell',
  machine: 'Maquina',
  cable: 'Polea',
  band: 'Banda',
  bodyweight: 'Peso corporal',
  other: 'Aparato',
}

/** Formato espanol: coma decimal y sin ceros de relleno. */
export function fmt(kg: number): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(kg)
}

export function defaultLadder(exercise: Exercise): LoadLadder {
  return BY_EQUIPMENT[exercise.equipment]
}

/** true si el usuario ha configurado a mano la escalera de este ejercicio. */
export function isCustomLadder(exercise: Exercise, ladders: Record<string, LoadLadder>): boolean {
  return ladders[exercise.id] !== undefined
}

/**
 * Escalera efectiva. Lo configurado a mano manda sobre el valor del material;
 * `fallbackStep` solo entra cuando el material no define salto (bandas).
 */
export function ladderFor(
  exercise: Exercise,
  ladders: Record<string, LoadLadder>,
  fallbackStep: number,
): LoadLadder {
  const custom = ladders[exercise.id]
  if (custom && custom.step > 0) return custom
  const byEquipment = defaultLadder(exercise)
  return byEquipment.step > 0 ? byEquipment : { base: byEquipment.base, step: fallbackStep }
}

/** Carga real mas cercana dentro de la escalera. */
export function snapToLadder(kg: number, ladder: LoadLadder): number {
  if (ladder.step <= 0) return Math.max(0, Math.round(kg * 100) / 100)
  const positions = Math.round((kg - ladder.base) / ladder.step)
  const value = ladder.base + Math.max(0, positions) * ladder.step
  return Math.round(value * 100) / 100
}

/**
 * Posicion dentro de la pila, 1 = primer disco. null si la carga no cae en la
 * escalera, para no rotular como "disco 7,4" algo que se ha tecleado a mano.
 */
export function platePosition(kg: number, ladder: LoadLadder): number | null {
  if (ladder.step <= 0) return null
  const raw = (kg - ladder.base) / ladder.step
  const rounded = Math.round(raw)
  if (rounded < 0) return null
  if (Math.abs(raw - rounded) > 0.01) return null
  return rounded + 1
}

/** Primeras cargas de la escalera, para comprobarlas contra el aparato real. */
export function ladderPreview(ladder: LoadLadder, count = 6): number[] {
  if (ladder.step <= 0) return []
  return Array.from(
    { length: count },
    (_, i) => Math.round((ladder.base + i * ladder.step) * 100) / 100,
  )
}

/** Pie del control: de donde salen las cargas. */
export function ladderSource(
  exercise: Exercise,
  ladder: LoadLadder,
  custom: boolean,
): string {
  const noun = EQUIPMENT_NOUN[exercise.equipment]
  if (ladder.step <= 0) return `${noun} · sin cargas fijas`
  const body =
    ladder.base > 0
      ? `desde ${fmt(ladder.base)} kg, de ${fmt(ladder.step)} en ${fmt(ladder.step)}`
      : `de ${fmt(ladder.step)} en ${fmt(ladder.step)}`
  return custom ? `${noun} · ${body} · guardado en el ejercicio` : `${noun} · ${body}`
}

export interface LoadOption {
  kg: number
  /** Diferencia respecto a la sugerida, ya formateada. Vacia en la central. */
  delta: string
  kind: 'lower' | 'suggested' | 'higher'
  /** Numero de disco, si el aparato se lee asi. */
  plate: number | null
}

/**
 * Las tres cargas del control: una por debajo, la sugerida y una por encima,
 * todas dentro de la escalera.
 *
 * Cada lateral muestra la diferencia REAL respecto a la sugerida. No se
 * etiquetan como "suave" o "exigente" porque el numero ya lo dice, y no se
 * ofrece nada por debajo de la carga minima del aparato.
 */
export function loadOptions(suggested: number, ladder: LoadLadder): LoadOption[] {
  const step = ladder.step > 0 ? ladder.step : 1
  const mid = snapToLadder(suggested, ladder)
  const lower = Math.round((mid - step) * 100) / 100
  const higher = Math.round((mid + step) * 100) / 100

  const options: LoadOption[] = []
  // Por debajo de la carga minima no hay nada que ofrecer: un boton que no
  // cambia nada, o que propone un peso imposible, confunde mas que ayuda.
  if (lower >= ladder.base) {
    options.push({
      kg: lower,
      delta: `−${fmt(mid - lower)} kg`,
      kind: 'lower',
      plate: platePosition(lower, ladder),
    })
  }
  options.push({ kg: mid, delta: '', kind: 'suggested', plate: platePosition(mid, ladder) })
  options.push({
    kg: higher,
    delta: `+${fmt(higher - mid)} kg`,
    kind: 'higher',
    plate: platePosition(higher, ladder),
  })
  return options
}
