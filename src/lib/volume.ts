import type { Exercise, Muscle } from '@/types/catalog'
import { MUSCLES } from '@/types/catalog'
import type { Routine } from '@/types/routine'
import { allSlots, prescribedSets } from '@/types/routine'
import type { SetLog, WeekOverride } from '@/types/logs'
import { classifyVolume, type Landmark, type VolumeStatus } from '@/data/volume-landmarks'

/* ============================================================================
 *  Volumen semanal por grupo muscular
 * ----------------------------------------------------------------------------
 *  El conteo usa contribuciones FRACCIONALES: una serie de press de banca
 *  cuenta 1.0 para pectoral y 0.5 para triceps y deltoides anterior. Contar
 *  solo series directas infravalora el trabajo real de brazos y hombros, que
 *  es el error mas comun al auditar un programa.
 *
 *  Se calcula por partida doble:
 *    planned   lo que la rutina prescribe para esa semana
 *    actual    lo que registraste de verdad
 *  La diferencia entre ambos es la senal mas util: un plan perfecto sobre el
 *  papel no sirve de nada si la adherencia real es del 60%.
 * ========================================================================== */

export interface MuscleVolume {
  muscle: Muscle
  planned: number
  actual: number
  landmark: Landmark
  status: VolumeStatus
  /** Ejercicios que aportan, ordenados por contribucion. */
  contributors: Array<{ exerciseId: string; name: string; sets: number }>
}

function emptyTally(): Record<Muscle, number> {
  return Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>
}

/** Reparte `sets` series de un ejercicio entre los musculos que trabaja. */
function addExercise(
  tally: Record<Muscle, number>,
  contributors: Map<Muscle, Map<string, number>>,
  exercise: Exercise,
  sets: number,
) {
  for (const c of [...exercise.primary, ...exercise.secondary]) {
    const amount = sets * c.factor
    tally[c.muscle] += amount
    const perMuscle = contributors.get(c.muscle) ?? new Map<string, number>()
    perMuscle.set(exercise.id, (perMuscle.get(exercise.id) ?? 0) + amount)
    contributors.set(c.muscle, perMuscle)
  }
}

export interface VolumeInput {
  routine: Routine
  week: number
  catalog: Record<string, Exercise>
  landmarks: Record<Muscle, Landmark>
  /** Series realmente registradas en esa semana. Las de calentamiento se ignoran. */
  loggedSets: SetLog[]
  /** Sustituciones activas de la semana, para que el plan refleje lo que vas a hacer. */
  overrides: WeekOverride[]
}

export function computeWeeklyVolume({
  routine,
  week,
  catalog,
  landmarks,
  loggedSets,
  overrides,
}: VolumeInput): MuscleVolume[] {
  const planned = emptyTally()
  const actual = emptyTally()
  const contributors = new Map<Muscle, Map<string, number>>()

  const overrideBySlot = new Map(overrides.filter((o) => o.week === week).map((o) => [o.slotId, o]))

  // Planificado: lo que dice la rutina, con las sustituciones de esta semana aplicadas.
  for (const { slot } of allSlots(routine)) {
    const effectiveId = overrideBySlot.get(slot.slotId)?.replacementExerciseId ?? slot.exerciseId
    const ex = catalog[effectiveId]
    if (!ex) continue
    addExercise(planned, contributors, ex, prescribedSets(routine, slot, week))
  }

  // Real: una serie efectiva registrada, con reps > 0.
  const actualContributors = new Map<Muscle, Map<string, number>>()
  for (const s of loggedSets) {
    if (s.isWarmup || s.reps <= 0) continue
    const ex = catalog[s.exerciseId]
    if (!ex) continue
    addExercise(actual, actualContributors, ex, 1)
  }

  return MUSCLES.map((muscle) => {
    const lm = landmarks[muscle]
    const src = actual[muscle] > 0 ? actualContributors : contributors
    const list = [...(src.get(muscle) ?? new Map<string, number>()).entries()]
      .map(([exerciseId, sets]) => ({
        exerciseId,
        name: catalog[exerciseId]?.name.es ?? exerciseId,
        sets: Math.round(sets * 10) / 10,
      }))
      .sort((a, b) => b.sets - a.sets)

    return {
      muscle,
      planned: Math.round(planned[muscle] * 10) / 10,
      actual: Math.round(actual[muscle] * 10) / 10,
      landmark: lm,
      // El semaforo mira lo planificado: es lo que puedes corregir de antemano.
      status: classifyVolume(planned[muscle], lm),
      contributors: list,
    }
  })
}

/** Solo los musculos con volumen relevante, para no llenar la vista de ceros. */
export function significantVolume(rows: MuscleVolume[]): MuscleVolume[] {
  return rows.filter((r) => r.planned > 0 || r.actual > 0)
}

/** Series efectivas totales de una semana, sin ponderar por musculo. */
export function totalWorkingSets(sets: SetLog[]): number {
  return sets.filter((s) => !s.isWarmup && s.reps > 0).length
}
