import type { MovementPattern, Muscle } from '@/types/catalog'
import type { DayType } from '@/types/routine'

/* ============================================================================
 *  Plantillas de reparto semanal
 * ----------------------------------------------------------------------------
 *  Una plantilla NO nombra ejercicios concretos: describe ROLES ("empuje
 *  horizontal pesado", "aislamiento de biceps"). El generador resuelve cada rol
 *  contra el catalogo segun el material disponible y las limitaciones.
 *
 *  Esa indireccion es lo que permite que la misma plantilla sirva para un
 *  gimnasio completo y para alguien con solo mancuernas: cambia el ejercicio,
 *  no la estructura.
 *
 *  Todos los repartos buscan frecuencia 2x por grupo muscular, que es lo que
 *  mejor respaldo tiene para hipertrofia. Con 2 y 3 dias se consigue con cuerpo
 *  completo; con 4 o mas, dividiendo.
 * ========================================================================== */

export interface RoleSlot {
  /** Etiqueta legible, aparece si el generador no encuentra ejercicio. */
  role: string
  /** Patrones aceptables, en orden de preferencia. */
  patterns: MovementPattern[]
  /** Musculo que debe trabajar de forma primaria. */
  muscle: Muscle
  /**
   * compound   basico pesado, va primero y con descansos largos
   * accessory  trabajo intermedio
   * isolation  aislamiento, al final y con rangos altos
   */
  tier: 'compound' | 'accessory' | 'isolation'
  sets: number
  repRange: [number, number]
  restSec: number
  notes?: string
  /** Si se marca, se omite cuando la sesion tiene que ser corta. */
  optional?: boolean
}

export interface DayBlueprint {
  id: string
  name: string
  type: DayType
  focus: string
  slots: RoleSlot[]
}

/* ── Piezas reutilizables ──────────────────────────────────────────────── */

const HEAVY_REST = 180
const MID_REST = 105
const ISO_REST = 60

const pushHeavy = (sets = 4): RoleSlot => ({
  role: 'Empuje horizontal pesado',
  patterns: ['horizontal-push'],
  muscle: 'chest',
  tier: 'compound',
  sets,
  repRange: [6, 8],
  restSec: HEAVY_REST,
})

const pullVertical = (sets = 4): RoleSlot => ({
  role: 'Traccion vertical',
  patterns: ['vertical-pull'],
  muscle: 'lats',
  tier: 'compound',
  sets,
  repRange: [8, 10],
  restSec: MID_REST,
})

const pullHorizontal = (sets = 3): RoleSlot => ({
  role: 'Traccion horizontal',
  patterns: ['horizontal-pull'],
  muscle: 'upper-back',
  tier: 'compound',
  sets,
  repRange: [8, 12],
  restSec: MID_REST,
})

const pressVertical = (sets = 3): RoleSlot => ({
  role: 'Empuje vertical',
  patterns: ['vertical-push'],
  muscle: 'front-delts',
  tier: 'accessory',
  sets,
  repRange: [8, 12],
  restSec: MID_REST,
})

const squatPattern = (sets = 4): RoleSlot => ({
  role: 'Dominante de rodilla pesado',
  patterns: ['squat'],
  muscle: 'quads',
  tier: 'compound',
  sets,
  repRange: [6, 10],
  restSec: HEAVY_REST,
})

const hingePattern = (sets = 3): RoleSlot => ({
  role: 'Dominante de cadera',
  patterns: ['hinge'],
  muscle: 'hamstrings',
  tier: 'compound',
  sets,
  repRange: [8, 12],
  restSec: MID_REST,
})

const quadAccessory = (sets = 3): RoleSlot => ({
  role: 'Accesorio de cuadriceps',
  patterns: ['knee-extension', 'lunge', 'squat'],
  muscle: 'quads',
  tier: 'accessory',
  sets,
  repRange: [10, 15],
  restSec: ISO_REST,
})

const hamstringIso = (sets = 3): RoleSlot => ({
  role: 'Aislamiento de isquiotibiales',
  patterns: ['knee-flexion'],
  muscle: 'hamstrings',
  tier: 'isolation',
  sets,
  repRange: [10, 15],
  restSec: ISO_REST,
})

const gluteWork = (sets = 3, optional = false): RoleSlot => ({
  role: 'Gluteo',
  patterns: ['hip-thrust', 'hip-abduction', 'lunge'],
  muscle: 'glutes',
  tier: 'accessory',
  sets,
  repRange: [10, 15],
  restSec: ISO_REST,
  optional,
})

