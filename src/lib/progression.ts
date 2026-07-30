import type { Routine, Slot } from '@/types/routine'
import { isDeloadWeek, targetRIR } from '@/types/routine'
import type { SetLog } from '@/types/logs'
import type { Exercise } from '@/types/catalog'
import { bestE1RM, estimate1RM, roundToPlate, weightForReps } from './e1rm'

/* ============================================================================
 *  Motor de progresion
 * ----------------------------------------------------------------------------
 *  Convierte la app de registro pasivo en algo que te dice que hacer hoy.
 *
 *  Doble progresion (el modelo por defecto, el que divulga Jeff Nippard):
 *    1. Con un peso dado, sube repeticiones dentro del rango prescrito.
 *    2. Cuando alcanzas el tope del rango en TODAS las series al RIR objetivo,
 *       subes el peso y vuelves a la parte baja del rango.
 *  Es simple, autorregulado y no depende de tests de 1RM.
 * ========================================================================== */

export interface Suggestion {
  /** Carga sugerida en kg. null si no hay historial suficiente. */
  weightKg: number | null
  repRange: [number, number]
  targetRIR: number | 'deload'
  /** Explicacion en una linea, se muestra bajo el ejercicio. */
  rationale: string
  /** Como se ha llegado a la sugerencia. */
  basis: 'no-history' | 'hold' | 'add-weight' | 'deload' | 'back-off' | 'first-time'
}

/** Que incremento aplicar segun el ejercicio: compuesto de pierna, de torso o aislamiento. */
export function incrementFor(exercise: Exercise, routine: Routine, slot: Slot): number {
  const inc = slot.progression?.incrementKg ?? routine.progression.incrementKg
  const isolationPatterns = new Set([
    'elbow-flexion',
    'elbow-extension',
    'shoulder-abduction',
    'shoulder-horizontal-abduction',
    'knee-extension',
    'knee-flexion',
    'calf-raise',
    'hip-abduction',
    'hip-adduction',
    'core-flexion',
    'core-anti-extension',
    'core-rotation',
  ])
  if (isolationPatterns.has(exercise.pattern)) return inc.isolation
  const lowerPatterns = new Set(['squat', 'hinge', 'lunge', 'hip-thrust'])
  return lowerPatterns.has(exercise.pattern) ? inc.lower : inc.upper
}

/**
 * Sugerencia para el proximo entrenamiento de un slot.
 *
 * @param lastSets Series efectivas de la ULTIMA sesion en que se hizo este slot,
 *                 en orden. Vacio si nunca se ha hecho.
 */
export function suggestNext(
  routine: Routine,
  slot: Slot,
  exercise: Exercise,
  week: number,
  lastSets: SetLog[],
  minPlateIncrement: number,
): Suggestion {
  const rir = targetRIR(routine, slot, week)
  const [minReps, maxReps] = slot.repRange
  const working = lastSets.filter((s) => !s.isWarmup && s.reps > 0)

  if (working.length === 0) {
    return {
      weightKg: null,
      repRange: slot.repRange,
      targetRIR: rir,
      rationale: `Primera vez. Elige un peso con el que puedas hacer ${maxReps} reps dejando ${
        typeof rir === 'number' ? rir : 2
      } en reserva.`,
      basis: 'first-time',
    }
  }

  const lastWeight = Math.max(...working.map((s) => s.weightKg))
  const atWeight = working.filter((s) => s.weightKg === lastWeight)

  // Semana de descarga: baja carga y volumen, no se progresa.
  if (isDeloadWeek(routine, week)) {
    const mult = routine.deload?.intensityMultiplier ?? 0.9
    return {
      weightKg: roundToPlate(lastWeight * mult, minPlateIncrement),
      repRange: slot.repRange,
      targetRIR: 'deload',
      rationale: `Semana de descarga: ${Math.round(mult * 100)}% de la carga y la mitad de series. Deja al menos 3-4 reps en reserva.`,
      basis: 'deload',
    }
  }

  const increment = incrementFor(exercise, routine, slot)
  const numericRIR = typeof rir === 'number' ? rir : 2

  // Criterio de doble progresion: todas las series al tope del rango, y sin
  // haberse pasado del RIR objetivo (es decir, no fue mas facil de lo previsto).
  //
  // Se exige ademas haber COMPLETADO la prescripcion: llegar al tope de reps en
  // una sola serie de cuatro no es motivo para subir carga, y tras una semana de
  // descarga (con la mitad de series) tampoco se progresa.
  const completedPrescription = atWeight.length >= slot.sets
  const allAtTop = completedPrescription && atWeight.every((s) => s.reps >= maxReps)
  const rirOk = atWeight.every((s) => (s.rir ?? numericRIR) <= numericRIR)

  const type = slot.progression?.type ?? routine.progression.type

  if (type === 'linear') {
    return {
      weightKg: roundToPlate(lastWeight + increment, minPlateIncrement),
      repRange: slot.repRange,
      targetRIR: rir,
      rationale: `Progresion lineal: +${increment} kg sobre los ${lastWeight} kg de la sesion anterior.`,
      basis: 'add-weight',
    }
  }

  if (type === 'rir-autoregulated') {
    const best = bestE1RM(working)
    if (best) {
      const target = weightForReps(best.value, maxReps, numericRIR)
      return {
        weightKg: roundToPlate(target, minPlateIncrement),
        repRange: slot.repRange,
        targetRIR: rir,
        rationale: `Ajustado a tu e1RM actual (${best.value.toFixed(1)} kg) para ${maxReps} reps a RIR ${numericRIR}.`,
        basis: 'hold',
      }
    }
  }

  if (type === 'none') {
    return {
      weightKg: lastWeight,
      repRange: slot.repRange,
      targetRIR: rir,
      rationale: `Ultima carga registrada: ${lastWeight} kg.`,
      basis: 'hold',
    }
  }

  if (allAtTop && rirOk) {
    return {
      weightKg: roundToPlate(lastWeight + increment, minPlateIncrement),
      repRange: slot.repRange,
      targetRIR: rir,
      rationale: `Completaste ${maxReps} reps en todas las series a ${lastWeight} kg: sube a +${increment} kg y vuelve a ${minReps} reps.`,
      basis: 'add-weight',
    }
  }

  // Sesion incompleta: no hay informacion suficiente para mover la carga.
  if (!completedPrescription) {
    return {
      weightKg: lastWeight,
      repRange: slot.repRange,
      targetRIR: rir,
      rationale: `La ultima vez registraste ${atWeight.length} de ${slot.sets} series a ${lastWeight} kg. Completa la prescripcion antes de subir carga.`,
      basis: 'hold',
    }
  }

  // Si la sesion anterior se quedo muy corta del rango, no insistas con el mismo peso.
  const worstReps = Math.min(...atWeight.map((s) => s.reps))
  if (worstReps < minReps - 1) {
    return {
      weightKg: roundToPlate(lastWeight - increment, minPlateIncrement),
      repRange: slot.repRange,
      targetRIR: rir,
      rationale: `La ultima serie se quedo en ${worstReps} reps, por debajo del rango. Baja ${increment} kg y consolida la tecnica.`,
      basis: 'back-off',
    }
  }

  const repsList = atWeight.map((s) => s.reps).join(', ')
  return {
    weightKg: lastWeight,
    repRange: slot.repRange,
    targetRIR: rir,
    rationale: `Manten ${lastWeight} kg (ultima vez: ${repsList} reps) y suma repeticiones hasta llegar a ${maxReps} en todas las series.`,
    basis: 'hold',
  }
}

