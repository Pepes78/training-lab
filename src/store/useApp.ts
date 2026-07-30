import { create } from 'zustand'
import type { Exercise } from '@/types/catalog'
import type { Routine } from '@/types/routine'
import { routineSchema } from '@/types/routine'
import type {
  BodyMetric,
  BodyMetricKey,
  Cycle,
  Session,
  SetLog,
  Settings,
  WeekOverride,
} from '@/types/logs'
import { DEFAULT_SETTINGS } from '@/types/logs'
import { CATALOG } from '@/data/catalog'
import seedRoutine from '@/data/routines/ul-ppl-5d.json'
import * as db from '@/lib/db'
import { sync, type SyncResult } from '@/lib/sync'
import { mondayOfCurrentWeek, toISODate, weekOf } from '@/lib/date'

/* ============================================================================
 *  Estado de la aplicacion
 * ----------------------------------------------------------------------------
 *  Todo se carga de IndexedDB al arrancar y se mantiene en memoria: el volumen
 *  de datos de un usuario unico es pequeno y asi las vistas de analitica son
 *  instantaneas y funcionan sin red.
 * ========================================================================== */

interface AppState {
  ready: boolean
  settings: Settings
  routines: Routine[]
  cycle: Cycle | null
  cycles: Cycle[]
  sessions: Session[]
  setLogs: SetLog[]
  overrides: WeekOverride[]
  metrics: BodyMetric[]
  syncResult: SyncResult | null

  init: () => Promise<void>
  refresh: () => Promise<void>
  runSync: () => Promise<void>

  updateSettings: (patch: Partial<Settings>) => Promise<void>

  importRoutine: (raw: unknown) => Promise<{ ok: true; routine: Routine } | { ok: false; errors: string[] }>
  removeRoutine: (id: string) => Promise<void>
  startCycle: (routineId: string, startDate?: string, weeks?: number) => Promise<void>
  finishCycle: (status: 'completed' | 'abandoned') => Promise<void>
  removeCycle: (cycleId: string) => Promise<void>

  getOrCreateSession: (week: number, dayId: string, date?: string) => Promise<Session>
  updateSession: (s: Session) => Promise<void>

  logSet: (input: Omit<SetLog, 'id' | 'completedAt'> & { id?: string }) => Promise<void>
  removeSet: (id: string) => Promise<void>

  setOverride: (week: number, slotId: string, exerciseId: string, reason?: string) => Promise<void>
  clearOverride: (week: number, slotId: string) => Promise<void>

  saveMetric: (date: string, metric: BodyMetricKey, value: number, note?: string) => Promise<void>
  removeMetric: (id: string) => Promise<void>
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  settings: DEFAULT_SETTINGS,
  routines: [],
  cycle: null,
  cycles: [],
  sessions: [],
  setLogs: [],
  overrides: [],
  metrics: [],
  syncResult: null,

  async init() {
    const settings = await db.loadSettings()
    let routines = await db.listRoutines()

    // Primera ejecucion: sembramos la rutina de ejemplo para que la app no
    // arranque vacia y sirva de referencia del formato.
    if (routines.length === 0) {
      const parsed = routineSchema.safeParse(seedRoutine)
      if (parsed.success) {
        await db.saveRoutine(parsed.data)
        routines = [parsed.data]
      } else {
        console.error('La rutina semilla no valida contra el esquema:', parsed.error.issues)
      }
    }

    set({ settings, routines })
    await get().refresh()
    set({ ready: true })
    void get().runSync()
  },

  async refresh() {
    const cycles = await db.listCycles()
    const cycle = cycles.find((c) => c.status === 'active') ?? null
    const [sessions, setLogs, overrides, metrics, routines] = await Promise.all([
      db.listSessions(),
      db.listSetLogs(),
      db.listOverrides(),
      db.listBodyMetrics(),
      db.listRoutines(),
    ])
    set({ cycles, cycle, sessions, setLogs, overrides, metrics, routines })
  },

  async runSync() {
    const { settings } = get()
    const result = await sync(settings.supabaseUrl, settings.supabaseAnonKey)
    set({ syncResult: result })
    if (result.pulled > 0) await get().refresh()
  },

  async updateSettings(patch) {
    const next = { ...get().settings, ...patch }
    await db.saveSettings(next)
    set({ settings: next })
  },

  async importRoutine(raw) {
    const parsed = routineSchema.safeParse(raw)
    if (!parsed.success) {
      // Mensajes con ruta: "days.2.blocks.0.exercises.1.repRange: ..." para
      // poder corregir el JSON sin adivinar donde esta el fallo.
      const errors = parsed.error.issues.map((i) => {
        const path = i.path.join('.')
        return path ? `${path}: ${i.message}` : i.message
      })
      return { ok: false, errors }
    }
    await db.saveRoutine(parsed.data)
    await get().refresh()
    return { ok: true, routine: parsed.data }
  },

  async removeRoutine(id) {
    await db.deleteRoutine(id)
    await get().refresh()
  },

