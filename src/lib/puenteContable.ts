/**
 * ══════════════════════════════════════════════════════════════════════
 *  PUENTE ENTRE COSTEO Y CONTABILIDAD
 * ══════════════════════════════════════════════════════════════════════
 *
 *  Aquí se juntan las dos fuentes de información que hoy la empresa
 *  maneja por separado: la operativa (tarja → costo por labor y cuartel)
 *  y la tributaria (asiento contable → Balance y Estado de Resultados).
 *
 *  Estructura del asiento de remuneraciones, tomada del asiento real de
 *  junio 2026 que ya existe en Sistema_contable_AEB_V01.xlsx:
 *
 *    DEBE   5.1  Costo de ventas ......... una línea por cada combinación
 *                                          de las 13 dimensiones
 *    HABER  2.7  Leyes sociales por pagar
 *           2.5  Impuestos por pagar (impuesto único 2ª categoría)
 *           1.71 Anticipos de sueldos (rebaja el anticipo ya entregado)
 *           2.4  Remuneraciones por pagar (líquido a transferir)
 *
 *  El líquido se calcula por diferencia, de modo que el asiento cuadra
 *  al peso por construcción.
 */

import type {
  Asiento,
  LineaAsiento,
  Remuneracion,
  ResumenDistribucion,
  Trabajador,
} from './types'
import { CUENTAS_REMUNERACIONES, financieraDeN4 } from '@/data/planFinanciero'
import type { CostoCombustibleCC } from './motorCombustible'
import { cuentaN5DeCategoria, type CostoInsumoCC } from './motorBodega'
import { agrupar, suma, uid } from './utils'

export interface ParametrosAsiento {
  numero: number
  fecha: string
  glosa: string
  /** Tasa patronal estimada cuando no hay libro de remuneraciones cargado. */
  tasaLeyesSociales?: number
}

export interface ResultadoPuente {
  asiento: Asiento
  advertencias: string[]
  resumen: {
    costoTotal: number
    leyesSociales: number
    impuestoUnico: number
    anticipos: number
    liquido: number
  }
}

/**
 * Construye el asiento de remuneraciones a partir del resultado del
 * motor de distribución y del libro de remuneraciones del período.
 */
