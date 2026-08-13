/**
 * ══════════════════════════════════════════════════════════════════════
 *  MOTOR DE BODEGA Y APLICACIONES FITOSANITARIAS
 * ══════════════════════════════════════════════════════════════════════
 *
 *  Reemplaza las hojas "Stock sept LL" y "Stock Sept CH", que comparan el
 *  stock según entradas y salidas contra el conteo físico y calculan el
 *  ajuste producto por producto.
 *
 *  La diferencia de fondo con el Excel: aquí una aplicación fitosanitaria
 *  descuenta el producto de bodega automáticamente. En la planilla eran
 *  dos registros independientes, y por eso el stock nunca cuadraba.
 */

import type {
  Aplicacion,
  ConteoFisico,
  EstadoCarencia,
  MovimientoBodega,
  Producto,
} from './types'
import { agrupar, suma, uid } from './utils'

/* ─────────────── Stock ─────────────── */

export function stockDe(
  movs: MovimientoBodega[],
  productoId: string,
  campo?: string,
  hasta?: string,
) {
  return suma(
    movs.filter(
      (m) =>
        m.productoId === productoId &&
        (!campo || campo === 'TODOS' || m.campo === campo) &&
        (!hasta || m.fecha <= hasta),
    ),
    (m) => m.cantidad,
  )
}

export interface FilaStock {
  producto: Producto
  campo: string
  stock: number
  entradas: number
  salidas: number
  movimientos: number
  valor: number
  bajoMinimo: boolean
  ultimoMovimiento?: string
}

export function inventario(
  productos: Producto[],
  movs: MovimientoBodega[],
  campo?: string,
): FilaStock[] {
  const relevantes = movs.filter((m) => !campo || campo === 'TODOS' || m.campo === campo)
  const porProducto = agrupar(relevantes, (m) => m.productoId)

  return productos
    .map((p) => {
      const ms = porProducto.get(p.id) ?? []
      const stock = Math.round(suma(ms, (m) => m.cantidad) * 1000) / 1000
      return {
        producto: p,
        campo: campo ?? 'TODOS',
        stock,
        entradas: Math.round(suma(ms.filter((m) => m.cantidad > 0), (m) => m.cantidad) * 100) / 100,
        salidas: Math.round(Math.abs(suma(ms.filter((m) => m.cantidad < 0), (m) => m.cantidad)) * 100) / 100,
        movimientos: ms.length,
        valor: Math.round(stock * p.precioUnitario),
        bajoMinimo: stock <= p.stockMinimo,
        ultimoMovimiento: ms.map((m) => m.fecha).sort().at(-1),
      }
    })
    .filter((f) => f.movimientos > 0 || f.producto.activo)
    .sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre))
}

/* ─────────────── Conteo físico ─────────────── */

/**
 * Compara el stock según registros contra lo efectivamente contado en bodega.
 * Es el mismo cuadro del Excel: stock según entradas y salidas · stock real ·
 * ajuste. La diferencia se registra como movimiento de ajuste, de modo que el
 * registro queda igual a la realidad y queda constancia de la corrección.
 */
export function compararConteo(
  productos: Producto[],
  movs: MovimientoBodega[],
  campo: string,
  contados: Record<string, number>,
  hasta?: string,
): ConteoFisico[] {
  return Object.entries(contados)
    .map(([productoId, stockContado]) => {
      const producto = productos.find((p) => p.id === productoId)
      if (!producto) return null
      const stockTeorico = Math.round(stockDe(movs, productoId, campo, hasta) * 1000) / 1000
      return {
        producto,
        campo,
        stockTeorico,
        stockContado,
        ajuste: Math.round((stockContado - stockTeorico) * 1000) / 1000,
      }
    })
    .filter(Boolean) as ConteoFisico[]
}

export function movimientosDeConteo(
  conteos: ConteoFisico[],
  fecha: string,
): MovimientoBodega[] {
  return conteos
    .filter((c) => c.ajuste !== 0)
    .map((c) => ({
      id: uid(),
      fecha,
      productoId: c.producto.id,
      campo: c.campo,
      accion: 'AJUSTE' as const,
      cantidad: c.ajuste,
      observaciones: `AJUSTE por conteo físico del ${fecha} · registro ${c.stockTeorico} ${c.producto.unidad}, contado ${c.stockContado} ${c.producto.unidad}`,
    }))
}

/* ─────────────── Aplicaciones fitosanitarias ─────────────── */

/**
 * Cantidad de producto que consume una aplicación.
 *
 * Se puede expresar de dos formas, y ambas conviven en la práctica:
 *   · por hectárea    → dosis/ha × hectáreas
 *   · por 100 litros  → dosis/100L × (mojamiento × hectáreas) ÷ 100
 *
 * Si vienen las dos, manda la dosis por hectárea, que es la que fiscaliza
 * el SAG.
 */
