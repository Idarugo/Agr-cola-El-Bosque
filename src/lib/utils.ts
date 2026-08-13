import clsx, { type ClassValue } from 'clsx'

export const cn = (...v: ClassValue[]) => clsx(v)

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/* ─────────────── Formato chileno ─────────────── */

const clp = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})
const num = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 })

export const money = (n: number) => clp.format(Math.round(n || 0))
export const moneyShort = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1_000_000_000) return `$${num.format(n / 1_000_000_000)}MM`
  if (a >= 1_000_000) return `$${num.format(Math.round(n / 100_000) / 10)}M`
  if (a >= 1_000) return `$${Math.round(n / 1000)}k`
  return `$${Math.round(n)}`
}
export const nfmt = (n: number, dec = 2) =>
  new Intl.NumberFormat('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(
    n || 0,
  )
export const pct = (n: number) => `${nfmt((n || 0) * 100, 1)}%`

/* ─────────────── RUT chileno ─────────────── */

export function limpiarRut(rut: string) {
  return (rut || '').replace(/[^0-9kK]/g, '').toUpperCase()
}

export function dvRut(cuerpo: string) {
  let suma = 0
  let mul = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const r = 11 - (suma % 11)
  return r === 11 ? '0' : r === 10 ? 'K' : String(r)
}

export function validarRut(rut: string) {
  const l = limpiarRut(rut)
  if (l.length < 7) return false
  const cuerpo = l.slice(0, -1)
  const dv = l.slice(-1)
  if (!/^\d+$/.test(cuerpo)) return false
  return dvRut(cuerpo) === dv
}

export function formatearRut(rut: string) {
  const l = limpiarRut(rut)
  if (l.length < 2) return l
  const cuerpo = l.slice(0, -1)
  const dv = l.slice(-1)
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`
}

/* ─────────────── Fechas ─────────────── */

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export const diasDelMes = (periodo: string) => {
  const [y, m] = periodo.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export const nombrePeriodo = (periodo: string) => {
  const [y, m] = periodo.split('-').map(Number)
  return `${MESES[m - 1]} ${y}`
}

export const fechasDelMes = (periodo: string) => {
  const n = diasDelMes(periodo)
  return Array.from({ length: n }, (_, i) => `${periodo}-${String(i + 1).padStart(2, '0')}`)
}

export const esFinDeSemana = (fecha: string) => {
  const d = new Date(fecha + 'T12:00:00').getDay()
  return d === 0 || d === 6
}

export const diaSemanaCorto = (fecha: string) =>
  ['D', 'L', 'M', 'M', 'J', 'V', 'S'][new Date(fecha + 'T12:00:00').getDay()]

export const hoy = () => new Date().toISOString().slice(0, 10)
export const periodoActual = () => new Date().toISOString().slice(0, 7)

/** Temporada agrícola: parte en mayo (post cosecha) — convención del maestro. */
export function temporadaDe(fecha: string) {
  const [y, m] = fecha.split('-').map(Number)
  return m >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

/* ─────────────── Varios ─────────────── */

export const suma = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + (f(x) || 0), 0)

export function agrupar<T>(arr: T[], key: (x: T) => string) {
  const m = new Map<string, T[]>()
  for (const x of arr) {
    const k = key(x)
    const list = m.get(k)
    if (list) list.push(x)
    else m.set(k, [x])
  }
  return m
}

/** Minutos de atraso respecto a la hora de entrada pactada. */
export function minutosAtraso(horaLlegada: string | undefined, horaEntrada = '08:00') {
  if (!horaLlegada) return 0
  const [h1, m1] = horaLlegada.split(':').map(Number)
  const [h2, m2] = horaEntrada.split(':').map(Number)
  return Math.max(0, h1 * 60 + m1 - (h2 * 60 + m2))
}

export const descargar = (blob: Blob, nombre: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
