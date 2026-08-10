import type { SetLog } from '@/types/logs'
import { tonnage } from './e1rm'

/* ============================================================================
 *  Comparativas y logros
 * ----------------------------------------------------------------------------
 *  Un numero grande sin referencia no dice nada: "14.200 kg" no significa nada
 *  para nadie. "El peso de un autobus urbano" si.
 *
 *  Todas las equivalencias son aproximadas y estan pensadas para dar
 *  perspectiva, no para ser exactas. Donde la estimacion es especialmente
 *  gruesa (la energia de un kilo de grasa, por ejemplo) se dice claramente.
 * ========================================================================== */

export interface FunFact {
  emoji: string
  /** La cifra en si, ya formateada. */
  headline: string
  /** La comparativa que le da sentido. */
  comparison: string
  /** Matiz o advertencia, cuando la estimacion lo pide. */
  detail?: string
}

const nf = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })

/* ── Objetos por masa, de menor a mayor ────────────────────────────────── */

interface MassReference {
  kg: number
  singular: string
  plural: string
  emoji: string
}

const MASS_REFERENCES: MassReference[] = [
  { kg: 5, singular: 'un gato adulto', plural: 'gatos adultos', emoji: '🐈' },
  { kg: 25, singular: 'un saco de cemento', plural: 'sacos de cemento', emoji: '🧱' },
  { kg: 80, singular: 'una nevera', plural: 'neveras', emoji: '🧊' },
  { kg: 130, singular: 'una moto', plural: 'motos', emoji: '🏍️' },
  { kg: 400, singular: 'un piano de cola', plural: 'pianos de cola', emoji: '🎹' },
  { kg: 700, singular: 'una vaca adulta', plural: 'vacas adultas', emoji: '🐄' },
  { kg: 1100, singular: 'un coche pequeno', plural: 'coches pequenos', emoji: '🚗' },
  { kg: 2500, singular: 'una furgoneta', plural: 'furgonetas', emoji: '🚐' },
  { kg: 6000, singular: 'un elefante africano', plural: 'elefantes africanos', emoji: '🐘' },
  { kg: 12000, singular: 'un autobus urbano', plural: 'autobuses urbanos', emoji: '🚌' },
  { kg: 30000, singular: 'un camion cargado', plural: 'camiones cargados', emoji: '🚛' },
  { kg: 78000, singular: 'un avion A320', plural: 'aviones A320', emoji: '✈️' },
  { kg: 150000, singular: 'una ballena azul', plural: 'ballenas azules', emoji: '🐋' },
  { kg: 1000000, singular: 'una locomotora de mercancias', plural: 'locomotoras', emoji: '🚂' },
  { kg: 7300000, singular: 'la estructura de la torre Eiffel', plural: 'torres Eiffel', emoji: '🗼' },
]

/** La referencia mas grande que quepa al menos una vez. */
function pickReference(kg: number): MassReference {
  let best = MASS_REFERENCES[0]
  for (const ref of MASS_REFERENCES) {
    if (kg >= ref.kg) best = ref
    else break
  }
  return best
}

function timesPhrase(kg: number, ref: MassReference): string {
  const times = kg / ref.kg
  if (times < 1.15) return `el peso de ${ref.singular}`
  if (times < 2) return `${nf1.format(times)} veces ${ref.singular}`
  return `${nf1.format(times)} ${ref.plural}`
}

/**
 * Tonelaje levantado traducido a algo imaginable.
 * `bodyweightKg` anade la referencia mas personal: cuantas veces te has
 * levantado a ti mismo.
 */
export function tonnageFact(kg: number, bodyweightKg?: number): FunFact | null {
  if (kg < 100) return null
  const ref = pickReference(kg)

  let detail: string | undefined
  if (bodyweightKg && bodyweightKg > 0) {
    const times = Math.round(kg / bodyweightKg)
    if (times >= 3) detail = `Equivale a levantarte a ti mismo ${nf.format(times)} veces.`
  }

  return {
    emoji: ref.emoji,
    headline: `${nf.format(kg)} kg movidos`,
    comparison: timesPhrase(kg, ref),
    detail,
  }
}

/** Tonelaje total de un conjunto de series (peso x repeticiones). */
export function totalTonnage(sets: SetLog[]): number {
  return sets.reduce((sum, s) => sum + tonnage(s), 0)
}

/* ── Cambio de peso corporal ───────────────────────────────────────────── */

/** Energia almacenada en un kilo de tejido graso, en kcal. Cifra clasica y aproximada. */
const KCAL_PER_KG_FAT = 7700

/** Gasto caminando a paso ligero: 3.5 MET. kcal/h = MET x peso x 1.05 */
function walkingKcalPerHour(bodyweightKg: number): number {
  return 3.5 * bodyweightKg * 1.05
}

