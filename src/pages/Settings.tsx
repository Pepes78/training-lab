import { useRef, useState } from 'react'
import { useApp } from '@/store/useApp'
import { MUSCLES, MUSCLE_LABEL } from '@/types/catalog'
import { VOLUME_LANDMARKS } from '@/data/volume-landmarks'
import { Badge, Button, Card, NumberField, SectionTitle } from '@/components/ui'
import { exportAll, importAll, type Backup } from '@/lib/db'
import {
  currentUserEmail,
  describeAuthError,
  envConfig,
  hasEnvConfig,
  signInWithEmail,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  verifyEmailCode,
} from '@/lib/sync'
import { formatBytes, isIOS, requestPersistence, type StorageStatus } from '@/lib/storage'
import { useEffect } from 'react'

/* ============================================================================
 *  Ajustes
 * ========================================================================== */

export default function Settings() {
  const { settings, updateSettings, runSync, syncResult, refresh } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [authMsg, setAuthMsg] = useState('')
  const [authError, setAuthError] = useState(false)
  const [sending, setSending] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [signedInAs, setSignedInAs] = useState<string | null>(null)

  // Lo guardado en el dispositivo manda sobre lo incrustado en el build, para
  // poder apuntar a otro proyecto sin recompilar.
  const env = envConfig()
  const fromEnv = hasEnvConfig()
  const effectiveUrl = settings.supabaseUrl || env.url
  const effectiveKey = settings.supabaseAnonKey || env.key
  const configured = Boolean(effectiveUrl && effectiveKey)
  const fileRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState('')

  useEffect(() => {
    void currentUserEmail(effectiveUrl, effectiveKey).then(setSignedInAs)
  }, [effectiveUrl, effectiveKey, syncResult])

  /** Entrar o registrarse con contrasena. Al terminar, sincroniza de inmediato. */
  async function submitPassword() {
    setAuthMsg('')
    setAuthError(false)
    setSending(true)
    try {
      if (mode === 'signup') {
        const { needsConfirmation } = await signUpWithPassword(
          email,
          password,
          effectiveUrl,
          effectiveKey,
        )
        if (needsConfirmation) {
          setAuthMsg(
            'Cuenta creada, pero el proyecto exige verificar el correo. Confirma desde el mensaje recibido, o desactiva "Confirm email" en Supabase para entrar directamente.',
          )
          setSending(false)
          return
        }
      } else {
        await signInWithPassword(email, password, effectiveUrl, effectiveKey)
      }
      setPassword('')
      setAuthMsg('Sesion iniciada. Sincronizando…')
      await runSync()
    } catch (e) {
      setAuthError(true)
      setAuthMsg(describeAuthError(e))
    }
    setSending(false)
  }

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
          {/*
            El acceso va primero y las claves quedan escondidas: cuando la app viene
            preconfigurada, ver dos campos vacios de URL y clave hace pensar que hay
            que rellenarlos, cuando lo unico que hace falta es el correo.
          */}
          {signedInAs ? (
            <div className="flex items-center gap-3 rounded-lg bg-[#eefaee] px-3 py-2.5">
              <span className="flex-1 text-[13px] text-[#0a7a0a]">
                Sesion iniciada como <strong className="font-semibold">{signedInAs}</strong>
              </span>
              <Button
                onClick={async () => {
                  await signOut(effectiveUrl, effectiveKey)
                  setSignedInAs(null)
                }}
              >
                Cerrar sesion
              </Button>
            </div>
          ) : configured ? (
            <>
              <p className="text-[13px] leading-relaxed text-ink-secondary">
                Crea una cuenta con tu correo y una contrasena. No necesitas cuenta de Supabase:
                eso es solo el panel de administracion.
              </p>

              {/* Selector Entrar / Crear cuenta */}
              <div className="flex gap-1 rounded-lg bg-surface-sunken p-1">
                {(['signin', 'signup'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMode(m)
                      setAuthMsg('')
                      setAuthError(false)
                    }}
                    className={
                      mode === m
                        ? 'flex-1 rounded-md bg-white px-3 py-1.5 text-[13px] font-medium text-ink shadow-sm'
                        : 'flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium text-ink-secondary'
                    }
                  >
                    {m === 'signin' ? 'Entrar' : 'Crear cuenta'}
                  </button>
                ))}
              </div>

              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="h-11 w-full rounded-lg border border-hairline bg-white px-3 text-[13px] text-ink focus:border-accent focus:outline-none"
              />
              <input
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Contrasena (min. 6 caracteres)' : 'Contrasena'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && email.includes('@') && password.length >= 6) {
                    void submitPassword()
                  }
                }}
                className="h-11 w-full rounded-lg border border-hairline bg-white px-3 text-[13px] text-ink focus:border-accent focus:outline-none"
              />
              <Button
                variant="primary"
                className="w-full"
                disabled={!email.includes('@') || password.length < 6 || sending}
                onClick={() => void submitPassword()}
              >
                {sending
                  ? 'Un momento…'
                  : mode === 'signup'
                    ? 'Crear cuenta y entrar'
                    : 'Entrar'}
              </Button>

              {/* Alternativa por correo, plegada: el metodo principal es la contrasena */}
              <details className="text-[12px]">
                <summary className="cursor-pointer text-ink-secondary">
                  Prefiero un codigo por correo
                </summary>
                <div className="mt-2 space-y-3 rounded-lg border border-hairline p-3">
                  <p className="text-[12px] leading-relaxed text-ink-muted">
                    Requiere que la plantilla del correo en Supabase incluya{' '}
                    <code>{'{{ .Token }}'}</code>, tanto en <em>Magic Link</em> como en{' '}
                    <em>Confirm signup</em>. Ademas gasta envios del limite gratuito.
                  </p>
                  <div className="flex gap-2">
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  disabled={codeSent}
                  className="h-11 flex-1 rounded-lg border border-hairline bg-white px-3 text-[13px] text-ink disabled:bg-surface-sunken disabled:text-ink-secondary focus:border-accent focus:outline-none"
                />
                <Button
                  variant={codeSent ? 'secondary' : 'primary'}
                  onClick={async () => {
                    setAuthMsg('')
                    setAuthError(false)
                    setSending(true)
                    try {
                      await signInWithEmail(email, effectiveUrl, effectiveKey)
                      setCodeSent(true)
                      setAuthMsg('Codigo enviado. Revisa tu correo, tambien la carpeta de spam.')
                    } catch (e) {
                      setAuthError(true)
                      setAuthMsg(describeAuthError(e))
                    }
                    setSending(false)
                  }}
                  // Solo depende del correo: la conexion ya esta resuelta
                  disabled={!email.includes('@') || sending}
                >
                  {sending ? 'Enviando…' : codeSent ? 'Reenviar' : 'Enviar codigo'}
                </Button>
              </div>

              {codeSent && (
                <div className="rounded-lg border border-hairline bg-surface-sunken p-3">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                      Codigo del correo
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="num h-11 flex-1 rounded-lg border border-hairline bg-white px-3 text-center text-[18px] tracking-[0.3em] text-ink focus:border-accent focus:outline-none"
                      />
                      <Button
                        variant="primary"
                        disabled={code.length < 6 || verifying}
                        onClick={async () => {
                          setAuthMsg('')
                          setAuthError(false)
                          setVerifying(true)
                          try {
                            await verifyEmailCode(email, code, effectiveUrl, effectiveKey)
                            setCodeSent(false)
                            setCode('')
                            setAuthMsg('Sesion iniciada. Sincronizando…')
                            await runSync()
                          } catch (e) {
                            setAuthError(true)
                            setAuthMsg(describeAuthError(e))
                          }
                          setVerifying(false)
                        }}
                      >
                        {verifying ? 'Entrando…' : 'Entrar'}
                      </Button>
                    </div>
                  </label>
                  <button
                    onClick={() => {
                      setCodeSent(false)
                      setCode('')
                      setAuthMsg('')
                      setAuthError(false)
                    }}
                    className="mt-2 text-[11px] font-medium text-accent hover:underline"
                  >
                    Usar otro correo
                  </button>
                </div>
              )}
                </div>
              </details>
            </>
          ) : (
            <p className="rounded-lg bg-[#fff8e6] px-3 py-2.5 text-[12px] leading-relaxed text-[#8a6200]">
              No hay ningun proyecto configurado. Despliega la app con un{' '}
              <code>.env.production</code> o rellena los datos de conexion mas abajo.
            </p>
          )}

          {authMsg && (
            <p
              className={
                authError
                  ? 'rounded-lg border border-[#f3cdcd] bg-[#fdf2f2] px-3 py-2 text-[12px] leading-relaxed text-[#a72c2c]'
                  : 'text-[12px] leading-relaxed text-ink-secondary'
              }
            >
              {authMsg}
            </p>
          )}

          {configured && (
            <div className="flex items-center gap-3">
              <Button onClick={() => void runSync()}>Sincronizar ahora</Button>
              {syncResult && (
                <span className="num text-[11px] text-ink-muted">
                  {syncResult.pushed} subidas · {syncResult.pulled} bajadas · {syncResult.pending}{' '}
                  pendientes
                </span>
              )}
            </div>
          )}
          {syncResult?.message && (
            <p className="text-[12px] text-ink-secondary">{syncResult.message}</p>
          )}

          {/* Conexion: plegada porque casi nadie necesita tocarla */}
          <details className="rounded-lg border border-hairline">
            <summary className="cursor-pointer px-3 py-2 text-[12px] font-medium text-ink-secondary">
              Conexion avanzada
              {fromEnv && !settings.supabaseUrl && (
                <span className="ml-2 font-normal text-ink-muted">· ya configurada</span>
              )}
            </summary>
            <div className="space-y-3 border-t border-hairline p-3">
              <p className="text-[12px] leading-relaxed text-ink-secondary">
                {fromEnv
                  ? 'La app ya trae un proyecto configurado. Rellena esto solo si quieres apuntarla a otro distinto.'
                  : 'Datos del proyecto de Supabase al que se conecta la app.'}
              </p>

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  URL del proyecto
                </span>
                <input
                  type="url"
                  value={settings.supabaseUrl}
                  onChange={(e) => void updateSettings({ supabaseUrl: e.target.value.trim() })}
                  placeholder={fromEnv ? env.url : 'https://xxxx.supabase.co'}
                  className="h-11 w-full rounded-lg border border-hairline bg-white px-3 text-[13px] text-ink focus:border-accent focus:outline-none"
                />
                <span className="mt-1 block text-[11px] leading-snug text-ink-muted">
                  Solo el origen, sin <code>/rest/v1/</code>: la app anade esa ruta sola.
                </span>
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  Clave publicable
                </span>
                <input
                  type="text"
                  value={settings.supabaseAnonKey}
                  onChange={(e) => void updateSettings({ supabaseAnonKey: e.target.value.trim() })}
                  placeholder={fromEnv ? 'sb_publishable_… (ya configurada)' : 'sb_publishable_…'}
                  className="h-11 w-full rounded-lg border border-hairline bg-white px-3 font-mono text-[12px] text-ink focus:border-accent focus:outline-none"
                />
                <span className="mt-1 block text-[11px] leading-snug text-ink-muted">
                  En Supabase: Project Settings → API. Es la que antes se llamaba <em>anon key</em>.
                  Nunca pongas aqui la <strong>secret key</strong>.
                </span>
              </label>

              {(settings.supabaseUrl || settings.supabaseAnonKey) && fromEnv && (
                <Button
                  variant="danger"
                  onClick={() => void updateSettings({ supabaseUrl: '', supabaseAnonKey: '' })}
                >
                  Volver al proyecto por defecto
                </Button>
              )}

              <p className="rounded-lg border border-[#f5e3b0] bg-[#fff8e6] p-2.5 text-[11px] leading-relaxed text-[#8a6200]">
                <strong className="font-semibold">La clave publicable es publica por diseno</strong>{' '}
                y viaja al navegador de todas formas. Lo que protege tus datos es Row Level
                Security: cada fila lleva tu usuario y nadie mas puede leerla.
              </p>
            </div>
          </details>
        </div>
      </Card>

      {/* ── Estado del almacenamiento ── */}
      <StorageCard />

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

