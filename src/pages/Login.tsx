import { useEffect, useState } from 'react'
import { Leaf, Lock, User, Eye, EyeOff, LogIn, ShieldAlert, Info, KeyRound } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { USUARIOS_SEMILLA } from '@/data/usuarios'
import { ROL_META, evaluarClave } from '@/lib/auth'
import { Badge, Field } from '@/components/ui'
import { alerta } from '@/lib/alerta'
import { cn } from '@/lib/utils'

export default function Login() {
  const { usuarios, sembrarUsuarios, ingresar, tema, setTema } = useStore()
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'dark')
  }, [tema])

  // Primer arranque: se crean los usuarios iniciales
  useEffect(() => {
    if (usuarios.length === 0) void sembrarUsuarios()
  }, [usuarios.length, sembrarUsuarios])

  const entrar = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!usuario.trim() || !clave) {
      setError('Complete usuario y contraseña.')
      return
    }
    setCargando(true)
    setError('')
    const r = await ingresar(usuario, clave)
    setCargando(false)
    if (!r.ok) {
      setError(r.msg ?? 'No se pudo ingresar.')
      setClave('')
      return
    }
    alerta.toast('Bienvenido a SIGA')
  }

  const accesoRapido = (u: (typeof USUARIOS_SEMILLA)[number]) => {
    setUsuario(u.usuario)
    setClave(u.clave)
    setError('')
  }

  return (
    <div className="flex min-h-screen bg-surface-soft">
      {/* ── Panel izquierdo: identidad ── */}
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-brand-900 p-10 lg:flex">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-brand-100">
              <Leaf className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <p className="text-[15px] font-semibold text-white">Agrícola El Bosque Ltda.</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand-300">
                SIGA · Sistema Integrado de Gestión Agrícola
              </p>
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-[26px] font-semibold leading-tight text-white">
            Una sola base para los cuatro campos.
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-brand-200/90">
            La tarja alimenta el costeo, el costeo alimenta la contabilidad, y la
            contabilidad sale en el formato que el contador ya usa.
          </p>
          <ul className="mt-6 space-y-2">
            {[
              'Costo real por jornada, por hectárea y por labor',
              'Libro Diario con las 13 dimensiones del plan de cuentas',
              'Control de combustible, bodega y carencias',
              'Registro de prevención para la ACHS y las certificadoras',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-[13px] text-brand-100/85">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] text-brand-300/70">
          Buin · Graneros · Los Lirios · Chumaco
        </p>
      </aside>

      {/* ── Panel derecho: acceso ── */}
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-7 lg:hidden">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-700 text-brand-200">
              <Leaf className="h-5 w-5" />
            </span>
            <p className="mt-3 text-[15px] font-semibold text-ink">Agrícola El Bosque Ltda.</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              SIGA · v1.0
            </p>
          </div>

          <h2 className="text-xl font-semibold tracking-tight text-ink">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-ink-faint">
            Ingrese con las credenciales que le entregó el administrador.
          </p>

          <form onSubmit={entrar} className="mt-6 space-y-4">
            <Field label="Usuario">
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  className="input pl-9"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="nombre.usuario"
                  autoFocus
                />
              </div>
            </Field>

            <Field label="Contraseña">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  className="input pl-9 pr-10"
                  type={verClave ? 'text' : 'password'}
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setVerClave((v) => !v)}
                  aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded text-ink-faint transition-colors duration-200 hover:text-ink"
                >
                  {verClave ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/8 p-2.5 text-[13px] text-red-600 dark:text-red-400"
              >
                <ShieldAlert className="mt-px h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <button type="submit" disabled={cargando} className="btn-primary w-full">
              {cargando ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Verificando…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Ingresar
                </>
              )}
            </button>
          </form>

          {/* Accesos de demostración — quitar en operación real */}
          <div className="mt-7 rounded-xl border border-accent-500/30 bg-accent-500/6 p-3.5">
            <p className="flex items-center gap-2 text-[12px] font-semibold text-accent-700 dark:text-accent-400">
              <KeyRound className="h-3.5 w-3.5" />
              Accesos de demostración
            </p>
            <p className="mt-1 text-[11px] leading-snug text-ink-faint">
              Haga clic en un perfil para completar el formulario. Cada uno ve módulos
              distintos. En operación real esta sección se elimina.
            </p>
            <ul className="mt-2.5 space-y-1">
              {USUARIOS_SEMILLA.map((u) => (
                <li key={u.usuario}>
                  <button
                    onClick={() => accesoRapido(u)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors duration-200 hover:border-hairline hover:bg-surface"
                  >
                    <Badge tone={ROL_META[u.rol].color}>{ROL_META[u.rol].label.split(' ')[0]}</Badge>
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink">
                      {u.usuario}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-ink-faint">{u.clave}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-5 flex items-start gap-2 text-[11px] leading-snug text-ink-faint">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            Este control de acceso organiza el trabajo y deja registro de quién hace qué,
            pero <strong className="font-medium text-ink-soft">no protege los datos</strong>:
            todo corre en este navegador. La seguridad real llega cuando el sistema tenga
            servidor.
          </p>

          <button
            onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')}
            className="mt-6 cursor-pointer text-[11px] text-ink-faint underline-offset-2 hover:underline"
          >
            Cambiar a modo {tema === 'dark' ? 'claro' : 'oscuro'}
          </button>
        </div>
      </main>
    </div>
  )
}

/* ═══════════════════ Cambio de clave obligatorio ═══════════════════ */

export function CambioClaveObligatorio() {
  const { sesion, cambiarClave, salir } = useStore()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const fuerza = evaluarClave(nueva, [sesion?.usuario ?? '', sesion?.nombre ?? ''])
  const coincide = nueva.length > 0 && nueva === repetir

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fuerza.aceptable) return setError(fuerza.problemas[0])
    if (!coincide) return setError('Las contraseñas no coinciden.')
    setCargando(true)
    const r = await cambiarClave(actual, nueva)
    setCargando(false)
    if (!r.ok) return setError(r.msg ?? 'No se pudo cambiar la contraseña.')
    alerta.ok('Contraseña actualizada', 'Ya puede usar el sistema.')
  }

  const colores = ['bg-red-500', 'bg-red-500', 'bg-amber-500', 'bg-brand-500', 'bg-brand-500']

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-soft px-5 py-10">
      <div className="w-full max-w-[420px]">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-700 text-brand-200">
          <KeyRound className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-ink">
          Cambie su contraseña
        </h2>
        <p className="mt-1 text-sm text-ink-faint">
          {sesion?.nombre} · su clave es provisoria y debe cambiarla antes de continuar.
        </p>

        <form onSubmit={guardar} className="mt-6 space-y-4">
          <Field label="Contraseña actual">
            <input type="password" className="input" value={actual} autoComplete="current-password"
                   onChange={(e) => setActual(e.target.value)} />
          </Field>

          <Field label="Contraseña nueva">
            <input type="password" className="input" value={nueva} autoComplete="new-password"
                   onChange={(e) => setNueva(e.target.value)} />
          </Field>

          {nueva && (
            <div>
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i}
                        className={cn('h-1 flex-1 rounded-full transition-colors duration-200',
                                      i < fuerza.puntaje ? colores[fuerza.puntaje] : 'bg-ink-faint/15')} />
                ))}
              </div>
              <p className="mt-1.5 text-[12px] text-ink-faint">
                {fuerza.etiqueta}
                {fuerza.problemas.length > 0 && ` · ${fuerza.problemas[0]}`}
              </p>
            </div>
          )}

          <Field label="Repita la contraseña nueva"
                 error={repetir && !coincide ? 'No coinciden.' : undefined}>
            <input type="password" className="input" value={repetir} autoComplete="new-password"
                   onChange={(e) => setRepetir(e.target.value)} />
          </Field>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/8 p-2.5 text-[13px] text-red-600 dark:text-red-400">
              <ShieldAlert className="mt-px h-4 w-4 shrink-0" />{error}
            </p>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={salir} className="btn-ghost flex-1">Salir</button>
            <button type="submit" disabled={cargando || !fuerza.aceptable || !coincide}
                    className="btn-primary flex-[2]">
              Guardar contraseña
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
