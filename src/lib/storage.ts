/* ============================================================================
 *  Persistencia del almacenamiento local
 * ----------------------------------------------------------------------------
 *  Los navegadores pueden desalojar IndexedDB para liberar espacio. En iOS
 *  ademas hay una regla dura: Safari borra el almacenamiento de un sitio tras
 *  7 dias sin visitarlo.
 *
 *  Esa regla NO se aplica a las apps anadidas a la pantalla de inicio, que iOS
 *  trata como aplicacion instalada. De ahi que la app insista en instalarse:
 *  no es cosmetica, es lo que evita perder el historial.
 *
 *  navigator.storage.persist() pide al navegador que no desaloje los datos.
 *  Chrome y Firefox lo conceden cuando la app esta instalada o hay senales de
 *  uso habitual. Safari no implementa la concesion, asi que ahi la proteccion
 *  real es instalarla en la pantalla de inicio y, sobre todo, sincronizar.
 * ========================================================================== */

export interface StorageStatus {
  /** El navegador se ha comprometido a no borrar los datos por falta de espacio. */
  persisted: boolean
  /** true si la API ni siquiera existe (Safari antiguo). */
  unsupported: boolean
  /** Bytes usados, si el navegador los expone. */
  usage?: number
  quota?: number
  /** true si se esta ejecutando como app instalada y no como pestana. */
  installed: boolean
}

/** true si la app corre en modo standalone (pantalla de inicio en iOS, instalada en Android). */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false
  // iOS expone navigator.standalone; el resto usa display-mode
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

/**
 * Pide almacenamiento persistente. Idempotente: si ya estaba concedido no
 * vuelve a pedirlo. Nunca lanza; si algo falla, devuelve el estado que pueda.
 */
export async function requestPersistence(): Promise<StorageStatus> {
  const installed = isInstalled()

  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return { persisted: false, unsupported: true, installed }
  }

  try {
    let persisted = await navigator.storage.persisted()
    if (!persisted) persisted = await navigator.storage.persist()

    let usage: number | undefined
    let quota: number | undefined
    if (navigator.storage.estimate) {
      const est = await navigator.storage.estimate()
      usage = est.usage
      quota = est.quota
    }
    return { persisted, unsupported: false, usage, quota, installed }
  } catch {
    return { persisted: false, unsupported: false, installed }
  }
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Detecta iOS, incluido el iPad que se hace pasar por Mac desde iPadOS 13. */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)
}
