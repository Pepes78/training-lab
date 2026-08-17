import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import type { Exercise } from '@/types/catalog'
import { EQUIPMENT_LABEL } from '@/types/catalog'
import {
  fmt,
  incrementFor,
  incrementOptions,
  incrementSource,
  loadOptions,
  snapToIncrement,
} from '@/lib/increments'
import { Sheet } from './ui'

/* ============================================================================
 *  Control de carga
 * ----------------------------------------------------------------------------
 *  Tres cargas concretas que el aparato admite de verdad, en vez de un campo
 *  vacio: la sugerida en el centro y una a cada lado con la DIFERENCIA REAL
 *  respecto a ella. No se etiquetan como "suave" o "exigente" porque el numero
 *  ya lo dice, y "sube un par" solo tendria sentido con mancuernas.
 *
 *  El salto sale del material del ejercicio y se puede fijar a mano desde la
 *  hoja de "Otro", donde queda guardado EN EL EJERCICIO: las semanas siguientes
 *  ya ofrecen las cargas correctas sin volver a tocarlo.
 * ========================================================================== */

interface Props {
  exercise: Exercise
  /** Carga sugerida por el motor de progresion. null la primera vez. */
  suggested: number | null
  value: number | ''
  onChange: (kg: number) => void
  /** Carga de la ultima vez, para la comparacion en verde. */
  lastWeight?: number
  increments: Record<string, number>
  fallbackIncrement: number
  onSaveIncrement: (exerciseId: string, kg: number) => void
}

