import { type ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronDown, Search, Inbox, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─────────────────────────── Card ─────────────────────────── */

export function Card({
  children,
  className,
  hover,
}: {
  children: ReactNode
  className?: string
  hover?: boolean
}) {
  return <div className={cn('card', hover && 'card-hover', className)}>{children}</div>
}

export function CardHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
}: {
  title: string
  subtitle?: string
  icon?: React.ComponentType<{ className?: string }>
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon && (
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-500/12 text-brand-600 dark:text-brand-400">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ─────────────────────────── KPI ─────────────────────────── */

export function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  tone = 'brand',
}: {
  label: string
  value: string
  sub?: string
  icon?: React.ComponentType<{ className?: string }>
  trend?: number
  tone?: 'brand' | 'accent' | 'sky' | 'violet' | 'red' | 'amber' | 'slate'
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-500/12 text-brand-600 dark:text-brand-400',
    accent: 'bg-accent-500/15 text-accent-600 dark:text-accent-400',
    sky: 'bg-sky-500/12 text-sky-600 dark:text-sky-400',
    violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-400',
    red: 'bg-red-500/12 text-red-600 dark:text-red-400',
    amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    slate: 'bg-ink-faint/12 text-ink-faint',
  }
  const TrendIcon = trend === undefined ? null : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
  return (
    <div className="card card-hover animate-fade-up p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
        {Icon && (
          <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', tones[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="tnum mt-2 text-2xl font-semibold leading-none text-ink">{value}</p>
      <div className="mt-2 flex items-center gap-2">
        {TrendIcon && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              trend! > 0 ? 'text-brand-600 dark:text-brand-400' : trend! < 0 ? 'text-red-500' : 'text-ink-faint',
            )}
          >
            <TrendIcon className="h-3.5 w-3.5" />
            {Math.abs(trend!).toFixed(1)}%
          </span>
        )}
        {sub && <p className="truncate text-xs text-ink-faint">{sub}</p>}
      </div>
    </div>
  )
}

/* ─────────────────────────── Badge ─────────────────────────── */

const TONOS: Record<string, string> = {
  brand: 'bg-brand-500/15 text-brand-700 dark:text-brand-300',
  accent: 'bg-accent-500/18 text-accent-700 dark:text-accent-300',
  sky: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  violet: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  red: 'bg-red-500/15 text-red-700 dark:text-red-300',
  amber: 'bg-amber-500/18 text-amber-700 dark:text-amber-300',
  slate: 'bg-ink-faint/15 text-ink-soft',
}

export function Badge({
  children,
  tone = 'slate',
  className,
}: {
  children: ReactNode
  tone?: keyof typeof TONOS | string
  className?: string
}) {
  return <span className={cn('chip', TONOS[tone] ?? TONOS.slate, className)}>{children}</span>
}

/* ─────────────────────────── Modal ─────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', h)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-hairline bg-surface-raised shadow-pop animate-scale-in sm:rounded-2xl',
          wide ? 'sm:max-w-4xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-faint transition-colors duration-200 hover:bg-ink-faint/10 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline bg-surface-soft px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/* ─────────────────────────── Campos de formulario ─────────────────────────── */

export function Field({
  label,
  children,
  hint,
  error,
  className,
}: {
  label: string
  children: ReactNode
  hint?: string
  error?: string
  className?: string
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-500">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  )
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  options: (string | { value: string; label: string })[]
  placeholder?: string
  className?: string
  disabled?: boolean
}) {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="input cursor-pointer appearance-none pr-9"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const v = typeof o === 'string' ? o : o.value
          const l = typeof o === 'string' ? o : o.label
          return (
            <option key={v} value={v}>
              {l}
            </option>
          )
        })}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
    </div>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar…',
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="input pl-9"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="Limpiar búsqueda"
          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 cursor-pointer place-items-center rounded text-ink-faint transition-colors duration-200 hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

/* ─────────────────────────── Estados vacíos ─────────────────────────── */

export function Vacio({
  titulo,
  detalle,
  icon: Icon = Inbox,
  accion,
}: {
  titulo: string
  detalle?: string
  icon?: React.ComponentType<{ className?: string }>
  accion?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-ink-faint/10 text-ink-faint">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-medium text-ink">{titulo}</p>
        {detalle && <p className="mx-auto mt-1 max-w-sm text-xs text-ink-faint">{detalle}</p>}
      </div>
      {accion}
    </div>
  )
}

/* ─────────────────────────── Tabs ─────────────────────────── */

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div
      role="tablist"
      className="flex gap-1 overflow-x-auto rounded-lg border border-hairline bg-surface-soft p-1"
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-200',
            value === t.id
              ? 'bg-surface-raised text-ink shadow-card'
              : 'text-ink-faint hover:text-ink',
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={cn(
                'tnum rounded px-1.5 py-0.5 text-[10px] font-semibold',
                value === t.id ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300' : 'bg-ink-faint/12',
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ─────────────────────────── Barra proporcional ─────────────────────────── */

export function Barra({ valor, max, tone = 'brand' }: { valor: number; max: number; tone?: string }) {
  const p = max > 0 ? Math.min(100, (valor / max) * 100) : 0
  const tones: Record<string, string> = {
    brand: 'bg-brand-500',
    accent: 'bg-accent-500',
    red: 'bg-red-500',
    sky: 'bg-sky-500',
    violet: 'bg-violet-500',
  }
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-faint/12">
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', tones[tone] ?? tones.brand)}
        style={{ width: `${p}%` }}
      />
    </div>
  )
}

/* ─────────────────────────── Tooltip liviano ─────────────────────────── */

export function Tip({ texto, children }: { texto: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  return (
    <span
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-40 w-max max-w-[240px] -translate-x-1/2 rounded-md border border-hairline bg-surface-raised px-2.5 py-1.5 text-xs font-normal normal-case tracking-normal text-ink-soft shadow-pop">
          {texto}
        </span>
      )}
    </span>
  )
}

/* ─────────────────────────── Cabecera de página ─────────────────────────── */

export function PageHeader({
  titulo,
  descripcion,
  icon: Icon,
  children,
}: {
  titulo: string
  descripcion?: string
  icon?: React.ComponentType<{ className?: string }>
  children?: ReactNode
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/12 text-brand-600 dark:text-brand-400">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{titulo}</h1>
          {descripcion && <p className="mt-0.5 text-sm text-ink-faint">{descripcion}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  )
}
