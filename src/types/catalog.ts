import { z } from 'zod'

/* ============================================================================
 *  Catalogo de ejercicios
 * ----------------------------------------------------------------------------
 *  Un ejercicio del catalogo describe QUE es el movimiento, nunca como se
 *  entrena. Series, repeticiones y RIR viven en la rutina, no aqui.
 *
 *  El campo clave es la contribucion fraccional por musculo: un press de banca
 *  aporta 1.0 series a pectoral y 0.5 a triceps y deltoides anterior. Es la
 *  unica forma de contar volumen semanal de manera honesta (series directas
 *  mas indirectas), que es como se plantea en la literatura de hipertrofia.
 * ========================================================================== */

export const MUSCLES = [
  'chest',
  'front-delts',
  'side-delts',
  'rear-delts',
  'lats',
  'upper-back',
  'traps',
  'lower-back',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'abductors',
  'calves',
  'abs',
  'obliques',
  'neck',
] as const

export type Muscle = (typeof MUSCLES)[number]

/** Etiquetas en castellano para la interfaz. */
export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Pectoral',
  'front-delts': 'Deltoides anterior',
  'side-delts': 'Deltoides lateral',
  'rear-delts': 'Deltoides posterior',
  lats: 'Dorsal',
  'upper-back': 'Espalda alta',
  traps: 'Trapecio',
  'lower-back': 'Lumbar',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Antebrazo',
  quads: 'Cuadriceps',
  hamstrings: 'Isquiotibiales',
  glutes: 'Gluteos',
  adductors: 'Aductores',
  abductors: 'Abductores',
  calves: 'Gemelos',
  abs: 'Abdomen',
  obliques: 'Oblicuos',
  neck: 'Cuello',
}

/**
 * Agrupacion de musculos para las vistas de resumen. El volumen se puede leer
 * por musculo fino (deltoides lateral) o por grupo (hombro).
 */
export const MUSCLE_GROUP: Record<Muscle, string> = {
  chest: 'Pecho',
  'front-delts': 'Hombro',
  'side-delts': 'Hombro',
  'rear-delts': 'Hombro',
  lats: 'Espalda',
  'upper-back': 'Espalda',
  traps: 'Espalda',
  'lower-back': 'Espalda',
  biceps: 'Brazo',
  triceps: 'Brazo',
  forearms: 'Brazo',
  quads: 'Pierna',
  hamstrings: 'Pierna',
  glutes: 'Pierna',
  adductors: 'Pierna',
  abductors: 'Pierna',
  calves: 'Pierna',
  abs: 'Core',
  obliques: 'Core',
  neck: 'Otros',
}

export const MOVEMENT_PATTERNS = [
  'horizontal-push',
  'vertical-push',
  'horizontal-pull',
  'vertical-pull',
  'squat',
  'hinge',
  'lunge',
  'knee-flexion',
  'knee-extension',
  'hip-thrust',
  'hip-abduction',
  'hip-adduction',
  'elbow-flexion',
  'elbow-extension',
  'shoulder-abduction',
  'shoulder-horizontal-abduction',
  'calf-raise',
  'core-flexion',
  'core-anti-extension',
  'core-rotation',
  'carry',
  'other',
] as const

export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number]

export const PATTERN_LABEL: Record<MovementPattern, string> = {
  'horizontal-push': 'Empuje horizontal',
  'vertical-push': 'Empuje vertical',
  'horizontal-pull': 'Traccion horizontal',
  'vertical-pull': 'Traccion vertical',
  squat: 'Sentadilla',
  hinge: 'Bisagra de cadera',
  lunge: 'Zancada',
  'knee-flexion': 'Flexion de rodilla',
  'knee-extension': 'Extension de rodilla',
  'hip-thrust': 'Empuje de cadera',
  'hip-abduction': 'Abduccion de cadera',
  'hip-adduction': 'Aduccion de cadera',
  'elbow-flexion': 'Flexion de codo',
  'elbow-extension': 'Extension de codo',
  'shoulder-abduction': 'Abduccion de hombro',
  'shoulder-horizontal-abduction': 'Abduccion horizontal',
  'calf-raise': 'Elevacion de talon',
  'core-flexion': 'Flexion de tronco',
  'core-anti-extension': 'Anti-extension',
  'core-rotation': 'Rotacion de tronco',
  carry: 'Transporte',
  other: 'Otro',
}

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'smith',
  'bodyweight',
  'band',
  'kettlebell',
  'ez-bar',
  'other',
] as const

export type Equipment = (typeof EQUIPMENT)[number]

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barra',
  dumbbell: 'Mancuerna',
  machine: 'Maquina',
  cable: 'Polea',
  smith: 'Multipower',
  bodyweight: 'Peso corporal',
  band: 'Banda',
  kettlebell: 'Kettlebell',
  'ez-bar': 'Barra EZ',
  other: 'Otro',
}

/** Como se mide una serie: repeticiones o tiempo bajo tension. */
export const METRICS = ['reps', 'seconds'] as const
export type SetMetric = (typeof METRICS)[number]

export const muscleContributionSchema = z.object({
  muscle: z.enum(MUSCLES),
  /**
   * Cuanto cuenta una serie de este ejercicio para este musculo.
   * 1.0 = serie directa, 0.5 = contribucion indirecta significativa,
   * 0.25 = estabilizador con estimulo bajo.
   */
  factor: z.number().min(0).max(1),
})

export const exerciseSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'El id debe ser kebab-case en minusculas (ej. "press-banca-barra")'),
  name: z.object({
    es: z.string().min(1),
    en: z.string().min(1).optional(),
  }),
  pattern: z.enum(MOVEMENT_PATTERNS),
  equipment: z.enum(EQUIPMENT),
  primary: z.array(muscleContributionSchema).min(1, 'Todo ejercicio necesita al menos un musculo primario'),
  secondary: z.array(muscleContributionSchema).default([]),
  /** id de media en la CDN de ExerciseDB; genera el GIF de demostracion. */
  mediaId: z.string().optional(),
  isUnilateral: z.boolean().default(false),
  defaultMetric: z.enum(METRICS).default('reps'),
  /** Puntos tecnicos cortos mostrados en la ficha del ejercicio. */
  cues: z.array(z.string()).default([]),
  /** Nombres alternativos, usados por el buscador. */
  aliases: z.array(z.string()).default([]),
  /** true para los ejercicios que ha creado el usuario, no los de serie. */
  isCustom: z.boolean().default(false),
})

export type Exercise = z.infer<typeof exerciseSchema>
export type ExerciseInput = z.input<typeof exerciseSchema>

/** Todos los musculos que toca un ejercicio, con su factor. */
export function allContributions(ex: Exercise) {
  return [...ex.primary, ...ex.secondary]
}

/** El musculo primario dominante, para agrupar y colorear. */
export function primaryMuscle(ex: Exercise): Muscle {
  return [...ex.primary].sort((a, b) => b.factor - a.factor)[0].muscle
}
