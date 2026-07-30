import { z } from 'zod'
import { routineSchema } from './routine'

/* ============================================================================
 *  Registro de entrenamiento
 * ----------------------------------------------------------------------------
 *  Cycle    una ejecucion concreta de una rutina, con fechas reales
 *  Session  un dia de entrenamiento dentro del ciclo
 *  SetLog   una serie: peso, repeticiones y RIR
 *
 *  Un Cycle guarda una COPIA de la rutina (routineSnapshot). Si mas adelante
 *  editas la plantilla, el historial de ciclos pasados sigue siendo coherente
 *  con lo que realmente hiciste.
 * ========================================================================== */

export const cycleSchema = z.object({
  id: z.string(),
  routineId: z.string(),
  /** Copia congelada de la rutina tal y como estaba al empezar el ciclo. */
  routineSnapshot: routineSchema,
  /** ISO yyyy-mm-dd. Marca el lunes de la semana 1. */
  startDate: z.string(),
  targetWeeks: z.number().int().positive(),
  status: z.enum(['active', 'completed', 'abandoned']).default('active'),
  notes: z.string().optional(),
  createdAt: z.string(),
})

export type Cycle = z.infer<typeof cycleSchema>

export const sessionSchema = z.object({
  id: z.string(),
  cycleId: z.string(),
  /** Semana del ciclo, 1-indexada. */
  week: z.number().int().positive(),
  /** id del dia dentro de la rutina. */
  dayId: z.string(),
  /** ISO yyyy-mm-dd. */
  date: z.string(),
  status: z.enum(['planned', 'in-progress', 'completed', 'skipped']).default('planned'),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  durationMin: z.number().optional(),
  notes: z.string().optional(),
  /** Fatiga percibida de la sesion, 1 fresco - 5 destruido. */
  perceivedEffort: z.number().int().min(1).max(5).optional(),
})

export type Session = z.infer<typeof sessionSchema>

export const setLogSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  /** Ancla a la rutina. Sobrevive a cambios de ejercicio. */
  slotId: z.string(),
  /**
   * Ejercicio REALMENTE ejecutado. Puede diferir del prescrito si esa semana
   * hubo sustitucion, y por eso la analitica del sustituto no contamina la
   * progresion del ejercicio original.
   */
  exerciseId: z.string(),
  /** Orden dentro del ejercicio, 1-indexado. */
  setIndex: z.number().int().positive(),
  weightKg: z.number().min(0),
  reps: z.number().int().min(0),
  /** Para ejercicios isometricos medidos en tiempo. */
  seconds: z.number().int().min(0).optional(),
  /** Repeticiones en reserva. 0 = fallo muscular. */
  rir: z.number().min(0).max(10).optional(),
  /** Las series de aproximacion no cuentan para el volumen. */
  isWarmup: z.boolean().default(false),
  completedAt: z.string(),
  notes: z.string().optional(),
})

export type SetLog = z.infer<typeof setLogSchema>

/**
 * Sustitucion temporal de ejercicio, valida SOLO para una semana concreta.
 * La clave (cycleId, week, slotId) es lo que hace que la semana siguiente
 * vuelva sola al ejercicio original sin que haya que deshacer nada.
 */
export const weekOverrideSchema = z.object({
  id: z.string(),
  cycleId: z.string(),
  week: z.number().int().positive(),
  slotId: z.string(),
  replacementExerciseId: z.string(),
  reason: z.string().optional(),
  createdAt: z.string(),
})

export type WeekOverride = z.infer<typeof weekOverrideSchema>

/* ── Metricas corporales ───────────────────────────────────────────────── */

export const BODY_METRICS = [
  'bodyweight',
  'steps',
  'neck',
  'shoulders',
  'chest',
  'waist',
  'hips',
  'arm-left',
  'arm-right',
  'thigh-left',
  'thigh-right',
  'calf-left',
  'calf-right',
  'bodyfat',
  'sleep',
  'fatigue',
] as const

export type BodyMetricKey = (typeof BODY_METRICS)[number]

export const BODY_METRIC_META: Record<
  BodyMetricKey,
  { label: string; unit: string; group: 'peso' | 'medidas' | 'actividad' | 'recuperacion'; step: number }
> = {
  bodyweight: { label: 'Peso corporal', unit: 'kg', group: 'peso', step: 0.1 },
  bodyfat: { label: 'Grasa corporal', unit: '%', group: 'peso', step: 0.1 },
  steps: { label: 'Pasos', unit: 'pasos', group: 'actividad', step: 100 },
  neck: { label: 'Cuello', unit: 'cm', group: 'medidas', step: 0.5 },
  shoulders: { label: 'Hombros', unit: 'cm', group: 'medidas', step: 0.5 },
  chest: { label: 'Pecho', unit: 'cm', group: 'medidas', step: 0.5 },
  waist: { label: 'Cintura', unit: 'cm', group: 'medidas', step: 0.5 },
  hips: { label: 'Cadera', unit: 'cm', group: 'medidas', step: 0.5 },
  'arm-left': { label: 'Brazo izq.', unit: 'cm', group: 'medidas', step: 0.5 },
  'arm-right': { label: 'Brazo der.', unit: 'cm', group: 'medidas', step: 0.5 },
  'thigh-left': { label: 'Muslo izq.', unit: 'cm', group: 'medidas', step: 0.5 },
  'thigh-right': { label: 'Muslo der.', unit: 'cm', group: 'medidas', step: 0.5 },
  'calf-left': { label: 'Gemelo izq.', unit: 'cm', group: 'medidas', step: 0.5 },
  'calf-right': { label: 'Gemelo der.', unit: 'cm', group: 'medidas', step: 0.5 },
  sleep: { label: 'Sueno', unit: 'h', group: 'recuperacion', step: 0.5 },
  fatigue: { label: 'Fatiga', unit: '1-5', group: 'recuperacion', step: 1 },
}

/**
 * Formato largo: una fila por metrica y dia. Anadir una medida nueva no
 * obliga a migrar el esquema, solo a extender BODY_METRICS.
 */
export const bodyMetricSchema = z.object({
  id: z.string(),
  /** ISO yyyy-mm-dd. */
  date: z.string(),
  metric: z.enum(BODY_METRICS),
  value: z.number(),
  note: z.string().optional(),
  createdAt: z.string(),
})

export type BodyMetric = z.infer<typeof bodyMetricSchema>

/* ── Ajustes de usuario ────────────────────────────────────────────────── */

export const settingsSchema = z.object({
  /** Landmarks de volumen personalizados, por musculo. */
  volumeOverrides: z.record(z.string(), z.object({ mev: z.number(), mav: z.number(), mrv: z.number() })).default({}),
  units: z.enum(['kg', 'lb']).default('kg'),
  /** Incremento minimo de disco disponible en tu gimnasio, en kg. */
  minPlateIncrement: z.number().positive().default(1.25),
  restTimerSound: z.boolean().default(true),
  supabaseUrl: z.string().default(''),
  supabaseAnonKey: z.string().default(''),
})

export type Settings = z.infer<typeof settingsSchema>

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({})
