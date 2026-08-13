/**
 * Maestros extraídos del archivo real "Maestro_Plan_de_Cuentas_muestra.xlsx".
 * Estas son las tablas base del sistema: se leen desde JSON y se normalizan aquí.
 * Cambiarlas en un solo lugar es justamente lo que hoy no permite Excel.
 */
import raw from './maestros.json'

export interface CuentaBase {
  n1: string
  c1: string
  n2: string
  c2: string
  n3: string
  c3: string
  n4: string
  c4: string
  n5: string
  c5: string
  codigo: string // ID_CUENTA_N4 — los 4 dígitos contables clásicos
}

export interface CentroCosto {
  cc: string
  campo: string
  codigo: string
}

export interface Cuartel {
  campo: string
  temporada: string
  uso: string
  especie: string
  rol: string
  propiedad: string
  variedad: string
  anioPlantacion: string
  cce: string
  hectareas: number
  hectareasProd: number
  riego: string
  plantas: number
  hileras: number
  cuarteles: string
}

export interface Cargo {
  cargo: string
  cuentaN4: string
  codigoN4: string
}

export const CUENTAS = raw.cuentas as CuentaBase[]
export const BASE_OPERATIVA = raw.baseOperativa as Cuartel[]
export const CARGOS = raw.cargos as Cargo[]
export const CENTROS_COSTO = raw.centrosCosto as CentroCosto[]
export const CAMPOS = raw.campos as { nombre: string; codigo: string }[]
export const ETAPAS_PLANTA = raw.etapaPlanta as { nombre: string; codigo: string }[]
export const ESPECIES = raw.especies as { nombre: string; codigo: string }[]
export const VARIEDADES = raw.variedades as { especie: string; variedad: string; codigo: string }[]
export const TEMPORADAS = raw.temporadas as string[]
export const UNIDADES = raw.unidades as string[]
export const MONEDAS = raw.monedas as string[]
export const ESTADOS_TRABAJADOR = raw.estadosTrabajador as string[]
export const DESTINOS_VENTA = raw.ventaDestino as { nombre: string; codigo: string }[]

/**
 * Labores agrícolas — N6 (general) → N7 (específica).
 *
 * Tanto las listas como los códigos vienen del maestro de la empresa
 * (AEB_Param), no se inventan ni se derivan del orden alfabético: el código
 * de cuenta que genera el sistema tiene que ser el mismo que el del Excel.
 *
 * Las labores que en el maestro no traen desglose N7 propio quedan con lista
 * vacía; al imputar se registran con 0 en ese nivel.
 */
export const LABORES = raw.labores as Record<string, string[]>

/** Orden y códigos oficiales del nivel N6. */
export const CODIGOS_N6 = raw.codigosN6 as Record<string, number>

export const LABORES_GENERALES = raw.laboresGenerales as string[]

export const codigoLaborGeneral = (general: string) => String(CODIGOS_N6[general] ?? 0)

export const codigoLaborEspecifica = (general: string, especifica: string) => {
  const list = LABORES[general] ?? []
  const i = list.indexOf(especifica)
  return i < 0 ? '0' : String(i + 1)
}

/** Cargo → cuenta contable N4. Es el puente RRHH ↔ contabilidad. */
export const cuentaDeCargo = (cargo: string): Cargo | undefined =>
  CARGOS.find((c) => c.cargo.trim().toUpperCase() === cargo.trim().toUpperCase())

/** Centros de costo de un campo. */
export const ccDeCampo = (campo: string) => CENTROS_COSTO.filter((c) => c.campo === campo)

/** Variedades de una especie. */
export const variedadesDeEspecie = (especie: string) =>
  VARIEDADES.filter((v) => v.especie === especie)

/** Superficie total y productiva por campo y temporada. */
export function superficiePorCampo(temporada: string) {
  const acc = new Map<string, { has: number; hasProd: number; plantas: number; cuarteles: number }>()
  for (const c of BASE_OPERATIVA) {
    if (c.temporada !== temporada) continue
    const cur = acc.get(c.campo) ?? { has: 0, hasProd: 0, plantas: 0, cuarteles: 0 }
    cur.has += c.hectareas
    cur.hasProd += c.hectareasProd
    cur.plantas += c.plantas
    cur.cuarteles += 1
    acc.set(c.campo, cur)
  }
  return acc
}

/** Cuentas de costo imputables (las que reciben mano de obra e insumos). */
export const CUENTAS_COSTO = CUENTAS.filter((c) => c.n1 === 'COSTOS')

/** Índice rápido por código N4. */
export const cuentaPorCodigo = (codigo: string) => CUENTAS.find((c) => c.codigo === codigo)
