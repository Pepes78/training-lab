import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { useApp, useCatalog, useCatalogList, useCurrentWeek, lastSetsForSlot } from '@/store/useApp'
import { isDeloadWeek, prescribedSets, slotsOfDay, type Slot } from '@/types/routine'
import type { Exercise } from '@/types/catalog'
import type { SetLog } from '@/types/logs'
import { suggestNext } from '@/lib/progression'
import { rankSubstitutions } from '@/lib/substitutions'
import { estimate1RM } from '@/lib/e1rm'
import { Badge, Button, Card, EmptyState, NumberField, Sheet } from '@/components/ui'
import { ExerciseDemo } from '@/components/ExerciseDemo'
import { RestTimer } from '@/components/RestTimer'

/* ============================================================================
 *  Pantalla de entrenamiento
 * ----------------------------------------------------------------------------
 *  La unica pantalla que se usa DENTRO del gimnasio. Prioridades, por orden:
 *    1. Registrar una serie en dos toques
 *    2. Ver que toca hoy y que hiciste la ultima vez
 *    3. Cambiar un ejercicio si la maquina esta ocupada
 * ========================================================================== */

export default function Train() {
  const { cycle, sessions, setLogs, overrides, settings } = useApp()
  const currentWeek = useCurrentWeek()
  const catalog = useCatalog()
  const catalogList = useCatalogList()

  const [week, setWeek] = useState(currentWeek)
  const [dayIdx, setDayIdx] = useState(0)
  const [demo, setDemo] = useState<{ exercise: Exercise; note?: string } | null>(null)
  const [swapping, setSwapping] = useState<{ slot: Slot; exercise: Exercise } | null>(null)
  const [rest, setRest] = useState<{ seconds: number; key: number } | null>(null)

  if (!cycle) {
    return (
      <EmptyState
        title="No hay ningun ciclo en marcha"
        body="Un ciclo es la ejecucion de una rutina con fechas reales. Empieza uno desde Rutinas para poder registrar entrenamientos."
        action={
          <Link to="/rutinas">
            <Button variant="primary">Ir a rutinas</Button>
          </Link>
        }
      />
    )
  }

  const routine = cycle.routineSnapshot
  const day = routine.days[Math.min(dayIdx, routine.days.length - 1)]
  const session = sessions.find((s) => s.cycleId === cycle.id && s.week === week && s.dayId === day.id)
  const sessionSets = session ? setLogs.filter((l) => l.sessionId === session.id) : []
  const deload = isDeloadWeek(routine, week)

  const overrideFor = (slotId: string) =>
    overrides.find((o) => o.cycleId === cycle.id && o.week === week && o.slotId === slotId)

  return (
    <div className="space-y-4">
      {/* Selector de semana */}
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
              {isDeloadWeek(routine, w) && <span className="ml-1 text-[10px] opacity-80">↓</span>}
            </button>
          ))}
        </div>
      </div>

      {deload && (
        <div className="rounded-xl border border-[#f5e3b0] bg-[#fff8e6] px-4 py-3">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#8a6200]">
            <span aria-hidden>↓</span> Semana de descarga
          </div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[#8a6200]">
            Series reducidas al {Math.round((routine.deload?.volumeMultiplier ?? 0.5) * 100)}% y carga
            al {Math.round((routine.deload?.intensityMultiplier ?? 0.9) * 100)}%. Deja 3-4 repeticiones
            en reserva: el objetivo es disipar fatiga, no rendir.
          </p>
        </div>
      )}

      {/* Selector de dia */}
      <div className="scroll-x -mx-4 px-4">
        <div className="flex gap-2 pb-1">
          {routine.days.map((d, i) => {
            const s = sessions.find((x) => x.cycleId === cycle.id && x.week === week && x.dayId === d.id)
            const done = s?.status === 'completed'
            return (
              <button
                key={d.id}
                onClick={() => setDayIdx(i)}
                className={clsx(
                  'shrink-0 rounded-xl border px-3.5 py-2.5 text-left transition-colors',
                  i === dayIdx ? 'border-accent bg-accent-soft' : 'border-hairline bg-white hover:bg-surface-sunken',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={clsx(
                      'text-[13px] font-semibold',
                      i === dayIdx ? 'text-accent-strong' : 'text-ink',
                    )}
                  >
                    {d.name}
                  </span>
                  {done && (
                    <span className="text-[11px] text-[#0ca30c]" aria-label="completado">
                      ✓
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-ink-muted">{d.focus ?? `${slotsOfDay(d).length} ejercicios`}</div>
              </button>
            )
          })}
        </div>
      </div>

      {day.notes && (
        <p className="text-[12px] leading-relaxed text-ink-secondary">{day.notes}</p>
      )}

      {/* Ejercicios */}
      <div className="space-y-3">
        {slotsOfDay(day).map((slot) => {
          const ov = overrideFor(slot.slotId)
          const effectiveId = ov?.replacementExerciseId ?? slot.exerciseId
          const exercise = catalog[effectiveId]
          if (!exercise) return null

          return (
            <ExerciseCard
              key={slot.slotId}
              slot={slot}
              exercise={exercise}
              originalExercise={catalog[slot.exerciseId]}
              isSwapped={Boolean(ov)}
              week={week}
              dayId={day.id}
              sets={sessionSets.filter((s) => s.slotId === slot.slotId)}
              lastSets={lastSetsForSlot(sessions, setLogs, cycle.id, slot.slotId, week)}
              minPlate={settings.minPlateIncrement}
              onDemo={() => setDemo({ exercise, note: slot.notes })}
              onSwap={() => setSwapping({ slot, exercise })}
              onRest={(seconds) => setRest({ seconds, key: Date.now() })}
            />
          )
        })}
      </div>

      {/* Cerrar sesion */}
      {session && session.status !== 'completed' && sessionSets.length > 0 && (
        <FinishSession sessionId={session.id} />
      )}

      <ExerciseDemo
        exercise={demo?.exercise ?? null}
        note={demo?.note}
        open={Boolean(demo)}
        onClose={() => setDemo(null)}
      />

      <SwapSheet
        state={swapping}
        catalogList={catalogList}
        week={week}
        onClose={() => setSwapping(null)}
        currentOverrideId={swapping ? overrideFor(swapping.slot.slotId)?.replacementExerciseId : undefined}
      />

      {rest && (
        <RestTimer
          key={rest.key}
          seconds={rest.seconds}
          sound={settings.restTimerSound}
          onDone={() => setRest(null)}
        />
      )}
    </div>
  )
}

/* ── Tarjeta de ejercicio ──────────────────────────────────────────────── */

function ExerciseCard({
  slot,
  exercise,
  originalExercise,
  isSwapped,
  week,
  dayId,
  sets,
  lastSets,
  minPlate,
  onDemo,
  onSwap,
  onRest,
}: {
  slot: Slot
  exercise: Exercise
  originalExercise?: Exercise
  isSwapped: boolean
  week: number
  dayId: string
  sets: SetLog[]
  lastSets: SetLog[]
  minPlate: number
  onDemo: () => void
  onSwap: () => void
  onRest: (seconds: number) => void
}) {
  const { cycle, getOrCreateSession, logSet, removeSet } = useApp()
  const routine = cycle!.routineSnapshot

  const suggestion = useMemo(
    () => suggestNext(routine, slot, exercise, week, lastSets, minPlate),
    [routine, slot, exercise, week, lastSets, minPlate],
  )

  const targetSets = prescribedSets(routine, slot, week)
  const done = sets.filter((s) => !s.isWarmup).sort((a, b) => a.setIndex - b.setIndex)
  const isSeconds = (slot.metric ?? exercise.defaultMetric) === 'seconds'

  const [weight, setWeight] = useState<number | ''>('')
  const [reps, setReps] = useState<number | ''>('')
  const [rir, setRir] = useState<number | ''>('')
  const [open, setOpen] = useState(false)

  const prefill = () => {
    if (weight === '' && suggestion.weightKg !== null) setWeight(suggestion.weightKg)
    if (reps === '') setReps(slot.repRange[1])
    if (rir === '' && typeof suggestion.targetRIR === 'number') setRir(suggestion.targetRIR)
  }

  const add = async () => {
    if (reps === '' || reps <= 0) return
    const session = await getOrCreateSession(week, dayId)
    await logSet({
      sessionId: session.id,
      slotId: slot.slotId,
      exerciseId: exercise.id,
      setIndex: done.length + 1,
      weightKg: weight === '' ? 0 : weight,
      reps: isSeconds ? 0 : reps,
      seconds: isSeconds ? reps : undefined,
      rir: rir === '' ? undefined : rir,
      isWarmup: false,
    })
    setReps('')
    setRir('')
    const restSec = slot.restSec ?? 90
    if (restSec > 0) onRest(restSec)
  }

  const complete = done.length >= targetSets

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-[15px] font-semibold tracking-tight text-ink">{exercise.name.es}</h3>
              {complete && <Badge tone="good" icon="✓">Completado</Badge>}
              {isSwapped && <Badge tone="warning" icon="⇄">Solo esta semana</Badge>}
            </div>
            <div className="num mt-1 text-[12px] text-ink-secondary">
              {targetSets} × {slot.repRange[0]}–{slot.repRange[1]}
              {isSeconds ? ' s' : ' reps'}
              {typeof suggestion.targetRIR === 'number' && ` · RIR ${suggestion.targetRIR}`}
              {slot.restSec ? ` · ${slot.restSec}s descanso` : ''}
            </div>
            {isSwapped && originalExercise && (
              <div className="mt-0.5 text-[11px] text-ink-muted">
                Sustituye a {originalExercise.name.es} · vuelve solo la semana {week + 1}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              onClick={onDemo}
              title="Ver demostracion"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline text-[13px] text-ink-secondary hover:bg-surface-sunken"
            >
              ▶
            </button>
            <button
              onClick={onSwap}
              title="Cambiar ejercicio solo esta semana"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline text-[13px] text-ink-secondary hover:bg-surface-sunken"
            >
              ⇄
            </button>
          </div>
        </div>

        {/* Sugerencia del motor de progresion */}
        <div className="mt-3 rounded-lg bg-accent-soft px-3 py-2">
          <div className="flex items-baseline gap-2">
            {suggestion.weightKg !== null && (
              <span className="num text-[17px] font-semibold text-accent-strong">
                {suggestion.weightKg} kg
              </span>
            )}
            <span className="text-[11px] font-medium tracking-wide text-accent-strong uppercase">
              {suggestion.basis === 'add-weight'
                ? 'Sube peso'
                : suggestion.basis === 'back-off'
                  ? 'Baja peso'
                  : suggestion.basis === 'deload'
                    ? 'Descarga'
                    : suggestion.basis === 'first-time'
                      ? 'Primera vez'
                      : 'Manten'}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-secondary">{suggestion.rationale}</p>
        </div>

        {/* Series ya registradas */}
        {done.length > 0 && (
          <div className="mt-3 space-y-1">
            {done.map((s) => {
              const e = estimate1RM(s.weightKg, s.reps, s.rir ?? 0)
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg bg-surface-sunken px-3 py-2 text-[13px]"
                >
                  <span className="num w-5 shrink-0 text-[11px] font-medium text-ink-muted">
                    {s.setIndex}
                  </span>
                  <span className="num font-medium text-ink">
                    {s.weightKg > 0 ? `${s.weightKg} kg` : 'Peso corporal'}
                  </span>
                  <span className="num text-ink-secondary">
                    × {s.seconds ?? s.reps}
                    {s.seconds ? 's' : ''}
                  </span>
                  {s.rir !== undefined && (
                    <span className="num text-[12px] text-ink-muted">RIR {s.rir}</span>
                  )}
                  {e && (
                    <span className="num ml-auto text-[11px] text-ink-muted" title="1RM estimado">
                      e1RM {e.value.toFixed(1)}
                    </span>
                  )}
                  <button
                    onClick={() => void removeSet(s.id)}
                    aria-label={`Borrar serie ${s.setIndex}`}
                    className="shrink-0 text-[13px] text-ink-muted hover:text-[#d03b3b]"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Registro de una serie nueva */}
        <div className="mt-3 flex items-end gap-2">
          <NumberField
            label={isSeconds ? 'Lastre' : 'Peso'}
            value={weight}
            onChange={setWeight}
            step={minPlate}
            suffix="kg"
            className="flex-1"
          />
          <NumberField
            label={isSeconds ? 'Segundos' : 'Reps'}
            value={reps}
            onChange={setReps}
            step={1}
            className="w-20"
          />
          <NumberField label="RIR" value={rir} onChange={setRir} step={1} className="w-16" />
          <Button variant="primary" size="lg" onClick={() => void add()} disabled={reps === ''}>
            +
          </Button>
        </div>
        <button
          onClick={prefill}
          className="mt-2 text-[11px] font-medium text-accent hover:underline"
        >
          Rellenar con la sugerencia
        </button>
      </div>

      {/* Historial reciente del ejercicio */}
      {lastSets.length > 0 && (
        <div className="border-t border-hairline bg-surface-sunken px-4 py-2">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex w-full items-center justify-between text-[11px] font-medium text-ink-secondary"
          >
            <span>Ultima vez: {lastSets.map((s) => `${s.weightKg}×${s.reps}`).join('  ')}</span>
            <span aria-hidden>{open ? '▲' : '▼'}</span>
          </button>
          {open && (
            <div className="mt-2">
              <Link
                to={`/ejercicio/${exercise.id}`}
                className="text-[12px] font-medium text-accent hover:underline"
              >
                Ver historial completo y progresion →
              </Link>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

/* ── Cerrar sesion ─────────────────────────────────────────────────────── */

function FinishSession({ sessionId }: { sessionId: string }) {
  const { sessions, updateSession } = useApp()
  const session = sessions.find((s) => s.id === sessionId)
  const [effort, setEffort] = useState<number | ''>('')
  if (!session) return null

  return (
    <Card>
      <h3 className="text-[14px] font-semibold text-ink">Cerrar entrenamiento</h3>
      <p className="mt-0.5 text-[12px] text-ink-secondary">
        La fatiga percibida da contexto al volumen: 20 series de pecho con esfuerzo 5 sostenido
        significan que estas por encima de lo que recuperas.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setEffort(n)}
            className={clsx(
              'h-10 w-10 rounded-lg border text-[14px] font-medium transition-colors',
              effort === n
                ? 'border-accent bg-accent text-white'
                : 'border-hairline bg-white text-ink-secondary hover:bg-surface-sunken',
            )}
          >
            {n}
          </button>
        ))}
        <span className="text-[11px] text-ink-muted">1 fresco · 5 destruido</span>
      </div>
      <Button
        variant="primary"
        className="mt-3 w-full"
        onClick={() =>
          void updateSession({
            ...session,
            status: 'completed',
            completedAt: new Date().toISOString(),
            perceivedEffort: effort === '' ? undefined : effort,
          })
        }
      >
        Marcar como completado
      </Button>
    </Card>
  )
}

/* ── Sustitucion de ejercicio ──────────────────────────────────────────── */

function SwapSheet({
  state,
  catalogList,
  week,
  onClose,
  currentOverrideId,
}: {
  state: { slot: Slot; exercise: Exercise } | null
  catalogList: Exercise[]
  week: number
  onClose: () => void
  currentOverrideId?: string
}) {
  const { setOverride, clearOverride } = useApp()
  if (!state) return null

  const candidates = rankSubstitutions(state.exercise, state.slot, catalogList)

  return (
    <Sheet open onClose={onClose} title="Cambiar ejercicio">
      <p className="mb-3 text-[12px] leading-relaxed text-ink-secondary">
        El cambio se aplica <strong className="font-semibold text-ink">solo a la semana {week}</strong>.
        La semana siguiente vuelve automaticamente a {state.exercise.name.es}, sin que tengas que
        deshacer nada. Las series quedan registradas a nombre del ejercicio que hagas de verdad.
      </p>

      {currentOverrideId && (
        <Button
          variant="danger"
          className="mb-3 w-full"
          onClick={() => {
            void clearOverride(week, state.slot.slotId)
            onClose()
          }}
        >
          Quitar sustitucion y volver al original
        </Button>
      )}

      <div className="space-y-1.5">
        {candidates.map((c) => (
          <button
            key={c.exercise.id}
            onClick={() => {
              void setOverride(week, state.slot.slotId, c.exercise.id, c.reason)
              onClose()
            }}
            className="flex w-full items-center gap-3 rounded-lg border border-hairline bg-white px-3 py-2.5 text-left hover:bg-surface-sunken"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium text-ink">{c.exercise.name.es}</div>
              <div className="mt-0.5 text-[11px] text-ink-muted">{c.reason}</div>
            </div>
            <span className="shrink-0 text-[13px] text-ink-muted" aria-hidden>
              →
            </span>
          </button>
        ))}
        {candidates.length === 0 && (
          <p className="text-[13px] text-ink-muted">
            No hay alternativas equivalentes en el catalogo para este ejercicio.
          </p>
        )}
      </div>
    </Sheet>
  )
}
