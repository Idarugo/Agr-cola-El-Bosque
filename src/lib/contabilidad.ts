/**
 * ══════════════════════════════════════════════════════════════════════
 *  MOTOR CONTABLE DE DOBLE ENTRADA
 * ══════════════════════════════════════════════════════════════════════
 *
 *  Reemplaza las fórmulas de Sistema_contable_AEB_V01.xlsx. Todo se
 *  deriva del Libro Diario, que es el único punto de ingreso:
 *
 *      Libro Diario ──┬── Control de asientos (Debe = Haber)
 *                     ├── Libro Mayor (por cuenta, con saldo acumulado)
 *                     ├── Balance de 8 columnas
 *                     ├── Estado de Resultados
 *                     └── Balance General
 *
 *  A diferencia del Excel, aquí es imposible romper una fórmula al
 *  borrar una fila: los informes se recalculan siempre desde el diario.
 */

import {
  PLAN_ORDENADO,
  cuentaFin,
  ordenCodigo,
  type CuentaFinanciera,
} from '@/data/planFinanciero'
import type {
  Asiento,
  BalanceGeneral,
  CuentaMayor,
  EstadoResultados,
  FilaBalance8,
  LineaAsiento,
} from './types'
import { suma } from './utils'

/* ─────────────── Control de cuadratura ─────────────── */

export interface ControlAsiento {
  numero: number
  fecha: string
  glosa: string
  totalDebe: number
  totalHaber: number
  diferencia: number
  cuadrado: boolean
  lineas: number
}

export const totalDebe = (a: Asiento) => suma(a.lineas, (l) => l.debe)
export const totalHaber = (a: Asiento) => suma(a.lineas, (l) => l.haber)
export const estaCuadrado = (a: Asiento) => Math.round(totalDebe(a) - totalHaber(a)) === 0

export function controlarAsientos(asientos: Asiento[]): ControlAsiento[] {
  return asientos
    .map((a) => {
      const d = totalDebe(a)
      const h = totalHaber(a)
      return {
        numero: a.numero,
        fecha: a.fecha,
        glosa: a.glosa,
        totalDebe: d,
        totalHaber: h,
        diferencia: Math.round(d - h),
        cuadrado: Math.round(d - h) === 0,
        lineas: a.lineas.length,
      }
    })
    .sort((x, y) => x.numero - y.numero)
}

/** Sólo los asientos cuadrados alimentan los informes. */
export const asientosValidos = (asientos: Asiento[], desde?: string, hasta?: string) =>
  asientos
    .filter(estaCuadrado)
    .filter((a) => (!desde || a.fecha >= desde) && (!hasta || a.fecha <= hasta))

export const siguienteNumero = (asientos: Asiento[]) =>
  asientos.reduce((m, a) => Math.max(m, a.numero), 0) + 1

/* ─────────────── Libro Mayor ─────────────── */

/**
 * Signo del movimiento según la naturaleza de la cuenta.
 * Deudora: aumenta por el debe. Acreedora: aumenta por el haber.
 */
const saldoLinea = (cuenta: CuentaFinanciera | undefined, debe: number, haber: number) =>
  cuenta?.naturaleza === 'Acreedora' ? haber - debe : debe - haber

export function construirMayor(asientos: Asiento[]): CuentaMayor[] {
  const validos = asientos.filter(estaCuadrado).sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero,
  )

  const porCuenta = new Map<string, CuentaMayor>()

  for (const a of validos) {
    for (const l of a.lineas) {
      if (!l.cuenta) continue
      const def = cuentaFin(l.cuenta)
      let cta = porCuenta.get(l.cuenta)
      if (!cta) {
        cta = {
          codigo: l.cuenta,
          nombre: def?.nombre ?? '(cuenta no definida)',
          tipo: def?.tipo ?? '—',
          subtipo: def?.subtipo ?? '—',
          naturaleza: def?.naturaleza ?? 'Deudora',
          movimientos: [],
          totalDebe: 0,
          totalHaber: 0,
          saldoFinal: 0,
        }
        porCuenta.set(l.cuenta, cta)
      }
      cta.totalDebe += l.debe
      cta.totalHaber += l.haber
      cta.saldoFinal += saldoLinea(def, l.debe, l.haber)
      cta.movimientos.push({
        fecha: a.fecha,
        numero: a.numero,
        glosa: l.glosaLinea || a.glosa,
        debe: l.debe,
        haber: l.haber,
        saldo: cta.saldoFinal,
      })
    }
  }

  return [...porCuenta.values()].sort((a, b) => ordenCodigo(a.codigo, b.codigo))
}

