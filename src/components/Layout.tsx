import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Network,
  Users,
  CalendarRange,
  Calculator,
  BookOpen,
  Fuel,
  Package,
  HardHat,
  Sprout,
  Trophy,
  FileSpreadsheet,
  Moon,
  Sun,
  Menu,
  X,
  ChevronDown,
  Leaf,
  AlertTriangle,
  UsersRound,
  LogOut,
  ShieldCheck,
  KeyRound,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { ROL_META, estaAcotadoACampo, puedeVer, type Modulo } from '@/lib/auth'
import { VigilanteDeSesion } from '@/components/Acceso'
import { alerta } from '@/lib/alerta'
import { cn, nombrePeriodo } from '@/lib/utils'
import { CAMPOS } from '@/data/maestros'

const NAV = [
  {
    grupo: 'Gestión',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true, modulo: 'dashboard' as Modulo },
      { to: '/costos', label: 'Costos y cierre', icon: Calculator, modulo: 'costos' as Modulo },
      { to: '/contabilidad', label: 'Contabilidad', icon: BookOpen, modulo: 'contabilidad' as Modulo },
      { to: '/reportes', label: 'Reportes y export', icon: FileSpreadsheet, modulo: 'reportes' as Modulo },
    ],
  },
  {
    grupo: 'Operación',
    items: [
      { to: '/tarja', label: 'Tarja digital', icon: CalendarRange, modulo: 'tarja' as Modulo },
      { to: '/rrhh', label: 'Personal', icon: Users, modulo: 'rrhh' as Modulo },
      { to: '/combustible', label: 'Combustible', icon: Fuel, modulo: 'combustible' as Modulo },
      { to: '/bodega', label: 'Bodega e insumos', icon: Package, modulo: 'bodega' as Modulo },
      { to: '/campos', label: 'Campos y cuarteles', icon: Sprout, modulo: 'campos' as Modulo },
    ],
  },
  {
    grupo: 'Cumplimiento',
    items: [
      { to: '/prevencion', label: 'Prevención y EPP', icon: HardHat, modulo: 'prevencion' as Modulo },
      { to: '/motivacional', label: 'Pack motivacional', icon: Trophy, modulo: 'motivacional' as Modulo },
    ],
  },
  {
    grupo: 'Maestros',
    items: [
      { to: '/plan-cuentas', label: 'Plan de cuentas', icon: Network, modulo: 'plan-cuentas' as Modulo },
      { to: '/usuarios', label: 'Usuarios y acceso', icon: UsersRound, modulo: 'usuarios' as Modulo },
    ],
  },
]

