import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { useApp, useCatalogList } from '@/store/useApp'
import { GOALS, GOAL_LABEL, LEVELS, LEVEL_LABEL, slotsOfDay, type Routine } from '@/types/routine'
import {
  DEFAULT_PROFILE,
  EMPHASIS_LABEL,
  EMPHASIS_OPTIONS,
  EQUIPMENT_PROFILES,
  EQUIPMENT_PROFILE_LABEL,
  LIMITATIONS,
  LIMITATION_LABEL,
  SESSION_LENGTHS,
  SESSION_LENGTH_LABEL,
  generateRoutine,
  type Emphasis,
  type EquipmentProfile,
  type Limitation,
  type Profile,
  type SessionLength,
} from '@/lib/generator'
import { Badge, Button, NumberField, Sheet } from './ui'

/* ============================================================================
 *  Asistente de rutina
 * ----------------------------------------------------------------------------
 *  Cuestionario corto que produce una rutina completa. La rutina resultante es
 *  un documento del mismo esquema que una importada de Claude, asi que se puede
 *  exportar, editar fuera y volver a importar.
 * ========================================================================== */

function OptionGroup<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
  columns = 2,
}: {
  label: string
  hint?: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
  columns?: 2 | 3
}) {
  return (
    <div>
      <div className="mb-1.5">
        <span className="text-[12px] font-semibold text-ink">{label}</span>
        {hint && <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{hint}</p>}
      </div>
      <div className={clsx('grid gap-1.5', columns === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={clsx(
              'rounded-lg border px-2.5 py-2 text-[12px] font-medium transition-colors',
              value === o.value
                ? 'border-accent bg-accent-soft text-accent-strong'
                : 'border-hairline bg-white text-ink-secondary hover:bg-surface-sunken',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function RoutineWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const catalog = useCatalogList()
  const importRoutine = useApp((s) => s.importRoutine)
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const [preview, setPreview] = useState<Routine | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const set = <K extends keyof Profile>(key: K, v: Profile[K]) =>
    setProfile((p) => ({ ...p, [key]: v }))

  const toggleLimitation = (l: Limitation) =>
    setProfile((p) => ({
      ...p,
      limitations: p.limitations.includes(l)
        ? p.limitations.filter((x) => x !== l)
        : [...p.limitations, l],
    }))

  const totalSets = useMemo(
    () =>
      preview
        ? preview.days.reduce((n, d) => n + slotsOfDay(d).reduce((m, s) => m + s.sets, 0), 0)
        : 0,
    [preview],
  )

  const generate = () => {
    setError('')
    setSaved(false)
    try {
      const result = generateRoutine(profile, catalog)
      setPreview(result.routine)
      setNotes(result.notes)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar la rutina')
      setPreview(null)
    }
  }

  const save = async () => {
    if (!preview) return
    const result = await importRoutine(preview)
    if (result.ok) {
      setSaved(true)
    } else {
      setError(result.errors.join('; '))
    }
  }

  const reset = () => {
    setPreview(null)
    setNotes([])
    setError('')
    setSaved(false)
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title={preview ? 'Tu rutina' : 'Crear rutina a medida'}
    >
      {!preview ? (
        <div className="space-y-5">
          <p className="text-[12px] leading-relaxed text-ink-secondary">
            Responde estas preguntas y se construye una rutina completa con tu material y tus
            limitaciones. Sale en el mismo formato que las importadas, asi que despues puedes
            exportarla, retocarla y volver a cargarla.
          </p>

          <OptionGroup
            label="¿Cual es tu objetivo?"
            value={profile.goal}
            onChange={(v) => set('goal', v)}
            options={GOALS.map((g) => ({ value: g, label: GOAL_LABEL[g] }))}
          />

          <OptionGroup
            label="¿Que experiencia tienes?"
            hint="Ajusta el volumen y lo cerca del fallo que se entrena."
            value={profile.level}
            onChange={(v) => set('level', v)}
            columns={3}
            options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABEL[l] }))}
          />

          <div>
            <div className="mb-1.5">
              <span className="text-[12px] font-semibold text-ink">
                ¿Cuantos dias puedes entrenar?
              </span>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">
                Con 2 o 3 dias se usa cuerpo completo; a partir de 4, repartos divididos.
              </p>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[2, 3, 4, 5, 6].map((d) => (
                <button
                  key={d}
                  onClick={() => set('daysPerWeek', d)}
                  className={clsx(
                    'rounded-lg border py-2 text-[13px] font-medium transition-colors',
                    profile.daysPerWeek === d
                      ? 'border-accent bg-accent-soft text-accent-strong'
                      : 'border-hairline bg-white text-ink-secondary hover:bg-surface-sunken',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <OptionGroup
            label="¿Que material tienes?"
            value={profile.equipment}
            onChange={(v) => set('equipment', v as EquipmentProfile)}
            options={EQUIPMENT_PROFILES.map((e) => ({ value: e, label: EQUIPMENT_PROFILE_LABEL[e] }))}
          />

          <OptionGroup
            label="¿Cuanto dura tu sesion?"
            value={profile.sessionLength}
            onChange={(v) => set('sessionLength', v as SessionLength)}
            columns={3}
            options={SESSION_LENGTHS.map((s) => ({ value: s, label: SESSION_LENGTH_LABEL[s] }))}
          />

          <OptionGroup
            label="¿Quieres enfatizar algo?"
            hint="Anade una serie extra al trabajo de ese grupo."
            value={profile.emphasis}
            onChange={(v) => set('emphasis', v as Emphasis)}
            columns={3}
            options={EMPHASIS_OPTIONS.map((e) => ({ value: e, label: EMPHASIS_LABEL[e] }))}
          />

          <div>
            <div className="mb-1.5">
              <span className="text-[12px] font-semibold text-ink">¿Alguna molestia?</span>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">
                Se evitaran los ejercicios que mas suelen dar problemas. No sustituye la valoracion
                de un profesional.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {LIMITATIONS.map((l) => (
                <button
                  key={l}
                  onClick={() => toggleLimitation(l)}
                  className={clsx(
                    'rounded-lg border px-2.5 py-2 text-[12px] font-medium transition-colors',
                    profile.limitations.includes(l)
                      ? 'border-accent bg-accent-soft text-accent-strong'
                      : 'border-hairline bg-white text-ink-secondary hover:bg-surface-sunken',
                  )}
                >
                  {profile.limitations.includes(l) ? '✓ ' : ''}
                  {LIMITATION_LABEL[l]}
                </button>
              ))}
            </div>
          </div>

          <NumberField
            label="Duracion del ciclo"
            value={profile.durationWeeks}
            onChange={(v) => set('durationWeeks', v === '' ? 8 : v)}
            step={1}
            min={2}
            suffix="sem"
          />

          {error && (
            <p className="rounded-lg border border-[#f3cdcd] bg-[#fdf2f2] px-3 py-2 text-[12px] text-[#a72c2c]">
              {error}
            </p>
          )}

          <Button variant="primary" className="w-full" onClick={generate}>
            Generar rutina
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="text-[15px] font-semibold text-ink">{preview.name}</h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge>{GOAL_LABEL[preview.goal]}</Badge>
              <Badge>{preview.days.length} dias/semana</Badge>
              <Badge>{preview.durationWeeks} semanas</Badge>
              <Badge>{totalSets} series/semana</Badge>
            </div>
          </div>

          {notes.length > 0 && (
            <div className="rounded-lg bg-surface-sunken p-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Por que esta rutina
              </h4>
              <ul className="mt-1.5 space-y-1">
                {notes.map((n, i) => (
                  <li key={i} className="text-[12px] leading-relaxed text-ink-secondary">
                    · {n}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            {preview.days.map((d) => (
              <div key={d.id}>
                <h4 className="text-[13px] font-semibold text-ink">{d.name}</h4>
                <p className="text-[11px] text-ink-muted">{d.focus}</p>
                <div className="mt-1.5 space-y-1">
                  {slotsOfDay(d).map((s) => (
                    <div key={s.slotId} className="flex items-baseline gap-2 text-[12px]">
                      <span className="flex-1 text-ink-secondary">
                        {catalog.find((e) => e.id === s.exerciseId)?.name.es ?? s.exerciseId}
                      </span>
                      <span className="num shrink-0 text-ink-muted">
                        {s.sets} × {s.repRange[0]}–{s.repRange[1]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p className="rounded-lg border border-[#f3cdcd] bg-[#fdf2f2] px-3 py-2 text-[12px] text-[#a72c2c]">
              {error}
            </p>
          )}

          {saved ? (
            <div className="rounded-lg border border-[#c9ecc9] bg-[#eefaee] p-3">
              <p className="text-[13px] font-medium text-[#0a7a0a]">
                Guardada en tus rutinas. Ya puedes empezar un ciclo con ella.
              </p>
              <Button
                className="mt-2 w-full"
                onClick={() => {
                  reset()
                  onClose()
                }}
              >
                Cerrar
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={reset}>
                Cambiar respuestas
              </Button>
              <Button variant="primary" className="flex-1" onClick={() => void save()}>
                Guardar rutina
              </Button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}
