import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp, useCatalog, useCurrentWeek, setsOfWeek } from '@/store/useApp'
import { BodyweightChart, E1RMChart, WeeklySetsChart } from '@/components/charts'
import { Button, Card, EmptyState, SectionTitle, StatTile, Select } from '@/components/ui'
import { changeOver, latest, metricPoints, movingAverage, weeklyTrend } from '@/lib/stats'
import { estimate1RM } from '@/lib/e1rm'
import { tonnageFact, totalTonnage, weightChangeFact, type FunFact } from '@/lib/milestones'
import { FunFactList } from '@/components/FunFacts'
import { slotsOfDay } from '@/types/routine'
import { formatLong } from '@/lib/date'

/* ============================================================================
 *  Panel principal
 * ----------------------------------------------------------------------------
 *  Responde de un vistazo a: como voy de peso, estoy levantando mas que antes,
 *  y estoy cumpliendo el plan.
 * ========================================================================== */

export default function Dashboard() {
  const { cycle, sessions, setLogs, metrics } = useApp()
  const catalog = useCatalog()
  const week = useCurrentWeek()

  const bwPoints = useMemo(() => metricPoints(metrics, 'bodyweight'), [metrics])
  const stepPoints = useMemo(() => metricPoints(metrics, 'steps'), [metrics])

  const bwLatest = latest(bwPoints)
  const bwTrend = weeklyTrend(bwPoints.slice(-28))
  const bwChange30 = changeOver(bwPoints, 30)

  // Ejercicios con al menos dos sesiones registradas: los unicos que pueden mostrar progresion
  const exerciseOptions = useMemo(() => {
    const bySession = new Map<string, Set<string>>()
    for (const s of setLogs) {
      if (s.isWarmup) continue
      const set = bySession.get(s.exerciseId) ?? new Set<string>()
      set.add(s.sessionId)
      bySession.set(s.exerciseId, set)
    }
    return [...bySession.entries()]
      .filter(([, sess]) => sess.size >= 2)
      .map(([id]) => ({ value: id, label: catalog[id]?.name.es ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [setLogs, catalog])

  const [selectedExercise, setSelectedExercise] = useState('')
  const activeExercise = selectedExercise || exerciseOptions[0]?.value || ''

  // Mejor e1RM por sesion para el ejercicio elegido
  const e1rmPoints = useMemo(() => {
    if (!activeExercise) return []
    const byDate = new Map<string, number>()
    for (const log of setLogs) {
      if (log.exerciseId !== activeExercise || log.isWarmup) continue
      const session = sessions.find((s) => s.id === log.sessionId)
      if (!session) continue
      const e = estimate1RM(log.weightKg, log.reps, log.rir ?? 0)
      if (!e) continue
      byDate.set(session.date, Math.max(byDate.get(session.date) ?? 0, e.value))
    }
    return [...byDate.entries()]
      .map(([date, value]) => ({ date, value: Math.round(value * 10) / 10 }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [setLogs, sessions, activeExercise])

  // Series efectivas por semana del ciclo activo
  const weeklySets = useMemo(() => {
    if (!cycle) return []
    return Array.from({ length: cycle.targetWeeks }, (_, i) => {
      const w = i + 1
      const sets = setsOfWeek(sessions, setLogs, cycle.id, w)
      return { date: `S${w}`, value: sets.filter((s) => !s.isWarmup && s.reps > 0).length }
    })
  }, [cycle, sessions, setLogs])

  // Adherencia: sesiones completadas frente a las planificadas hasta hoy
  const adherence = useMemo(() => {
    if (!cycle) return null
    const perWeek = cycle.routineSnapshot.days.length
    const planned = perWeek * week
    const completed = sessions.filter(
      (s) => s.cycleId === cycle.id && s.week <= week && s.status === 'completed',
    ).length
    return { planned, completed, pct: planned > 0 ? Math.round((completed / planned) * 100) : 0 }
  }, [cycle, sessions, week])

  const totalSetsThisWeek = cycle
    ? setsOfWeek(sessions, setLogs, cycle.id, week).filter((s) => !s.isWarmup && s.reps > 0).length
    : 0

  /*
   * Comparativas. El cambio de peso se calcula sobre la MEDIA MOVIL, no sobre
   * lecturas sueltas: celebrar una bajada que en realidad era agua seria
   * desinformar.
   */
  const facts = useMemo(() => {
    const out: FunFact[] = []
    const bodyweight = latest(bwPoints)?.value

    if (cycle) {
      const weekSets = setsOfWeek(sessions, setLogs, cycle.id, week)
      const t = tonnageFact(totalTonnage(weekSets), bodyweight)
      if (t) out.push({ ...t, headline: `${t.headline} esta semana` })
    }

    const smoothed = movingAverage(bwPoints, 7).filter((p) => p.avg !== null)
    if (smoothed.length >= 2) {
      const last = smoothed[smoothed.length - 1].avg!
      const target = new Date(smoothed[smoothed.length - 1].date).getTime() - 30 * 86_400_000
      let ref = smoothed[0]
      let bestDiff = Infinity
      for (const p of smoothed.slice(0, -1)) {
        const diff = Math.abs(new Date(p.date).getTime() - target)
        if (diff < bestDiff) {
          bestDiff = diff
          ref = p
        }
      }
      const w = weightChangeFact(last - ref.avg!, bodyweight ?? 75)
      if (w) out.push({ ...w, headline: `${w.headline} en 30 dias` })
    }

    return out
  }, [cycle, sessions, setLogs, week, bwPoints])

  if (!cycle && metrics.length === 0 && setLogs.length === 0) {
    return (
      <EmptyState
        title="Bienvenido a Training Lab"
        body="Empieza un ciclo con la rutina de ejemplo o importa una generada a medida. Despues podras registrar series, medidas corporales y ver tu progresion."
        action={
          <Link to="/rutinas">
            <Button variant="primary">Elegir una rutina</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      {cycle && (
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-ink">
            {cycle.routineSnapshot.name}
          </h1>
          <p className="mt-0.5 text-[12px] text-ink-secondary">
            Semana {week} de {cycle.targetWeeks} · comenzado el {formatLong(cycle.startDate)}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Peso corporal"
          value={bwLatest ? bwLatest.value.toFixed(1) : '—'}
          unit={bwLatest ? 'kg' : undefined}
          delta={bwChange30 !== null ? { value: bwChange30, unit: 'kg / 30d', goodWhen: 'any' } : undefined}
          hint={
            bwTrend
              ? `${bwTrend.perWeek > 0 ? '+' : ''}${bwTrend.perWeek} kg/semana${bwTrend.confident ? '' : ' (pocos datos)'}`
              : 'Registra tu peso para ver la tendencia'
          }
        />
        <StatTile
          label="Series esta semana"
          value={totalSetsThisWeek}
          hint={adherence ? `${adherence.completed}/${adherence.planned} sesiones` : undefined}
        />
        <StatTile
          label="Adherencia"
          value={adherence ? `${adherence.pct}` : '—'}
          unit={adherence ? '%' : undefined}
          hint="Sesiones completadas del plan"
        />
        <StatTile
          label="Pasos (ultimo dia)"
          value={latest(stepPoints)?.value.toLocaleString('es-ES') ?? '—'}
          hint="Registro manual"
        />
      </div>

      {facts.length > 0 && (
        <div>
          <SectionTitle hint="Para que las cifras signifiquen algo">En perspectiva</SectionTitle>
          <FunFactList facts={facts} />
        </div>
      )}

      <Card>
        <SectionTitle hint="Los puntos son la bascula diaria; la linea es la unica lectura fiable">
          Peso corporal
        </SectionTitle>
        <BodyweightChart points={bwPoints} />
      </Card>

      <Card>
        <SectionTitle
          hint="1RM estimado: compara sesiones aunque cambien las repeticiones"
          action={
            exerciseOptions.length > 1 ? (
              <Select
                value={activeExercise}
                onChange={setSelectedExercise}
                options={exerciseOptions}
                className="w-44"
              />
            ) : undefined
          }
        >
          Progresion de fuerza
        </SectionTitle>
        {activeExercise ? (
          <>
            <E1RMChart points={e1rmPoints} name={catalog[activeExercise]?.name.es ?? activeExercise} />
            <Link
              to={`/ejercicio/${activeExercise}`}
              className="mt-2 inline-block text-[12px] font-medium text-accent hover:underline"
            >
              Ver detalle del ejercicio →
            </Link>
          </>
        ) : (
          <p className="py-8 text-center text-[13px] text-ink-muted">
            Necesitas al menos dos sesiones del mismo ejercicio para dibujar una progresion.
          </p>
        )}
      </Card>

      {cycle && (
        <Card>
          <SectionTitle hint="Series efectivas registradas, sin contar calentamientos">
            Volumen por semana
          </SectionTitle>
          <WeeklySetsChart data={weeklySets} />
        </Card>
      )}

      {cycle && (
        <Card>
          <SectionTitle hint="Lo que toca en la semana en curso">Plan de la semana</SectionTitle>
          <div className="space-y-1.5">
            {cycle.routineSnapshot.days.map((d) => {
              const s = sessions.find(
                (x) => x.cycleId === cycle.id && x.week === week && x.dayId === d.id,
              )
              const done = s?.status === 'completed'
              return (
                <Link
                  key={d.id}
                  to="/entrenar"
                  className="flex items-center gap-3 rounded-lg border border-hairline px-3 py-2.5 hover:bg-surface-sunken"
                >
                  <span
                    className={
                      done
                        ? 'text-[13px] text-[#0ca30c]'
                        : 'text-[13px] text-ink-muted'
                    }
                    aria-hidden
                  >
                    {done ? '✓' : '○'}
                  </span>
                  <span className="flex-1 text-[14px] font-medium text-ink">{d.name}</span>
                  <span className="num text-[11px] text-ink-muted">
                    {slotsOfDay(d).length} ejercicios
                  </span>
                </Link>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