export default function Layout() {
  const { tema, setTema, campoActivo, setCampo, periodoActivo, setPeriodo, sesion, salir } = useStore()
  const [abierto, setAbierto] = useState(false)
  const [menuUsuario, setMenuUsuario] = useState(false)
  const loc = useLocation()

  const rol = sesion?.rol
  // El menú sólo muestra lo que el rol puede abrir
  const navegacion = rol
    ? NAV.map((g) => ({ ...g, items: g.items.filter((it) => puedeVer(rol, it.modulo)) }))
        .filter((g) => g.items.length > 0)
    : []

  // Los roles de terreno quedan amarrados a sus campos
  const acotado = rol ? estaAcotadoACampo(rol) : false
  const camposVisibles = CAMPOS.filter((c) => c.nombre !== 'GENERAL').filter(
    (c) => !acotado || !sesion?.campos.length || sesion.campos.includes(c.nombre),
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'dark')
  }, [tema])

  useEffect(() => setAbierto(false), [loc.pathname])

  const periodos = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(2026, 7 - i, 1)
    return d.toISOString().slice(0, 7)
  })

  return (
    <div className="flex min-h-screen bg-surface-soft">
      <VigilanteDeSesion />
      {/* Overlay móvil */}
      {abierto && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-[2px] lg:hidden"
          onClick={() => setAbierto(false)}
          aria-hidden
        />
      )}

      {/* ───────── Sidebar ───────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-hairline bg-surface transition-transform duration-300 lg:translate-x-0',
          abierto ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-hairline px-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-700 text-brand-200 dark:bg-brand-600">
            <Leaf className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-semibold tracking-tight text-ink">
              Agrícola El Bosque
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              SIGA · v1.0
            </p>
          </div>
          <button
            onClick={() => setAbierto(false)}
            aria-label="Cerrar menú"
            className="ml-auto grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-ink-faint hover:bg-ink-faint/10 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navegacion.map((g) => (
            <div key={g.grupo} className="mb-5">
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint/80">
                {g.grupo}
              </p>
              <ul className="space-y-0.5">
                {g.items.map((it) => (
                  <li key={it.to}>
                    <NavLink
                      to={it.to}
                      end={it.exact}
                      className={({ isActive }) =>
                        cn(
                          'group flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-200',
                          isActive
                            ? 'bg-brand-500/12 text-brand-700 dark:text-brand-300'
                            : 'text-ink-soft hover:bg-ink-faint/8 hover:text-ink',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <it.icon
                            className={cn(
                              'h-[17px] w-[17px] shrink-0 transition-colors duration-200',
                              isActive
                                ? 'text-brand-600 dark:text-brand-400'
                                : 'text-ink-faint group-hover:text-ink-soft',
                            )}
                          />
                          <span className="truncate">{it.label}</span>
                          {isActive && (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 space-y-2 border-t border-hairline p-3">
          <div className="rounded-lg border border-accent-500/25 bg-accent-500/8 p-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-accent-700 dark:text-accent-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              Datos de demostración
            </p>
            <p className="mt-1 text-[11px] leading-snug text-ink-faint">
              Maestros reales del Excel. Movimientos simulados para evaluar el sistema.
            </p>
          </div>
        </div>
      </aside>

      {/* ───────── Contenido ───────── */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-hairline bg-surface/85 px-4 backdrop-blur-md sm:px-6">
          <button
            onClick={() => setAbierto(true)}
            aria-label="Abrir menú"
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-soft transition-colors duration-200 hover:bg-ink-faint/10 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Selector de campo */}
          <div className="relative">
            <select
              value={campoActivo}
              onChange={(e) => setCampo(e.target.value)}
              aria-label="Campo activo"
              className="h-9 cursor-pointer appearance-none rounded-lg border border-hairline bg-surface pl-3 pr-8 text-[13px] font-medium text-ink transition-colors duration-200 hover:border-brand-500/50 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
            >
              {!acotado && <option value="TODOS">Todos los campos</option>}
              {camposVisibles.map((c) => (
                <option key={c.nombre} value={c.nombre}>
                  {c.nombre.replace('_', ' ')}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          </div>

          {/* Selector de período */}
          <div className="relative">
            <select
              value={periodoActivo}
              onChange={(e) => setPeriodo(e.target.value)}
              aria-label="Período contable"
              className="h-9 cursor-pointer appearance-none rounded-lg border border-hairline bg-surface pl-3 pr-8 text-[13px] font-medium text-ink transition-colors duration-200 hover:border-brand-500/50 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
            >
              {periodos.map((p) => (
                <option key={p} value={p}>
                  {nombrePeriodo(p)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')}
              aria-label={tema === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-hairline bg-surface text-ink-soft transition-colors duration-200 hover:border-brand-500/50 hover:text-ink"
            >
              {tema === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Usuario en sesión */}
            {sesion && (
              <div className="relative">
                <button
                  onClick={() => setMenuUsuario((v) => !v)}
                  aria-expanded={menuUsuario}
                  aria-label="Menú de usuario"
                  className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-hairline bg-surface pl-2 pr-2.5 transition-colors duration-200 hover:border-brand-500/50"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-500/15 text-[10px] font-bold text-brand-700 dark:text-brand-300">
                    {sesion.nombre.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                  </span>
                  <span className="hidden text-[12px] font-medium text-ink sm:block">
                    {sesion.nombre.split(' ')[0]}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-ink-faint" />
                </button>

                {menuUsuario && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMenuUsuario(false)} aria-hidden />
                    <div className="absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-xl border border-hairline bg-surface-raised shadow-pop animate-scale-in">
                      <div className="border-b border-hairline p-3">
                        <p className="truncate text-[13px] font-semibold text-ink">{sesion.nombre}</p>
                        <p className="truncate font-mono text-[11px] text-ink-faint">{sesion.usuario}</p>
                        <span className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-brand-500/12 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                          <ShieldCheck className="h-3 w-3" />
                          {ROL_META[sesion.rol].label}
                        </span>
                        <p className="mt-2 text-[11px] leading-snug text-ink-faint">
                          {sesion.campos.length
                            ? `Campos: ${sesion.campos.map((c) => c.replace('_', ' ')).join(', ')}`
                            : 'Acceso a todos los campos'}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          setMenuUsuario(false)
                          if (await alerta.confirmar('¿Cerrar sesión?', 'Deberá ingresar de nuevo.', 'Cerrar sesión'))
                            salir()
                        }}
                        className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-ink-soft transition-colors duration-200 hover:bg-red-500/8 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <LogOut className="h-4 w-4" />
                        Cerrar sesión
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>

        <footer className="shrink-0 border-t border-hairline px-6 py-4 text-[11px] text-ink-faint">
          SIGA · Sistema Integrado de Gestión Agrícola — Agrícola El Bosque Ltda. Los datos se
          guardan en este navegador.
        </footer>
      </div>
    </div>
  )
}
