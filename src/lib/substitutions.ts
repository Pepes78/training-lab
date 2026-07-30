import type { Exercise } from '@/types/catalog'
import type { Slot } from '@/types/routine'

/* ============================================================================
 *  Sustitucion temporal de ejercicio
 * ----------------------------------------------------------------------------
 *  Caso de uso: llegas al gimnasio y la maquina esta ocupada. Necesitas un
 *  reemplazo AHORA que estimule lo mismo, y quieres volver al original la
 *  semana que viene sin tener que acordarte de deshacer nada.
 *
 *  El ranking combina lo que declara la rutina con lo que deduce el catalogo,
 *  asi que siempre hay alternativas aunque no se hayan escrito a mano.
 * ========================================================================== */

export interface SubstitutionCandidate {
  exercise: Exercise
  score: number
  /** Por que se propone, mostrado como etiqueta en la interfaz. */
  reason: string
}

/** Solapamiento de musculos entre dos ejercicios, ponderado por los factores. */
function muscleOverlap(a: Exercise, b: Exercise): number {
  const mapB = new Map<string, number>()
  for (const c of [...b.primary, ...b.secondary]) mapB.set(c.muscle, c.factor)

  let shared = 0
  let total = 0
  for (const c of [...a.primary, ...a.secondary]) {
    total += c.factor
    const other = mapB.get(c.muscle)
    if (other !== undefined) shared += Math.min(c.factor, other)
  }
  return total > 0 ? shared / total : 0
}

/**
 * Alternativas a un ejercicio, ordenadas de mejor a peor.
 *
 * Prioridad:
 *   1. Sustitutos declarados en la rutina (los eligio quien la diseno)
 *   2. Mismo patron de movimiento y musculo primario
 *   3. Mismo musculo primario con otro equipo (util cuando el problema es la maquina)
 *   4. Solapamiento muscular alto aunque el patron difiera
 */
export function rankSubstitutions(
  original: Exercise,
  slot: Slot | undefined,
  catalog: Exercise[],
  limit = 8,
): SubstitutionCandidate[] {
  const declared = new Set(slot?.substitutions ?? [])
  const originalPrimary = new Set(original.primary.map((p) => p.muscle))

  const candidates: SubstitutionCandidate[] = []

  for (const ex of catalog) {
    if (ex.id === original.id) continue

    const overlap = muscleOverlap(original, ex)
    const samePattern = ex.pattern === original.pattern
    const sharesPrimary = ex.primary.some((p) => originalPrimary.has(p.muscle))
    const sameEquipment = ex.equipment === original.equipment

    // Sin musculo primario en comun y con poco solapamiento no es un sustituto.
    if (!sharesPrimary && overlap < 0.5) continue

    let score = overlap * 100
    let reason = 'Solapamiento muscular alto'

    if (samePattern && sharesPrimary) {
      score += 40
      reason = 'Mismo patron y mismo musculo'
    } else if (sharesPrimary) {
      score += 20
      reason = 'Mismo musculo, otro patron'
    }

    // Si buscas alternativa suele ser porque la maquina esta pillada:
    // cambiar de material es una ventaja, no un inconveniente.
    if (!sameEquipment) {
      score += 8
      if (samePattern && sharesPrimary) reason = 'Mismo patron, otro material'
    }

    if (declared.has(ex.id)) {
      score += 1000
      reason = 'Alternativa prevista en la rutina'
    }

    candidates.push({ exercise: ex, score, reason })
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, limit)
}