/* ── Deteccion de estancamiento ────────────────────────────────────────── */

export interface StagnationCheck {
  stagnant: boolean
  weeksFlat: number
  message: string
}

/**
 * Marca un ejercicio como estancado si su mejor e1RM no mejora en las ultimas
 * N sesiones. Un 1% de margen evita falsos positivos por ruido de redondeo.
 */
export function detectStagnation(
  e1rmBySession: Array<{ date: string; value: number }>,
  minSessions = 3,
): StagnationCheck {
  if (e1rmBySession.length < minSessions) {
    return { stagnant: false, weeksFlat: 0, message: '' }
  }
  const ordered = [...e1rmBySession].sort((a, b) => a.date.localeCompare(b.date))
  const recent = ordered.slice(-minSessions)
  const peak = Math.max(...recent.map((x) => x.value))
  const first = recent[0].value
  const improved = peak > first * 1.01

  if (improved) return { stagnant: false, weeksFlat: 0, message: '' }

  return {
    stagnant: true,
    weeksFlat: recent.length,
    message: `Sin progreso de fuerza en las ultimas ${recent.length} sesiones. Valora una descarga, cambiar el rango de reps o sustituir el ejercicio.`,
  }
}

/* ── Records personales ────────────────────────────────────────────────── */

export interface PersonalRecord {
  exerciseId: string
  kind: 'weight' | 'reps' | 'e1rm'
  value: number
  date: string
  detail: string
}

/** Mejores marcas por ejercicio: peso maximo, reps maximas y e1RM maximo. */
export function computePRs(sets: SetLog[], dateOf: (sessionId: string) => string): PersonalRecord[] {
  const byExercise = new Map<string, SetLog[]>()
  for (const s of sets) {
    if (s.isWarmup || s.reps <= 0) continue
    const list = byExercise.get(s.exerciseId) ?? []
    list.push(s)
    byExercise.set(s.exerciseId, list)
  }

  const prs: PersonalRecord[] = []
  for (const [exerciseId, list] of byExercise) {
    const heaviest = list.reduce((a, b) => (b.weightKg > a.weightKg ? b : a))
    prs.push({
      exerciseId,
      kind: 'weight',
      value: heaviest.weightKg,
      date: dateOf(heaviest.sessionId),
      detail: `${heaviest.weightKg} kg x ${heaviest.reps}`,
    })

    let bestE = { value: 0, set: list[0] }
    for (const s of list) {
      const e = estimate1RM(s.weightKg, s.reps, s.rir ?? 0)
      if (e && e.value > bestE.value) bestE = { value: e.value, set: s }
    }
    if (bestE.value > 0) {
      prs.push({
        exerciseId,
        kind: 'e1rm',
        value: bestE.value,
        date: dateOf(bestE.set.sessionId),
        detail: `${bestE.set.weightKg} kg x ${bestE.set.reps}`,
      })
    }
  }
  return prs
}
