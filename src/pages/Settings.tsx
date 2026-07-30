import { useRef, useState } from 'react'
import { useApp } from '@/store/useApp'
import { MUSCLES, MUSCLE_LABEL } from '@/types/catalog'
import { VOLUME_LANDMARKS } from '@/data/volume-landmarks'
import { Badge, Button, Card, NumberField, SectionTitle } from '@/components/ui'
import { exportAll, importAll, type Backup } from '@/lib/db'
import { currentUserEmail, signInWithEmail, signOut } from '@/lib/sync'
import { useEffect } from 'react'

/* ============================================================================
 *  Ajustes
 * ========================================================================== */

export default function Settings() {
  const { settings, updateSettings, runSync, syncResult, refresh } = useApp()
  const [email, setEmail] = useState('')
  const [authMsg, setAuthMsg] = useState('')
  const [signedInAs, setSignedInAs] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState('')

  useEffect(() => {
    void currentUserEmail(settings.supabaseUrl, settings.supabaseAnonKey).then(setSignedInAs)
  }, [settings.supabaseUrl, settings.supabaseAnonKey, syncResult])

  const syncLabel: Record<string, { text: string; tone: 'good' | 'warning' | 'critical' | 'neutral' }> = {
    disabled: { text: 'Sin configurar', tone: 'neutral' },
    offline: { text: 'Sin conexion', tone: 'warning' },
    'signed-out': { text: 'Sesion no iniciada', tone: 'warning' },
    syncing: { text: 'Sincronizando', tone: 'neutral' },
    synced: { text: 'Sincronizado', tone: 'good' },
    error: { text: 'Error', tone: 'critical' },
  }

  return (
    <div className="space-y-5">
      <h1 className="text-[20px] font-semibold tracking-tight text-ink">Ajustes</h1>

      {/* ── Preferencias de entrenamiento ── */}
      <Card>
        <SectionTitle hint="Afecta a las sugerencias de carga del motor de progresion">
          Entrenamiento
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Incremento minimo de disco"
            value={settings.minPlateIncrement}
            onChange={(v) => void updateSettings({ minPlateIncrement: v === '' ? 1.25 : v })}
            step={0.25}
            min={0.25}
            suffix="kg"
          />
          <label className="flex items-end gap-2 pb-1">
            <input
              type="checkbox"
              checked={settings.restTimerSound}
              onChange={(e) => void updateSettings({ restTimerSound: e.target.checked })}
              className="h-5 w-5 rounded border-hairline accent-[#2a78d6]"
            />
            <span className="text-[13px] text-ink">Aviso sonoro al acabar el descanso</span>
          </label>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
          El incremento minimo es el disco mas pequeno de tu gimnasio. Las sugerencias se redondean a
          ese valor para que siempre sean cargas que puedas montar de verdad.
        </p>
      </Card>

      {/* ── Sincronizacion ── */}
      <Card>
        <SectionTitle
          hint="Opcional. Sin configurar, todo funciona igual pero solo en este dispositivo."
          action={
            syncResult ? (
              <Badge tone={syncLabel[syncResult.status]?.tone ?? 'neutral'}>
                {syncLabel[syncResult.status]?.text ?? syncResult.status}
              </Badge>
            ) : undefined
          }
        >
          Sincronizacion entre dispositivos
        </SectionTitle>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              URL del proyecto Supabase
            </span>
            <input
              type="url"
              value={settings.supabaseUrl}
              onChange={(e) => void updateSettings({ supabaseUrl: e.target.value.trim() })}
              placeholder="https://xxxx.supabase.co"
              className="h-11 w-full rounded-lg border border-hairline bg-white px-3 text-[13px] text-ink focus:border-accent focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              Clave anonima (anon key)
            </span>
            <input
              type="text"
              value={settings.supabaseAnonKey}
              onChange={(e) => void updateSettings({ supabaseAnonKey: e.target.value.trim() })}
              placeholder="eyJhbGciOi..."
              className="h-11 w-full rounded-lg border border-hairline bg-white px-3 font-mono text-[12px] text-ink focus:border-accent focus:outline-none"
            />
          </label>

          <div className="rounded-lg border border-[#f5e3b0] bg-[#fff8e6] p-3">
            <p className="text-[11px] leading-relaxed text-[#8a6200]">
              <strong className="font-semibold">La clave anonima es publica por diseno</strong>, pero
              solo protege tus datos si has ejecutado <code>supabase/schema.sql</code> con Row Level
              Security activado y has iniciado sesion. Sin RLS, cualquiera con la clave puede leer y
              borrar todo.
            </p>
          </div>

          {signedInAs ? (
            <div className="flex items-center gap-3">
              <span className="flex-1 text-[13px] text-ink">
                Sesion iniciada como <strong className="font-semibold">{signedInAs}</strong>
              </span>
              <Button
                onClick={async () => {
                  await signOut(settings.supabaseUrl, settings.supabaseAnonKey)
                  setSignedInAs(null)
                }}
              >
                Cerrar sesion
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="h-11 flex-1 rounded-lg border border-hairline bg-white px-3 text-[13px] text-ink focus:border-accent focus:outline-none"
              />
              <Button
                variant="primary"
                onClick={async () => {
                  try {
                    await signInWithEmail(email, settings.supabaseUrl, settings.supabaseAnonKey)
                    setAuthMsg('Te hemos enviado un enlace de acceso. Revisa tu correo.')
                  } catch (e) {
                    setAuthMsg(e instanceof Error ? e.message : 'No se pudo enviar el enlace')
                  }
                }}
                disabled={!email.includes('@') || !settings.supabaseUrl}
              >
                Enviar enlace
              </Button>
            </div>
          )}
          {authMsg && <p className="text-[12px] text-ink-secondary">{authMsg}</p>}

          <div className="flex items-center gap-3">
            <Button onClick={() => void runSync()}>Sincronizar ahora</Button>
            {syncResult && (
              <span className="num text-[11px] text-ink-muted">
                {syncResult.pushed} subidas · {syncResult.pulled} bajadas · {syncResult.pending}{' '}
                pendientes
              </span>
            )}
          </div>
          {syncResult?.message && (
            <p className="text-[12px] text-ink-secondary">{syncResult.message}</p>
          )}
        </div>
      </Card>

      {/* ── Copias de seguridad ── */}
      <Card>
        <SectionTitle hint="Tus datos son tuyos y salen de aqui sin ataduras">
          Copia de seguridad
        </SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              const data = await exportAll()
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `training-lab-${new Date().toISOString().slice(0, 10)}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            Exportar todo
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try {
                const backup = JSON.parse(await f.text()) as Backup
                await importAll(backup, true)
                await refresh()
                setImportMsg('Copia restaurada correctamente')
              } catch (err) {
                setImportMsg(err instanceof Error ? err.message : 'Archivo no valido')
              }
            }}
          />
          <Button onClick={() => fileRef.current?.click()}>Restaurar copia</Button>
        </div>
        {importMsg && <p className="mt-2 text-[12px] text-ink-secondary">{importMsg}</p>}
      </Card>

      {/* ── Referencias de volumen ── */}
      <VolumeSettings />

      <Card>
        <h3 className="text-[13px] font-semibold text-ink">Creditos y datos</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
          Animaciones e informacion de ejercicios: dataset <em>hasaneyldrm/exercises-dataset</em>,
          atribucion Gym Visual (gymvisual.com), uso no comercial. Metodologia de entrenamiento
          inspirada en el trabajo divulgativo de Jeff Nippard y en el marco de landmarks de volumen
          de Renaissance Periodization. Esta aplicacion no sustituye el criterio de un profesional;
          si tienes lesiones o condiciones medicas, consulta antes de seguir cualquier programa.
        </p>
      </Card>
    </div>
  )
}

function VolumeSettings() {
  const { settings, updateSettings } = useApp()
  const [open, setOpen] = useState(false)

  const get = (m: string, field: 'mev' | 'mav' | 'mrv') => {
    const o = settings.volumeOverrides[m]
    if (o) return o[field]
    const base = VOLUME_LANDMARKS[m as keyof typeof VOLUME_LANDMARKS]
    return field === 'mav' ? base.mav[1] : base[field]
  }

  const set = (m: string, field: 'mev' | 'mav' | 'mrv', value: number) => {
    const current = {
      mev: get(m, 'mev'),
      mav: get(m, 'mav'),
      mrv: get(m, 'mrv'),
    }
    void updateSettings({
      volumeOverrides: { ...settings.volumeOverrides, [m]: { ...current, [field]: value } },
    })
  }

  return (
    <Card>
      <SectionTitle
        hint="Los valores por defecto son heuristicas, no ciencia exacta: ajustalos a tu experiencia"
        action={
          <Button size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? 'Ocultar' : 'Editar'}
          </Button>
        }
      >
        Referencias de volumen
      </SectionTitle>

      {open && (
        <>
          <div className="scroll-x">
            <table className="w-full min-w-[380px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-hairline text-[11px] font-medium text-ink-muted">
                  <th className="pb-2 font-medium">Musculo</th>
                  <th className="pb-2 text-center font-medium">MEV</th>
                  <th className="pb-2 text-center font-medium">Optimo max</th>
                  <th className="pb-2 text-center font-medium">MRV</th>
                </tr>
              </thead>
              <tbody>
                {MUSCLES.map((m) => (
                  <tr key={m} className="border-b border-hairline/60 last:border-0">
                    <td className="py-1.5 text-ink">{MUSCLE_LABEL[m]}</td>
                    {(['mev', 'mav', 'mrv'] as const).map((f) => (
                      <td key={f} className="px-1 py-1.5">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={get(m, f)}
                          onChange={(e) => set(m, f, Number(e.target.value))}
                          className="num h-9 w-full rounded-lg border border-hairline bg-white text-center text-[13px] focus:border-accent focus:outline-none"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {Object.keys(settings.volumeOverrides).length > 0 && (
            <Button
              variant="danger"
              className="mt-3"
              onClick={() => void updateSettings({ volumeOverrides: {} })}
            >
              Restaurar valores por defecto
            </Button>
          )}
        </>
      )}
    </Card>
  )
}
