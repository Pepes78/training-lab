import type { BodyMetric } from '@/types/logs'

/* ============================================================================
 *  Series temporales y tendencias
 * ----------------------------------------------------------------------------
 *  El peso corporal diario es ruido: agua, sodio, glucogeno y contenido
 *  intestinal mueven la bascula uno o dos kilos sin que cambie nada real.
 *  Interpretar un dato suelto lleva a decisiones equivocadas.
 *
 *  Por eso el peso siempre se muestra en dos capas: los puntos diarios en
 *  suave, y encima la media movil, que es lo unico que se debe interpretar.
 * ========================================================================== */

export interface Point {
  date: string
  value: number
}

/** Media movil centrada de ventana `window` dias. */
export function movingAverage(points: Point[], window = 7): Array<Point & { avg: number | null }> {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const half = Math.floor(window / 2)

  return sorted.map((p, i) => {
    const from = Math.max(0, i - half)
    const to = Math.min(sorted.length - 1, i + half)
    const slice = sorted.slice(from, to + 1)
    // Sin ventana completa la media es engañosa: mejor no dibujarla.
    if (slice.length < Math.min(window, 3)) return { ...p, avg: null }
    const avg = slice.reduce((s, x) => s + x.value, 0) / slice.length
    return { ...p, avg: Math.round(avg * 100) / 100 }
  })
}

/**
 * Pendiente por semana usando regresion lineal sobre los dias transcurridos.
 * Aplicada al peso corporal da los kg/semana que estas ganando o perdiendo.
 */
export function weeklyTrend(points: Point[]): { perWeek: number; confident: boolean } | null {
  if (points.length < 4) return null
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const t0 = new Date(sorted[0].date).getTime()
  const day = 86_400_000

  const xs = sorted.map((p) => (new Date(p.date).getTime() - t0) / day)
  const ys = sorted.map((p) => p.value)
  const n = xs.length
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n

  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY)
    den += (xs[i] - meanX) ** 2
  }
  if (den === 0) return null

  const slopePerDay = num / den
  const spanDays = xs[n - 1] - xs[0]

  return {
    perWeek: Math.round(slopePerDay * 7 * 100) / 100,
    // Con menos de dos semanas o menos de 6 medidas, la pendiente es poco fiable.
    confident: spanDays >= 14 && n >= 6,
  }
}

export function metricPoints(metrics: BodyMetric[], key: string): Point[] {
  return metrics
    .filter((m) => m.metric === key)
    .map((m) => ({ date: m.date, value: m.value }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Ultimo valor registrado de una metrica. */
export function latest(points: Point[]): Point | null {
  if (points.length === 0) return null
  return points[points.length - 1]
}

/** Diferencia entre el ultimo valor y el de hace `days` dias (el mas cercano). */
export function changeOver(points: Point[], days: number): number | null {
  if (points.length < 2) return null
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const last = sorted[sorted.length - 1]
  const target = new Date(last.date).getTime() - days * 86_400_000

  let closest = sorted[0]
  let bestDiff = Infinity
  for (const p of sorted.slice(0, -1)) {
    const diff = Math.abs(new Date(p.date).getTime() - target)
    if (diff < bestDiff) {
      bestDiff = diff
      closest = p
    }
  }
  return Math.round((last.value - closest.value) * 100) / 100
}
