import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { useApp, useCatalog, useCatalogList, useCurrentWeek, lastSetsForSlot } from '@/store/useApp'
import { isDeloadWeek, prescribedSets, slotsOfDay, type Slot } from '@/types/routine'
import type { Exercise } from '@/types/catalog'
import type { SetLog } from '@/types/logs'
import { suggestNext } from '@/lib/progression'
import { rankSubstitutions } from '@/lib/substitutions'
import { estimate1RM } from '@/lib/e1rm'
import { summarizeSession } from '@/lib/milestones'
import { fmt, incrementFor } from '@/lib/increments'
import { FunFactList } from '@/components/FunFacts'
import { WeightPicker } from '@/components/WeightPicker'
import { RestBar } from '@/components/RestBar'
import { ChipSelect, rangeValues } from '@/components/ChipSelect'
import { ExerciseDemo } from '@/components/ExerciseDemo'
import { Badge, Button, Card, EmptyState, Sheet } from '@/components/ui'

/* ============================================================================
 *  Pantalla de entrenamiento  ·  foco de serie
 * ----------------------------------------------------------------------------
 *  Un solo ejercicio ocupa la pantalla. El resto del dia queda en filas de una
 *  linea, y el descanso en una franja fina arriba.
 *
 *  El motivo es que esta pantalla se usa DENTRO del gimnasio, de pie y entre
 *  series: la lista completa de siete ejercicios obliga a buscar cada vez donde
 *  estabas. Con foco unico, lo que se mira siempre esta en el mismo sitio.
 *
 *  El orden de la tarjeta sigue el orden real de la accion: que toca, que
 *  llevas hecho, que carga pones, cuantas reps, y registrar.
 * ========================================================================== */

