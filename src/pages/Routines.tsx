import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp, useCatalog } from '@/store/useApp'
import { allSlots, deloadWeek, GOAL_LABEL, LEVEL_LABEL, slotsOfDay, type Routine } from '@/types/routine'
import type { Cycle } from '@/types/logs'
import { Badge, Button, Card, NumberField, SectionTitle, Sheet } from '@/components/ui'
import { formatLong, mondayOfCurrentWeek } from '@/lib/date'
import { cycleContents, type CycleContents } from '@/lib/db'
import { PROMPT_TEMPLATE } from '@/data/prompt-template'
import { RoutineWizard } from '@/components/RoutineWizard'

/* ============================================================================
 *  Rutinas
 * ----------------------------------------------------------------------------
 *  Aqui vive el flujo que hace el sistema extensible: pedir una rutina a Claude
 *  en otra conversacion, pegar el JSON y tenerla funcionando. La validacion da
 *  errores con ruta exacta para que corregir el documento sea trivial.
 * ========================================================================== */

export default function Routines() {
  const { routines, cycle, cycles, startCycle, removeRoutine, importRoutine } = useApp()
  const [importing, setImporting] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [detail, setDetail] = useState<Routine | null>(null)
  const [starting, setStarting] = useState<Routine | null>(null)
  const [deletingCycle, setDeletingCycle] = useState<Cycle | null>(null)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-ink">Rutinas</h1>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">
            Una rutina es una plantilla. Al iniciarla se crea un ciclo con fechas reales, y la
            plantilla queda congelada dentro para que el historial nunca se descuadre.
          </p>
        </div>
      </div>

      {/* Dos maneras de conseguir una rutina, deliberadamente al mismo nivel:
          el asistente resuelve el caso comun sin salir de la app, y la
          importacion permite pedirle a Claude algo que el generador no cubre. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => setWizardOpen(true)}
          className="card p-4 text-left transition-colors hover:bg-surface-sunken"
        >
          <div className="flex items-center gap-2">
            <span className="text-[18px]" aria-hidden>
              ✨
            </span>
            <span className="text-[14px] font-semibold text-ink">Crear a medida</span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
            Responde seis preguntas y se genera una rutina con tu material, tus dias y tus
            limitaciones.
          </p>
        </button>

        <button
          onClick={() => setImporting(true)}
          className="card p-4 text-left transition-colors hover:bg-surface-sunken"
        >
          <div className="flex items-center gap-2">
            <span className="text-[18px]" aria-hidden>
              ⇥
            </span>
            <span className="text-[14px] font-semibold text-ink">Importar de Claude</span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
            Copia el prompt, pidesela en otra conversacion con todo el detalle que quieras y pega
            el JSON aqui.
          </p>
        </button>
      </div>

      {cycle && (
        <Card className="border-accent/40 bg-accent-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge tone="accent">Ciclo activo</Badge>
              <h2 className="mt-1.5 text-[15px] font-semibold text-ink">
                {cycle.routineSnapshot.name}
              </h2>
              <p className="num mt-0.5 text-[12px] text-ink-secondary">
                {cycle.targetWeeks} semanas desde el {formatLong(cycle.startDate)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <FinishCycleButton />
              <button
                onClick={() => setDeletingCycle(cycle)}
                className="text-[11px] font-medium text-[#a72c2c] hover:underline"
              >
                Eliminar
              </button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {routines.map((r) => (
          <Card key={r.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold tracking-tight text-ink">{r.name}</h2>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge>{GOAL_LABEL[r.goal]}</Badge>
                  <Badge>{LEVEL_LABEL[r.experienceLevel]}</Badge>
                  <Badge>{r.days.length} dias/semana</Badge>
                  <Badge>{r.durationWeeks} semanas</Badge>
                  {deloadWeek(r) && <Badge icon="↓">Descarga S{deloadWeek(r)}</Badge>}
                </div>
                {r.description && (
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-secondary">
                    {r.description}
                  </p>
                )}
                <p className="num mt-1.5 text-[11px] text-ink-muted">
                  {allSlots(r).length} ejercicios · {allSlots(r).reduce((n, s) => n + s.slot.sets, 0)}{' '}
                  series por semana
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => setStarting(r)}>
                Empezar ciclo
              </Button>
              <Button onClick={() => setDetail(r)}>Ver detalle</Button>
              <Button onClick={() => downloadRoutine(r)}>Exportar</Button>
              {routines.length > 1 && (
                <Button variant="danger" onClick={() => void removeRoutine(r.id)}>
                  Borrar
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {cycles.filter((c) => c.status !== 'active').length > 0 && (
        <Card>
          <SectionTitle hint="Cerrados o abandonados. Sus datos siguen contando en la analitica salvo que los elimines.">
            Ciclos anteriores
          </SectionTitle>
          <div className="space-y-1">
            {cycles
              .filter((c) => c.status !== 'active')
              .sort((a, b) => b.startDate.localeCompare(a.startDate))
              .map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-1.5 text-[13px]">
                  <span className="min-w-0 flex-1 truncate text-ink">{c.routineSnapshot.name}</span>
                  <span className="num shrink-0 text-[11px] text-ink-muted">
                    {formatLong(c.startDate)}
                  </span>
                  <Badge tone={c.status === 'completed' ? 'good' : 'neutral'}>
                    {c.status === 'completed' ? 'Completado' : 'Abandonado'}
                  </Badge>
                  <button
                    onClick={() => setDeletingCycle(c)}
                    aria-label={`Eliminar el ciclo ${c.routineSnapshot.name}`}
                    title="Eliminar ciclo y sus datos"
                    className="shrink-0 px-1 text-[13px] text-ink-muted hover:text-[#d03b3b]"
                  >
                    ✕
                  </button>
                </div>
              ))}
          </div>
        </Card>
      )}

      <RoutineWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />

      <DeleteCycleSheet cycle={deletingCycle} onClose={() => setDeletingCycle(null)} />

      <ImportSheet open={importing} onClose={() => setImporting(false)} onImport={importRoutine} />
      <DetailSheet routine={detail} onClose={() => setDetail(null)} />
      <StartSheet
        routine={starting}
        onClose={() => setStarting(null)}
        onStart={async (id, date, weeks) => {
          await startCycle(id, date, weeks)
          setStarting(null)
        }}
      />
    </div>
  )
}

function FinishCycleButton() {
  const finishCycle = useApp((s) => s.finishCycle)
  const [confirming, setConfirming] = useState(false)
  if (!confirming) {
    return <Button onClick={() => setConfirming(true)}>Cerrar</Button>
  }
  return (
    <div className="flex shrink-0 gap-1.5">
      <Button size="sm" variant="primary" onClick={() => void finishCycle('completed')}>
        Completado
      </Button>
      <Button size="sm" onClick={() => setConfirming(false)}>
        Cancelar
      </Button>
    </div>
  )
}

/* ── Eliminar un ciclo ─────────────────────────────────────────────────── */

/**
 * Confirmacion de borrado de ciclo.
 *
 * Es una accion destructiva e irreversible, asi que antes de pedir confirmacion
 * se cuenta y se muestra exactamente lo que se va a perder. Un "estas seguro?"
 * a secas no le da al usuario informacion para decidir.
 */
function DeleteCycleSheet({ cycle, onClose }: { cycle: Cycle | null; onClose: () => void }) {
  const removeCycle = useApp((s) => s.removeCycle)
  const [contents, setContents] = useState<CycleContents | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    setContents(null)
    if (cycle) void cycleContents(cycle.id).then(setContents)
  }, [cycle])

  if (!cycle) return null

  const isActive = cycle.status === 'active'

  return (
    <Sheet open onClose={onClose} title="¿Eliminar este ciclo?">
      <div className="space-y-4">
        <div>
          <div className="text-[15px] font-semibold text-ink">{cycle.routineSnapshot.name}</div>
          <div className="num mt-0.5 text-[12px] text-ink-secondary">
            Iniciado el {formatLong(cycle.startDate)} · {cycle.targetWeeks} semanas
            {isActive && ' · en curso'}
          </div>
        </div>

        <div className="rounded-lg border border-[#f3cdcd] bg-[#fdf2f2] p-3">
          <h4 className="text-[12px] font-semibold text-[#a72c2c]">
            Se borrara de forma permanente
          </h4>
          {contents ? (
            <ul className="mt-1.5 space-y-0.5 text-[12px] text-[#a72c2c]">
              <li>· {contents.sessions} sesiones de entrenamiento</li>
              <li>· {contents.sets} series registradas (peso, repeticiones y RIR)</li>
              {contents.overrides > 0 && <li>· {contents.overrides} sustituciones de ejercicio</li>}
            </ul>
          ) : (
            <p className="mt-1.5 text-[12px] text-[#a72c2c]">Calculando…</p>
          )}
          <p className="mt-2 text-[12px] leading-relaxed text-[#a72c2c]">
            <strong className="font-semibold">Dejara de contar en tu progreso:</strong> desaparecera
            del volumen semanal, de las graficas de fuerza, de los records y de la adherencia. Esta
            accion no se puede deshacer.
          </p>
        </div>

        <p className="text-[12px] leading-relaxed text-ink-secondary">
          La plantilla de la rutina <strong className="font-semibold text-ink">no</strong> se borra:
          seguira en tu lista y podras volver a empezarla cuando quieras.
          {isActive && ' Al ser el ciclo en curso, te quedaras sin ciclo activo.'}
        </p>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={onClose} disabled={working}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            disabled={working}
            onClick={async () => {
              setWorking(true)
              await removeCycle(cycle.id)
              setWorking(false)
              onClose()
            }}
          >
            {working ? 'Eliminando…' : 'Si, eliminar'}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

/* ── Importar ──────────────────────────────────────────────────────────── */

function ImportSheet({
  open,
  onClose,
  onImport,
}: {
  open: boolean
  onClose: () => void
  onImport: (raw: unknown) => Promise<{ ok: true; routine: Routine } | { ok: false; errors: string[] }>
}) {
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [ok, setOk] = useState('')
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const doImport = async (raw: string) => {
    setErrors([])
    setOk('')
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      setErrors([`El texto no es JSON valido: ${e instanceof Error ? e.message : 'error'}`])
      return
    }
    const result = await onImport(parsed)
    if (result.ok) {
      setOk(`"${result.routine.name}" importada correctamente`)
      setText('')
    } else {
      setErrors(result.errors)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Importar rutina">
      <div className="space-y-4">
        <div className="rounded-lg bg-surface-sunken p-3">
          <h4 className="text-[12px] font-semibold text-ink">Como generar una con Claude</h4>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
            Copia el prompt de abajo, pegalo en una conversacion nueva, describe lo que quieres
            (dias, objetivo, material disponible, lesiones) y pega aqui el JSON que te devuelva.
          </p>
          <Button
            size="sm"
            className="mt-2"
            onClick={() => {
              void navigator.clipboard.writeText(PROMPT_TEMPLATE)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
          >
            {copied ? 'Copiado ✓' : 'Copiar prompt'}
          </Button>
        </div>

        <div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) await doImport(await f.text())
            }}
          />
          <Button className="w-full" onClick={() => fileRef.current?.click()}>
            Seleccionar archivo .json
          </Button>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            O pega el JSON
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder='{ "schemaVersion": "1.0", "id": "mi-rutina", ... }'
            className="w-full rounded-lg border border-hairline bg-white p-3 font-mono text-[12px] text-ink focus:border-accent focus:outline-none"
          />
        </div>

        {errors.length > 0 && (
          <div className="rounded-lg border border-[#f3cdcd] bg-[#fdf2f2] p-3">
            <h4 className="text-[12px] font-semibold text-[#a72c2c]">
              La rutina no cumple el esquema
            </h4>
            <ul className="mt-1.5 space-y-1">
              {errors.map((e, i) => (
                <li key={i} className="font-mono text-[11px] leading-snug text-[#a72c2c]">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {ok && (
          <div className="rounded-lg border border-[#c9ecc9] bg-[#eefaee] p-3 text-[12px] font-medium text-[#0a7a0a]">
            {ok}
          </div>
        )}

        <Button variant="primary" className="w-full" onClick={() => void doImport(text)} disabled={!text.trim()}>
          Importar
        </Button>
      </div>
    </Sheet>
  )
}

/* ── Detalle ───────────────────────────────────────────────────────────── */

function DetailSheet({ routine, onClose }: { routine: Routine | null; onClose: () => void }) {
  const catalog = useCatalog()
  if (!routine) return null

  return (
    <Sheet open onClose={onClose} title={routine.name}>
      <div className="space-y-4">
        {routine.days.map((d) => (
          <div key={d.id}>
            <h4 className="text-[13px] font-semibold text-ink">{d.name}</h4>
            {d.focus && <p className="text-[11px] text-ink-muted">{d.focus}</p>}
            <div className="mt-1.5 space-y-1">
              {slotsOfDay(d).map((s) => (
                <div key={s.slotId} className="flex items-baseline gap-2 text-[12px]">
                  <span className="flex-1 text-ink-secondary">
                    {catalog[s.exerciseId]?.name.es ?? s.exerciseId}
                  </span>
                  <span className="num shrink-0 text-ink-muted">
                    {s.sets} × {s.repRange[0]}–{s.repRange[1]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {routine.references.length > 0 && (
          <div className="border-t border-hairline pt-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Referencias
            </h4>
            <ul className="mt-1.5 space-y-1">
              {routine.references.map((r, i) => (
                <li key={i} className="text-[11px] leading-relaxed text-ink-secondary">
                  · {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  )
}

/* ── Iniciar ciclo ─────────────────────────────────────────────────────── */

function StartSheet({
  routine,
  onClose,
  onStart,
}: {
  routine: Routine | null
  onClose: () => void
  onStart: (id: string, date: string, weeks: number) => Promise<void>
}) {
  const navigate = useNavigate()
  const [date, setDate] = useState(mondayOfCurrentWeek())
  const [weeks, setWeeks] = useState<number | ''>(routine?.durationWeeks ?? 8)
  if (!routine) return null

  return (
    <Sheet open onClose={onClose} title="Empezar ciclo">
      <div className="space-y-4">
        <p className="text-[12px] leading-relaxed text-ink-secondary">
          Se creara un ciclo de <strong className="font-semibold text-ink">{routine.name}</strong>. Si
          tienes otro ciclo activo, se cerrara como completado.
        </p>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Fecha de inicio (lunes de la semana 1)
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 w-full rounded-lg border border-hairline bg-white px-3 text-[14px] text-ink focus:border-accent focus:outline-none"
          />
        </label>

        <NumberField
          label="Duracion objetivo"
          value={weeks}
          onChange={setWeeks}
          step={1}
          min={1}
          suffix="sem"
        />

        <Button
          variant="primary"
          className="w-full"
          onClick={async () => {
            await onStart(routine.id, date, weeks === '' ? routine.durationWeeks : weeks)
            navigate('/entrenar')
          }}
        >
          Empezar
        </Button>
      </div>
    </Sheet>
  )
}

function downloadRoutine(r: Routine) {
  const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${r.id}.json`
  a.click()
  URL.revokeObjectURL(url)
}
