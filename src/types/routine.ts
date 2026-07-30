import { z } from 'zod'
import { exerciseSchema, METRICS } from './catalog'

/* ============================================================================
 *  Esquema de rutina  ·  routine.v1
 * ----------------------------------------------------------------------------
 *  Una rutina es una PLANTILLA: describe que hacer, no que hiciste. Es un
 *  documento JSON portable, versionado y validable, pensado para poder pedirle
 *  a Claude en otra conversacion "generame una rutina X" e importarla aqui.
 *
 *  La separacion plantilla / ejecucion es deliberada:
 *    Routine (esto)  --instancia-->  Cycle  -->  Session  -->  SetLog
 *  Asi puedes repetir la misma rutina dentro de un ano y comparar ciclos.
 *
 *  Ver  schema/routine.v1.schema.json  y  schema/PROMPT.md  en la raiz del repo.
 * ========================================================================== */

export const SCHEMA_VERSION = '1.0' as const

export const GOALS = ['hypertrophy', 'strength', 'recomp', 'endurance', 'maintenance'] as const
export type Goal = (typeof GOALS)[number]

export const GOAL_LABEL: Record<Goal, string> = {
  hypertrophy: 'Hipertrofia',
  strength: 'Fuerza',
  recomp: 'Recomposicion',
  endurance: 'Resistencia',
  maintenance: 'Mantenimiento',
}

export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const
export type Level = (typeof LEVELS)[number]

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
}

export const DAY_TYPES = [
  'upper',
  'lower',
  'push',
  'pull',
  'legs',
  'full-body',
  'arms',
  'chest-back',
  'custom',
] as const
export type DayType = (typeof DAY_TYPES)[number]

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  upper: 'Tren superior',
  lower: 'Tren inferior',
  push: 'Empuje',
  pull: 'Traccion',
  legs: 'Pierna',
  'full-body': 'Cuerpo completo',
  arms: 'Brazos',
  'chest-back': 'Pecho y espalda',
  custom: 'Personalizado',
}

export const PROGRESSION_TYPES = [
  /** Sube el peso cuando alcanzas el tope del rango de reps en todas las series. */
  'double-progression',
  /** Sube el peso cada semana un incremento fijo. */
  'linear',
  /** Ajusta la carga sesion a sesion para casar con el RIR objetivo. */
  'rir-autoregulated',
  /** Sin sugerencia automatica. */
  'none',
] as const
export type ProgressionType = (typeof PROGRESSION_TYPES)[number]

export const PROGRESSION_LABEL: Record<ProgressionType, string> = {
  'double-progression': 'Doble progresion',
  linear: 'Lineal',
  'rir-autoregulated': 'Autorregulada por RIR',
  none: 'Manual',
}

/** Incrementos de carga por tipo de ejercicio, en kilos. */
export const incrementSchema = z.object({
  upper: z.number().positive().default(2.5),
  lower: z.number().positive().default(5),
  isolation: z.number().positive().default(1.25),
})

export const progressionSchema = z.object({
  type: z.enum(PROGRESSION_TYPES).default('double-progression'),
  incrementKg: incrementSchema.default({ upper: 2.5, lower: 5, isolation: 1.25 }),
  /**
   * RIR objetivo semana a semana. Un elemento por semana del ciclo; 'deload'
   * marca una semana de descarga. Si es mas corto que durationWeeks se repite
   * el ultimo valor. Modelo tipico: empezar lejos del fallo e ir apretando.
   */
  rirRamp: z.array(z.union([z.number().min(0).max(6), z.literal('deload')])).optional(),
})

export const deloadSchema = z.object({
  /** Numero de semana (1-indexado) o 'last' para la ultima del ciclo. */
  week: z.union([z.number().int().positive(), z.literal('last')]),
  /** Multiplicador de series. 0.5 = la mitad del volumen. */
  volumeMultiplier: z.number().min(0.1).max(1).default(0.5),
  /** Multiplicador de carga. 0.9 = 90% del peso habitual. */
  intensityMultiplier: z.number().min(0.1).max(1).default(0.9),
})

