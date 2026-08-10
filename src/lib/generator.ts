import type { Equipment, Exercise, Muscle } from '@/types/catalog'
import type { Goal, Level, Routine, Slot } from '@/types/routine'
// Level se usa tanto en el perfil como en la puntuacion de candidatos
import { routineSchema } from '@/types/routine'
import { splitFor, type DayBlueprint, type RoleSlot } from '@/data/blueprints'

/* ============================================================================
 *  Generador de rutinas
 * ----------------------------------------------------------------------------
 *  Convierte un cuestionario corto en una rutina completa y VALIDA contra el
 *  mismo esquema que una importada de Claude. No es un sistema paralelo: sale
 *  por la misma tuberia, asi que hereda la sustitucion semanal, el conteo de
 *  volumen y el motor de progresion sin tocar nada.
 *
 *  El generador resuelve roles, no nombres: la plantilla pide "traccion
 *  vertical para dorsal" y aqui se elige el mejor ejercicio disponible segun el
 *  material y las limitaciones de la persona.
 * ========================================================================== */

export const EQUIPMENT_PROFILES = ['gym', 'dumbbells', 'machines', 'bodyweight'] as const
export type EquipmentProfile = (typeof EQUIPMENT_PROFILES)[number]

export const EQUIPMENT_PROFILE_LABEL: Record<EquipmentProfile, string> = {
  gym: 'Gimnasio completo',
  dumbbells: 'Mancuernas y barra en casa',
  machines: 'Solo maquinas y poleas',
  bodyweight: 'Peso corporal y bandas',
}

const ALLOWED_EQUIPMENT: Record<EquipmentProfile, Equipment[]> = {
  gym: ['barbell', 'dumbbell', 'machine', 'cable', 'smith', 'bodyweight', 'band', 'kettlebell', 'ez-bar', 'other'],
  dumbbells: ['dumbbell', 'barbell', 'ez-bar', 'bodyweight', 'band', 'kettlebell'],
  machines: ['machine', 'cable', 'smith', 'bodyweight'],
  bodyweight: ['bodyweight', 'band'],
}

export const LIMITATIONS = ['shoulder', 'knee', 'lower-back', 'wrist'] as const
export type Limitation = (typeof LIMITATIONS)[number]

export const LIMITATION_LABEL: Record<Limitation, string> = {
  shoulder: 'Hombro',
  knee: 'Rodilla',
  'lower-back': 'Zona lumbar',
  wrist: 'Muneca o codo',
}

/**
 * Ejercicios desaconsejados por limitacion, y material que se penaliza.
 *
 * No es consejo medico: son exclusiones conservadoras para que la rutina
 * generada no proponga de entrada lo que mas suele molestar. Cualquier dolor
 * persistente necesita a un profesional, no a un algoritmo.
 */
const LIMITATION_RULES: Record<Limitation, { exclude: string[]; avoidEquipment: Equipment[] }> = {
  // Los fondos, en paralelas o en banco, son de lo que mas comprime el hombro
  shoulder: {
    exclude: ['fondos-paralelas', 'fondos-banco', 'press-frances'],
    avoidEquipment: ['barbell'],
  },
  knee: { exclude: ['sentadilla-barra', 'zancada-mancuernas', 'sumo-mancuerna'], avoidEquipment: [] },
  'lower-back': {
    exclude: ['peso-muerto-rumano-barra', 'remo-barra', 'sentadilla-barra', 'peso-muerto-rumano'],
    avoidEquipment: ['barbell'],
  },
  wrist: { exclude: ['curl-barra'], avoidEquipment: [] },
}

export const EMPHASIS_OPTIONS = ['balanced', 'chest', 'back', 'arms', 'shoulders', 'legs', 'glutes'] as const
export type Emphasis = (typeof EMPHASIS_OPTIONS)[number]

export const EMPHASIS_LABEL: Record<Emphasis, string> = {
  balanced: 'Equilibrado',
  chest: 'Pecho',
  back: 'Espalda',
  arms: 'Brazos',
  shoulders: 'Hombros',
  legs: 'Pierna',
  glutes: 'Gluteos',
}

