import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  bumpOutboxAttempts,
  clearOutboxEntry,
  getDB,
  listOutbox,
  type OutboxEntry,
} from './db'

/* ============================================================================
 *  Sincronizacion con Supabase
 * ----------------------------------------------------------------------------
 *  Modelo: local-first con cola de salida (outbox). IndexedDB es la fuente de
 *  verdad mientras entrenas; Supabase es la copia compartida entre dispositivos.
 *
 *  SEGURIDAD
 *  La clave anonima es publica por diseno y puede vivir en el repo, pero SOLO
 *  es segura con Row Level Security activado y sesion iniciada: cada fila
 *  lleva user_id y la politica exige auth.uid() = user_id. Sin RLS, cualquiera
 *  con la clave puede leer y borrar tus datos. Ver supabase/schema.sql.
 * ========================================================================== */

/** Nombre de tabla local -> tabla remota. */
const TABLE_MAP: Record<string, string> = {
  routines: 'routines',
  cycles: 'cycles',
  sessions: 'sessions',
  setLogs: 'set_logs',
  weekOverrides: 'week_overrides',
  bodyMetrics: 'body_metrics',
}

/** camelCase local -> snake_case remoto, por tabla. */
const COLUMN_MAP: Record<string, Record<string, string>> = {
  routines: { schemaVersion: 'schema_version' },
  cycles: {
    routineId: 'routine_id',
    routineSnapshot: 'routine_snapshot',
    startDate: 'start_date',
    targetWeeks: 'target_weeks',
    createdAt: 'created_at',
  },
  sessions: {
    cycleId: 'cycle_id',
    dayId: 'day_id',
    startedAt: 'started_at',
    completedAt: 'completed_at',
    durationMin: 'duration_min',
    perceivedEffort: 'perceived_effort',
  },
  setLogs: {
    sessionId: 'session_id',
    slotId: 'slot_id',
    exerciseId: 'exercise_id',
    setIndex: 'set_index',
    weightKg: 'weight_kg',
    isWarmup: 'is_warmup',
    completedAt: 'completed_at',
  },
  weekOverrides: {
    cycleId: 'cycle_id',
    slotId: 'slot_id',
    replacementExerciseId: 'replacement_exercise_id',
    createdAt: 'created_at',
  },
  bodyMetrics: { createdAt: 'created_at' },
}

function toRemote(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const map = COLUMN_MAP[table] ?? {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) out[map[k] ?? k] = v
  return out
}

function toLocal(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const map = COLUMN_MAP[table] ?? {}
  const inverse = Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (k === 'user_id') continue
    out[inverse[k] ?? k] = v
  }
  return out
}

let client: SupabaseClient | null = null
let clientKey = ''

/** Configuracion incrustada en el build (.env.production). */
export function envConfig(): { url: string; key: string } {
  return {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    key: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  }
}

/**
 * true si la app viene preconfigurada de fabrica. En ese caso el usuario no
 * tiene que pegar ninguna clave: le basta con su correo.
 */
export function hasEnvConfig(): boolean {
  const c = envConfig()
  return Boolean(c.url && c.key)
}

/**
 * Cliente de Supabase, o null si no esta configurado.
 * La configuracion sale de las variables de entorno de compilacion y, si no,
 * de los ajustes guardados en el dispositivo.
 */
export function getClient(url?: string, anonKey?: string): SupabaseClient | null {
  const finalUrl = url || import.meta.env.VITE_SUPABASE_URL || ''
  const finalKey = anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  if (!finalUrl || !finalKey) return null

  const key = `${finalUrl}|${finalKey}`
  if (client && clientKey === key) return client

  client = createClient(finalUrl, finalKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      /*
       * PKCE y no el flujo implicito por defecto.
       *
       * El flujo implicito devuelve el token en el fragmento de la URL
       * (#access_token=...), que es justo donde HashRouter guarda la ruta: la
       * app interpretaria el token como una ruta y la sesion se perderia.
       * PKCE devuelve ?code=... en la query, antes del #, y no hay colision.
       */
      flowType: 'pkce',
      detectSessionInUrl: true,
    },
  })
  clientKey = key
  return client
}

/**
 * Limpia el ?code= de la barra de direcciones despues de canjear el enlace
 * magico. Sin esto el codigo queda visible y se reenvia si recargas la pagina.
 */