/** Un ejercicio dentro de un dia, con su prescripcion. */
export const slotSchema = z.object({
  /** Identificador estable dentro de la rutina. Ancla el historial: no lo cambies. */
  slotId: z.string().min(1),
  /** id del catalogo, o de un ejercicio declarado en customExercises. */
  exerciseId: z.string().min(1),
  sets: z.number().int().min(1).max(20),
  /** [minimo, maximo]. Para una cifra exacta usa [10, 10]. */
  repRange: z
    .tuple([z.number().int().min(1), z.number().int().min(1)])
    .refine(([min, max]) => min <= max, 'repRange debe ser [min, max] con min <= max'),
  /** Reps en reserva objetivo. Si se omite se usa el rirRamp de la rutina. */
  targetRIR: z.number().min(0).max(6).optional(),
  restSec: z.number().int().min(0).max(600).optional(),
  /** Cadencia excentrica-pausa-concentrica-pausa, ej. "3-1-1-0". */
  tempo: z.string().optional(),
  notes: z.string().optional(),
  /** Series de aproximacion sugeridas. No cuentan para el volumen. */
  warmupSets: z.number().int().min(0).max(6).default(0),
  /** Se mide en reps o en segundos (planchas, isometricos). */
  metric: z.enum(METRICS).optional(),
  /** true si las reps son por lado (zancadas, remo a una mano). */
  perSide: z.boolean().default(false),
  /**
   * Alternativas aceptables si la maquina esta ocupada. El sustituto se aplica
   * solo a la semana en curso; la siguiente vuelve al ejercicio original.
   * Ademas de estas, la app propone sustitutos por patron y musculo.
   */
  substitutions: z.array(z.string()).default([]),
  /** Sobrescribe la progresion global solo para este ejercicio. */
  progression: progressionSchema.partial().optional(),
})

export const blockSchema = z.object({
  /** 'superset' y 'circuit' encadenan ejercicios sin descanso entre ellos. */
  type: z.enum(['single', 'superset', 'circuit']).default('single'),
  /** Descanso al terminar la vuelta completa del bloque. */
  restSec: z.number().int().min(0).max(600).optional(),
  label: z.string().optional(),
  exercises: z.array(slotSchema).min(1),
})

export const daySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(DAY_TYPES).default('custom'),
  /** Posicion dentro de la semana, 1-indexado. */
  order: z.number().int().positive(),
  focus: z.string().optional(),
  notes: z.string().optional(),
  blocks: z.array(blockSchema).min(1),
})

