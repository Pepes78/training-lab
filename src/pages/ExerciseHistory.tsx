import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp, useCatalog } from '@/store/useApp'
import { E1RMChart } from '@/components/charts'
import { Badge, Button, Card, EmptyState, SectionTitle, StatTile } from '@/components/ui'
import { estimate1RM, tonnage } from '@/lib/e1rm'
import { detectStagnation } from '@/lib/progression'
import { EQUIPMENT_LABEL, MUSCLE_LABEL, PATTERN_LABEL } from '@/types/catalog'
import { formatShort } from '@/lib/date'
import { gifUrl } from '@/components/ExerciseDemo'

/* ============================================================================
 *  Historial de un ejercicio
 * ----------------------------------------------------------------------------
 *  Todo lo registrado de un movimiento: progresion de e1RM, mejores marcas,
 *  tonelaje y el detalle serie a serie de cada sesion.
 * ========================================================================== */

export default function ExerciseHistory() {
  const { exerciseId = '' } = useParams()
  const { sessions, setLogs } = useApp()
  const catalog = useCatalog()
  const exercise = catalog[exerciseId]

  const history = useMemo(() => {
    const bySession = new Map<string, { date: string; sets: typeof setLogs }>()
    for (const log of setLogs) {
      if (log.exerciseId !== exerciseId || log.isWarmup) continue
      const session = sessions.find((s) => s.id === log.sessionId)
      if (!session) continue
      const entry = bySession.get(session.id) ?? { date: session.date, sets: [] }
      entry.sets = [...entry.sets, log]
      bySession.set(session.id, entry)
    }
    return [...bySession.values()]
      .map((e) => ({ ...e, sets: [...e.sets].sort((a, b) => a.setIndex - b.setIndex) }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [setLogs, sessions, exerciseId])

  const e1rmPoints = useMemo(
    () =>
      history
        .map((h) => {
          const best = h.sets.reduce((acc, s) => {
            const e = estimate1RM(s.weightKg, s.reps, s.rir ?? 0)
            return e && e.value > acc ? e.value : acc
          }, 0)
          return { date: h.date, value: Math.round(best * 10) / 10 }
        })
        .filter((p) => p.value > 0)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [history],
  )

  const stagnation = useMemo(() => detectStagnation(e1rmPoints), [e1rmPoints])

  if (!exercise) {
    return (
      <EmptyState
        title="Ejercicio no encontrado"
        body={`No hay ningun ejercicio con el identificador "${exerciseId}" en el catalogo.`}
        action={
          <Link to="/">
            <Button variant="primary">Volver al inicio</Button>
          </Link>
        }
      />
    )
  }

  const bestE1RM = e1rmPoints.length > 0 ? Math.max(...e1rmPoints.map((p) => p.value)) : null
  const heaviest = history.flatMap((h) => h.sets).reduce((a, s) => Math.max(a, s.weightKg), 0)
  const totalSets = history.reduce((n, h) => n + h.sets.length, 0)
  const totalTonnage = history.reduce((n, h) => n + h.sets.reduce((m, s) => m + tonnage(s), 0), 0)

  const gif = gifUrl(exercise)

  return (
    <div className="space-y-5">
      <div>
        <Link to="/" className="text-[12px] font-medium text-accent hover:underline">
          ← Volver
        </Link>
        <h1 className="mt-1.5 text-[20px] font-semibold tracking-tight text-ink">
          {exercise.name.es}
        </h1>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge tone="accent">{PATTERN_LABEL[exercise.pattern]}</Badge>
          <Badge>{EQUIPMENT_LABEL[exercise.equipment]}</Badge>
          {exercise.primary.map((p) => (
            <Badge key={p.muscle}>{MUSCLE_LABEL[p.muscle]}</Badge>
          ))}
        </div>
      </div>

      {history.length === 0 ? (
        <EmptyState
          title="Sin registros todavia"
          body="Cuando registres series de este ejercicio apareceran aqui su progresion de fuerza y sus mejores marcas."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Mejor e1RM"
              value={bestE1RM?.toFixed(1) ?? '—'}
              unit="kg"
              hint="1RM estimado"
            />
            <StatTile label="Peso maximo" value={heaviest || '—'} unit="kg" />
            <StatTile label="Series totales" value={totalSets} />
            <StatTile
              label="Tonelaje"
              value={Math.round(totalTonnage).toLocaleString('es-ES')}
              unit="kg"
              hint="Peso x reps acumulado"
            />
          </div>

          {stagnation.stagnant && (
            <div className="rounded-xl border border-[#f5e3b0] bg-[#fff8e6] px-4 py-3">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#8a6200]">
                <span aria-hidden>!</span> Progresion estancada
              </div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-[#8a6200]">
                {stagnation.message}
              </p>
            </div>
          )}

          <Card>
            <SectionTitle hint="Mejor 1RM estimado de cada sesion, ajustado por RIR">
              Progresion de fuerza
            </SectionTitle>
            <E1RMChart points={e1rmPoints} name={exercise.name.es} />
          </Card>

          <Card>
            <SectionTitle hint="Serie a serie, de mas reciente a mas antiguo">
              Historial completo
            </SectionTitle>
            <div className="space-y-3">
              {history.map((h) => (
                <div key={h.date} className="border-b border-hairline pb-3 last:border-0 last:pb-0">
                  <div className="num mb-1.5 text-[12px] font-medium text-ink-secondary">
                    {formatShort(h.date)}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {h.sets.map((s) => (
                      <span
                        key={s.id}
                        className="num rounded-md bg-surface-sunken px-2 py-1 text-[12px] text-ink"
                      >
                        {s.weightKg > 0 ? `${s.weightKg}kg` : 'PC'} × {s.seconds ?? s.reps}
                        {s.seconds ? 's' : ''}
                        {s.rir !== undefined && (
                          <span className="text-ink-muted"> @{s.rir}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {gif && (
        <Card>
          <SectionTitle>Tecnica</SectionTitle>
          <img
            src={gif}
            alt={`Demostracion de ${exercise.name.es}`}
            className="w-full rounded-xl bg-surface-sunken"
            loading="lazy"
          />
          {exercise.cues.length > 0 && (
            <ul className="mt-3 space-y-1">
              {exercise.cues.map((c, i) => (
                <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-secondary">
                  <span className="text-accent" aria-hidden>
                    ·
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}
