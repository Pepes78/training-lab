import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

/* ============================================================================
 *  Barra de descanso
 * ----------------------------------------------------------------------------
 *  El descanso vive en una franja fina arriba, ocupando el sitio de la cabecera
 *  en lugar de flotar sobre el contenido: mientras corre no tapa la carga ni
 *  los botones, que es justo lo que se esta mirando entre serie y serie.
 *
 *  La cuenta va contra un instante final absoluto y no restando segundos: los
 *  navegadores moviles frenan los temporizadores con la pantalla apagada, y
 *  restando de uno en uno el reloj se quedaria corto justo al mirarlo.
 * ========================================================================== */

function beep() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
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

export function RestBar({
  seconds,
  onDone,
  onExtend,
  sound = true,
}: {
  seconds: number
  onDone: () => void
  onExtend: (extra: number) => void
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
        'relative overflow-hidden rounded-xl border px-3 py-2',
        done ? 'border-[#c9ecc9] bg-[#eefaee]' : 'border-hairline bg-white',
      )}
      role="status"
      aria-live="polite"
    >
      {/* El relleno avanza por debajo del contenido: el progreso se ve de reojo
          sin tener que leer la cifra */}
      <div
        className={clsx(
          'absolute inset-y-0 left-0 transition-[width] duration-300',
          done ? 'bg-[#0ca30c]/10' : 'bg-accent-soft',
        )}
        style={{ width: `${Math.min(100, pct)}%` }}
        aria-hidden
      />
      <div className="relative flex items-center gap-3">
        <span className="text-[11px] font-medium tracking-wide text-ink-muted uppercase">
          {done ? 'Listo' : 'Descanso'}
        </span>
        <span className="num text-[17px] leading-none font-semibold text-ink">
          {mm}:{String(ss).padStart(2, '0')}
        </span>
        <div className="ml-auto flex gap-1.5">
          <button
            onClick={() => onExtend(30)}
            className="h-8 rounded-lg border border-hairline bg-white px-2.5 text-[12px] font-medium text-ink-secondary"
          >
            +30s
          </button>
          <button
            onClick={onDone}
            className="h-8 rounded-lg bg-accent px-3 text-[12px] font-medium text-white"
          >
            Saltar
          </button>
        </div>
      </div>
    </div>
  )
}