function StorageCard() {
  const [status, setStatus] = useState<StorageStatus | null>(null)

  useEffect(() => {
    void requestPersistence().then(setStatus)
  }, [])

  if (!status) return null

  const ios = isIOS()

  // Tres estados reales, sin adornos:
  //   riesgo      iOS en pestana de Safari: borrado garantizado a los 7 dias
  //   garantizado el navegador se ha comprometido a no desalojar los datos
  //   sin-garantia no hay borrado por inactividad, pero tampoco compromiso
  //                frente a una limpieza por falta de espacio
  const level: 'riesgo' | 'garantizado' | 'sin-garantia' =
    ios && !status.installed ? 'riesgo' : status.persisted ? 'garantizado' : 'sin-garantia'

  const badge = {
    riesgo: { tone: 'warning' as const, icon: '!', text: 'En riesgo' },
    garantizado: { tone: 'good' as const, icon: '✓', text: 'Garantizado' },
    'sin-garantia': { tone: 'neutral' as const, icon: '·', text: 'Sin garantia' },
  }[level]

  return (
    <Card>
      <SectionTitle
        hint="Donde viven tus datos mientras no haya sincronizacion"
        action={
          <Badge tone={badge.tone} icon={badge.icon}>
            {badge.text}
          </Badge>
        }
      >
        Almacenamiento en este dispositivo
      </SectionTitle>

      <dl className="space-y-1.5 text-[13px]">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-secondary">Instalada en pantalla de inicio</dt>
          <dd className="font-medium text-ink">{status.installed ? 'Si' : 'No'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-secondary">Almacenamiento persistente</dt>
          <dd className="font-medium text-ink">
            {status.unsupported ? 'No soportado' : status.persisted ? 'Concedido' : 'No concedido'}
          </dd>
        </div>
        {status.usage !== undefined && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-secondary">Espacio usado</dt>
            <dd className="num font-medium text-ink">
              {formatBytes(status.usage)}
              {status.quota ? ` de ${formatBytes(status.quota)}` : ''}
            </dd>
          </div>
        )}
      </dl>

      {ios && !status.installed && (
        <p className="mt-3 rounded-lg bg-[#fff8e6] px-3 py-2 text-[12px] leading-relaxed text-[#8a6200]">
          Estas en Safari como pestana normal. Safari borra el almacenamiento de un sitio tras 7
          dias sin abrirlo. Pulsa <strong>Compartir → Anadir a pantalla de inicio</strong>: las apps
          instaladas quedan exentas de esa regla.
        </p>
      )}

      {ios && status.installed && (
        <p className="mt-3 rounded-lg bg-[#eefaee] px-3 py-2 text-[12px] leading-relaxed text-[#0a7a0a]">
          Instalada en la pantalla de inicio, asi que iOS no aplica el borrado por inactividad. Aun
          asi, desinstalarla borra los datos: configura la sincronizacion o exporta una copia de vez
          en cuando.
        </p>
      )}

      {!ios && level === 'sin-garantia' && (
        <p className="mt-3 rounded-lg bg-surface-sunken px-3 py-2 text-[12px] leading-relaxed text-ink-secondary">
          El navegador no ha concedido almacenamiento persistente, algo habitual hasta que usas la
          app con cierta regularidad. Aqui no hay borrado por inactividad, pero si el dispositivo se
          queda sin espacio el navegador puede liberar estos datos. La sincronizacion o una copia
          exportada lo cubren.
        </p>
      )}
    </Card>
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
