import type { Muscle } from '@/types/catalog'

/* ============================================================================
 *  Referencias de volumen semanal
 * ----------------------------------------------------------------------------
 *  MV   volumen de mantenimiento: por debajo, se pierde musculo
 *  MEV  volumen minimo efectivo: el umbral para que haya crecimiento
 *  MAV  volumen adaptativo: la franja donde se progresa mejor
 *  MRV  volumen maximo recuperable: por encima, la fatiga supera la adaptacion
 *
 *  AVISO IMPORTANTE
 *  Estos numeros son HEURISTICAS, no ciencia exacta. Vienen del marco de
 *  landmarks popularizado por Renaissance Periodization (Mike Israetel) que
 *  Jeff Nippard usa como referencia divulgativa. La variacion entre personas
 *  es enorme: edad, nivel, genetica, sueno, calorias y seleccion de ejercicios
 *  mueven estos rangos con facilidad.
 *
 *  Usalos como semaforo, no como sentencia. Tu propia progresion de e1RM y tu
 *  fatiga acumulada mandan sobre cualquier tabla. Todos los valores se pueden
 *  editar en Ajustes y quedan guardados por musculo.
 *
 *  AJUSTE POR CONTEO FRACCIONAL
 *  Las tablas publicadas se construyeron contando SERIES DIRECTAS. Esta app
 *  cuenta ademas las indirectas (el triceps del press, el biceps del remo), asi
 *  que los totales salen mas altos por definicion. Por eso los musculos que
 *  reciben mucho trabajo indirecto —triceps, biceps, deltoides anterior— llevan
 *  aqui techos algo mas altos que la tabla original: comparar un recuento
 *  fraccional contra un umbral de conteo directo marcaria exceso donde no lo hay.
 * ========================================================================== */

export interface Landmark {
  mv: number
  mev: number
  /** [minimo, maximo] de la franja adaptativa. */
  mav: [number, number]
  mrv: number
}

export const VOLUME_LANDMARKS: Record<Muscle, Landmark> = {
  chest: { mv: 4, mev: 8, mav: [12, 20], mrv: 22 },
  // Recibe empuje indirecto de todo el trabajo de pecho y hombro: techo alto
  'front-delts': { mv: 0, mev: 0, mav: [6, 14], mrv: 18 },
  'side-delts': { mv: 6, mev: 8, mav: [16, 22], mrv: 26 },
  // Todo remo horizontal aporta algo de deltoides posterior: MEV moderado
  'rear-delts': { mv: 0, mev: 4, mav: [8, 18], mrv: 22 },
  lats: { mv: 6, mev: 10, mav: [14, 20], mrv: 25 },
  'upper-back': { mv: 6, mev: 10, mav: [14, 22], mrv: 25 },
  traps: { mv: 0, mev: 4, mav: [8, 16], mrv: 20 },
  'lower-back': { mv: 0, mev: 2, mav: [4, 10], mrv: 14 },
  biceps: { mv: 4, mev: 8, mav: [14, 20], mrv: 26 },
  // Toda la familia de empujes suma triceps: la tabla original (10-14/18) se
  // queda corta en cuanto cuentas las indirectas
  triceps: { mv: 4, mev: 6, mav: [10, 18], mrv: 22 },
  forearms: { mv: 0, mev: 2, mav: [6, 12], mrv: 16 },
  quads: { mv: 6, mev: 8, mav: [12, 18], mrv: 20 },
  hamstrings: { mv: 3, mev: 6, mav: [10, 16], mrv: 20 },
  glutes: { mv: 0, mev: 4, mav: [8, 16], mrv: 20 },
  adductors: { mv: 0, mev: 2, mav: [6, 12], mrv: 16 },
  abductors: { mv: 0, mev: 2, mav: [6, 12], mrv: 16 },
  calves: { mv: 6, mev: 8, mav: [12, 16], mrv: 20 },
  abs: { mv: 0, mev: 0, mav: [12, 20], mrv: 25 },
  obliques: { mv: 0, mev: 0, mav: [6, 12], mrv: 16 },
  neck: { mv: 0, mev: 0, mav: [4, 10], mrv: 14 },
}

export type VolumeStatus = 'below-mv' | 'below-mev' | 'optimal' | 'above-mav' | 'above-mrv'

export const VOLUME_STATUS_META: Record<
  VolumeStatus,
  { label: string; hint: string; tone: 'low' | 'warn' | 'good' | 'high' }
> = {
  'below-mv': {
    label: 'Muy bajo',
    hint: 'Por debajo del volumen de mantenimiento: riesgo de perder masa',
    tone: 'low',
  },
  'below-mev': {
    label: 'Insuficiente',
    hint: 'No llegas al minimo efectivo para crecer',
    tone: 'warn',
  },
  optimal: { label: 'Optimo', hint: 'Dentro de la franja adaptativa', tone: 'good' },
  'above-mav': {
    label: 'Alto',
    hint: 'Por encima de la franja adaptativa, aun recuperable',
    tone: 'warn',
  },
  'above-mrv': {
    label: 'Excesivo',
    hint: 'Supera el maximo recuperable: acumularas fatiga sin ganancia extra',
    tone: 'high',
  },
}

export function classifyVolume(sets: number, lm: Landmark): VolumeStatus {
  if (sets > lm.mrv) return 'above-mrv'
  if (sets > lm.mav[1]) return 'above-mav'
  if (sets >= lm.mev) return 'optimal'
  if (sets >= lm.mv) return 'below-mev'
  return 'below-mv'
}

/** Landmarks efectivos: los de serie mezclados con los que haya editado el usuario. */
export function resolveLandmarks(
  overrides: Record<string, { mev: number; mav: number; mrv: number }>,
): Record<Muscle, Landmark> {
  const out = { ...VOLUME_LANDMARKS }
  for (const [muscle, o] of Object.entries(overrides)) {
    const base = VOLUME_LANDMARKS[muscle as Muscle]
    if (!base) continue
    out[muscle as Muscle] = {
      mv: Math.min(base.mv, o.mev),
      mev: o.mev,
      mav: [o.mev, o.mav],
      mrv: o.mrv,
    }
  }
  return out
}
