import { useState } from 'react'
import type { Exercise } from '@/types/catalog'
import { EQUIPMENT_LABEL, MUSCLE_LABEL, PATTERN_LABEL } from '@/types/catalog'
import { Badge, Sheet } from './ui'

/* ============================================================================
 *  Ficha de ejercicio con demostracion animada
 * ----------------------------------------------------------------------------
 *  Los GIF se sirven desde la CDN de ExerciseDB usando el mediaId. No viven en
 *  el repo. Si el ejercicio no tiene mediaId o la CDN falla, la ficha sigue
 *  mostrando musculos, material y consejos tecnicos: degrada sin romperse.
 * ========================================================================== */

const MEDIA_BASE = 'https://static.exercisedb.dev/media/'

export function gifUrl(exercise: Exercise): string | null {
  return exercise.mediaId ? `${MEDIA_BASE}${exercise.mediaId}.gif` : null
}

export function ExerciseDemo({
  exercise,
  open,
  onClose,
  note,
}: {
  exercise: Exercise | null
  open: boolean
  onClose: () => void
  note?: string
}) {
  const [failed, setFailed] = useState(false)
  if (!exercise) return null

  const gif = gifUrl(exercise)
  const contributions = [
    ...exercise.primary.map((c) => ({ ...c, primary: true })),
    ...exercise.secondary.map((c) => ({ ...c, primary: false })),
  ]

  return (
    <Sheet open={open} onClose={onClose} title={exercise.name.es}>
      <div className="space-y-4">
        {gif && !failed ? (
          <img
            src={gif}
            alt={`Demostracion de ${exercise.name.es}`}
            onError={() => setFailed(true)}
            className="w-full rounded-xl bg-surface-sunken"
            loading="lazy"
          />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl bg-surface-sunken text-[12px] text-ink-muted">
            Sin demostracion disponible
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <Badge tone="accent">{PATTERN_LABEL[exercise.pattern]}</Badge>
          <Badge>{EQUIPMENT_LABEL[exercise.equipment]}</Badge>
          {exercise.isUnilateral && <Badge>Unilateral</Badge>}
        </div>

        <div>
          <h4 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Musculos implicados
          </h4>
          <div className="space-y-1">
            {contributions.map((c) => (
              <div key={c.muscle} className="flex items-center gap-2 text-[13px]">
                <span className={c.primary ? 'font-medium text-ink' : 'text-ink-secondary'}>
                  {MUSCLE_LABEL[c.muscle]}
                </span>
                <span className="h-1 flex-1 rounded-full bg-surface-sunken">
                  <span
                    className="block h-1 rounded-full bg-accent"
                    style={{ width: `${c.factor * 100}%` }}
                  />
                </span>
                <span className="num w-10 text-right text-[11px] text-ink-muted">
                  {c.factor.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-ink-muted">
            El factor indica cuanto cuenta una serie para cada musculo en el recuento de
            volumen semanal.
          </p>
        </div>

        {note && (
          <div className="rounded-lg border-l-2 border-accent bg-accent-soft px-3 py-2 text-[12px] leading-relaxed text-ink-secondary">
            {note}
          </div>
        )}

        {exercise.cues.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              Puntos tecnicos
            </h4>
            <ul className="space-y-1">
              {exercise.cues.map((c, i) => (
                <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-secondary">
                  <span className="text-accent" aria-hidden>
                    ·
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[10px] leading-snug text-ink-muted">
          Animaciones: ExerciseDB · Gym Visual. Uso no comercial.
        </p>
      </div>
    </Sheet>
  )
}