export function cleanAuthParamsFromUrl() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (!url.searchParams.has('code') && !url.searchParams.has('error')) return
  url.searchParams.delete('code')
  url.searchParams.delete('error')
  url.searchParams.delete('error_description')
  window.history.replaceState({}, '', url.toString())
}

export type SyncStatus = 'disabled' | 'offline' | 'signed-out' | 'syncing' | 'synced' | 'error'

export interface SyncResult {
  status: SyncStatus
  pushed: number
  pulled: number
  pending: number
  message?: string
}

/** Sube la cola pendiente. Cada entrada se borra solo si su escritura confirma. */
async function push(sb: SupabaseClient, userId: string): Promise<{ pushed: number; failed: number }> {
  const queue = await listOutbox()
  let pushed = 0
  let failed = 0

  for (const entry of queue) {
    const remoteTable = TABLE_MAP[entry.table]
    if (!remoteTable) {
      await clearOutboxEntry(entry.id)
      continue
    }

    try {
      if (entry.op === 'delete') {
        const { id } = entry.payload as { id: string }
        const { error } = await sb.from(remoteTable).delete().eq('id', id).eq('user_id', userId)
        if (error) throw error
      } else {
        const row = toRemote(entry.table, entry.payload as Record<string, unknown>)
        row.user_id = userId
        const { error } = await sb.from(remoteTable).upsert(row, { onConflict: 'id' })
        if (error) throw error
      }
      await clearOutboxEntry(entry.id)
      pushed++
    } catch {
      // Tras 5 intentos fallidos se descarta para no bloquear la cola entera.
      if (entry.attempts >= 5) await clearOutboxEntry(entry.id)
      else await bumpOutboxAttempts(entry as OutboxEntry)
      failed++
    }
  }
  return { pushed, failed }
}

/** Baja las filas remotas y las escribe en local. Ultima escritura gana. */
async function pull(sb: SupabaseClient, userId: string): Promise<number> {
  const db = await getDB()
  let pulled = 0

  for (const [localTable, remoteTable] of Object.entries(TABLE_MAP)) {
    const { data, error } = await sb.from(remoteTable).select('*').eq('user_id', userId)
    if (error || !data) continue

    for (const row of data) {
      const local = toLocal(localTable, row as Record<string, unknown>)
      await db.put(localTable as 'cycles', local as never)
      pulled++
    }
  }
  return pulled
}

export async function sync(url?: string, anonKey?: string): Promise<SyncResult> {
  const sb = getClient(url, anonKey)
  if (!sb) {
    return { status: 'disabled', pushed: 0, pulled: 0, pending: (await listOutbox()).length }
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { status: 'offline', pushed: 0, pulled: 0, pending: (await listOutbox()).length }
  }

  // getSession() espera a que el cliente haya canjeado el ?code= del enlace
  // magico, asi que este es el momento seguro para limpiar la URL.
  const { data: sessionData } = await sb.auth.getSession()
  cleanAuthParamsFromUrl()
  const userId = sessionData.session?.user.id
  if (!userId) {
    return {
      status: 'signed-out',
      pushed: 0,
      pulled: 0,
      pending: (await listOutbox()).length,
      message: 'Inicia sesion para sincronizar entre dispositivos',
    }
  }

  try {
    const { pushed, failed } = await push(sb, userId)
    const pulled = await pull(sb, userId)
    const pending = (await listOutbox()).length
    return {
      status: failed > 0 ? 'error' : 'synced',
      pushed,
      pulled,
      pending,
      message: failed > 0 ? `${failed} operaciones no se pudieron subir` : undefined,
    }
  } catch (e) {
    return {
      status: 'error',
      pushed: 0,
      pulled: 0,
      pending: (await listOutbox()).length,
      message: e instanceof Error ? e.message : 'Error de sincronizacion',
    }
  }
}

/** Envia un enlace magico al correo. No se manejan contrasenas en ningun momento. */
export async function signInWithEmail(email: string, url?: string, anonKey?: string) {
  const sb = getClient(url, anonKey)
  if (!sb) throw new Error('Supabase no esta configurado')
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  })
  if (error) throw error
}

export async function signOut(url?: string, anonKey?: string) {
  const sb = getClient(url, anonKey)
  if (sb) await sb.auth.signOut()
}

export async function currentUserEmail(url?: string, anonKey?: string): Promise<string | null> {
  const sb = getClient(url, anonKey)
  if (!sb) return null
  const { data } = await sb.auth.getSession()
  return data.session?.user.email ?? null
}
