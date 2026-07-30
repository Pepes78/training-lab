import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { useApp, useCatalog, useCurrentWeek, setsOfWeek } from '@/store/useApp'
import { computeWeeklyVolume, significantVolume } from '@/lib/volume'
import { resolveLandmarks, VOLUME_STATUS_META } from '@/data/volume-landmarks'
import { MUSCLE_GROUP, MUSCLE_LABEL } from '@/types/catalog'
import { VolumeBars } from '@/components/charts'
import { Badge, Button, Card, EmptyState, SectionTitle } from '@/components/ui'

/* ============================================================================
 *  Auditoria de volumen semanal
 * ----------------------------------------------------------------------------
 *  Contesta la pregunta que casi ninguna app responde: estoy haciendo las
 *  series que necesito para crecer, en cada musculo, sin pasarme.
 *
 *  El estado nunca se comunica solo con color: siempre hay etiqueta e icono.
 * ========================================================================== */

const TONE_ICON: Record<string, string> = {
  'below-mv': '▼',
  'below-mev': '!',
  optimal: '✓',
  'above-mav': '▲',
  'above-mrv': '!!',
}

const TONE_BADGE: Record<string, 'good' | 'warning' | 'critical' | 'neutral'> = {
  'below-mv': 'critical',
  'below-mev': 'warning',
  optimal: 'good',
  'above-mav': 'warning',
  'above-mrv': 'critical',
}

export default function Volume() {
  const { cycle, sessions, setLogs, overrides, settings } = useApp()
  const catalog = useCatalog()
  const currentWeek = useCurrentWeek()
  const [week, setWeek] = useState(currentWeek)

  const landmarks = useMemo(
    () => resolveLandmarks(settings.volumeOverrides),
    [settings.volumeOverrides],
  )

  const rows = useMemo(() => {
    if (!cycle) return []
    return significantVolume(
      computeWeeklyVolume({
        routine: cycle.routineSnapshot,
        week,
        catalog,
        landmarks,
        loggedSets: setsOfWeek(sessions, setLogs, cycle.id, week),
        overrides: overrides.filter((o) => o.cycleId === cycle.id),
      }),
    )
  }, [cycle, week, catalog, landmarks, sessions, setLogs, overrides])

  if (!cycle) {
    return (
      <EmptyState
        title="Sin ciclo activo"
        body="El analisis de volumen necesita una rutina en marcha para saber cuantas series tienes planificadas por musculo."
        action={
          <Link to="/rutinas">
            <Button variant="primary">Ir a rutinas</Button>
          </Link>
        }
      />
    )
  }

  const problems = rows.filter((r) => r.status !== 'optimal')
  const grouped = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    const g = MUSCLE_GROUP[r.muscle]
    ;(acc[g] ??= []).push(r)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">Volumen semanal</h1>
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">
          Series por grupo muscular contrastadas con las referencias de volumen. El recuento es
          fraccional: una serie de press de banca cuenta 1 para pectoral y 0,5 para triceps y
          deltoides anterior.
        </p>
      </div>

      <div className="scroll-x -mx-4 px-4">
        <div className="flex gap-1.5 pb-1">
          {Array.from({ length: cycle.targetWeeks }, (_, i) => i + 1).map((w) => (
            <button
              key={w}
              onClick={() => setWeek(w)}
              className={clsx(
                'h-9 shrink-0 rounded-lg border px-3 text-[13px] font-medium transition-colors',
                w === week
                  ? 'border-accent bg-accent text-white'
                  : 'border-hairline bg-white text-ink-secondary hover:bg-surface-sunken',
              )}
            >
              S{w}
            </button>
          ))}
        </div>
      </div>

      {problems.length > 0 && (
        <Card>
          <SectionTitle hint="Lo que conviene revisar de esta semana">Avisos</SectionTitle>
          <div className="space-y-2">
            {problems.map((p) => {
              const meta = VOLUME_STATUS_META[p.status]
              return (
                <div key={p.muscle} className="flex items-start gap-2.5">
                  <Badge tone={TONE_BADGE[p.status]} icon={TONE_ICON[p.status]}>
                    {meta.label}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-ink">
                      {MUSCLE_LABEL[p.muscle]}{' '}
                      <span className="num font-normal text-ink-secondary">
                        · {p.planned} series planificadas
                      </span>
                    </div>
                    <div className="text-[11px] leading-snug text-ink-muted">
                      {meta.hint} · referencia {p.landmark.mev}–{p.landmark.mav[1]}, maximo{' '}
                      {p.landmark.mrv}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle hint="Barra gris: planificado. Barra de color: realmente ejecutado.">
          Series por musculo
        </SectionTitle>
        <VolumeBars rows={rows} />
      </Card>

      {/* Tabla: la lectura accesible del mismo dato, sin depender del color */}
      <Card>
        <SectionTitle hint="Los mismos datos en tabla, con el desglose por ejercicio">
          Detalle
        </SectionTitle>
        <div className="space-y-4">
          {Object.entries(grouped).map(([group, list]) => (
            <div key={group}>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                {group}
              </h3>
              <div className="scroll-x">
                <table className="w-full min-w-[420px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-hairline text-[11px] font-medium text-ink-muted">
                      <th className="pb-1.5 font-medium">Musculo</th>
                      <th className="pb-1.5 text-right font-medium">Plan</th>
                      <th className="pb-1.5 text-right font-medium">Real</th>
                      <th className="pb-1.5 text-right font-medium">Referencia</th>
                      <th className="pb-1.5 pl-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.muscle} className="border-b border-hairline/60 last:border-0">
                        <td className="py-2 text-ink">
                          {MUSCLE_LABEL[r.muscle]}
                          {r.contributors.length > 0 && (
                            <div className="mt-0.5 text-[11px] text-ink-muted">
                              {r.contributors
                                .slice(0, 3)
                                .map((c) => `${c.name} (${c.sets})`)
                                .join(' · ')}
                            </div>
                          )}
                        </td>
                        <td className="num py-2 text-right text-ink-secondary">{r.planned}</td>
                        <td className="num py-2 text-right font-medium text-ink">{r.actual}</td>
                        <td className="num py-2 text-right text-ink-muted">
                          {r.landmark.mev}–{r.landmark.mav[1]}
                        </td>
                        <td className="py-2 pl-3">
                          <Badge tone={TONE_BADGE[r.status]} icon={TONE_ICON[r.status]}>
                            {VOLUME_STATUS_META[r.status].label}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-[13px] font-semibold text-ink">Sobre estas referencias</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
          MEV es el minimo para que haya crecimiento, MRV el maximo que puedes recuperar. Son
          heuristicas del marco divulgado por Renaissance Periodization y Jeff Nippard, no medidas
          exactas: la variacion entre personas es grande y depende de edad, nivel, sueno y calorias.
          Usalas como semaforo; tu progresion real de fuerza y tu fatiga mandan por encima de
          cualquier tabla. Puedes ajustarlas musculo a musculo en{' '}
          <Link to="/ajustes" className="font-medium text-accent hover:underline">
            Ajustes
          </Link>
          .
        </p>
      </Card>
    </div>
  )
}