export function WeightPicker({
  exercise,
  suggested,
  value,
  onChange,
  lastWeight,
  increments,
  fallbackIncrement,
  onSaveIncrement,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const increment = incrementFor(exercise, increments, fallbackIncrement)
  const source = incrementSource(exercise, increments, fallbackIncrement)

  // Sin referencia previa no hay tres cargas que ofrecer: proponer "0 kg ·
  // sugerido" no significa nada. La primera vez se pide la carga directamente.
  const base = suggested ?? (typeof value === 'number' && value > 0 ? value : null)
  const options = useMemo(() => (base === null ? [] : loadOptions(base, increment)), [base, increment])

  // La carga elegida puede no estar entre las tres (viene del teclado libre)
  const isCustom = typeof value === 'number' && !options.some((o) => o.kg === value)

  if (base === null) {
    return (
      <div>
        <button
          onClick={() => setSheetOpen(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-hairline bg-surface-sunken text-[14px] font-medium text-ink-secondary transition-colors hover:bg-white"
        >
          <span aria-hidden>⌨</span> Escribir la carga
        </button>
        <p className="mt-1.5 text-[11px] text-ink-muted">
          Primera vez con este ejercicio: elige una carga y a partir de la proxima ya se te ofrecen
          las tres opciones. {source}
        </p>
        <LoadSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          exercise={exercise}
          suggested={null}
          initial={typeof value === 'number' ? value : 0}
          increments={increments}
          fallbackIncrement={fallbackIncrement}
          onConfirm={(kg) => {
            onChange(kg)
            setSheetOpen(false)
          }}
          onSaveIncrement={onSaveIncrement}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map((o) => {
          const selected = value === o.kg
          return (
            <button
              key={o.kind}
              onClick={() => onChange(o.kg)}
              className={clsx(
                'flex flex-col items-center justify-center rounded-xl border py-2 transition-colors',
                selected
                  ? 'border-accent bg-accent-soft'
                  : o.kind === 'suggested'
                    ? 'border-hairline bg-white'
                    : 'border-hairline bg-surface-sunken',
              )}
            >
              <span
                className={clsx(
                  'num leading-none',
                  o.kind === 'suggested' ? 'text-[20px] font-semibold' : 'text-[16px] font-medium',
                  selected ? 'text-accent-strong' : 'text-ink',
                )}
              >
                {fmt(o.kg)}
              </span>
              <span
                className={clsx(
                  'mt-1 text-[10px] leading-none',
                  selected ? 'text-accent-strong' : 'text-ink-muted',
                )}
              >
                {o.kind === 'suggested' ? 'Sugerido' : o.delta}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <button
          onClick={() => setSheetOpen(true)}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors',
            isCustom
              ? 'border-accent bg-accent-soft text-accent-strong'
              : 'border-hairline bg-white text-ink-secondary hover:bg-surface-sunken',
          )}
        >
          <span aria-hidden>⌨</span>
          {isCustom ? `${fmt(value as number)} kg` : 'Otro'}
        </button>
        <span className="min-w-0 flex-1 truncate text-[11px] text-ink-muted">{source}</span>
      </div>

      {/* Comparacion con la ultima vez: el verde esta reservado a esto */}
      {typeof value === 'number' && lastWeight !== undefined && value !== lastWeight && (
        <p className="mt-1.5 text-[11px] font-medium text-[#17916a]">
          {value > lastWeight ? '+' : '−'}
          {fmt(Math.abs(value - lastWeight))} kg respecto a la ultima vez
        </p>
      )}

      <LoadSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        exercise={exercise}
        suggested={base}
        initial={typeof value === 'number' ? value : base}
        increments={increments}
        fallbackIncrement={fallbackIncrement}
        onConfirm={(kg) => {
          onChange(kg)
          setSheetOpen(false)
        }}
        onSaveIncrement={onSaveIncrement}
      />
    </div>
  )
}

/* ── Hoja de carga: teclado propio y salto del ejercicio ───────────────── */

function LoadSheet({
  open,
  onClose,
  exercise,
  suggested,
  initial,
  increments,
  fallbackIncrement,
  onConfirm,
  onSaveIncrement,
}: {
  open: boolean
  onClose: () => void
  exercise: Exercise
  suggested: number | null
  initial: number
  increments: Record<string, number>
  fallbackIncrement: number
  onConfirm: (kg: number) => void
  onSaveIncrement: (exerciseId: string, kg: number) => void
}) {
  // Se teclea con coma, como se lee en Espana; se convierte al confirmar
  const [text, setText] = useState(() => fmt(initial))
  const [customStep, setCustomStep] = useState('')
  const [customStepOpen, setCustomStepOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setText(initial > 0 ? fmt(initial) : '')
      setCustomStepOpen(false)
      setCustomStep('')
    }
  }, [open, initial])

  const parsed = Number(text.replace(',', '.'))
  const kg = Number.isFinite(parsed) && text !== '' ? parsed : null
  const increment = incrementFor(exercise, increments, fallbackIncrement)
  const options = incrementOptions(exercise, increments)
  const active = increments[exercise.id] ?? increment

  const press = (key: string) => {
    setText((t) => {
      if (key === '⌫') return t.slice(0, -1)
      if (key === ',') return t.includes(',') ? t : (t === '' ? '0,' : t + ',')
      if (t === '0') return key
      // Sin limite duro, pero evitamos cadenas absurdas
      return t.length >= 6 ? t : t + key
    })
  }

  const diff = kg !== null && suggested !== null ? kg - suggested : null

  return (
    <Sheet open={open} onClose={onClose} title="Ajustar carga">
      <div className="space-y-4">
        {/* Peso siempre visible */}
        <div className="rounded-xl border border-hairline bg-surface-sunken p-4 text-center">
          <div className="num text-[34px] leading-none font-semibold text-ink">
            {text === '' ? '—' : text} <span className="text-[18px] font-medium text-ink-secondary">kg</span>
          </div>
          {suggested !== null && (
            <div className="mt-1.5 text-[12px] text-ink-muted">
              Sugerido {fmt(suggested)} kg
              {diff !== null && diff !== 0 && (
                <span className="text-ink-secondary">
                  {' '}
                  · {diff > 0 ? '+' : '−'}
                  {fmt(Math.abs(diff))} sobre el sugerido
                </span>
              )}
            </div>
          )}
        </div>

        {/* Teclado propio: cifras grandes y coma decimal, sin depender del
            teclado del sistema, que en movil tapa media pantalla */}
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'].map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              className={clsx(
                'num h-12 rounded-xl border border-hairline text-[19px] transition-colors active:bg-surface-sunken',
                k === '⌫' ? 'bg-surface-sunken text-ink-secondary' : 'bg-white',
                k === ',' ? 'text-ink-secondary' : 'text-ink',
              )}
            >
              {k}
            </button>
          ))}
        </div>

        {/* Salto del ejercicio */}
        <div className="rounded-xl border border-hairline p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-[12px] font-semibold text-ink">Salto de este ejercicio</h4>
            <span className="text-[11px] text-ink-muted">
              {EQUIPMENT_LABEL[exercise.equipment]}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {options.map((s) => (
              <button
                key={s}
                onClick={() => {
                  onSaveIncrement(exercise.id, s)
                  setCustomStepOpen(false)
                }}
                className={clsx(
                  'num rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors',
                  active === s
                    ? 'border-accent bg-accent-soft text-accent-strong'
                    : 'border-hairline bg-white text-ink-secondary hover:bg-surface-sunken',
                )}
              >
                {fmt(s)}
              </button>
            ))}
            <button
              onClick={() => setCustomStepOpen((o) => !o)}
              className={clsx(
                'rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors',
                customStepOpen
                  ? 'border-accent bg-accent-soft text-accent-strong'
                  : 'border-hairline bg-white text-ink-secondary hover:bg-surface-sunken',
              )}
            >
              Otro
            </button>
          </div>

          {customStepOpen && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={customStep}
                onChange={(e) => {
                  const v = e.target.value
                  if (/^\d*[.,]?\d*$/.test(v)) setCustomStep(v)
                }}
                placeholder="Ej. 1,5"
                className="num h-10 flex-1 rounded-lg border border-hairline bg-white px-3 text-[14px] text-ink focus:border-accent focus:outline-none"
              />
              <button
                onClick={() => {
                  const n = Number(customStep.replace(',', '.'))
                  if (Number.isFinite(n) && n > 0) {
                    onSaveIncrement(exercise.id, n)
                    setCustomStepOpen(false)
                    setCustomStep('')
                  }
                }}
                disabled={!(Number(customStep.replace(',', '.')) > 0)}
                className="h-10 rounded-lg bg-accent px-3 text-[13px] font-medium text-white disabled:opacity-40"
              >
                Fijar
              </button>
            </div>
          )}

          <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
            Se guarda en {exercise.name.es}: las proximas semanas las cargas laterales ya vienen de{' '}
            {fmt(active)} en {fmt(active)}. Puedes cambiarlo cuando quieras desde aqui.
          </p>
        </div>

        <button
          onClick={() => {
            if (kg === null) return
            // Se respeta lo tecleado tal cual: si escribes 51 en una polea de 5
            // es porque tu maquina lo permite, y forzar un redondeo seria pelear
            // contra el usuario en su propio gimnasio.
            onConfirm(kg)
          }}
          disabled={kg === null}
          className="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-40"
        >
          {kg === null ? 'Escribe una carga' : `Usar ${fmt(kg)} kg`}
        </button>

        {kg !== null && increment > 0 && snapToIncrement(kg, increment) !== kg && (
          <p className="text-[11px] leading-relaxed text-ink-muted">
            Con saltos de {fmt(increment)} kg, las cargas cercanas serian{' '}
            {fmt(snapToIncrement(kg, increment))} kg. Se usara lo que has escrito.
          </p>
        )}
      </div>
    </Sheet>
  )
}