const SMALL_MASS_ITEMS: Array<{ kg: number; label: string }> = [
  { kg: 0.33, label: 'una lata de refresco' },
  { kg: 1, label: 'un paquete de azucar' },
  { kg: 1.5, label: 'una botella grande de agua' },
  { kg: 2.5, label: 'un portatil' },
  { kg: 5, label: 'una mancuerna de 5 kg' },
  { kg: 10, label: 'un disco grande de gimnasio' },
  { kg: 20, label: 'un saco de pienso' },
]

function smallMassPhrase(kg: number): string {
  const abs = Math.abs(kg)
  let best = SMALL_MASS_ITEMS[0]
  for (const item of SMALL_MASS_ITEMS) {
    if (abs >= item.kg) best = item
    else break
  }
  const times = abs / best.kg
  if (times < 1.3) return best.label
  return `${nf1.format(times)} × ${best.label}`
}

/**
 * Cambio de peso corporal con dos lecturas: el objeto equivalente y, si se ha
 * perdido peso, el esfuerzo que representa esa energia.
 *
 * La equivalencia energetica asume que TODO el cambio es grasa, cosa que nunca
 * es del todo cierta: agua y glucogeno mueven la bascula sin tocar el tejido.
 * Por eso se calcula sobre la tendencia y se advierte del supuesto.
 */
export function weightChangeFact(deltaKg: number, bodyweightKg: number): FunFact | null {
  const abs = Math.abs(deltaKg)
  if (abs < 0.4) return null

  const lost = deltaKg < 0

  if (lost) {
    const kcal = abs * KCAL_PER_KG_FAT
    const hours = kcal / walkingKcalPerHour(bodyweightKg || 75)
    return {
      emoji: '🚶',
      headline: `${nf1.format(abs)} kg menos`,
      comparison: `dejas de cargar ${smallMassPhrase(abs)} en cada paso`,
      detail:
        hours >= 2
          ? `Esa grasa almacenaba unas ${nf.format(kcal)} kcal: el gasto de caminar ${nf.format(hours)} horas seguidas. Estimacion orientativa, el peso tambien oscila por agua y glucogeno.`
          : undefined,
    }
  }

  return {
    emoji: '📈',
    headline: `${nf1.format(abs)} kg mas`,
    comparison: `el peso de ${smallMassPhrase(abs)}`,
    detail: 'Si estas en fase de ganancia, acompanalo de progresion en las cargas para que sea musculo.',
  }
}

/* ── Repeticiones y series ─────────────────────────────────────────────── */

export function repsFact(sets: SetLog[]): FunFact | null {
  const working = sets.filter((s) => !s.isWarmup && s.reps > 0)
  if (working.length === 0) return null
  const reps = working.reduce((n, s) => n + s.reps, 0)
  if (reps < 20) return null

  return {
    emoji: '🔁',
    headline: `${nf.format(reps)} repeticiones`,
    comparison: `en ${working.length} series efectivas`,
  }
}

/* ── Pasos ─────────────────────────────────────────────────────────────── */

const DISTANCE_REFERENCES: Array<{ km: number; label: string }> = [
  { km: 0.4, label: 'una vuelta a una pista de atletismo' },
  { km: 5, label: 'una carrera popular de 5 km' },
  { km: 10, label: 'una carrera de 10 km' },
  { km: 21.1, label: 'una media maraton' },
  { km: 42.2, label: 'una maraton' },
  { km: 100, label: 'la distancia de Madrid a Toledo, ida y vuelta' },
  { km: 350, label: 'la distancia de Madrid a Valencia' },
  { km: 620, label: 'la distancia de Madrid a Barcelona' },
]

/** Un paso ronda los 0,75 m de zancada media. */
const METERS_PER_STEP = 0.75

export function stepsFact(steps: number): FunFact | null {
  if (steps < 3000) return null
  const km = (steps * METERS_PER_STEP) / 1000

  let best = DISTANCE_REFERENCES[0]
  for (const ref of DISTANCE_REFERENCES) {
    if (km >= ref.km) best = ref
    else break
  }
  const times = km / best.km

  return {
    emoji: '👟',
    headline: `${nf1.format(km)} km recorridos`,
    comparison: times < 1.3 ? best.label : `${nf1.format(times)} veces ${best.label}`,
  }
}

/* ── Resumen de sesion ─────────────────────────────────────────────────── */

export interface SessionSummary {
  tonnageKg: number
  workingSets: number
  reps: number
  facts: FunFact[]
}

export function summarizeSession(sets: SetLog[], bodyweightKg?: number): SessionSummary {
  const working = sets.filter((s) => !s.isWarmup && s.reps > 0)
  const kg = totalTonnage(sets)
  const facts: FunFact[] = []

  const t = tonnageFact(kg, bodyweightKg)
  if (t) facts.push(t)
  const r = repsFact(sets)
  if (r) facts.push(r)

  return {
    tonnageKg: kg,
    workingSets: working.length,
    reps: working.reduce((n, s) => n + s.reps, 0),
    facts,
  }
}
