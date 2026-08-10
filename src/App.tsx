import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import clsx from 'clsx'
import { useApp } from '@/store/useApp'
import { requestPersistence } from '@/lib/storage'
import { StorageWarning } from '@/components/StorageWarning'
import {
  IconBars,
  IconBody,
  IconDumbbell,
  IconHome,
  IconPlan,
  IconSettings,
} from '@/components/icons'
import Dashboard from '@/pages/Dashboard'
import Train from '@/pages/Train'
import Volume from '@/pages/Volume'
import Body from '@/pages/Body'
import Routines from '@/pages/Routines'
import Settings from '@/pages/Settings'
import ExerciseHistory from '@/pages/ExerciseHistory'

const NAV = [
  { to: '/', label: 'Inicio', Icon: IconHome, end: true },
  { to: '/entrenar', label: 'Entrenar', Icon: IconDumbbell, end: false },
  { to: '/volumen', label: 'Volumen', Icon: IconBars, end: false },
  { to: '/cuerpo', label: 'Cuerpo', Icon: IconBody, end: false },
  { to: '/rutinas', label: 'Rutinas', Icon: IconPlan, end: false },
]

export default function App() {
  const ready = useApp((s) => s.ready)
  const init = useApp((s) => s.init)
  const runSync = useApp((s) => s.runSync)

  useEffect(() => {
    void init()
    // Pedir al navegador que no desaloje IndexedDB. Silencioso: si lo deniega,
    // el aviso de StorageWarning explica que hacer.
    void requestPersistence()
  }, [init])

  // Al recuperar la conexion, vaciar la cola pendiente sin que el usuario haga nada.
  useEffect(() => {
    const onOnline = () => void runSync()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [runSync])

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="text-[13px] text-ink-muted">Cargando…</div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-hairline bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[13px] font-bold text-white">
              T
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Training Lab</span>
          </div>

          {/* Navegacion de escritorio */}
          <nav className="hidden gap-1 sm:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  clsx(
                    'rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                    isActive ? 'bg-accent-soft text-accent-strong' : 'text-ink-secondary hover:bg-surface-sunken',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <NavLink
            to="/ajustes"
            className={({ isActive }) =>
              clsx(
                'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                isActive ? 'bg-accent-soft text-accent-strong' : 'text-ink-muted hover:bg-surface-sunken',
              )
            }
            aria-label="Ajustes"
          >
            {({ isActive }) => <IconSettings size={19} active={isActive} />}
          </NavLink>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-5 pb-24 sm:pb-10">
        <StorageWarning />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/entrenar" element={<Train />} />
          <Route path="/volumen" element={<Volume />} />
          <Route path="/cuerpo" element={<Body />} />
          <Route path="/rutinas" element={<Routines />} />
          <Route path="/ejercicio/:exerciseId" element={<ExerciseHistory />} />
          <Route path="/ajustes" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Navegacion movil: barra inferior, alcanzable con el pulgar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-white/95 backdrop-blur sm:hidden">
        <div className="flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx(
                  'flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors',
                  isActive ? 'text-accent' : 'text-ink-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* Pastilla de fondo: marca la pestana activa sin depender solo del color */}
                  <span
                    className={clsx(
                      'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                      isActive && 'bg-accent-soft',
                    )}
                  >
                    <n.Icon size={21} active={isActive} />
                  </span>
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
