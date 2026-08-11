import clsx from 'clsx'
import { useEffect, useState, type ReactNode } from 'react'

/* ============================================================================
 *  Piezas de interfaz compartidas
 * ========================================================================== */

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article'
}) {
  return <Tag className={clsx('card p-4 sm:p-5', className)}>{children}</Tag>
}

export function SectionTitle({
  children,
  hint,
  action,
}: {
  children: ReactNode
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{children}</h2>
        {hint && <p className="mt-0.5 text-[12px] leading-snug text-ink-muted">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatTile({
  label,
  value,
  unit,
  delta,
  hint,
}: {
  label: string
  value: string | number
  unit?: string
  /** Variacion respecto al periodo anterior. El signo se muestra siempre. */
  delta?: { value: number; unit?: string; goodWhen?: 'up' | 'down' | 'any' }
  hint?: string
}) {
  let deltaTone = 'text-ink-secondary'
  if (delta && delta.goodWhen && delta.goodWhen !== 'any' && delta.value !== 0) {
    const isGood = delta.goodWhen === 'up' ? delta.value > 0 : delta.value < 0
    deltaTone = isGood ? 'text-[#006300]' : 'text-[#d03b3b]'
  }

  return (
    <div className="card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-[26px] font-semibold leading-none tracking-tight text-ink">{value}</span>
        {unit && <span className="text-[13px] text-ink-secondary">{unit}</span>}
      </div>
      {delta && (
        <div className={clsx('num mt-1.5 text-[12px] font-medium', deltaTone)}>
          {delta.value > 0 ? '+' : ''}
          {delta.value}
          {delta.unit ? ` ${delta.unit}` : ''}
        </div>
      )}
      {hint && <div className="mt-1 text-[11px] leading-snug text-ink-muted">{hint}</div>}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  disabled,
  type = 'button',
  className,
  title,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
  title?: string
}) {
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-accent text-white hover:bg-accent-strong border-transparent',
    secondary: 'bg-white text-ink hover:bg-surface-sunken border-hairline',
    ghost: 'bg-transparent text-ink-secondary hover:bg-surface-sunken border-transparent',
    danger: 'bg-white text-[#d03b3b] hover:bg-[#fdf2f2] border-hairline',
  }
  const sizes = {
    sm: 'h-8 px-3 text-[13px]',
    md: 'h-10 px-4 text-[14px]',
    lg: 'h-12 px-5 text-[15px]',
  }
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  icon,
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'good' | 'warning' | 'critical'
  icon?: string
}) {
  const tones = {
    neutral: 'bg-surface-sunken text-ink-secondary border-hairline',
    accent: 'bg-accent-soft text-accent-strong border-[#cfe1f9]',
    good: 'bg-[#eefaee] text-[#0a7a0a] border-[#c9ecc9]',
    warning: 'bg-[#fff8e6] text-[#8a6200] border-[#f5e3b0]',
    critical: 'bg-[#fdf2f2] text-[#a72c2c] border-[#f3cdcd]',
  }
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        tones[tone],
      )}
    >
      {/* El icono acompana siempre al color: el estado nunca se comunica solo con el tono */}
      {icon && <span aria-hidden>{icon}</span>}
      {children}
    </span>
  )
}

/**
 * Acepta coma o punto como separador decimal y devuelve null si aun no hay un
 * numero utilizable ("", "-", "," son estados intermedios validos al teclear).
 */
function parseDecimal(raw: string): number | null {
  const normalized = raw.replace(',', '.').trim()
  if (normalized === '' || normalized === '-' || normalized === '.' || normalized === '-.') return null
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

/** Digitos con un unico separador decimal y signo negativo opcional. */
const PARTIAL_NUMBER = /^-?\d*[.,]?\d*$/

/*
 * Campo numerico.
 *
 * Es un input de TEXTO, no type="number", y la razon es concreta: un
 * type="number" controlado no deja escribir decimales. Al teclear "85." el
 * navegador considera ese valor intermedio invalido y devuelve cadena vacia,
 * asi que React reescribe el campo vacio justo al pulsar el punto y es
 * imposible llegar a "85.5". Ademas, el teclado decimal en espanol ofrece coma,
 * que type="number" rechaza de plano.
 *
 * Aqui se conserva el texto tal cual se escribe y se notifica el numero solo
 * cuando ya se puede interpretar.
 */
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  placeholder,
  suffix,
  className,
}: {
  label?: string
  value: number | ''
  onChange: (v: number | '') => void
  /**
   * Aceptado pero sin efecto: el campo es de texto y no tiene incrementos.
   * Se mantiene para no tocar las llamadas existentes, que lo pasan como
   * documentacion de la granularidad esperada.
   */
  step?: number
  min?: number
  placeholder?: string
  suffix?: string
  className?: string
}) {
  const [text, setText] = useState(() => (value === '' ? '' : String(value)))

  // Sincroniza cuando el valor cambia desde fuera (reset del formulario,
  // rellenar con la sugerencia...). Se compara por valor interpretado para no
  // pisar lo que se esta escribiendo: con "85," el numero ya es 85 y el texto
  // debe quedarse como esta.
  useEffect(() => {
    const current = parseDecimal(text)
    if (value === '') {
      if (current !== null) setText('')
    } else if (current !== value) {
      setText(String(value))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handle = (raw: string) => {
    if (!PARTIAL_NUMBER.test(raw)) return // se ignora la tecla invalida
    setText(raw)
    const n = parseDecimal(raw)
    onChange(n === null ? '' : n)
  }

  return (
    <label className={clsx('block', className)}>
      {label && (
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          {label}
        </span>
      )}
      <span className="relative flex items-center">
        <input
          type="text"
          /* Teclado numerico con separador decimal en movil */
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          onChange={(e) => handle(e.target.value)}
          onBlur={() => {
            // Al salir se normaliza: "85," pasa a "85" y "" limpia el valor
            const n = parseDecimal(text)
            if (n === null) {
              setText('')
              onChange('')
            } else {
              const clamped = min !== undefined && n < min ? min : n
              setText(String(clamped))
              onChange(clamped)
            }
          }}
          className={clsx(
            'num h-11 w-full rounded-lg border border-hairline bg-white px-3 text-[15px] text-ink',
            'focus:border-accent focus:ring-2 focus:ring-accent-soft focus:outline-none',
            suffix && 'pr-9',
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 text-[12px] text-ink-muted">
            {suffix}
          </span>
        )}
      </span>
    </label>
  )
}

export function Select<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label?: string
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
  className?: string
}) {
  return (
    <label className={clsx('block', className)}>
      {label && (
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          {label}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-11 w-full rounded-lg border border-hairline bg-white px-3 text-[14px] text-ink focus:border-accent focus:ring-2 focus:ring-accent-soft focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="animate-in max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-hairline bg-white px-4 py-3">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-sunken"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-secondary">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
