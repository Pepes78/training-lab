import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { BodyMetric, Cycle, Session, SetLog, Settings, WeekOverride } from '@/types/logs'
import { DEFAULT_SETTINGS } from '@/types/logs'
import type { Routine } from '@/types/routine'

/* ============================================================================
 *  Almacen local (IndexedDB)
 * ----------------------------------------------------------------------------
 *  La app es local-first: TODA escritura entra aqui primero y la sincronizacion
 *  con Supabase ocurre despues, en segundo plano.
 *
 *  El motivo es practico: en un gimnasio la cobertura es mala y perder una
 *  serie recien registrada es el peor fallo posible. Escribiendo en local
 *  primero, la app funciona entera sin red y sincroniza cuando vuelve.
 *
 *  Cada escritura deja ademas una entrada en `outbox`, que es la cola de
 *  operaciones pendientes de subir.
 * ========================================================================== */

export interface OutboxEntry {
  id: string
  table: string
  op: 'upsert' | 'delete'
  payload: unknown
  createdAt: string
  attempts: number
}

interface TrainingDB extends DBSchema {
  routines: { key: string; value: Routine }
  cycles: { key: string; value: Cycle }
  sessions: { key: string; value: Session; indexes: { 'by-cycle': string } }
  setLogs: { key: string; value: SetLog; indexes: { 'by-session': string } }
  weekOverrides: { key: string; value: WeekOverride; indexes: { 'by-cycle': string } }
  bodyMetrics: { key: string; value: BodyMetric; indexes: { 'by-metric': string } }
  settings: { key: string; value: Settings }
  outbox: { key: string; value: OutboxEntry }
}

const DB_NAME = 'training-lab'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<TrainingDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<TrainingDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('routines', { keyPath: 'id' })
        db.createObjectStore('cycles', { keyPath: 'id' })

        const sessions = db.createObjectStore('sessions', { keyPath: 'id' })
        sessions.createIndex('by-cycle', 'cycleId')

        const setLogs = db.createObjectStore('setLogs', { keyPath: 'id' })
        setLogs.createIndex('by-session', 'sessionId')

        const overrides = db.createObjectStore('weekOverrides', { keyPath: 'id' })
        overrides.createIndex('by-cycle', 'cycleId')

        const metrics = db.createObjectStore('bodyMetrics', { keyPath: 'id' })
        metrics.createIndex('by-metric', 'metric')

        db.createObjectStore('settings')
        db.createObjectStore('outbox', { keyPath: 'id' })
      },
    })
  }
  return dbPromise
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Encola una operacion para subirla a Supabase cuando haya red. */
async function enqueue(table: string, op: OutboxEntry['op'], payload: unknown) {
  const db = await getDB()
  await db.put('outbox', {
    id: newId(),
    table,
    op,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  })
}

/* ── Rutinas ───────────────────────────────────────────────────────────── */

export async function saveRoutine(r: Routine) {
  const db = await getDB()
  await db.put('routines', r)
  await enqueue('routines', 'upsert', r)
}

export async function listRoutines(): Promise<Routine[]> {
  return (await getDB()).getAll('routines')
}

export async function deleteRoutine(id: string) {
  const db = await getDB()
  await db.delete('routines', id)
  await enqueue('routines', 'delete', { id })
}

/* ── Ciclos ────────────────────────────────────────────────────────────── */

export async function saveCycle(c: Cycle) {
  const db = await getDB()
  await db.put('cycles', c)
  await enqueue('cycles', 'upsert', c)
}

export async function listCycles(): Promise<Cycle[]> {
  return (await getDB()).getAll('cycles')
}

export async function activeCycle(): Promise<Cycle | undefined> {
  const all = await listCycles()
  return all.find((c) => c.status === 'active')
}

export interface CycleContents {
  sessions: number
  sets: number
  overrides: number
}

/** Cuenta lo que colgaria de un ciclo, para poder avisar antes de borrarlo. */
export async function cycleContents(cycleId: string): Promise<CycleContents> {
  const db = await getDB()
  const sessions = await db.getAllFromIndex('sessions', 'by-cycle', cycleId)
  const sessionIds = new Set(sessions.map((s) => s.id))
  const allSets = await db.getAll('setLogs')
  const overrides = await db.getAllFromIndex('weekOverrides', 'by-cycle', cycleId)
  return {
    sessions: sessions.length,
    sets: allSets.filter((s) => sessionIds.has(s.sessionId) && !s.isWarmup).length,
    overrides: overrides.length,
  }
}

/**
 * Borra un ciclo y TODO lo que cuelga de el: sesiones, series y sustituciones.
 *
 * El borrado en cascada es el punto entero de esta operacion. Quitar solo la
 * fila del ciclo dejaria las series huerfanas, que seguirian sumando en el
 * volumen semanal y en los records: exactamente lo que se quiere evitar al
 * descartar un ciclo de pruebas.
 */
