import type { SetLog } from '@/types/logs'

/* ============================================================================
 *  1RM estimado (e1RM)
 * ----------------------------------------------------------------------------
 *  El peso por si solo no dice si has progresado: 100 kg x 8 y 105 kg x 6 no
 *  son comparables a simple vista. El e1RM los lleva a una escala comun y es
 *  la unica forma honesta de graficar fuerza cuando el rango de reps cambia.
 *
 *  Formula de Epley:  1RM = peso * (1 + reps / 30)
 *
 *  Ajuste por RIR: una serie a RIR 2 tenia 2 reps mas en el deposito, asi que
 *  las sumamos a las realizadas. Sin este ajuste, entrenar mas lejos del fallo
 *  parece un retroceso cuando en realidad es la progresion planificada.
 *
 *  LIMITE: por encima de ~12 repeticiones efectivas la estimacion pierde
 *  fiabilidad (la resistencia local pesa mas que la fuerza maxima). Marcamos
 *  esas estimaciones como de baja confianza en lugar de esconderlas.
 * ========================================================================== */

export const HIGH_REP_THRESHOLD = 12

export interface E1RMResult {
  value: number
  /** Reps efectivas usadas en el calculo (reps + RIR). */
  effectiveReps: number
  /** false cuando las reps efectivas superan el umbral fiable. */
  reliable: boolean
}

export function estimate1RM(weightKg: number, reps: number, rir = 0): E1RMResult | null {
  if (weightKg <= 0 || reps <= 0) return null
  const effectiveReps = reps + Math.max(0, rir)
  return {
    value: weightKg * (1 + effectiveReps / 30),
    effectiveReps,
    reliable: effectiveReps <= HIGH_REP_THRESHOLD,
  }
}

export function e1rmOfSet(set: SetLog): E1RMResult | null {
  if (set.isWarmup) return null
  return estimate1RM(set.weightKg, set.reps, set.rir ?? 0)
}

/** El mejor e1RM de un conjunto de series (normalmente, de una sesion). */
export function bestE1RM(sets: SetLog[]): E1RMResult | null {
  let best: E1RMResult | null = null
  for (const s of sets) {
    const e = e1rmOfSet(s)
    if (e && (!best || e.value > best.value)) best = e
  }
  return best
}

/**
 * Peso estimado para un numero de reps objetivo, partiendo de un e1RM.
 * Es la operacion inversa de Epley y alimenta las sugerencias de carga.
 */
export function weightForReps(e1rm: number, targetReps: number, targetRIR = 0): number {
  const effective = targetReps + Math.max(0, targetRIR)
  return e1rm / (1 + effective / 30)
}

/** Volumen de carga (tonelaje) de una serie: peso x repeticiones. */
export function tonnage(set: SetLog): number {
  if (set.isWarmup) return 0
  return set.weightKg * set.reps
}

/** Redondea al incremento de disco disponible, para dar sugerencias usables. */
export function roundToPlate(weightKg: number, increment: number): number {
  if (increment <= 0) return Math.round(weightKg * 100) / 100
  return Math.round(weightKg / increment) * increment
}