export const routineSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: z.string().regex(/^[a-z0-9-]+$/, 'El id debe ser kebab-case en minusculas'),
    name: z.string().min(1),
    description: z.string().optional(),
    author: z.string().optional(),
    goal: z.enum(GOALS).default('hypertrophy'),
    experienceLevel: z.enum(LEVELS).default('intermediate'),
    /** Duracion objetivo del ciclo. Por defecto 8 semanas. */
    durationWeeks: z.number().int().min(1).max(52).default(8),
    /** Informativo. Si se indica debe coincidir con days.length. */
    daysPerWeek: z.number().int().min(1).max(7).optional(),
    tags: z.array(z.string()).default([]),
    /** Referencias o justificacion metodologica de la rutina. */
    references: z.array(z.string()).default([]),
    progression: progressionSchema.default({
      type: 'double-progression',
      incrementKg: { upper: 2.5, lower: 5, isolation: 1.25 },
    }),
    deload: deloadSchema.optional(),
    days: z.array(daySchema).min(1).max(7),
    /**
     * Ejercicios que no estan en el catalogo base. Permite que una rutina
     * generada fuera de la app sea autocontenida e importable sin romperse.
     */
    customExercises: z.array(exerciseSchema).default([]),
  })
  .superRefine((r, ctx) => {
    if (r.daysPerWeek !== undefined && r.daysPerWeek !== r.days.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['daysPerWeek'],
        message: `daysPerWeek (${r.daysPerWeek}) no coincide con el numero de dias definidos (${r.days.length})`,
      })
    }

    const dayIds = new Set<string>()
    for (const [i, d] of r.days.entries()) {
      if (dayIds.has(d.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['days', i, 'id'],
          message: `id de dia duplicado: "${d.id}"`,
        })
      }
      dayIds.add(d.id)
    }

    // Los slotId anclan todo el historial: deben ser unicos en la rutina entera.
    const slotIds = new Set<string>()
    for (const [di, d] of r.days.entries()) {
      for (const [bi, b] of d.blocks.entries()) {
        for (const [ei, s] of b.exercises.entries()) {
          if (slotIds.has(s.slotId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['days', di, 'blocks', bi, 'exercises', ei, 'slotId'],
              message: `slotId duplicado: "${s.slotId}". Debe ser unico en toda la rutina.`,
            })
          }
          slotIds.add(s.slotId)
        }
      }
    }

    if (r.deload && typeof r.deload.week === 'number' && r.deload.week > r.durationWeeks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deload', 'week'],
        message: `La semana de descarga (${r.deload.week}) cae fuera del ciclo de ${r.durationWeeks} semanas`,
      })
    }
  })

export type Routine = z.infer<typeof routineSchema>
export type RoutineInput = z.input<typeof routineSchema>
export type Day = z.infer<typeof daySchema>
export type Block = z.infer<typeof blockSchema>
export type Slot = z.infer<typeof slotSchema>
export type Progression = z.infer<typeof progressionSchema>

/* ── Utilidades sobre la plantilla ─────────────────────────────────────────── */

/** Todos los slots de un dia, aplanando los bloques. */
export function slotsOfDay(day: Day): Slot[] {
  return day.blocks.flatMap((b) => b.exercises)
}

/** Todos los slots de la rutina, con su dia asociado. */
export function allSlots(routine: Routine): Array<{ day: Day; slot: Slot }> {
  return routine.days.flatMap((day) => slotsOfDay(day).map((slot) => ({ day, slot })))
}

export function findSlot(routine: Routine, slotId: string): { day: Day; slot: Slot } | undefined {
  return allSlots(routine).find((x) => x.slot.slotId === slotId)
}

/** Numero de semana de descarga resuelto, o null si la rutina no tiene. */
export function deloadWeek(routine: Routine): number | null {
  if (!routine.deload) return null
  return routine.deload.week === 'last' ? routine.durationWeeks : routine.deload.week
}

export function isDeloadWeek(routine: Routine, week: number): boolean {
  return deloadWeek(routine) === week
}

/**
 * RIR objetivo de un slot en una semana dada.
 * Prioridad: valor del slot > rampa de la rutina > 2 por defecto.
 * Si la rampa es mas corta que el ciclo, se repite su ultimo valor.
 */
export function targetRIR(routine: Routine, slot: Slot, week: number): number | 'deload' {
  if (isDeloadWeek(routine, week)) return 'deload'
  if (slot.targetRIR !== undefined) return slot.targetRIR
  const ramp = slot.progression?.rirRamp ?? routine.progression.rirRamp
  if (!ramp || ramp.length === 0) return 2
  return ramp[Math.min(week - 1, ramp.length - 1)]
}

/**
 * Series prescritas de un slot en una semana, aplicando la descarga.
 * Se redondea hacia arriba para no dejar un ejercicio a cero series.
 */
export function prescribedSets(routine: Routine, slot: Slot, week: number): number {
  if (!isDeloadWeek(routine, week)) return slot.sets
  return Math.max(1, Math.ceil(slot.sets * (routine.deload?.volumeMultiplier ?? 0.5)))
}
