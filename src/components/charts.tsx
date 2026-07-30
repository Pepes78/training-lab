import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Point } from '@/lib/stats'
import { movingAverage } from '@/lib/stats'
import { formatShort } from '@/lib/date'
import type { MuscleVolume } from '@/lib/volume'
import { MUSCLE_LABEL } from '@/types/catalog'
import { VOLUME_STATUS_META } from '@/data/volume-landmarks'

/* ============================================================================
 *  Graficas
 * ----------------------------------------------------------------------------
 *  Reglas que se siguen en todas:
 *    - Un solo eje Y. Nunca dos escalas en la misma grafica.
 *    - Rejilla y ejes recesivos; los datos son lo unico con peso visual.
 *    - Tooltip siempre: una grafica en pantalla es interactiva por definicion.
 *    - Con dos o mas series, leyenda siempre presente: la identidad no puede
 *      depender solo del color.
 *  Paleta validada para daltonismo (deuteranopia y tritanopia).
 * ========================================================================== */

const INK_MUTED = '#898781'
const GRID = '#eeede8'
const AXIS = '#c3c2b7'

export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'] as const

const axisProps = {
  stroke: AXIS,
  tick: { fill: INK_MUTED, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: AXIS },
}

function TooltipBox({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; color?: string; dataKey?: string }>
  label?: string | number
  unit?: string
}) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((p) => p.value !== null && p.value !== undefined)
  if (rows.length === 0) return null

  return (
    <div className="rounded-lg border border-[#e6e5e0] bg-white px-3 py-2 shadow-lg">
      <div className="mb-1 text-[11px] font-medium text-[#52514e]">
        {typeof label === 'string' ? formatShort(label) : label}
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-[12px]">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: r.color }}
            aria-hidden
          />
          <span className="text-[#52514e]">{r.name}</span>
          <span className="num ml-auto font-semibold text-[#0b0b0b]">
            {typeof r.value === 'number' ? Math.round(r.value * 100) / 100 : r.value}
            {unit ? ` ${unit}` : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── Peso corporal ─────────────────────────────────────────────────────── */

/**
 * Dos capas deliberadas: los pesos diarios en puntos tenues y encima la media
 * movil marcada. La bascula diaria es ruido (agua, sodio, glucogeno); lo unico
 * interpretable es la tendencia, y la grafica debe dejarlo obvio a simple vista.
 */
export function BodyweightChart({ points, unit = 'kg' }: { points: Point[]; unit?: string }) {
  const data = movingAverage(points, 7)
  if (data.length === 0) return <ChartEmpty />

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        <span className="flex items-center gap-1.5 text-[#52514e]">
          <span className="inline-block h-2 w-2 rounded-full bg-[#c3c2b7]" aria-hidden />
          Medida diaria
        </span>
        <span className="flex items-center gap-1.5 font-medium text-[#52514e]">
          <span className="inline-block h-0.5 w-4 rounded bg-[#2a78d6]" aria-hidden />
          Tendencia (media de 7 dias)
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={formatShort} minTickGap={28} {...axisProps} />
          <YAxis domain={['auto', 'auto']} width={46} {...axisProps} />
          <Tooltip content={<TooltipBox unit={unit} />} />
          <Scatter dataKey="value" name="Medida" fill="#c3c2b7" />
          <Line
            type="monotone"
            dataKey="avg"
            name="Tendencia"
            stroke="#2a78d6"
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ── Progresion de fuerza ──────────────────────────────────────────────── */

/**
 * El e1RM lleva a una escala comun series con distintas repeticiones, que es
 * la unica manera honesta de ver si progresas cuando el rango de reps cambia.
 */
export function E1RMChart({ points, name }: { points: Point[]; name: string }) {
  if (points.length === 0) return <ChartEmpty />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={points} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={formatShort} minTickGap={28} {...axisProps} />
        <YAxis domain={['auto', 'auto']} width={46} {...axisProps} />
        <Tooltip content={<TooltipBox unit="kg" />} />
        <Line
          type="monotone"
          dataKey="value"
          name={name}
          stroke="#2a78d6"
          strokeWidth={2}
          dot={{ r: 4, fill: '#2a78d6', strokeWidth: 0 }}
          activeDot={{ r: 6 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/* ── Medidas corporales ────────────────────────────────────────────────── */

/**
 * Maximo tres series a la vez: es el limite en el que la paleta mantiene
 * separacion suficiente para daltonismo en TODAS las parejas posibles.
 */
export function MultiLineChart({
  data,
  series,
  unit,
}: {
  data: Array<Record<string, string | number | null>>
  series: Array<{ key: string; label: string }>
  unit?: string
}) {
  if (data.length === 0 || series.length === 0) return <ChartEmpty />
  const shown = series.slice(0, 3)

  return (
    <div>
      {shown.length >= 2 && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          {shown.map((s, i) => (
            <span key={s.key} className="flex items-center gap-1.5 text-[#52514e]">
              <span
                className="inline-block h-0.5 w-4 rounded"
                style={{ background: SERIES[i] }}
                aria-hidden
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={formatShort} minTickGap={28} {...axisProps} />
          <YAxis domain={['auto', 'auto']} width={46} {...axisProps} />
          <Tooltip content={<TooltipBox unit={unit} />} />
          {shown.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={SERIES[i]}
              strokeWidth={2}
              dot={{ r: 3.5, strokeWidth: 0, fill: SERIES[i] }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ── Volumen semanal ───────────────────────────────────────────────────── */

const STATUS_FILL: Record<string, string> = {
  'below-mv': '#d03b3b',
  'below-mev': '#fab219',
  optimal: '#0ca30c',
  'above-mav': '#ec835a',
  'above-mrv': '#d03b3b',
}

/**
 * Series semanales por musculo frente a las referencias de volumen.
 *
 * El color de estado NUNCA comunica solo: cada fila lleva su etiqueta de texto
 * ("Optimo", "Insuficiente"...) y el numero de series. Es imprescindible porque
 * verde y rojo son practicamente indistinguibles en deuteranopia.
 */
export function VolumeBars({ rows }: { rows: MuscleVolume[] }) {
  if (rows.length === 0) return <ChartEmpty />

  const data = rows.map((r) => ({
    muscle: MUSCLE_LABEL[r.muscle],
    planned: r.planned,
    actual: r.actual,
    status: r.status,
    mev: r.landmark.mev,
    mrv: r.landmark.mrv,
    mavMin: r.landmark.mav[0],
    mavMax: r.landmark.mav[1],
  }))
  const maxX = Math.max(...data.map((d) => Math.max(d.planned, d.actual, d.mrv))) * 1.1

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 34)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 0, left: 4 }}
        barCategoryGap={6}
      >
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" domain={[0, maxX]} {...axisProps} />
        <YAxis type="category" dataKey="muscle" width={104} {...axisProps} />
        <Tooltip
          cursor={{ fill: '#f7f7f5' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload as (typeof data)[number]
            const meta = VOLUME_STATUS_META[d.status as keyof typeof VOLUME_STATUS_META]
            return (
              <div className="max-w-[240px] rounded-lg border border-[#e6e5e0] bg-white px-3 py-2 shadow-lg">
                <div className="text-[12px] font-semibold text-[#0b0b0b]">{d.muscle}</div>
                <div className="num mt-1 text-[12px] text-[#52514e]">
                  {d.planned} series planificadas · {d.actual} realizadas
                </div>
                <div className="num mt-0.5 text-[11px] text-[#898781]">
                  MEV {d.mev} · optimo {d.mavMin}–{d.mavMax} · MRV {d.mrv}
                </div>
                <div className="mt-1.5 text-[11px] font-medium text-[#0b0b0b]">{meta.label}</div>
                <div className="text-[11px] leading-snug text-[#52514e]">{meta.hint}</div>
              </div>
            )
          }}
        />
        {/* Barra de fondo: lo planificado. Encima, en tono solido, lo realmente hecho. */}
        <Bar dataKey="planned" name="Planificado" radius={[0, 4, 4, 0]} fill="#e6e5e0" />
        <Bar dataKey="actual" name="Realizado" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={STATUS_FILL[d.status] ?? '#2a78d6'} />
          ))}
        </Bar>
        <ReferenceLine x={0} stroke={AXIS} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ── Series semanales totales ──────────────────────────────────────────── */

export function WeeklySetsChart({ data }: { data: Array<{ date: string; value: number }> }) {
  if (data.length === 0) return <ChartEmpty />
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -22 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" {...axisProps} />
        <YAxis width={40} allowDecimals={false} {...axisProps} />
        <Tooltip cursor={{ fill: '#f7f7f5' }} content={<TooltipBox unit="series" />} />
        <Bar dataKey="value" name="Series efectivas" fill="#2a78d6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function ChartEmpty() {
  return (
    <div className="flex h-[160px] items-center justify-center rounded-lg bg-surface-sunken text-[12px] text-ink-muted">
      Sin datos suficientes todavia
    </div>
  )
}