export default function Train() {
  const { cycle, sessions, setLogs, overrides, settings } = useApp()
  const currentWeek = useCurrentWeek()
  const catalog = useCatalog()
  const catalogList = useCatalogList()

  const [week, setWeek] = useState(currentWeek)
  const [dayIdx, setDayIdx] = useState(0)
  const [exIdx, setExIdx] = useState(0)
  const [picker, setPicker] = useState(false)
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
  const slots = slotsOfDay(day)
  const slot = slots[Math.min(exIdx, slots.length - 1)]

  const session = sessions.find((s) => s.cycleId === cycle.id && s.week === week && s.dayId === day.id)
  const sessionSets = session ? setLogs.filter((l) => l.sessionId === session.id) : []
  const deload = isDeloadWeek(routine, week)

  const overrideFor = (slotId: string) =>
    overrides.find((o) => o.cycleId === cycle.id && o.week === week && o.slotId === slotId)

  const effectiveExercise = (s: Slot) =>
    catalog[overrideFor(s.slotId)?.replacementExerciseId ?? s.exerciseId]

  const exercise = effectiveExercise(slot)
  const setsFor = (s: Slot) =>
    sessionSets.filter((l) => l.slotId === s.slotId && !l.isWarmup).sort((a, b) => a.setIndex - b.setIndex)

  const doneHere = setsFor(slot)
  const targetSets = prescribedSets(routine, slot, week)

  return (
    <div className="space-y-4">
      {/* ── Franja superior: contexto, o cuenta atras mientras descansas ── */}
      {rest ? (
        <RestBar
          key={rest.key}
          seconds={rest.seconds}
          sound={settings.restTimerSound}
          onDone={() => setRest(null)}
          onExtend={(extra) => setRest((r) => (r ? { ...r, seconds: r.seconds + extra } : r))}
        />
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPicker(true)}
            className="flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-[13px] font-medium text-ink"
          >
            <span className="num">S{week}</span>
            <span className="text-ink-muted" aria-hidden>
              ▾
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-ink">{day.name}</div>
          </div>
          <span className="num shrink-0 text-[12px] text-ink-muted">
            {exIdx + 1} de {slots.length}
          </span>
        </div>
      )}

      {deload && (
        <div className="rounded-xl border border-[#f5e3b0] bg-[#fff8e6] px-3 py-2">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#8a6200]">
            <span aria-hidden>↓</span> Semana de descarga
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[#8a6200]">
            Series al {Math.round((routine.deload?.volumeMultiplier ?? 0.5) * 100)}% y carga al{' '}
            {Math.round((routine.deload?.intensityMultiplier ?? 0.9) * 100)}%. Deja 3-4 reps en
            reserva: el objetivo es disipar fatiga, no rendir.
          </p>
        </div>
      )}

      {/* ── Ejercicio en curso ── */}
      {exercise ? (
        <ExerciseFocus
          key={`${day.id}-${slot.slotId}-${week}`}
          slot={slot}
          exercise={exercise}
          originalExercise={catalog[slot.exerciseId]}
          isSwapped={Boolean(overrideFor(slot.slotId))}
          week={week}
          dayId={day.id}
          position={{ index: exIdx + 1, total: slots.length }}
          done={doneHere}
          targetSets={targetSets}
          lastSets={lastSetsForSlot(sessions, setLogs, cycle.id, slot.slotId, week)}
          minPlate={settings.minPlateIncrement}
          increments={settings.exerciseIncrements}
          onDemo={() => setDemo({ exercise, note: slot.notes })}
          onSwap={() => setSwapping({ slot, exercise })}
          onRest={(seconds) => setRest({ seconds, key: Date.now() })}
          onNext={() => setExIdx((i) => Math.min(slots.length - 1, i + 1))}
          hasNext={exIdx < slots.length - 1}
        />
      ) : (
        <Card>
          <p className="text-[13px] text-ink-secondary">
            Este ejercicio no esta en el catalogo. Cambialo por otro desde la lista de abajo.
          </p>
        </Card>
      )}

      {/* ── Resto del dia ── */}
      <Card className="!p-0 overflow-hidden">
        <div className="border-b border-hairline px-4 py-2.5">
          <h3 className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
            Resto del dia
          </h3>
        </div>
        <div>
          {slots.map((s, i) => {
            const ex = effectiveExercise(s)
            const n = setsFor(s).length
            const target = prescribedSets(routine, s, week)
            const complete = n >= target
            const isCurrent = i === exIdx
            return (
              <button
                key={s.slotId}
                onClick={() => setExIdx(i)}
                className={clsx(
                  'flex w-full items-center gap-3 border-b border-hairline px-4 py-2.5 text-left last:border-0 transition-colors',
                  isCurrent ? 'bg-accent-soft' : 'hover:bg-surface-sunken',
                )}
              >
                <span
                  className={clsx(
                    'w-4 shrink-0 text-center text-[12px]',
                    complete ? 'text-[#0ca30c]' : 'text-ink-muted',
                  )}
                  aria-hidden
                >
                  {complete ? '✓' : isCurrent ? '▸' : '·'}
                </span>
                <span
                  className={clsx(
                    'min-w-0 flex-1 truncate text-[13px]',
                    isCurrent ? 'font-semibold text-accent-strong' : 'text-ink',
                  )}
                >
                  {ex?.name.es ?? s.exerciseId}
                </span>
                {overrideFor(s.slotId) && (
                  <span className="shrink-0 text-[11px] text-[#8a6200]" aria-hidden>
                    ⇄
                  </span>
                )}
                <span
                  className={clsx(
                    'num shrink-0 text-[12px]',
                    complete ? 'text-[#0a7a0a]' : 'text-ink-muted',
                  )}
                >
                  {n}/{target}
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      {/* ── Cierre de sesion ── */}
      {session && sessionSets.length > 0 && (
        session.status === 'completed' ? (
          <SessionDone sets={sessionSets} />
        ) : (
          <FinishSession sessionId={session.id} sets={sessionSets} />
        )
      )}

      <WeekDayPicker
        open={picker}
        onClose={() => setPicker(false)}
        weeks={cycle.targetWeeks}
        week={week}
        dayIdx={dayIdx}
        days={routine.days.map((d) => d.name)}
        deloadWeeks={Array.from({ length: cycle.targetWeeks }, (_, i) => i + 1).filter((w) =>
          isDeloadWeek(routine, w),
        )}
        onPick={(w, d) => {
          setWeek(w)
          setDayIdx(d)
          setExIdx(0)
          setPicker(false)
        }}
      />

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
    </div>
  )
}

/* ── Ejercicio en curso ───────────────────────────────────────────────── */

function ExerciseFocus({
  slot,
  exercise,
  originalExercise,
  isSwapped,
  week,
  dayId,
  position,
  done,
  targetSets,
  lastSets,
  minPlate,
  increments,
  onDemo,
  onSwap,
  onRest,
  onNext,
  hasNext,
}: {
  slot: Slot
  exercise: Exercise
  originalExercise?: Exercise
  isSwapped: boolean
  week: number
  dayId: string
  position: { index: number; total: number }
  done: SetLog[]
  targetSets: number
  lastSets: SetLog[]
  minPlate: number
  increments: Record<string, number>
  onDemo: () => void
  onSwap: () => void
  onRest: (seconds: number) => void
  onNext: () => void
  hasNext: boolean
}) {
  const { cycle, getOrCreateSession, logSet, removeSet, updateSettings } = useApp()
  const routine = cycle!.routineSnapshot

  const exerciseIncrement = incrementFor(exercise, increments, minPlate)
  const suggestion = useMemo(
    () => suggestNext(routine, slot, exercise, week, lastSets, exerciseIncrement),
    [routine, slot, exercise, week, lastSets, exerciseIncrement],
  )

  const isSeconds = (slot.metric ?? exercise.defaultMetric) === 'seconds'
  const lastWeight = lastSets.length > 0 ? Math.max(...lastSets.map((s) => s.weightKg)) : undefined

  // Referencia de carga: lo movido hoy manda sobre la sugerencia previa
  const pickerBase = done.length > 0 ? done[done.length - 1].weightKg : suggestion.weightKg

  const [weight, setWeight] = useState<number | ''>('')
  const [reps, setReps] = useState<number | ''>('')
  const [rir, setRir] = useState<number | ''>('')

  // Al entrar, la prescripcion viene ya elegida: lo normal es aceptarla
  useEffect(() => {
    if (weight === '' && pickerBase !== null) setWeight(pickerBase)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerBase])

  useEffect(() => {
    if (reps === '') setReps(slot.repRange[1])
    if (rir === '' && typeof suggestion.targetRIR === 'number') setRir(suggestion.targetRIR)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const complete = done.length >= targetSets
  const nextSetIndex = done.length + 1

  // En dominadas o flexiones la carga es el propio cuerpo: exigir un peso
  // impediria registrar la serie. En barra o maquina, en cambio, un 0 kg seria
  // casi siempre un descuido.
  const needsWeight = exercise.equipment !== 'bodyweight'

  const add = async () => {
    if (reps === '' || reps <= 0) return
    const session = await getOrCreateSession(week, dayId)
    await logSet({
      sessionId: session.id,
      slotId: slot.slotId,
      exerciseId: exercise.id,
      setIndex: nextSetIndex,
      weightKg: weight === '' ? 0 : weight,
      reps: isSeconds ? 0 : reps,
      seconds: isSeconds ? reps : undefined,
      rir: rir === '' ? undefined : rir,
      isWarmup: false,
    })
    const restSec = slot.restSec ?? 90
    if (restSec > 0) onRest(restSec)
  }

  const repChips = rangeValues(slot.repRange, 5)

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="p-4">
        {/* Que toca */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="num text-[11px] font-medium tracking-wider text-ink-muted uppercase">
              Ejercicio {position.index} de {position.total}
            </div>
            <h2 className="mt-0.5 text-[19px] leading-tight font-semibold tracking-tight text-ink">
              {exercise.name.es}
            </h2>
            <div className="num mt-1 text-[12px] text-ink-secondary">
              {targetSets} × {slot.repRange[0]}–{slot.repRange[1]}
              {isSeconds ? ' s' : ' reps'}
              {typeof suggestion.targetRIR === 'number' && ` · RIR ${suggestion.targetRIR}`}
              {slot.restSec ? ` · ${slot.restSec}s` : ''}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {complete && (
                <Badge tone="good" icon="✓">
                  Completado
                </Badge>
              )}
              {isSwapped && (
                <Badge tone="warning" icon="⇄">
                  Solo esta semana
                </Badge>
              )}
            </div>
            {isSwapped && originalExercise && (
              <div className="mt-1 text-[11px] text-ink-muted">
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

        {/* Que llevas hecho: una ficha por serie, hechas y pendientes */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {done.map((s) => {
            const e = estimate1RM(s.weightKg, s.reps, s.rir ?? 0)
            return (
              <button
                key={s.id}
                onClick={() => void removeSet(s.id)}
                title={`Serie ${s.setIndex}${e ? ` · e1RM ${fmt(Math.round(e.value * 10) / 10)}` : ''} · toca para borrar`}
                className="group flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-sunken px-2.5 py-1.5"
              >
                <span className="num text-[13px] font-medium text-ink">
                  {s.weightKg > 0 ? fmt(s.weightKg) : 'PC'}
                  <span className="text-ink-muted">×</span>
                  {s.seconds ?? s.reps}
                  {s.seconds ? 's' : ''}
                </span>
                {s.rir !== undefined && (
                  <span className="num text-[11px] text-ink-muted">@{s.rir}</span>
                )}
                <span className="text-[11px] text-ink-muted group-hover:text-[#d03b3b]" aria-hidden>
                  ✕
                </span>
              </button>
            )
          })}
          {Array.from({ length: Math.max(0, targetSets - done.length) }, (_, i) => (
            <span
              key={`pend-${i}`}
              className={clsx(
                'num flex items-center rounded-lg border border-dashed px-2.5 py-1.5 text-[12px]',
                i === 0 ? 'border-accent text-accent' : 'border-hairline text-ink-muted',
              )}
            >
              Serie {done.length + i + 1}
            </span>
          ))}
        </div>
      </div>

      {/* Que carga: el numero que importa, con el porque debajo */}
      <div className="border-t border-hairline bg-surface-sunken/60 p-4">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[11px] font-medium tracking-wide text-ink-muted uppercase">
            {suggestion.basis === 'add-weight'
              ? 'Sube peso'
              : suggestion.basis === 'back-off'
                ? 'Baja peso'
                : suggestion.basis === 'deload'
                  ? 'Descarga'
                  : suggestion.basis === 'first-time'
                    ? 'Primera vez'
                    : 'Manten carga'}
          </span>
        </div>

        <WeightPicker
          exercise={exercise}
          suggested={pickerBase}
          value={weight}
          onChange={setWeight}
          lastWeight={lastWeight}
          increments={increments}
          fallbackIncrement={minPlate}
          onSaveIncrement={(exerciseId, kg) =>
            void updateSettings({ exerciseIncrements: { ...increments, [exerciseId]: kg } })
          }
        />

        <p className="mt-2 text-[12px] leading-snug text-ink-secondary">{suggestion.rationale}</p>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <ChipSelect
            label={isSeconds ? 'Segundos' : 'Reps'}
            values={repChips}
            value={reps}
            onChange={setReps}
          />
          <ChipSelect label="RIR" values={[0, 1, 2, 3, 4]} value={rir} onChange={setRir} />
        </div>

        <Button
          variant="primary"
          size="lg"
          className="mt-3 w-full"
          onClick={() => void add()}
          disabled={reps === '' || (needsWeight && weight === '')}
        >
          {reps === ''
            ? `Registrar serie ${nextSetIndex}`
            : `Registrar serie ${nextSetIndex} · ${weight === '' ? 'PC' : fmt(weight)} × ${reps}${isSeconds ? 's' : ''}`}
        </Button>

        {complete && hasNext && (
          <Button className="mt-2 w-full" onClick={onNext}>
            Siguiente ejercicio →
          </Button>
        )}
      </div>

      {/* Que hiciste la ultima vez */}
      {lastSets.length > 0 && (
        <div className="border-t border-hairline px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="num text-[11px] text-ink-muted">
              Ultima vez · {lastSets.map((s) => `${fmt(s.weightKg)}×${s.reps}`).join(' · ')}
            </span>
            <Link
              to={`/ejercicio/${exercise.id}`}
              className="ml-auto shrink-0 text-[11px] font-medium text-accent hover:underline"
            >
              Historial →
            </Link>
          </div>
        </div>
      )}
    </Card>
  )
}

/* ── Selector de semana y dia ─────────────────────────────────────────── */

function WeekDayPicker({
  open,
  onClose,
  weeks,
  week,
  dayIdx,
  days,
  deloadWeeks,
  onPick,
}: {
  open: boolean
  onClose: () => void
  weeks: number
  week: number
  dayIdx: number
  days: string[]
  deloadWeeks: number[]
  onPick: (week: number, dayIdx: number) => void
}) {
  const [w, setW] = useState(week)
  useEffect(() => {
    if (open) setW(week)
  }, [open, week])

  if (!open) return null

  return (
    <Sheet open onClose={onClose} title="Semana y dia">
      <div className="space-y-4">
        <div>
          <h4 className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
            Semana
          </h4>
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: weeks }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setW(n)}
                className={clsx(
                  'num h-10 rounded-lg border text-[14px] font-medium transition-colors',
                  n === w
                    ? 'border-accent bg-accent bg-accent-soft text-accent-strong'
                    : 'border-hairline bg-white text-ink-secondary',
                )}
              >
                S{n}
                {deloadWeeks.includes(n) && <span className="ml-0.5 text-[10px]">↓</span>}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
            Dia
          </h4>
          <div className="space-y-1.5">
            {days.map((name, i) => (
              <button
                key={name}
                onClick={() => onPick(w, i)}
                className={clsx(
                  'flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[14px] transition-colors',
                  i === dayIdx && w === week
                    ? 'border-accent bg-accent-soft font-medium text-accent-strong'
                    : 'border-hairline bg-white text-ink hover:bg-surface-sunken',
                )}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  )
}

/* ── Cierre de sesion ─────────────────────────────────────────────────── */

function SessionDone({ sets }: { sets: SetLog[] }) {
  const metrics = useApp((s) => s.metrics)
  const bodyweight = useMemo(() => {
    const bw = metrics.filter((m) => m.metric === 'bodyweight').sort((a, b) => b.date.localeCompare(a.date))
    return bw[0]?.value
  }, [metrics])

  const summary = useMemo(() => summarizeSession(sets, bodyweight), [sets, bodyweight])
  if (summary.tonnageKg <= 0) return null

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[18px]" aria-hidden>
          ✓
        </span>
        <h3 className="text-[14px] font-semibold text-ink">Entrenamiento completado</h3>
      </div>
      <FunFactList facts={summary.facts} />
    </Card>
  )
}

function FinishSession({ sessionId, sets }: { sessionId: string; sets: SetLog[] }) {
  const { sessions, updateSession, metrics } = useApp()
  const session = sessions.find((s) => s.id === sessionId)
  const [effort, setEffort] = useState<number | ''>('')

  const bodyweight = useMemo(() => {
    const bw = metrics.filter((m) => m.metric === 'bodyweight').sort((a, b) => b.date.localeCompare(a.date))
    return bw[0]?.value
  }, [metrics])
  const summary = useMemo(() => summarizeSession(sets, bodyweight), [sets, bodyweight])

  if (!session) return null

  return (
    <Card>
      {/* Primero el logro, luego el tramite */}
      {summary.facts.length > 0 && (
        <div className="mb-4">
          <FunFactList facts={summary.facts.slice(0, 1)} />
        </div>
      )}

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
              'num h-10 w-10 rounded-lg border text-[14px] font-medium transition-colors',
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

/* ── Sustitucion de ejercicio ─────────────────────────────────────────── */

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
