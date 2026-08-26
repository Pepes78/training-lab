import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import type { Exercise } from '@/types/catalog'
import {
  fmt,
  isCustomLadder,
  ladderFor,
  ladderPreview,
  ladderSource,
  loadOptions,
  platePosition,
  snapToLadder,
  usesPlateNumbers,
  type LoadLadder,
} from '@/lib/increments'
import { Sheet } from './ui'

/* ============================================================================
 *  Control de carga
 * ----------------------------------------------------------------------------
 *  Tres cargas concretas que el aparato admite de verdad, con la sugerida en el
 *  centro y la DIFERENCIA REAL a cada lado. El numero ya dice si sube o baja,
 *  asi que no hacen falta etiquetas de esfuerzo.
 *
 *  Las cargas salen de la escalera del ejercicio (primera carga + salto), no de
 *  un salto contando desde cero: una pila cuyo primer disco pesa 5 y sube de 8
 *  en 8 da 5, 13, 21, y contar desde cero descuadraria todos los numeros.
 * ========================================================================== */

interface Props {
  exercise: Exercise
  /** Carga sugerida por el motor de progresion. null la primera vez. */
  suggested: number | null
  value: number | ''
  onChange: (kg: number) => void
  /** Carga de la ultima vez, para la comparacion en verde. */
  lastWeight?: number
  ladders: Record<string, LoadLadder>
  fallbackStep: number
  onSaveLadder: (exerciseId: string, ladder: LoadLadder) => void
  onResetLadder: (exerciseId: string) => void
}