  async startCycle(routineId, startDate, weeks) {
    const routine = get().routines.find((r) => r.id === routineId)
    if (!routine) throw new Error(`Rutina no encontrada: ${routineId}`)

    // Solo puede haber un ciclo activo: cerramos el anterior.
    for (const c of get().cycles.filter((c) => c.status === 'active')) {
      await db.saveCycle({ ...c, status: 'completed' })
    }

    const cycle: Cycle = {
      id: db.newId(),
      routineId,
      routineSnapshot: routine,
      startDate: startDate ?? mondayOfCurrentWeek(),
      targetWeeks: weeks ?? routine.durationWeeks,
      status: 'active',
      createdAt: new Date().toISOString(),
    }
    await db.saveCycle(cycle)
    await get().refresh()
  },

  async finishCycle(status) {
    const { cycle } = get()
    if (!cycle) return
    await db.saveCycle({ ...cycle, status })
    await get().refresh()
  },

  async removeCycle(cycleId) {
    // Borrado en cascada: sin el, las series quedarian huerfanas y seguirian
    // contando en el volumen y en los records.
    await db.deleteCycle(cycleId)
    await get().refresh()
  },

  async getOrCreateSession(week, dayId, date) {
    const { cycle, sessions } = get()
    if (!cycle) throw new Error('No hay ciclo activo')

    const existing = sessions.find(
      (s) => s.cycleId === cycle.id && s.week === week && s.dayId === dayId,
    )
    if (existing) return existing

    const session: Session = {
      id: db.newId(),
      cycleId: cycle.id,
      week,
      dayId,
      date: date ?? toISODate(),
      status: 'in-progress',
      startedAt: new Date().toISOString(),
    }
    await db.saveSession(session)
    await get().refresh()
    return session
  },

  async updateSession(s) {
    await db.saveSession(s)
    await get().refresh()
  },

  async logSet(input) {
    const log: SetLog = {
      ...input,
      id: input.id ?? db.newId(),
      completedAt: new Date().toISOString(),
    }
    await db.saveSetLog(log)
    await get().refresh()
  },

  async removeSet(id) {
    await db.deleteSetLog(id)
    await get().refresh()
  },

  async setOverride(week, slotId, exerciseId, reason) {
    const { cycle, overrides } = get()
    if (!cycle) return

    // Un solo sustituto por hueco y semana: si ya existe, se reemplaza.
    const existing = overrides.find(
      (o) => o.cycleId === cycle.id && o.week === week && o.slotId === slotId,
    )
    const row: WeekOverride = {
      id: existing?.id ?? db.newId(),
      cycleId: cycle.id,
      week,
      slotId,
      replacementExerciseId: exerciseId,
      reason,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    await db.saveOverride(row)
    await get().refresh()
  },

  async clearOverride(week, slotId) {
    const { cycle, overrides } = get()
    if (!cycle) return
    const existing = overrides.find(
      (o) => o.cycleId === cycle.id && o.week === week && o.slotId === slotId,
    )
    if (existing) {
      await db.deleteOverride(existing.id)
      await get().refresh()
    }
  },

  async saveMetric(date, metric, value, note) {
    // Una medida por metrica y dia: registrar dos veces sobrescribe.
    const existing = get().metrics.find((m) => m.date === date && m.metric === metric)
    const row: BodyMetric = {
      id: existing?.id ?? db.newId(),
      date,
      metric,
      value,
      note,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    await db.saveBodyMetric(row)
    await get().refresh()
  },

  async removeMetric(id) {
    await db.deleteBodyMetric(id)
    await get().refresh()
  },
}))

/* ── Selectores ────────────────────────────────────────────────────────── */

/**
 * Catalogo efectivo: los ejercicios de serie mas los que traiga la rutina en
 * customExercises. Asi una rutina generada fuera de la app puede usar
 * movimientos que aqui no existen sin romper la importacion.
 */
export function useCatalog(): Record<string, Exercise> {
  const routines = useApp((s) => s.routines)
  const map: Record<string, Exercise> = Object.fromEntries(CATALOG.map((e) => [e.id, e]))
  for (const r of routines) {
    for (const e of r.customExercises) map[e.id] = e
  }
  return map
}

export function useCatalogList(): Exercise[] {
  return Object.values(useCatalog())
}

/** Semana en curso del ciclo activo, acotada al final del ciclo. */
export function useCurrentWeek(): number {
  const cycle = useApp((s) => s.cycle)
  if (!cycle) return 1
  const w = weekOf(cycle.startDate, toISODate())
  return Math.min(Math.max(1, w), cycle.targetWeeks)
}

/** Series de una semana concreta del ciclo activo. */
export function setsOfWeek(
  sessions: Session[],
  setLogs: SetLog[],
  cycleId: string,
  week: number,
): SetLog[] {
  const ids = new Set(
    sessions.filter((s) => s.cycleId === cycleId && s.week === week).map((s) => s.id),
  )
  return setLogs.filter((s) => ids.has(s.sessionId))
}

/** Ultima sesion registrada de un slot, para calcular la sugerencia de carga. */
export function lastSetsForSlot(
  sessions: Session[],
  setLogs: SetLog[],
  cycleId: string,
  slotId: string,
  beforeWeek: number,
): SetLog[] {
  const relevant = sessions
    .filter((s) => s.cycleId === cycleId && s.week < beforeWeek)
    .sort((a, b) => b.week - a.week || b.date.localeCompare(a.date))

  for (const session of relevant) {
    const sets = setLogs.filter(
      (l) => l.sessionId === session.id && l.slotId === slotId && !l.isWarmup,
    )
    if (sets.length > 0) return sets.sort((a, b) => a.setIndex - b.setIndex)
  }
  return []
}