const chestIso = (sets = 3, optional = false): RoleSlot => ({
  role: 'Aislamiento de pectoral',
  patterns: ['horizontal-push'],
  muscle: 'chest',
  tier: 'isolation',
  sets,
  repRange: [12, 15],
  restSec: ISO_REST,
  optional,
})

const sideDelts = (sets = 3): RoleSlot => ({
  role: 'Deltoides lateral',
  patterns: ['shoulder-abduction'],
  muscle: 'side-delts',
  tier: 'isolation',
  sets,
  repRange: [12, 20],
  restSec: ISO_REST,
  notes: 'Peso ligero y control: el deltoides lateral es pequeno y tolera mucho volumen.',
})

const rearDelts = (sets = 3, optional = false): RoleSlot => ({
  role: 'Deltoides posterior',
  patterns: ['shoulder-horizontal-abduction'],
  muscle: 'rear-delts',
  tier: 'isolation',
  sets,
  repRange: [15, 20],
  restSec: ISO_REST,
  notes: 'Tambien es trabajo de salud del hombro: prioriza tecnica sobre carga.',
  optional,
})

const biceps = (sets = 3): RoleSlot => ({
  role: 'Biceps',
  patterns: ['elbow-flexion'],
  muscle: 'biceps',
  tier: 'isolation',
  sets,
  repRange: [10, 12],
  restSec: ISO_REST,
})

const triceps = (sets = 3): RoleSlot => ({
  role: 'Triceps',
  patterns: ['elbow-extension'],
  muscle: 'triceps',
  tier: 'isolation',
  sets,
  repRange: [10, 12],
  restSec: ISO_REST,
})

const calves = (sets = 3, optional = true): RoleSlot => ({
  role: 'Gemelos',
  patterns: ['calf-raise'],
  muscle: 'calves',
  tier: 'isolation',
  sets,
  repRange: [12, 20],
  restSec: ISO_REST,
  optional,
})

const core = (sets = 3, optional = true): RoleSlot => ({
  role: 'Core',
  patterns: ['core-flexion', 'core-anti-extension'],
  muscle: 'abs',
  tier: 'isolation',
  sets,
  repRange: [12, 20],
  restSec: 45,
  optional,
})

/* ── Dias ──────────────────────────────────────────────────────────────── */

const FULL_BODY_A: DayBlueprint = {
  id: 'fb-a',
  name: 'Cuerpo completo A',
  type: 'full-body',
  focus: 'Sentadilla, empuje horizontal y traccion vertical',
  slots: [squatPattern(3), pushHeavy(3), pullVertical(3), hamstringIso(2), sideDelts(2), biceps(2), core(2)],
}

const FULL_BODY_B: DayBlueprint = {
  id: 'fb-b',
  name: 'Cuerpo completo B',
  type: 'full-body',
  focus: 'Bisagra de cadera, empuje vertical y traccion horizontal',
  slots: [hingePattern(3), pressVertical(3), pullHorizontal(3), quadAccessory(2), triceps(2), calves(2), core(2)],
}

const FULL_BODY_C: DayBlueprint = {
  id: 'fb-c',
  name: 'Cuerpo completo C',
  type: 'full-body',
  focus: 'Variacion de todos los patrones con rangos mas altos',
  slots: [quadAccessory(3), chestIso(3), pullHorizontal(3), gluteWork(3), rearDelts(2), biceps(2), triceps(2)],
}

const UPPER_A: DayBlueprint = {
  id: 'up-a',
  name: 'Tren superior — Fuerza',
  type: 'upper',
  focus: 'Empuje y traccion pesados, rangos bajos',
  slots: [pushHeavy(4), pullVertical(4), pressVertical(3), pullHorizontal(3), sideDelts(3), biceps(3), triceps(3)],
}

const UPPER_B: DayBlueprint = {
  id: 'up-b',
  name: 'Tren superior — Volumen',
  type: 'upper',
  focus: 'Rangos medios y altos, mas aislamiento',
  slots: [pullHorizontal(4), chestIso(4), pullVertical(3), rearDelts(3), sideDelts(3), biceps(3), triceps(3)],
}