export function WeightPicker({
  exercise,
  suggested,
  value,
  onChange,
  lastWeight,
  ladders,
  fallbackStep,
  onSaveLadder,
  onResetLadder,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const ladder = ladderFor(exercise, ladders, fallbackStep)
  const custom = isCustomLadder(exercise, ladders)
  const source = ladderSource(exercise, ladder, custom)
  const byPlates = usesPlateNumbers(exercise)

  // Sin referencia previa no hay tres cargas que ofrecer: proponer la carga
  // minima como "sugerida" seria inventarse un dato.
  const base = suggested ?? (typeof value === 'number' && value > 0 ? value : null)
  const options = useMemo(() => (base === null ? [] : loadOptions(base, ladder)), [base, ladder])

  const isCustomWeight = typeof value === 'number' && !options.some((o) => o.kg === value)
  const selectedPlate = byPlates && typeof value === 'number' ? platePosition(value, ladder) : null

  const sheet = (
    <LoadSheet
      open={sheetOpen}
      onClose={() => setSheetOpen(false)}
      exercise={exercise}
      suggested={base}
      initial={typeof value === 'number' ? value : (base ?? 0)}
      ladder={ladder}
      custom={custom}
      onConfirm={(kg) => {
        onChange(kg)
        setSheetOpen(false)
      }}
      onSaveLadder={onSaveLadder}
      onResetLadder={onResetLadder}
    />
  )

  if (base === null) {
    return (
      <div>
        <button
          onClick={() => setSheetOpen(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-hairline bg-surface-sunken text-[14px] font-medium text-ink-secondary transition-colors hover:bg-white"
        >
          <span aria-hidden>&#9000;</span> Escribir la carga
        </button>
        <p className="mt-1.5 text-[11px] text-ink-muted">
          Primera vez con este ejercicio: elige una carga y a partir de la proxima ya se te ofrecen
          las tres opciones. {source}
        </p>
        {sheet}
      </div>
    )
  }

  return (
    <div>
      <div className={clsx('grid gap-1.5', options.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
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
                {o.kg === 0 ? 'PC' : fmt(o.kg)}
              </span>
              <span
                className={clsx(
                  'mt-1 text-[10px] leading-none',
                  selected ? 'text-accent-strong' : 'text-ink-muted',
                )}
              >
                {o.kind === 'suggested' ? 'Sugerido' : o.delta}
              </span>
              {/* En una pila se lee el numero de disco, no los kilos */}
              {byPlates && o.plate !== null && (
                <span
                  className={clsx(
                    'num mt-0.5 text-[10px] leading-none',
                    selected ? 'text-accent-strong' : 'text-ink-muted',
                  )}
                >
                  disco {o.plate}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <button
          onClick={() => setSheetOpen(true)}
          className={clsx(
            'flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors',
            isCustomWeight
              ? 'border-accent bg-accent-soft text-accent-strong'
              : 'border-hairline bg-white text-ink-secondary hover:bg-surface-sunken',
          )}
        >
          <span aria-hidden>&#9000;</span>
          {isCustomWeight ? `${fmt(value as number)} kg` : 'Otro'}
        </button>
        <span className="min-w-0 flex-1 truncate text-[11px] text-ink-muted">
          {source}
          {selectedPlate !== null && ` · disco ${selectedPlate}`}
        </span>
      </div>

      {/* Comparacion con la ultima vez: el verde esta reservado a esto */}
      {typeof value === 'number' && lastWeight !== undefined && value !== lastWeight && (
        <p className="mt-1.5 text-[11px] font-medium text-[#17916a]">
          {value > lastWeight ? '+' : '−'}
          {fmt(Math.abs(value - lastWeight))} kg respecto a la ultima vez
        </p>
      )}

      {sheet}
    </div>
  )
}

/* ── Hoja de carga: teclado propio y escalera del ejercicio ────────────── */

function LoadSheet({
  open,
  onClose,
  exercise,
  suggested,
  initial,
  ladder,
  custom,
  onConfirm,
  onSaveLadder,
  onResetLadder,
}: {
  open: boolean
  onClose: () => void
  exercise: Exercise
  suggested: number | null
  initial: number
  ladder: LoadLadder
  custom: boolean
  onConfirm: (kg: number) => void
  onSaveLadder: (exerciseId: string, ladder: LoadLadder) => void
  onResetLadder: (exerciseId: string) => void
}) {
  const [text, setText] = useState(() => fmt(initial))
  const [baseText, setBaseText] = useState(() => fmt(ladder.base))
  const [stepText, setStepText] = useState(() => fmt(ladder.step))

  useEffect(() => {
    if (open) {
      setText(initial > 0 ? fmt(initial) : '')
      setBaseText(fmt(ladder.base))
      setStepText(fmt(ladder.step))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial])

  const num = (t: string): number | null => {
    const n = Number(t.replace(',', '.'))
    return t !== '' && Number.isFinite(n) ? n : null
  }

  const kg = num(text)
  const draftBase = num(baseText)
  const draftStep = num(stepText)
  const draft: LoadLadder =
    draftBase !== null && draftStep !== null && draftStep > 0
      ? { base: Math.max(0, draftBase), step: draftStep }
      : ladder

  const preview = ladderPreview(draft, 6)
  const byPlates = usesPlateNumbers(exercise)

  const press = (key: string) => {
    setText((t) => {
      if (key === 'del') return t.slice(0, -1)
      if (key === ',') return t.includes(',') ? t : t === '' ? '0,' : t + ','
      if (t === '0') return key
      return t.length >= 6 ? t : t + key
    })
  }

  const diff = kg !== null && suggested !== null ? kg - suggested : null
  const snapped = kg !== null ? snapToLadder(kg, draft) : null
  const plate = kg !== null ? platePosition(kg, draft) : null

  const commitLadder = () => {
    if (draftBase === null || draftStep === null || draftStep <= 0) return
    onSaveLadder(exercise.id, { base: Math.max(0, draftBase), step: draftStep })
  }

  return (
    <Sheet open={open} onClose={onClose} title="Ajustar carga">
      <div className="space-y-4">
        {/*
          Todo lo que hay por encima del teclado tiene altura FIJA. Antes el
          aviso de carga cercana aparecia y desaparecia segun lo tecleado, y las
          teclas subian y bajaban bajo el dedo: imposible acertar los numeros.
        */}
        <div className="rounded-xl border border-hairline bg-surface-sunken p-4 text-center">
          <div className="num text-[34px] leading-none font-semibold text-ink">
            {text === '' ? '—' : text}{' '}
            <span className="text-[18px] font-medium text-ink-secondary">kg</span>
          </div>
          <div className="mt-1.5 flex h-4 items-center justify-center text-[12px] text-ink-muted">
            {suggested !== null && (
              <span>
                Sugerido {fmt(suggested)} kg
                {diff !== null && diff !== 0 && (
                  <span className="text-ink-secondary">
                    {' · '}
                    {diff > 0 ? '+' : '−'}
                    {fmt(Math.abs(diff))} sobre el sugerido
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="mt-1 flex h-4 items-center justify-center text-[11px]">
            {kg !== null && byPlates && plate !== null && (
              <span className="num text-accent-strong">Disco {plate}</span>
            )}
            {kg !== null && plate === null && snapped !== null && snapped !== kg && (
              <span className="num text-ink-muted">
                Fuera de la escalera · la mas cercana es {fmt(snapped)} kg
              </span>
            )}
          </div>
        </div>

        {/* Teclado propio: en el movil el del sistema tapa media pantalla */}
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'].map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              className={clsx(
                'num h-12 rounded-xl border border-hairline text-[19px] transition-colors active:bg-surface-sunken',
                k === 'del' ? 'bg-surface-sunken text-ink-secondary' : 'bg-white',
                k === ',' ? 'text-ink-secondary' : 'text-ink',
              )}
              aria-label={k === 'del' ? 'Borrar' : k}
            >
              {k === 'del' ? '⌫' : k}
            </button>
          ))}
        </div>

        <button
          onClick={() => kg !== null && onConfirm(kg)}
          disabled={kg === null}
          className="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-40"
        >
          {kg === null ? 'Escribe una carga' : `Usar ${fmt(kg)} kg`}
        </button>

        {/* La escalera va DEBAJO del teclado a proposito: al editarla crece, y
            aqui ya no puede arrastrar las teclas. */}
        <div className="rounded-xl border border-hairline p-3">
          <h4 className="text-[12px] font-semibold text-ink">Como carga este aparato</h4>
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
            Casi ninguna pila empieza en cero. Pon la carga mas baja que admite y lo que sube de una
            posicion a la siguiente, y comprueba abajo que coincide con lo que pone en el aparato.
          </p>

          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium tracking-wide text-ink-muted uppercase">
                Primera carga
              </span>
              <span className="relative flex items-center">
                <input
                  type="text"
                  inputMode="decimal"
                  value={baseText}
                  onChange={(e) => {
                    if (/^\d*[.,]?\d*$/.test(e.target.value)) setBaseText(e.target.value)
                  }}
                  onBlur={commitLadder}
                  className="num h-10 w-full rounded-lg border border-hairline bg-white px-3 pr-8 text-[14px] text-ink focus:border-accent focus:outline-none"
                />
                <span className="pointer-events-none absolute right-3 text-[11px] text-ink-muted">
                  kg
                </span>
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium tracking-wide text-ink-muted uppercase">
                Salto
              </span>
              <span className="relative flex items-center">
                <input
                  type="text"
                  inputMode="decimal"
                  value={stepText}
                  onChange={(e) => {
                    if (/^\d*[.,]?\d*$/.test(e.target.value)) setStepText(e.target.value)
                  }}
                  onBlur={commitLadder}
                  className="num h-10 w-full rounded-lg border border-hairline bg-white px-3 pr-8 text-[14px] text-ink focus:border-accent focus:outline-none"
                />
                <span className="pointer-events-none absolute right-3 text-[11px] text-ink-muted">
                  kg
                </span>
              </span>
            </label>
          </div>

          {preview.length > 0 && (
            <div className="mt-2.5 rounded-lg bg-surface-sunken px-2.5 py-2">
              <div className="text-[10px] font-medium tracking-wide text-ink-muted uppercase">
                {byPlates ? 'Discos 1 a 6' : 'Primeras cargas'}
              </div>
              <div className="num mt-1 text-[13px] text-ink">
                {preview.map((v) => fmt(v)).join(' · ')} …
              </div>
            </div>
          )}

          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={commitLadder}
              className="h-9 rounded-lg bg-accent px-3 text-[12px] font-medium text-white"
            >
              Guardar en el ejercicio
            </button>
            {custom && (
              <button
                onClick={() => {
                  onResetLadder(exercise.id)
                  onClose()
                }}
                className="h-9 rounded-lg border border-hairline px-3 text-[12px] font-medium text-ink-secondary"
              >
                Restablecer
              </button>
            )}
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
            Se guarda en {exercise.name.es}: las proximas semanas las cargas ya salen de esta
            escalera.
          </p>
        </div>
      </div>
    </Sheet>
  )
}
