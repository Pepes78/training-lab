import { useState } from 'react'
import clsx from 'clsx'

/* ============================================================================
 *  Selector de fichas
 * ----------------------------------------------------------------------------
 *  Repeticiones y RIR se eligen de un toque en lugar de teclearse: en el
 *  gimnasio se registra de pie, con una mano y a veces sudando, y abrir el
 *  teclado del sistema para escribir "8" es desproporcionado.
 *
 *  Siempre queda una salida a valor libre, porque un rango prescrito no cubre
 *  la serie en la que te pasas o te quedas corto.
 * ========================================================================== */

/** Valores a ofrecer para un rango, como mucho `max` fichas. */
export function rangeValues([min, max]: [number, number], maxChips = 5): number[] {
  const span = max - min
  if (span <= 0) return [min]
  if (span + 1 <= maxChips) {
    return Array.from({ length: span + 1 }, (_, i) => min + i)
  }
  // Rango ancho (12-20): se reparten las fichas incluyendo siempre los extremos
  const step = span / (maxChips - 1)
  const out = new Set<number>()
  for (let i = 0; i < maxChips; i++) out.add(Math.round(min + step * i))
  return [...out].sort((a, b) => a - b)
}

export function ChipSelect({
  label,
  values,
  value,
  onChange,
  suffix,
  allowCustom = true,
}: {
  label: string
  values: number[]
  value: number | ''
  onChange: (v: number | '') => void
  suffix?: string
  allowCustom?: boolean
}) {
  const [customOpen, setCustomOpen] = useState(false)
  const [custom, setCustom] = useState('')

  const isCustom = value !== '' && !values.includes(value)

  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-[11px] font-medium tracking-wide text-ink-muted uppercase">
          {label}
        </span>
        {suffix && <span className="text-[11px] text-ink-muted">{suffix}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <button
            key={v}
            onClick={() => {
              onChange(v)
              setCustomOpen(false)
            }}
            className={clsx(
              'num h-10 min-w-[44px] rounded-lg border px-3 text-[15px] font-medium transition-colors',
              value === v
                ? 'border-accent bg-accent-soft text-accent-strong'
                : 'border-hairline bg-white text-ink hover:bg-surface-sunken',
            )}
          >
            {v}
          </button>
        ))}
        {allowCustom && (
          <button
            onClick={() => setCustomOpen((o) => !o)}
            className={clsx(
              'h-10 rounded-lg border px-3 text-[13px] font-medium transition-colors',
              isCustom || customOpen
                ? 'border-accent bg-accent-soft text-accent-strong'
                : 'border-hairline bg-white text-ink-secondary hover:bg-surface-sunken',
            )}
          >
            {isCustom ? value : 'Otro'}
          </button>
        )}
      </div>

      {customOpen && (
        <div className="mt-1.5 flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            value={custom}
            onChange={(e) => {
              if (/^\d*$/.test(e.target.value)) setCustom(e.target.value)
            }}
            placeholder="Escribe"
            className="num h-10 w-24 rounded-lg border border-hairline bg-white px-3 text-[15px] text-ink focus:border-accent focus:outline-none"
          />
          <button
            onClick={() => {
              const n = Number(custom)
              if (custom !== '' && Number.isFinite(n)) {
                onChange(n)
                setCustomOpen(false)
                setCustom('')
              }
            }}
            disabled={custom === ''}
            className="h-10 rounded-lg bg-accent px-3 text-[13px] font-medium text-white disabled:opacity-40"
          >
            Fijar
          </button>
        </div>
      )}
    </div>
  )
}