/* ─────────────── Balance de 8 columnas ─────────────── */

export function balance8Columnas(asientos: Asiento[]): FilaBalance8[] {
  const mayor = new Map(construirMayor(asientos).map((m) => [m.codigo, m]))

  return PLAN_ORDENADO.map((cta) => {
    const m = mayor.get(cta.codigo)
    const debe = m?.totalDebe ?? 0
    const haber = m?.totalHaber ?? 0

    // Columnas de saldos: la diferencia se muestra del lado que corresponda
    const dif = debe - haber
    const saldoDeudor = dif > 0 ? dif : 0
    const saldoAcreedor = dif < 0 ? -dif : 0

    // Inventario (balance) vs Resultados (EERR), según el tipo de cuenta
    const esResultado = cta.tipo === 'Ingreso' || cta.tipo === 'Gasto'
    return {
      codigo: cta.codigo,
      nombre: cta.nombre,
      tipo: cta.tipo,
      subtipo: cta.subtipo,
      naturaleza: cta.naturaleza,
      debe,
      haber,
      saldoDeudor,
      saldoAcreedor,
      activo: !esResultado ? saldoDeudor : 0,
      pasivo: !esResultado ? saldoAcreedor : 0,
      perdida: esResultado ? saldoDeudor : 0,
      ganancia: esResultado ? saldoAcreedor : 0,
    }
  })
}

export const totalesBalance8 = (filas: FilaBalance8[]) => ({
  debe: suma(filas, (f) => f.debe),
  haber: suma(filas, (f) => f.haber),
  saldoDeudor: suma(filas, (f) => f.saldoDeudor),
  saldoAcreedor: suma(filas, (f) => f.saldoAcreedor),
  activo: suma(filas, (f) => f.activo),
  pasivo: suma(filas, (f) => f.pasivo),
  perdida: suma(filas, (f) => f.perdida),
  ganancia: suma(filas, (f) => f.ganancia),
})

/* ─────────────── Estado de Resultados ─────────────── */

/** Agrupación del EERR, replicando la estructura de la hoja original. */
const GRUPOS_EERR: Record<string, string> = {
  '4.1': 'INGRESOS',
  '4.2': 'INGRESOS',
  '4.3': 'INGRESOS',
  '5.1': 'COSTO_VENTAS',
  '5.2': 'ADMINISTRACION',
  '5.3': 'ADMINISTRACION',
  '5.4': 'ADMINISTRACION',
  '5.5': 'ADMINISTRACION',
  '5.6': 'ADMINISTRACION',
  '5.7': 'ADMINISTRACION',
  '5.9': 'ADMINISTRACION',
  '5.10': 'ADMINISTRACION',
  '5.11': 'ADMINISTRACION',
  '5.12': 'ADMINISTRACION',
  '5.13': 'ADMINISTRACION',
  '5.8': 'FINANCIERO',
}

export function estadoResultados(asientos: Asiento[], tasaImpuesto = 0.27): EstadoResultados {
  const filas = balance8Columnas(asientos)
  const detalle: EstadoResultados['detalle'] = []

  let ingresos = 0
  let costoVentas = 0
  let gastosAdm = 0
  let gastosFin = 0

  for (const f of filas) {
    const grupo = GRUPOS_EERR[f.codigo]
    if (!grupo) continue
    // Ingresos suman por el haber; gastos por el debe.
    const monto = grupo === 'INGRESOS' ? f.ganancia - f.perdida : f.perdida - f.ganancia
    if (monto === 0) continue
    detalle.push({ codigo: f.codigo, nombre: f.nombre, monto, grupo })
    if (grupo === 'INGRESOS') ingresos += monto
    else if (grupo === 'COSTO_VENTAS') costoVentas += monto
    else if (grupo === 'ADMINISTRACION') gastosAdm += monto
    else if (grupo === 'FINANCIERO') gastosFin += monto
  }

  const margenBruto = ingresos - costoVentas
  const resultadoOperacional = margenBruto - gastosAdm
  const utilidadAntesImpuesto = resultadoOperacional - gastosFin
  // Sólo se provisiona impuesto si hay utilidad.
  const provisionImpuesto = utilidadAntesImpuesto > 0 ? utilidadAntesImpuesto * tasaImpuesto : 0

  return {
    ingresosOperacionales: ingresos,
    costoVentas,
    margenBruto,
    gastosAdministracion: gastosAdm,
    resultadoOperacional,
    gastosFinancieros: gastosFin,
    otrosIngresos: 0,
    utilidadAntesImpuesto,
    provisionImpuesto,
    utilidadNeta: utilidadAntesImpuesto - provisionImpuesto,
    detalle,
  }
}