const EMPHASIS_MUSCLES: Record<Emphasis, Muscle[]> = {
  balanced: [],
  chest: ['chest'],
  back: ['lats', 'upper-back'],
  arms: ['biceps', 'triceps'],
  shoulders: ['side-delts', 'rear-delts', 'front-delts'],
  legs: ['quads', 'hamstrings', 'calves'],
  glutes: ['glutes', 'hamstrings'],
}

export const SESSION_LENGTHS = ['short', 'medium', 'long'] as const
export type SessionLength = (typeof SESSION_LENGTHS)[number]

export const SESSION_LENGTH_LABEL: Record<SessionLength, string> = {
  short: 'Corta (~45 min)',
  medium: 'Media (~60-75 min)',
  long: 'Larga (90 min o mas)',
}

/** Tope de series efectivas por sesion, para que la duracion sea realista. */
const SET_CAP: Record<SessionLength, number> = { short: 16, medium: 24, long: 32 }

export interface Profile {
  goal: Goal
  level: Level
  daysPerWeek: number
  equipment: EquipmentProfile
  sessionLength: SessionLength
  emphasis: Emphasis
  limitations: Limitation[]
  durationWeeks: number
}

export const DEFAULT_PROFILE: Profile = {
  goal: 'hypertrophy',
  level: 'intermediate',
  daysPerWeek: 4,
  equipment: 'gym',
  sessionLength: 'medium',
  emphasis: 'balanced',
  limitations: [],
  durationWeeks: 8,
}

/* ── Seleccion de ejercicio para un rol ────────────────────────────────── */

function isCandidate(ex: Exercise, slot: RoleSlot, allowed: Set<Equipment>, excluded: Set<string>): boolean {
  if (excluded.has(ex.id)) return false
  if (!allowed.has(ex.equipment)) return false
  if (!slot.patterns.includes(ex.pattern)) return false
  // El musculo del rol debe ser primario, no una contribucion de refilon
  return ex.primary.some((p) => p.muscle === slot.muscle && p.factor >= 0.5)
}

function scoreCandidate(
  ex: Exercise,
  slot: RoleSlot,
  avoidEquipment: Set<Equipment>,
  usedInDay: Set<string>,
  usedInRoutine: Set<string>,
  level: Level,
): number {
  let score = 100

  // Las versiones asistidas son un punto de partida para principiantes y un
  // paso atras para el resto. Siguen disponibles como sustituto.
  if (ex.isRegression) score += level === 'beginner' ? 25 : -45

  // Preferencia por el orden en que la plantilla lista los patrones
  const patternRank = slot.patterns.indexOf(ex.pattern)
  score -= patternRank * 15

  // Los basicos piden material estable y cargable; el aislamiento, tension constante
  if (slot.tier === 'compound') {
    if (ex.equipment === 'barbell') score += 20
    if (ex.equipment === 'machine' || ex.equipment === 'smith') score += 12
    if (ex.equipment === 'cable') score -= 8
  } else if (slot.tier === 'isolation') {
    if (ex.equipment === 'cable') score += 18
    if (ex.equipment === 'machine') score += 10
    if (ex.equipment === 'barbell') score -= 12
  }

  if (avoidEquipment.has(ex.equipment)) score -= 40

  // Variedad: nunca repetir dentro del dia, y evitarlo entre dias
  if (usedInDay.has(ex.id)) score -= 1000
  if (usedInRoutine.has(ex.id)) score -= 25

  // A igualdad, el que mas concentra el estimulo en el musculo objetivo
  const primary = ex.primary.find((p) => p.muscle === slot.muscle)
  score += (primary?.factor ?? 0) * 10

  return score
}

/* ── Ajustes por perfil ────────────────────────────────────────────────── */

function adjustSets(base: number, level: Level, emphasized: boolean): number {
  const byLevel = level === 'beginner' ? base * 0.7 : level === 'advanced' ? base * 1.15 : base
  const sets = Math.round(byLevel) + (emphasized ? 1 : 0)
  return Math.max(2, Math.min(6, sets))
}

function adjustReps(range: [number, number], goal: Goal, tier: RoleSlot['tier']): [number, number] {
  if (goal === 'strength') {
    if (tier === 'compound') return [4, 6]
    if (tier === 'accessory') return [6, 10]
    return [8, 12]
  }
  if (goal === 'endurance') {
    return [Math.round(range[0] * 1.4), Math.round(range[1] * 1.4)]
  }
  return range
}