export function asientoDeRemuneraciones(
  res: ResumenDistribucion,
  trabajadores: Trabajador[],
  remuneraciones: Remuneracion[],
  p: ParametrosAsiento,
): ResultadoPuente {
  const advertencias: string[] = [...res.advertencias]
  const lineas: LineaAsiento[] = []

  if (res.lineas.length === 0) {
    advertencias.push('No hay líneas de costo en el período: el asiento quedaría vacío.')
  }

  /* ── DEBE: el costo, agrupado por cuenta financiera + 13 dimensiones ── */
  const porImputacion = agrupar(res.lineas, (l) =>
    [
      financieraDeN4(l.codigoN4),
      l.codigoN4,
      l.imputacion.n6,
      l.imputacion.n7,
      l.imputacion.n8,
      l.imputacion.n9,
      l.imputacion.n10,
      l.imputacion.n11,
      l.imputacion.n12,
      l.imputacion.n13,
    ].join('¦'),
  )

  for (const [, grupo] of porImputacion) {
    const l0 = grupo[0]
    const monto = Math.round(suma(grupo, (g) => g.monto))
    if (monto === 0) continue
    lineas.push({
      id: uid(),
      cuenta: financieraDeN4(l0.codigoN4),
      debe: monto,
      haber: 0,
      glosaLinea: `${l0.imputacion.n6} · ${l0.imputacion.n13}`,
      n1: l0.imputacion.n1,
      n2: l0.imputacion.n2,
      n3: l0.imputacion.n3,
      n4: l0.imputacion.n4,
      n5: l0.imputacion.n5,
      n6: l0.imputacion.n6,
      n7: l0.imputacion.n7,
      n8: l0.imputacion.n8,
      n9: l0.imputacion.n9,
      n10: l0.imputacion.n10,
      n11: l0.imputacion.n11,
      n12: l0.imputacion.n12,
      n13: l0.imputacion.n13,
      codigoN4: l0.codigoN4,
      jornadas: Math.round(suma(grupo, (g) => g.jornadas) * 100) / 100,
    })
  }

  const costoTotal = suma(lineas, (l) => l.debe)

  /* ── HABER: la contrapartida previsional y de pago ── */
  const trabajadoresDelAsiento = new Set(res.lineas.map((l) => l.trabajadorId))
  const remsDelPeriodo = remuneraciones.filter(
    (r) => r.periodo === res.periodo && trabajadoresDelAsiento.has(r.trabajadorId),
  )

  let leyesSociales: number
  let impuestoUnico: number
  const anticipos = Math.round(suma(remsDelPeriodo, (r) => r.anticipo))

  if (remsDelPeriodo.length > 0) {
    // Con libro cargado: los descuentos reales son la base de la contrapartida.
    // Los descuentos previsionales van a leyes sociales; el resto es impuesto único.
    const descuentos = suma(remsDelPeriodo, (r) => r.totalDescuentos)
    impuestoUnico = Math.round(descuentos * 0.02)
    leyesSociales = Math.round(descuentos - impuestoUnico)
  } else {
    const tasa = p.tasaLeyesSociales ?? 0.2
    leyesSociales = Math.round(costoTotal * tasa)
    impuestoUnico = 0
    advertencias.push(
      `Sin libro de remuneraciones para ${res.periodo}: las leyes sociales se estimaron al ${(tasa * 100).toFixed(0)}%. Cargue el libro para que el asiento refleje los descuentos reales.`,
    )
  }

  // El líquido cierra el asiento: garantiza Debe = Haber al peso.
  const liquido = costoTotal - leyesSociales - impuestoUnico - anticipos

  if (liquido < 0) {
    advertencias.push(
      'Los descuentos y anticipos superan el costo distribuido. Revise el libro de remuneraciones antes de contabilizar.',
    )
  }

  const haber = (cuenta: string, monto: number, glosa: string) => {
    if (monto === 0) return
    lineas.push({ id: uid(), cuenta, debe: 0, haber: monto, glosaLinea: glosa, n11: res.campo })
  }

  haber(CUENTAS_REMUNERACIONES.leyesSociales, leyesSociales, 'Leyes sociales del período')
  haber(CUENTAS_REMUNERACIONES.impuestoUnico, impuestoUnico, 'Impuesto único de 2ª categoría')
  haber(CUENTAS_REMUNERACIONES.anticipos, anticipos, 'Anticipos de sueldos descontados')
  haber(CUENTAS_REMUNERACIONES.liquidoPorPagar, liquido, 'Líquido por pagar')

  return {
    asiento: {
      id: uid(),
      numero: p.numero,
      fecha: p.fecha,
      glosa: p.glosa,
      origen: 'REMUNERACIONES',
      observaciones: `Generado desde el cierre de costos · ${res.trabajadores} trabajadores · ${res.jornadasTotales.toFixed(2)} jornadas · base ${res.base}`,
      lineas,
    },
    advertencias,
    resumen: { costoTotal, leyesSociales, impuestoUnico, anticipos, liquido },
  }
}

/** Último día del mes de un período YYYY-MM — fecha natural del asiento. */
export function fechaCierre(periodo: string) {
  const [y, m] = periodo.split('-').map(Number)
  const d = new Date(y, m, 0).getDate()
  return `${periodo}-${String(d).padStart(2, '0')}`
}

