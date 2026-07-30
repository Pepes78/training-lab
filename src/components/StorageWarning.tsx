import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isIOS, requestPersistence, type StorageStatus } from '@/lib/storage'

/* ============================================================================
 *  Aviso de almacenamiento en riesgo
 * ----------------------------------------------------------------------------
 *  Solo aparece cuando hay motivo real de preocupacion: en iOS, abierta como
 *  pestana de Safari en lugar de como app instalada. En ese escenario WebKit
 *  borra el almacenamiento tras 7 dias sin visitas y se pierde el historial.
 *
 *  Se puede descartar, pero la preferencia se guarda por sesion a proposito:
 *  si sigues sin instalarla, el aviso vuelve. El riesgo no ha desaparecido.
 * ========================================================================== */

const DISMISS_KEY = 'tl-storage-warning-dismissed'

export function StorageWarning() {
  const [status, setStatus] = useState<StorageStatus | null>(null)
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === '1',
  )

  useEffect(() => {
    void requestPersistence().then(setStatus)
  }, [])

  if (!status || dismissed) return null

  // El unico caso que justifica interrumpir: iOS sin instalar.
  // En escritorio, aunque persist() se deniegue, no hay borrado por inactividad.
  const atRisk = isIOS() && !status.installed
  if (!atRisk) return null

  return (
    <div className="mb-4 rounded-xl border border-[#f5e3b0] bg-[#fff8e6] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#8a6200]">
            <span aria-hidden>!</span> Anade la app a la pantalla de inicio
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[#8a6200]">
            Safari borra los datos guardados de una web tras <strong>7 dias sin abrirla</strong>. Las
            apps anadidas a la pantalla de inicio estan exentas.
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[#8a6200]">
            Pulsa <strong>Compartir</strong> (el cuadrado con la flecha) y elige{' '}
            <strong>Anadir a pantalla de inicio</strong>. Para tenerlo a salvo del todo, configura
            ademas la{' '}
            <Link to="/ajustes" className="underline">
              sincronizacion
            </Link>
            .
          </p>
        </div>
        <button
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, '1')
            setDismissed(true)
          }}
          aria-label="Ocultar aviso"
          className="shrink-0 text-[13px] text-[#8a6200] hover:opacity-70"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