/* ─────────────── Balance General ─────────────── */

/**
 * Saldo neto de una cuenta para efectos del balance.
 *
 * Es fundamental que sea neto y no por columna: una cuenta de activo puede
 * quedar con saldo acreedor (los anticipos de sueldo tras descontarse, la
 * depreciación acumulada) y en ese caso **rebaja** el activo. Si se contara
 * como pasivo, o peor, si se ignorara, el balance dejaría de cuadrar aunque
 * todos los asientos estuvieran correctos.
 */
export const saldoNetoBalance = (f: FilaBalance8) =>
  f.tipo === 'Activo' ? f.saldoDeudor - f.saldoAcreedor : f.saldoAcreedor - f.saldoDeudor

export function balanceGeneral(asientos: Asiento[], tasaImpuesto = 0.27): BalanceGeneral {
  const filas = balance8Columnas(asientos)
  const eerr = estadoResultados(asientos, tasaImpuesto)

  const porSubtipo = (s: string) =>
    suma(filas.filter((f) => f.subtipo === s), saldoNetoBalance)

  const activoCorriente = porSubtipo('Activo Corriente')
  const activoNoCorriente = porSubtipo('Activo No Corriente')
  const totalActivo = activoCorriente + activoNoCorriente

  const pasivoCorriente = porSubtipo('Pasivo Corriente')
  const pasivoNoCorriente = porSubtipo('Pasivo No Corriente')
  const totalPasivo = pasivoCorriente + pasivoNoCorriente

  const patrimonio = porSubtipo('Patrimonio')
  // El impuesto provisionado aún no está asentado, por eso el patrimonio se
  // concilia con el resultado antes de impuesto.
  const totalPasivoPatrimonio = totalPasivo + patrimonio + eerr.utilidadAntesImpuesto

  return {
    activoCorriente,
    activoNoCorriente,
    totalActivo,
    pasivoCorriente,
    pasivoNoCorriente,
    totalPasivo,
    patrimonio,
    resultadoEjercicio: eerr.utilidadAntesImpuesto,
    totalPasivoPatrimonio,
    descuadre: Math.round(totalActivo - totalPasivoPatrimonio),
  }
}

/* ─────────────── Análisis por dimensión analítica ─────────────── */

/**
 * El mismo peso del Libro Diario, mirado por cualquiera de las 13
 * dimensiones. Esto es lo que el Excel resolvía con tablas dinámicas
 * separadas por campo.
 */
export function costoPorDimensionContable(
  asientos: Asiento[],
  dim: keyof LineaAsiento,
  filtro?: { campo?: string; periodo?: string },
) {
  const acc = new Map<string, { monto: number; jornadas: number; lineas: number }>()

  for (const a of asientos.filter(estaCuadrado)) {
    if (filtro?.periodo && !a.fecha.startsWith(filtro.periodo)) continue
    for (const l of a.lineas) {
      if (l.debe <= 0) continue // sólo cargos: es donde vive el costo
      if (filtro?.campo && filtro.campo !== 'TODOS' && l.n11 !== filtro.campo) continue
      const clave = (l[dim] as string) || '(sin asignar)'
      const cur = acc.get(clave) ?? { monto: 0, jornadas: 0, lineas: 0 }
      cur.monto += l.debe
      cur.jornadas += l.jornadas ?? 0
      cur.lineas += 1
      acc.set(clave, cur)
    }
  }

  return [...acc.entries()]
    .map(([nombre, v]) => ({ nombre, ...v }))
    .sort((a, b) => b.monto - a.monto)
}
