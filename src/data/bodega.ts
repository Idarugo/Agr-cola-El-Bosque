/**
 * Maestro de insumos, extraído de las hojas "Stock sept LL" y "Stock Sept CH"
 * de la planilla de control. Son 108 productos reales, 43 con su ingrediente
 * activo declarado — el resto quedó pendiente de completar y el sistema lo
 * avisa, porque sin ingrediente activo el registro de aplicaciones no sirve
 * ante una certificadora.
 */
import type { MovimientoBodega, Producto } from '@/lib/types'
import raw from './bodega.json'
import { uid } from '@/lib/utils'

interface ProductoCrudo {
  nombre: string
  unidad: string
  ingredienteActivo: string
  categoria: string
  campos: string[]
}

/**
 * Carencias y reingresos por categoría. Son valores de referencia
 * conservadores: la carencia real la fija la etiqueta de cada producto y
 * debe cargarse producto a producto antes de operar.
 */
const CARENCIA_POR_CATEGORIA: Record<string, { carencia: number; reingreso: number }> = {
  INSECTICIDA: { carencia: 14, reingreso: 24 },
  FUNGICIDA: { carencia: 7, reingreso: 12 },
  HERBICIDA: { carencia: 30, reingreso: 24 },
  FERTILIZANTE: { carencia: 0, reingreso: 0 },
  BIOESTIMULANTE: { carencia: 0, reingreso: 4 },
  COADYUVANTE: { carencia: 0, reingreso: 4 },
  OTRO: { carencia: 0, reingreso: 0 },
}

/** Precios de referencia por categoría, en $/unidad. */
const PRECIO_POR_CATEGORIA: Record<string, number> = {
  INSECTICIDA: 42_000,
  FUNGICIDA: 18_000,
  HERBICIDA: 15_000,
  FERTILIZANTE: 1_200,
  BIOESTIMULANTE: 22_000,
  COADYUVANTE: 6_500,
  OTRO: 12_000,
}

export const PRODUCTOS_INICIALES: Producto[] = (raw.productos as ProductoCrudo[]).map((p, i) => {
  const c = CARENCIA_POR_CATEGORIA[p.categoria] ?? CARENCIA_POR_CATEGORIA.OTRO
  return {
    id: `prod-${i}`,
    nombre: p.nombre,
    ingredienteActivo: p.ingredienteActivo,
    unidad: p.unidad,
    categoria: p.categoria as Producto['categoria'],
    stockMinimo: p.categoria === 'FERTILIZANTE' ? 200 : 5,
    precioUnitario: PRECIO_POR_CATEGORIA[p.categoria] ?? 12_000,
    carenciaDias: c.carencia,
    reingresoHoras: c.reingreso,
    activo: true,
  }
})

export const CATEGORIAS_PRODUCTO = [
  'FERTILIZANTE', 'HERBICIDA', 'FUNGICIDA', 'INSECTICIDA',
  'BIOESTIMULANTE', 'COADYUVANTE', 'OTRO',
] as const

/** Plagas y objetivos habituales, para el registro de aplicaciones. */
export const PLAGAS = [
  'Arañita bimaculada', 'Botrytis', 'Burrito', 'Chanchito blanco', 'Clorosis férrica',
  'Conchuela', 'Cuncunilla', 'Escama de San José', 'Fertilización foliar',
  'Malezas de hoja ancha', 'Malezas gramíneas', 'Mosquita blanca', 'Oidio',
  'Polilla de la manzana', 'Pudrición gris', 'Trips', 'Tizón', 'Venturia',
  'Aplicación preventiva', 'Corrección nutricional',
]

/** Equipos de aplicación disponibles. */
export const MAQUINAS_APLICACION = [
  'Nebulizadora Fumagri', 'Nebulizadora Jacto', 'Pulverizadora de barra',
  'Bomba de espalda', 'Turbo atomizadora', 'Aplicación manual',
]

/**
 * Stock físico contado en septiembre, tal como quedó en las hojas del Excel.
 * Se carga como stock inicial de cada bodega.
 */
export function movimientosInicialesBodega(): MovimientoBodega[] {
  const porNombre = new Map(PRODUCTOS_INICIALES.map((p) => [p.nombre, p]))
  return (raw.stockSeptiembre as { campo: string; producto: string; cantidad: number }[])
    .map((s) => {
      const p = porNombre.get(s.producto)
      if (!p || s.cantidad === 0) return null
      return {
        id: uid(),
        fecha: '2025-09-30',
        productoId: p.id,
        campo: s.campo,
        accion: 'STOCK_INICIAL' as const,
        cantidad: s.cantidad,
        observaciones: 'Conteo físico de septiembre',
      }
    })
    .filter(Boolean) as MovimientoBodega[]
}