/* ══════════════════════════════════════════════════════════════════
 *  COMBUSTIBLE
 * ══════════════════════════════════════════════════════════════════
 *
 *  El petróleo tiene dos momentos contables distintos:
 *
 *   1. La compra entra al inventario, no al costo:
 *        DEBE  1.5  Inventarios (1123 COMBUSTIBLE INVENTARIO)
 *        DEBE  1.6  IVA crédito fiscal
 *        HABER 2.1  Proveedores
 *
 *   2. El consumo sale del inventario al costo, ya imputado a cada
 *      centro de costo, especie y variedad:
 *        DEBE  5.1  Costo de ventas (4113 SERVICIOS_AGRICOLAS · MECANIZADOS)
 *        HABER 1.5  Inventarios
 *
 *  Separarlos es lo que permite que el estanque tenga valor de activo
 *  mientras el combustible no se ha usado.
 */

export const CUENTAS_COMBUSTIBLE = {
  inventario: '1.5',
  inventarioN4: '1123',
  ivaCredito: '1.6',
  proveedores: '2.1',
  costo: '5.1',
  costoN4: '4113',
} as const

export interface ResultadoAsientoCombustible {
  asiento: Asiento
  advertencias: string[]
  resumen: { litros: number; monto: number; precio: number; centrosCosto: number }
}

/**
 * Asiento de consumo de combustible del período: descarga el inventario
 * y lleva el costo a cada centro de costo con sus dimensiones analíticas.
 */
export function asientoConsumoCombustible(
  costos: CostoCombustibleCC[],
  temporada: string,
  precio: number,
  p: ParametrosAsiento,
): ResultadoAsientoCombustible {
  const advertencias: string[] = []
  const lineas: LineaAsiento[] = []

  if (precio <= 0)
    advertencias.push(
      'No hay precio de compra registrado: el consumo no se puede valorizar. Registre el precio por litro en las entradas de combustible.',
    )

  for (const c of costos) {
    if (c.monto === 0) continue
    if (!c.cc || c.cc === 'SIN CENTRO DE COSTO')
      advertencias.push(`${c.litros} L sin centro de costo: quedan imputados a GENERAL.`)

    lineas.push({
      id: uid(),
      cuenta: CUENTAS_COMBUSTIBLE.costo,
      debe: c.monto,
      haber: 0,
      glosaLinea: `Combustible · ${c.cc} · ${c.litros} L`,
      n1: 'COSTOS',
      n2: 'COSTO_OPERACIONAL',
      n3: 'DIRECTOS_DE_PRODUCCION',
      n4: 'SERVICIOS_AGRICOLAS',
      n5: 'MECANIZADOS',
      n6: 'MANTENIMIENTO',
      n7: 'MAQUINARIAS Y EQUIPOS',
      n8: '0',
      n9: c.especie,
      n10: c.variedad,
      n11: c.campo,
      n12: temporada,
      n13: c.cc || `GENERAL ${c.campo}`,
      codigoN4: CUENTAS_COMBUSTIBLE.costoN4,
    })
  }

  const total = suma(lineas, (l) => l.debe)
  if (total > 0)
    lineas.push({
      id: uid(),
      cuenta: CUENTAS_COMBUSTIBLE.inventario,
      debe: 0,
      haber: total,
      glosaLinea: 'Salida de combustible desde inventario',
      n4: 'COMBUSTIBLE INVENTARIO',
      codigoN4: CUENTAS_COMBUSTIBLE.inventarioN4,
    })
  else advertencias.push('No hay consumo valorizado en el período seleccionado.')

  return {
    asiento: {
      id: uid(),
      numero: p.numero,
      fecha: p.fecha,
      glosa: p.glosa,
      origen: 'AJUSTE',
      observaciones: `Consumo de combustible · ${suma(costos, (c) => c.litros).toFixed(1)} L a ${Math.round(precio)} $/L`,
      lineas,
    },
    advertencias,
    resumen: {
      litros: Math.round(suma(costos, (c) => c.litros) * 100) / 100,
      monto: total,
      precio,
      centrosCosto: costos.length,
    },
  }
}