export function cantidadAplicada(a: {
  dosisPorHa?: number
  dosisPor100L?: number
  mojamiento: number
  hectareas: number
}) {
  if (a.dosisPorHa && a.dosisPorHa > 0) return Math.round(a.dosisPorHa * a.hectareas * 1000) / 1000
  if (a.dosisPor100L && a.dosisPor100L > 0)
    return Math.round(((a.dosisPor100L * a.mojamiento * a.hectareas) / 100) * 1000) / 1000
  return 0
}

const sumarDias = (fecha: string, dias: number) => {
  const d = new Date(fecha + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

const sumarHoras = (fecha: string, horas: number) => {
  const d = new Date(fecha + 'T08:00:00')
  d.setHours(d.getHours() + horas)
  return d.toISOString().slice(0, 16).replace('T', ' ')
}

/**
 * Carencia y reingreso de una aplicación.
 * La fecha de cosecha es el dato crítico: cosechar antes invalida la
 * certificación y puede significar rechazo del embarque.
 */
export function estadoCarencia(a: Aplicacion, hoy: string): EstadoCarencia {
  const fechaCosecha = sumarDias(a.fecha, a.carenciaDias)
  const diasParaCosecha = Math.ceil(
    (Date.parse(fechaCosecha) - Date.parse(hoy)) / 86_400_000,
  )
  return {
    aplicacion: a,
    fechaReingreso: sumarHoras(a.fecha, a.reingresoHoras),
    fechaCosecha,
    diasParaCosecha,
    vigente: diasParaCosecha > 0,
  }
}

/** Cuarteles que hoy no se pueden cosechar por carencia vigente. */
export function cuartelesEnCarencia(aplicaciones: Aplicacion[], hoy: string) {
  const estados = aplicaciones.map((a) => estadoCarencia(a, hoy)).filter((e) => e.vigente)
  const porCuartel = agrupar(estados, (e) => `${e.aplicacion.campo}¦${e.aplicacion.cc}`)

  return [...porCuartel.entries()]
    .map(([clave, es]) => {
      const [campo, cc] = clave.split('¦')
      // Manda la carencia que vence más tarde
      const critica = es.reduce((a, b) => (b.diasParaCosecha > a.diasParaCosecha ? b : a))
      return {
        campo,
        cc,
        especie: critica.aplicacion.especie,
        variedad: critica.aplicacion.variedad,
        fechaCosecha: critica.fechaCosecha,
        diasRestantes: critica.diasParaCosecha,
        aplicaciones: es.length,
      }
    })
    .sort((a, b) => b.diasRestantes - a.diasRestantes)
}

/** Movimiento de bodega que genera una aplicación. */
export function salidaDeAplicacion(a: Aplicacion): MovimientoBodega {
  return {
    id: uid(),
    fecha: a.fecha,
    productoId: a.productoId,
    campo: a.campo,
    accion: 'SALIDA',
    cantidad: -a.cantidadProducto,
    cc: a.cc,
    especie: a.especie,
    variedad: a.variedad,
    labor: 'APLICACIONES_QUIMICAS',
    aplicacionId: a.id,
    observaciones: `Aplicación ${a.plaga} · ${a.hectareas} ha`,
  }
}

/* ─────────────── Análisis y valorización ─────────────── */

export type DimensionBodega = 'cc' | 'campo' | 'especie' | 'categoria' | 'producto'

export function consumoPorDimension(
  productos: Producto[],
  movs: MovimientoBodega[],
  dim: DimensionBodega,
  filtro?: { campo?: string; desde?: string; hasta?: string },
) {
  const salidas = movs.filter(
    (m) =>
      m.cantidad < 0 &&
      m.accion !== 'AJUSTE' &&
      (!filtro?.campo || filtro.campo === 'TODOS' || m.campo === filtro.campo) &&
      (!filtro?.desde || m.fecha >= filtro.desde) &&
      (!filtro?.hasta || m.fecha <= filtro.hasta),
  )

  const clave = (m: MovimientoBodega) => {
    const p = productos.find((x) => x.id === m.productoId)
    if (dim === 'producto') return p?.nombre ?? '(sin producto)'
    if (dim === 'categoria') return p?.categoria ?? 'OTRO'
    return (m[dim as 'cc' | 'campo' | 'especie'] as string) || '(sin asignar)'
  }

  const grupos = agrupar(salidas, clave)
  const valor = (ms: MovimientoBodega[]) =>
    suma(ms, (m) => {
      const p = productos.find((x) => x.id === m.productoId)
      return Math.abs(m.cantidad) * (m.precioUnitario ?? p?.precioUnitario ?? 0)
    })
  const total = suma([...grupos.values()], valor)

  return [...grupos.entries()]
    .map(([nombre, ms]) => ({
      nombre,
      monto: Math.round(valor(ms)),
      movimientos: ms.length,
      proporcion: total > 0 ? valor(ms) / total : 0,
    }))
    .sort((a, b) => b.monto - a.monto)
}

export interface CostoInsumoCC {
  cc: string
  campo: string
  especie: string
  variedad: string
  categoria: string
  monto: number
}

/**
 * Valoriza el consumo del período por centro de costo y categoría.
 * La categoría define a qué cuenta N5 se imputa: los agroquímicos y los
 * fertilizantes no van a la misma partida.
 */
export function valorizarConsumo(
  productos: Producto[],
  movs: MovimientoBodega[],
  filtro?: { campo?: string; desde?: string; hasta?: string },
): CostoInsumoCC[] {
  const salidas = movs.filter(
    (m) =>
      m.cantidad < 0 &&
      m.accion !== 'AJUSTE' &&
      (!filtro?.campo || filtro.campo === 'TODOS' || m.campo === filtro.campo) &&
      (!filtro?.desde || m.fecha >= filtro.desde) &&
      (!filtro?.hasta || m.fecha <= filtro.hasta),
  )

  const grupos = agrupar(salidas, (m) => {
    const p = productos.find((x) => x.id === m.productoId)
    return [m.campo, m.cc ?? '', m.especie ?? '', m.variedad ?? '', p?.categoria ?? 'OTRO'].join('¦')
  })

  return [...grupos.values()]
    .map((ms) => {
      const p0 = productos.find((x) => x.id === ms[0].productoId)
      return {
        cc: ms[0].cc || `GENERAL ${ms[0].campo}`,
        campo: ms[0].campo,
        especie: ms[0].especie || '0',
        variedad: ms[0].variedad || '0',
        categoria: p0?.categoria ?? 'OTRO',
        monto: Math.round(
          suma(ms, (m) => {
            const p = productos.find((x) => x.id === m.productoId)
            return Math.abs(m.cantidad) * (m.precioUnitario ?? p?.precioUnitario ?? 0)
          }),
        ),
      }
    })
    .filter((x) => x.monto > 0)
    .sort((a, b) => b.monto - a.monto)
}

/** La categoría del producto define la subcuenta N5 del plan analítico. */
export const cuentaN5DeCategoria = (categoria: string) =>
  categoria === 'FERTILIZANTE' ? 'FERTILIZANTES' : 'AGROQUIMICOS'

/* ─────────────── Alertas ─────────────── */

export interface AlertaBodega {
  nivel: 'critico' | 'aviso' | 'info'
  mensaje: string
}

export function revisarBodega(
  filas: FilaStock[],
  aplicaciones: Aplicacion[],
  hoy: string,
): AlertaBodega[] {
  const alertas: AlertaBodega[] = []

  const negativos = filas.filter((f) => f.stock < 0)
  if (negativos.length)
    alertas.push({
      nivel: 'critico',
      mensaje: `${negativos.length} producto(s) con stock negativo: hay salidas registradas sin su entrada. Corresponde un conteo físico.`,
    })

  // Sólo cuentan los productos que esta bodega efectivamente maneja: un
  // producto sin movimientos no está "bajo mínimo", simplemente no se usa aquí.
  const bajos = filas.filter(
    (f) => f.movimientos > 0 && f.stock >= 0 && f.bajoMinimo && f.producto.stockMinimo > 0,
  )
  if (bajos.length)
    alertas.push({
      nivel: 'aviso',
      mensaje: `${bajos.length} producto(s) bajo stock mínimo: ${bajos.slice(0, 4).map((f) => f.producto.nombre).join(', ')}${bajos.length > 4 ? '…' : ''}`,
    })

  const enCarencia = cuartelesEnCarencia(aplicaciones, hoy)
  if (enCarencia.length)
    alertas.push({
      nivel: 'critico',
      mensaje: `${enCarencia.length} cuartel(es) en carencia: no se pueden cosechar todavía. El más largo vence el ${enCarencia[0].fechaCosecha}.`,
    })

  const sinIA = filas.filter((f) => f.salidas > 0 && !f.producto.ingredienteActivo)
  if (sinIA.length)
    alertas.push({
      nivel: 'aviso',
      mensaje: `${sinIA.length} producto(s) usados sin ingrediente activo registrado: el registro de aplicaciones queda incompleto para la certificadora.`,
    })

  return alertas
}