/** Rampa de RIR: empezar lejos del fallo e ir apretando, con descarga final. */
function buildRirRamp(weeks: number, level: Level): Array<number | 'deload'> {
  const start = level === 'beginner' ? 4 : level === 'advanced' ? 3 : 3
  const end = level === 'beginner' ? 2 : 0
  const training = Math.max(1, weeks - 1)
  const ramp: Array<number | 'deload'> = []
  for (let i = 0; i < training; i++) {
    const t = training === 1 ? 1 : i / (training - 1)
    ramp.push(Math.round(start - (start - end) * t))
  }
  ramp.push('deload')
  return ramp
}

/* ── Generacion ────────────────────────────────────────────────────────── */

export interface GenerationResult {
  routine: Routine
  /** Roles que no se pudieron cubrir con el material disponible. */
  unresolved: string[]
  /** Explicacion de las decisiones, para mostrarla antes de guardar. */
  notes: string[]
}

export function generateRoutine(profile: Profile, catalog: Exercise[]): GenerationResult {
  const split = splitFor(profile.daysPerWeek)
  const allowed = new Set(ALLOWED_EQUIPMENT[profile.equipment])

  const excluded = new Set<string>()
  const avoidEquipment = new Set<Equipment>()
  for (const lim of profile.limitations) {
    for (const id of LIMITATION_RULES[lim].exclude) excluded.add(id)
    for (const eq of LIMITATION_RULES[lim].avoidEquipment) avoidEquipment.add(eq)
  }

  const emphasized = new Set(EMPHASIS_MUSCLES[profile.emphasis])
  const usedInRoutine = new Set<string>()
  const unresolved: string[] = []
  const cap = SET_CAP[profile.sessionLength]

  const built = split.days.map((blueprint, dayIndex) =>
    buildDay(blueprint, dayIndex, {
      profile,
      catalog,
      allowed,
      excluded,
      avoidEquipment,
      emphasized,
      usedInRoutine,
      unresolved,
      cap,
    }),
  )

  // Si con el material disponible un dia se queda sin ningun ejercicio, se
  // descarta en vez de emitir una rutina invalida. Se renumeran los dias
  // restantes para que el orden siga siendo consecutivo.
  const dropped = built.filter((d) => d.blocks[0].exercises.length === 0).length
  const days = built
    .filter((d) => d.blocks[0].exercises.length > 0)
    .map((d, i) => ({ ...d, order: i + 1 }))

  if (days.length === 0) {
    throw new Error(
      'Con el material y las limitaciones elegidos no hay ejercicios suficientes para montar una rutina. Prueba a anadir material o a quitar alguna limitacion.',
    )
  }

  const notes: string[] = [split.rationale]
  if (profile.limitations.length > 0) {
    notes.push(
      `Se han evitado los ejercicios que mas suelen molestar con: ${profile.limitations
        .map((l) => LIMITATION_LABEL[l].toLowerCase())
        .join(', ')}. No sustituye la valoracion de un profesional.`,
    )
  }
  if (profile.emphasis !== 'balanced') {
    notes.push(`Se ha anadido una serie extra al trabajo de ${EMPHASIS_LABEL[profile.emphasis].toLowerCase()}.`)
  }
  if (profile.sessionLength === 'short') {
    notes.push('Sesiones cortas: se han recortado los accesorios opcionales para no pasar de 16 series efectivas.')
  }
  if (unresolved.length > 0) {
    notes.push(
      `Con el material elegido no hay ejercicio para: ${unresolved.join(', ')}. Puedes anadirlos a mano mas adelante.`,
    )
  }
  if (dropped > 0) {
    notes.push(
      `Se han descartado ${dropped} ${dropped === 1 ? 'dia que quedaba' : 'dias que quedaban'} sin ejercicios utilizables con este material.`,
    )
  }

  const draft = {
    schemaVersion: '1.0' as const,
    id: `generada-${profile.daysPerWeek}d-${profile.goal}-${Date.now().toString(36)}`,
    name: `${split.name} · ${profile.emphasis === 'balanced' ? 'equilibrada' : EMPHASIS_LABEL[profile.emphasis].toLowerCase()}`,
    description: notes.join(' '),
    author: 'Generador de Training Lab',
    goal: profile.goal,
    experienceLevel: profile.level,
    durationWeeks: profile.durationWeeks,
    daysPerWeek: days.length,
    tags: ['generada', `${profile.daysPerWeek} dias`, EQUIPMENT_PROFILE_LABEL[profile.equipment]],
    references: [
      'Frecuencia 2x/semana por grupo muscular: Schoenfeld, Ogborn & Krieger (2016)',
      'Rangos de 5-30 reps cerca del fallo producen hipertrofia similar: Schoenfeld et al. (2021)',
      'Marco de volumen MEV/MAV/MRV: Renaissance Periodization',
    ],
    progression: {
      type: 'double-progression' as const,
      incrementKg: { upper: 2.5, lower: 5, isolation: 1.25 },
      rirRamp: buildRirRamp(profile.durationWeeks, profile.level),
    },
    deload: { week: 'last' as const, volumeMultiplier: 0.5, intensityMultiplier: 0.9 },
    days,
    customExercises: [],
  }

  // Se valida contra el mismo esquema que una rutina importada: si el generador
  // produjera algo invalido, es un fallo nuestro y debe verse aqui, no despues.
  const parsed = routineSchema.safeParse(draft)
  if (!parsed.success) {
    throw new Error(
      `El generador produjo una rutina invalida: ${parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    )
  }

  return { routine: parsed.data, unresolved, notes }
}

interface BuildContext {
  profile: Profile
  catalog: Exercise[]
  allowed: Set<Equipment>
  excluded: Set<string>
  avoidEquipment: Set<Equipment>
  emphasized: Set<Muscle>
  usedInRoutine: Set<string>
  unresolved: string[]
  cap: number
}

function buildDay(blueprint: DayBlueprint, dayIndex: number, ctx: BuildContext) {
  const usedInDay = new Set<string>()
  const exercises: Slot[] = []
  let setsSoFar = 0
  let slotIndex = 0

  // En sesiones cortas los opcionales caen antes de tocar el trabajo principal
  const slots =
    ctx.profile.sessionLength === 'short' ? blueprint.slots.filter((s) => !s.optional) : blueprint.slots

  for (const role of slots) {
    const candidates = ctx.catalog
      .filter((ex) => isCandidate(ex, role, ctx.allowed, ctx.excluded))
      .map((ex) => ({
        ex,
        score: scoreCandidate(
          ex,
          role,
          ctx.avoidEquipment,
          usedInDay,
          ctx.usedInRoutine,
          ctx.profile.level,
        ),
      }))
      .sort((a, b) => b.score - a.score)

    if (candidates.length === 0) {
      if (!ctx.unresolved.includes(role.role)) ctx.unresolved.push(role.role)
      continue
    }

    const chosen = candidates[0].ex
    const isEmphasized = chosen.primary.some((p) => ctx.emphasized.has(p.muscle))
    const sets = adjustSets(role.sets, ctx.profile.level, isEmphasized)

    if (setsSoFar + sets > ctx.cap) break
    setsSoFar += sets

    usedInDay.add(chosen.id)
    ctx.usedInRoutine.add(chosen.id)
    slotIndex++

    exercises.push({
      slotId: `d${dayIndex + 1}-s${slotIndex}`,
      exerciseId: chosen.id,
      sets,
      repRange: adjustReps(role.repRange, ctx.profile.goal, role.tier),
      restSec: ctx.profile.goal === 'strength' && role.tier === 'compound' ? role.restSec + 30 : role.restSec,
      warmupSets: role.tier === 'compound' ? 2 : 0,
      perSide: chosen.isUnilateral,
      metric: chosen.defaultMetric,
      notes: role.notes,
      // Los siguientes mejores candidatos quedan como alternativas para el dia
      // que la maquina este ocupada
      substitutions: candidates.slice(1, 4).map((c) => c.ex.id),
    })
  }

  return {
    id: `${blueprint.id}-${dayIndex + 1}`,
    name: blueprint.name,
    type: blueprint.type,
    order: dayIndex + 1,
    focus: blueprint.focus,
    blocks: [{ type: 'single' as const, exercises }],
  }
}