export async function deleteCycle(cycleId: string) {
  const db = await getDB()
  const sessions = await db.getAllFromIndex('sessions', 'by-cycle', cycleId)
  const sessionIds = new Set(sessions.map((s) => s.id))

  const allSets = await db.getAll('setLogs')
  for (const set of allSets) {
    if (!sessionIds.has(set.sessionId)) continue
    await db.delete('setLogs', set.id)
    await enqueue('setLogs', 'delete', { id: set.id })
  }

  for (const session of sessions) {
    await db.delete('sessions', session.id)
    await enqueue('sessions', 'delete', { id: session.id })
  }

  const overrides = await db.getAllFromIndex('weekOverrides', 'by-cycle', cycleId)
  for (const o of overrides) {
    await db.delete('weekOverrides', o.id)
    await enqueue('weekOverrides', 'delete', { id: o.id })
  }

  await db.delete('cycles', cycleId)
  await enqueue('cycles', 'delete', { id: cycleId })
}

/* ── Sesiones ──────────────────────────────────────────────────────────── */

export async function saveSession(s: Session) {
  const db = await getDB()
  await db.put('sessions', s)
  await enqueue('sessions', 'upsert', s)
}

export async function listSessions(cycleId?: string): Promise<Session[]> {
  const db = await getDB()
  if (!cycleId) return db.getAll('sessions')
  return db.getAllFromIndex('sessions', 'by-cycle', cycleId)
}

/* ── Series ────────────────────────────────────────────────────────────── */

export async function saveSetLog(s: SetLog) {
  const db = await getDB()
  await db.put('setLogs', s)
  await enqueue('setLogs', 'upsert', s)
}

export async function deleteSetLog(id: string) {
  const db = await getDB()
  await db.delete('setLogs', id)
  await enqueue('setLogs', 'delete', { id })
}

export async function listSetLogs(sessionId?: string): Promise<SetLog[]> {
  const db = await getDB()
  if (!sessionId) return db.getAll('setLogs')
  return db.getAllFromIndex('setLogs', 'by-session', sessionId)
}

/* ── Sustituciones semanales ───────────────────────────────────────────── */

export async function saveOverride(o: WeekOverride) {
  const db = await getDB()
  await db.put('weekOverrides', o)
  await enqueue('weekOverrides', 'upsert', o)
}

export async function deleteOverride(id: string) {
  const db = await getDB()
  await db.delete('weekOverrides', id)
  await enqueue('weekOverrides', 'delete', { id })
}

export async function listOverrides(cycleId?: string): Promise<WeekOverride[]> {
  const db = await getDB()
  if (!cycleId) return db.getAll('weekOverrides')
  return db.getAllFromIndex('weekOverrides', 'by-cycle', cycleId)
}

/* ── Metricas corporales ───────────────────────────────────────────────── */

export async function saveBodyMetric(m: BodyMetric) {
  const db = await getDB()
  await db.put('bodyMetrics', m)
  await enqueue('bodyMetrics', 'upsert', m)
}

export async function deleteBodyMetric(id: string) {
  const db = await getDB()
  await db.delete('bodyMetrics', id)
  await enqueue('bodyMetrics', 'delete', { id })
}

export async function listBodyMetrics(): Promise<BodyMetric[]> {
  return (await getDB()).getAll('bodyMetrics')
}

/* ── Ajustes ───────────────────────────────────────────────────────────── */

export async function loadSettings(): Promise<Settings> {
  const db = await getDB()
  const s = await db.get('settings', 'app')
  return s ? { ...DEFAULT_SETTINGS, ...s } : DEFAULT_SETTINGS
}

export async function saveSettings(s: Settings) {
  const db = await getDB()
  await db.put('settings', s, 'app')
}

/* ── Cola de sincronizacion ────────────────────────────────────────────── */

export async function listOutbox(): Promise<OutboxEntry[]> {
  return (await getDB()).getAll('outbox')
}

export async function clearOutboxEntry(id: string) {
  const db = await getDB()
  await db.delete('outbox', id)
}

export async function bumpOutboxAttempts(entry: OutboxEntry) {
  const db = await getDB()
  await db.put('outbox', { ...entry, attempts: entry.attempts + 1 })
}

/* ── Exportar / importar ───────────────────────────────────────────────── */

export interface Backup {
  version: 1
  exportedAt: string
  routines: Routine[]
  cycles: Cycle[]
  sessions: Session[]
  setLogs: SetLog[]
  weekOverrides: WeekOverride[]
  bodyMetrics: BodyMetric[]
  settings: Settings
}

/** Copia completa en JSON. Tus datos son tuyos y salen de aqui sin fricciones. */
export async function exportAll(): Promise<Backup> {
  const db = await getDB()
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    routines: await db.getAll('routines'),
    cycles: await db.getAll('cycles'),
    sessions: await db.getAll('sessions'),
    setLogs: await db.getAll('setLogs'),
    weekOverrides: await db.getAll('weekOverrides'),
    bodyMetrics: await db.getAll('bodyMetrics'),
    settings: await loadSettings(),
  }
}

/** Restaura una copia. `merge` conserva lo que ya hubiera; si es false, reemplaza. */
export async function importAll(backup: Backup, merge = true) {
  const db = await getDB()
  const stores = [
    'routines',
    'cycles',
    'sessions',
    'setLogs',
    'weekOverrides',
    'bodyMetrics',
  ] as const

  if (!merge) {
    for (const s of stores) await db.clear(s)
  }
  for (const s of stores) {
    const rows = (backup[s] ?? []) as Array<{ id: string }>
    for (const row of rows) await db.put(s, row as never)
  }
  if (backup.settings) await saveSettings(backup.settings)
}
