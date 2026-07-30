import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { useApp } from '@/store/useApp'
import { BODY_METRIC_META, BODY_METRICS, type BodyMetricKey } from '@/types/logs'
import { BodyweightChart, MultiLineChart } from '@/components/charts'
import { Button, Card, NumberField, SectionTitle, StatTile } from '@/components/ui'
import { changeOver, latest, metricPoints, weeklyTrend } from '@/lib/stats'
import { formatShort, toISODate } from '@/lib/date'

/* ============================================================================
 *  Metricas corporales
 * ----------------------------------------------------------------------------
 *  Registro manual: peso de bascula, medidas con cinta (opcionales), pasos y
 *  un par de senales de recuperacion. Todo por dia; volver a guardar el mismo
 *  dia sobrescribe en lugar de duplicar.
 * ========================================================================== */

const GROUPS = ['peso', 'actividad', 'medidas', 'recuperacion'] as const

const GROUP_LABEL: Record<(typeof GROUPS)[number], string> = {
  peso: 'Peso',
  actividad: 'Actividad',
  medidas: 'Medidas (opcionales)',
  recuperacion: 'Recuperacion',
}

export default function Body() {
  const { metrics, saveMetric } = useApp()
  const [date, setDate] = useState(toISODate())
  const [draft, setDraft] = useState<Partial<Record<BodyMetricKey, number | ''>>>({})
  const [saved, setSaved] = useState(false)

  const bwPoints = useMemo(() => metricPoints(metrics, 'bodyweight'), [metrics])
  const bwTrend = weeklyTrend(bwPoints.slice(-28))

  // Medidas con al menos dos registros: las unicas que dan una linea util
  const measurementKeys = useMemo(() => {
    return BODY_METRICS.filter(
      (k) => BODY_METRIC_META[k].group === 'medidas' && metricPoints(metrics, k).length >= 2,
    )
  }, [metrics])

  const [shown, setShown] = useState<BodyMetricKey[]>([])
  const activeMeasurements = shown.length > 0 ? shown : measurementKeys.slice(0, 3)

  const measurementData = useMemo(() => {
    const dates = new Set<string>()
    for (const k of activeMeasurements) {
      for (const p of metricPoints(metrics, k)) dates.add(p.date)
    }
    return [...dates]
      .sort()
      .map((d) => {
        const row: Record<string, string | number | null> = { date: d }
        for (const k of activeMeasurements) {
          const found = metrics.find((m) => m.date === d && m.metric === k)
          row[k] = found ? found.value : null
        }
        return row
      })
  }, [metrics, activeMeasurements])

  const existingForDate = (k: BodyMetricKey) =>
    metrics.find((m) => m.date === date && m.metric === k)?.value

  const save = async () => {
    for (const [k, v] of Object.entries(draft)) {
      if (v === '' || v === undefined) continue
      await saveMetric(date, k as BodyMetricKey, Number(v))
    }
    setDraft({})
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  const hasDraft = Object.values(draft).some((v) => v !== '' && v !== undefined)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">Cuerpo</h1>
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">
          Peso, medidas y actividad. Las medidas son opcionales: registra solo las que te interesen.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Peso"
          value={latest(bwPoints)?.value.toFixed(1) ?? '—'}
          unit="kg"
          delta={
            changeOver(bwPoints, 30) !== null
              ? { value: changeOver(bwPoints, 30)!, unit: 'kg / 30d', goodWhen: 'any' }
              : undefined
          }
        />
        <StatTile
          label="Tendencia"
          value={bwTrend ? `${bwTrend.perWeek > 0 ? '+' : ''}${bwTrend.perWeek}` : '—'}
          unit="kg/sem"
          hint={bwTrend && !bwTrend.confident ? 'Pocos datos aun' : 'Media de 4 semanas'}
        />
        <StatTile
          label="Cintura"
          value={latest(metricPoints(metrics, 'waist'))?.value.toFixed(1) ?? '—'}
          unit="cm"
        />
        <StatTile
          label="Pasos"
          value={latest(metricPoints(metrics, 'steps'))?.value.toLocaleString('es-ES') ?? '—'}
        />
      </div>

      {/* Registro */}
      <Card>
        <SectionTitle
          hint="Deja en blanco lo que no quieras registrar hoy"
          action={
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 rounded-lg border border-hairline bg-white px-2.5 text-[13px] text-ink focus:border-accent focus:outline-none"
            />
          }
        >
          Registrar medidas
        </SectionTitle>

        <div className="space-y-4">
          {GROUPS.map((g) => {
            const keys = BODY_METRICS.filter((k) => BODY_METRIC_META[k].group === g)
            return (
              <div key={g}>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  {GROUP_LABEL[g]}
                </h3>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {keys.map((k) => {
                    const meta = BODY_METRIC_META[k]
                    const existing = existingForDate(k)
                    return (
                      <NumberField
                        key={k}
                        label={meta.label}
                        value={draft[k] ?? ''}
                        onChange={(v) => setDraft((d) => ({ ...d, [k]: v }))}
                        step={meta.step}
                        suffix={meta.unit === 'pasos' ? undefined : meta.unit}
                        placeholder={existing !== undefined ? String(existing) : '—'}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button variant="primary" onClick={() => void save()} disabled={!hasDraft}>
            Guardar
          </Button>
          {saved && <span className="text-[12px] font-medium text-[#006300]">Guardado ✓</span>}
        </div>
      </Card>

      <Card>
        <SectionTitle hint="Puntos: bascula diaria. Linea: media movil de 7 dias, la unica lectura fiable.">
          Peso corporal
        </SectionTitle>
        <BodyweightChart points={bwPoints} />
        <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
          El peso diario oscila uno o dos kilos por agua, sodio y glucogeno sin que cambie nada
          real. Interpreta la linea, nunca un dato suelto.
        </p>
      </Card>

      {measurementKeys.length > 0 && (
        <Card>
          <SectionTitle hint="Maximo tres a la vez para que las lineas sigan siendo distinguibles">
            Medidas
          </SectionTitle>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {measurementKeys.map((k) => {
              const active = activeMeasurements.includes(k)
              return (
                <button
                  key={k}
                  onClick={() =>
                    setShown((prev) => {
                      const base = prev.length > 0 ? prev : measurementKeys.slice(0, 3)
                      if (base.includes(k)) return base.filter((x) => x !== k)
                      return [...base, k].slice(-3)
                    })
                  }
                  className={clsx(
                    'rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors',
                    active
                      ? 'border-accent bg-accent-soft text-accent-strong'
                      : 'border-hairline bg-white text-ink-secondary hover:bg-surface-sunken',
                  )}
                >
                  {BODY_METRIC_META[k].label}
                </button>
              )
            })}
          </div>
          <MultiLineChart
            data={measurementData}
            series={activeMeasurements.map((k) => ({ key: k, label: BODY_METRIC_META[k].label }))}
            unit="cm"
          />
        </Card>
      )}

      <RecentEntries />
    </div>
  )
}

function RecentEntries() {
  const { metrics, removeMetric } = useApp()
  const recent = useMemo(
    () =>
      [...metrics]
        .sort((a, b) => b.date.localeCompare(a.date) || a.metric.localeCompare(b.metric))
        .slice(0, 24),
    [metrics],
  )
  if (recent.length === 0) return null

  return (
    <Card>
      <SectionTitle>Registros recientes</SectionTitle>
      <div className="space-y-1">
        {recent.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-[13px] hover:bg-surface-sunken"
          >
            <span className="num w-16 shrink-0 text-[12px] text-ink-muted">
              {formatShort(m.date)}
            </span>
            <span className="flex-1 text-ink-secondary">{BODY_METRIC_META[m.metric].label}</span>
            <span className="num font-medium text-ink">
              {m.value} {BODY_METRIC_META[m.metric].unit}
            </span>
            <button
              onClick={() => void removeMetric(m.id)}
              aria-label="Borrar registro"
              className="text-[12px] text-ink-muted hover:text-[#d03b3b]"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </Card>
  )
}