const LOWER_A: DayBlueprint = {
  id: 'lo-a',
  name: 'Tren inferior — Fuerza',
  type: 'lower',
  focus: 'Sentadilla pesada y cadena posterior',
  slots: [squatPattern(4), hingePattern(3), quadAccessory(3), hamstringIso(3), calves(3, false), core(3, false)],
}

const LOWER_B: DayBlueprint = {
  id: 'lo-b',
  name: 'Tren inferior — Volumen',
  type: 'lower',
  focus: 'Maquinas y rangos altos, menos fatiga sistemica',
  slots: [quadAccessory(4), hingePattern(3), gluteWork(3), hamstringIso(3), calves(3, false), core(3)],
}

const PUSH_DAY: DayBlueprint = {
  id: 'push',
  name: 'Empuje',
  type: 'push',
  focus: 'Pectoral, deltoides y triceps',
  slots: [pushHeavy(4), pressVertical(3), chestIso(3), sideDelts(4), triceps(3), triceps(2)],
}

const PULL_DAY: DayBlueprint = {
  id: 'pull',
  name: 'Traccion',
  type: 'pull',
  focus: 'Dorsal, espalda alta, deltoides posterior y biceps',
  slots: [pullVertical(4), pullHorizontal(4), rearDelts(3, false), biceps(3), biceps(2), calves(2)],
}

const LEGS_DAY: DayBlueprint = {
  id: 'legs',
  name: 'Pierna',
  type: 'legs',
  focus: 'Cuadriceps, isquiotibiales, gluteos y gemelos',
  slots: [squatPattern(4), hingePattern(3), quadAccessory(3), hamstringIso(3), gluteWork(3), calves(3, false), core(2)],
}

/* ── Repartos por dias disponibles ─────────────────────────────────────── */

export interface SplitBlueprint {
  daysPerWeek: number
  name: string
  rationale: string
  days: DayBlueprint[]
}

export const SPLITS: SplitBlueprint[] = [
  {
    daysPerWeek: 2,
    name: 'Cuerpo completo — 2 dias',
    rationale:
      'Con dos sesiones, dividir el cuerpo dejaria cada musculo a una vez por semana. Cuerpo completo mantiene la frecuencia de dos, que es donde esta el beneficio.',
    days: [FULL_BODY_A, FULL_BODY_B],
  },
  {
    daysPerWeek: 3,
    name: 'Cuerpo completo — 3 dias',
    rationale:
      'Tres sesiones de cuerpo completo dan frecuencia de tres por grupo muscular con un volumen por sesion manejable. Es el reparto con mejor relacion resultado/tiempo.',
    days: [FULL_BODY_A, FULL_BODY_B, FULL_BODY_C],
  },
  {
    daysPerWeek: 4,
    name: 'Torso/Pierna — 4 dias',
    rationale:
      'Dos sesiones de tren superior y dos de inferior: frecuencia de dos por grupo, con sesiones mas cortas y especificas que en cuerpo completo.',
    days: [UPPER_A, LOWER_A, UPPER_B, LOWER_B],
  },
  {
    daysPerWeek: 5,
    name: 'Torso/Pierna + PPL — 5 dias',
    rationale:
      'Hibrido: los dos primeros dias con enfasis en fuerza y el bloque Push/Pull/Legs orientado a volumen. Mantiene la frecuencia de dos y reparte mejor el volumen semanal.',
    days: [UPPER_A, LOWER_A, PUSH_DAY, PULL_DAY, LEGS_DAY],
  },
  {
    daysPerWeek: 6,
    name: 'Push/Pull/Legs ×2 — 6 dias',
    rationale:
      'Seis sesiones permiten volumen alto con sesiones cortas. Exige buena recuperacion: si el sueno o las calorias fallan, es el primer reparto que se resiente.',
    days: [
      PUSH_DAY,
      PULL_DAY,
      LEGS_DAY,
      { ...PUSH_DAY, id: 'push-b', name: 'Empuje B' },
      { ...PULL_DAY, id: 'pull-b', name: 'Traccion B' },
      { ...LEGS_DAY, id: 'legs-b', name: 'Pierna B' },
    ],
  },
]

export function splitFor(days: number): SplitBlueprint {
  const exact = SPLITS.find((s) => s.daysPerWeek === days)
  if (exact) return exact
  // Fuera de rango: el reparto util mas cercano
  return days < 2 ? SPLITS[0] : SPLITS[SPLITS.length - 1]
}