/* ══════════════════════════════════════════════════════════════════
 *  INSUMOS DE BODEGA
 * ══════════════════════════════════════════════════════════════════
 *
 *  Mismo criterio que el combustible: la compra entra al inventario y
 *  el consumo lo descarga al costo. La diferencia es que la categoría
 *  del producto define la subcuenta N5 — agroquímicos y fertilizantes
 *  no van a la misma partida, y ese detalle es el que después permite
 *  comparar costo de fertilización contra costo de control de plagas.
 */

export const CUENTAS_INSUMOS = {
  inventario: '1.5',
  costo: '5.1',
  costoN4: '4111', // INSUMOS
} as const

export interface ResultadoAsientoInsumos {
  asiento: Asiento
  advertencias: string[]
  resumen: { monto: number; centrosCosto: number }
}

export function asientoConsumoInsumos(
  costos: CostoInsumoCC[],
  temporada: string,
  p: ParametrosAsiento,
): ResultadoAsientoInsumos {
  const advertencias: string[] = []
  const lineas: LineaAsiento[] = []

  for (const c of costos) {
    if (c.monto === 0) continue
    const n5 = cuentaN5DeCategoria(c.categoria)
    lineas.push({
      id: uid(),
      cuenta: CUENTAS_INSUMOS.costo,
      debe: c.monto,
      haber: 0,
      glosaLinea: `${c.categoria} · ${c.cc}`,
      n1: 'COSTOS',
      n2: 'COSTO_OPERACIONAL',
      n3: 'DIRECTOS_DE_PRODUCCION',
      n4: 'INSUMOS',
      n5,
      n6: n5 === 'FERTILIZANTES' ? 'FERTILIZACION' : 'APLICACIONES_QUIMICAS',
      n7: '0',
      n8: '0',
      n9: c.especie,
      n10: c.variedad,
      n11: c.campo,
      n12: temporada,
      n13: c.cc,
      codigoN4: CUENTAS_INSUMOS.costoN4,
    })
  }

  const total = suma(lineas, (l) => l.debe)
  if (total > 0)
    lineas.push({
      id: uid(),
      cuenta: CUENTAS_INSUMOS.inventario,
      debe: 0,
      haber: total,
      glosaLinea: 'Salida de insumos desde bodega',
      n4: 'MATERIAS_PRIMAS',
    })
  else advertencias.push('No hay consumo de insumos valorizado en el período seleccionado.')

  return {
    asiento: {
      id: uid(),
      numero: p.numero,
      fecha: p.fecha,
      glosa: p.glosa,
      origen: 'AJUSTE',
      observaciones: `Consumo de insumos · ${costos.length} imputaciones`,
      lineas,
    },
    advertencias,
    resumen: { monto: total, centrosCosto: new Set(costos.map((c) => c.cc)).size },
  }
}

/** Asiento de compra de combustible con IVA. */
export function asientoCompraCombustible(
  litros: number,
  precioNeto: number,
  p: ParametrosAsiento & { proveedor?: string },
): Asiento {
  const neto = Math.round(litros * precioNeto)
  const iva = Math.round(neto * 0.19)
  return {
    id: uid(),
    numero: p.numero,
    fecha: p.fecha,
    glosa: p.glosa,
    origen: 'COMPRAS',
    observaciones: `${litros} L a ${Math.round(precioNeto)} $/L neto`,
    lineas: [
      {
        id: uid(),
        cuenta: CUENTAS_COMBUSTIBLE.inventario,
        debe: neto,
        haber: 0,
        glosaLinea: 'Combustible a inventario',
        n4: 'COMBUSTIBLE INVENTARIO',
        codigoN4: CUENTAS_COMBUSTIBLE.inventarioN4,
      },
      { id: uid(), cuenta: CUENTAS_COMBUSTIBLE.ivaCredito, debe: iva, haber: 0, glosaLinea: 'IVA crédito fiscal' },
      {
        id: uid(),
        cuenta: CUENTAS_COMBUSTIBLE.proveedores,
        debe: 0,
        haber: neto + iva,
        glosaLinea: p.proveedor ?? 'Proveedor de combustible',
      },
    ],
  }
}
