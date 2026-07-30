import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

/* ============================================================================
 *  Temporizador de descanso
 * ----------------------------------------------------------------------------
 *  Arranca solo al registrar una serie, con el descanso que marca la rutina.
 *
 *  Cuenta contra un instante final absoluto en lugar de restar segundos: los
 *  navegadores moviles frenan los temporizadores con la pantalla apagada, y
 *  restando de uno en uno el reloj se quedaria corto justo cuando lo miras.
 * ========================================================================== */

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    /* Sin audio disponible: el aviso visual basta */
  }
}

export function RestTimer({
  seconds,
  onDone,
  sound = true,
}: {
  seconds: number
  onDone: () => void
  sound?: boolean
}) {
  const endAt = useRef(Date.now() + seconds * 1000)
  const [remaining, setRemaining] = useState(seconds)
  const fired = useRef(false)

  useEffect(() => {
    endAt.current = Date.now() + seconds * 1000
    fired.current = false
    setRemaining(seconds)
  }, [seconds])

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.round((endAt.current - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0 && !fired.current) {
        fired.current = true
        if (sound) beep()
        if ('vibrate' in navigator) navigator.vibrate?.(200)
      }
    }
    const id = setInterval(tick, 250)
    tick()
    return () => clearInterval(id)
  }, [sound])

  const done = remaining === 0
  const mm = Math.floor(remaining / 60)
  const ss = remaining % 60
  const pct = seconds > 0 ? ((seconds - remaining) / seconds) * 100 : 100

  return (
    <div
      className={clsx(
        'fixed inset-x-3 bottom-20 z-40 rounded-xl border p-3 shadow-lg sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-72',
        done ? 'border-[#c9ecc9] bg-[#eefaee]' : 'border-hairline bg-white',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">
            {done ? 'Descanso completado' : 'Descanso'}
          </div>
          <div className="num text-[24px] leading-tight font-semibold text-ink">
            {mm}:{String(ss).padStart(2, '0')}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              endAt.current += 30_000
              setRemaining((r) => r + 30)
              fired.current = false
            }}
            className="h-9 rounded-lg border border-hairline px-2.5 text-[12px] font-medium text-ink-secondary hover:bg-surface-sunken"
          >
            +30s
          </button>
          <button
            onClick={onDone}
            className="h-9 rounded-lg bg-accent px-3 text-[12px] font-medium text-white hover:bg-accent-strong"
          >
            Listo
          </button>
        </div>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-sunken">
        <div
          className={clsx('h-1 rounded-full transition-[width] duration-300', done ? 'bg-[#0ca30c]' : 'bg-accent')}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  )
}
