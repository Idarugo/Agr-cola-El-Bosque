/**
 * ══════════════════════════════════════════════════════════════════════
 *  PLAN DE CUENTAS FINANCIERO
 * ══════════════════════════════════════════════════════════════════════
 *
 *  Extraído de Sistema_contable_AEB_V01.xlsx · hoja "Plan_de_Cuentas".
 *
 *  Convive con el plan analítico de 13 niveles, no lo reemplaza:
 *
 *    · Plan financiero (1.x – 5.x) → Balance y Estado de Resultados.
 *      Es lo que entiende el contador y lo que exige el SII.
 *    · Plan analítico (N1 – N13)   → costo por labor, cuartel y hectárea.
 *      Es lo que necesita gerencia para decidir.
 *
 *  Cada línea del Libro Diario lleva ambos: la cuenta financiera manda
 *  en los estados financieros, las 13 dimensiones mandan en la gestión.
 */

export type TipoCuenta = 'Activo' | 'Pasivo' | 'Patrimonio' | 'Ingreso' | 'Gasto'
export type Naturaleza = 'Deudora' | 'Acreedora' | 'Mixta'
export type SubtipoCuenta =
  | 'Activo Corriente'
  | 'Activo No Corriente'
  | 'Pasivo Corriente'
  | 'Pasivo No Corriente'
  | 'Patrimonio'
  | 'Ingreso'
  | 'Gasto'

export interface CuentaFinanciera {
  codigo: string
  nombre: string
  tipo: TipoCuenta
  subtipo: SubtipoCuenta
  naturaleza: Naturaleza
  activa: boolean
}

const c = (
  codigo: string,
  nombre: string,
  tipo: TipoCuenta,
  subtipo: SubtipoCuenta,
  naturaleza: Naturaleza = 'Deudora',
): CuentaFinanciera => ({ codigo, nombre, tipo, subtipo, naturaleza, activa: true })

export const PLAN_FINANCIERO: CuentaFinanciera[] = [
  // ── 1.x ACTIVO ─────────────────────────────────────────────────────
  c('1.1', 'Caja', 'Activo', 'Activo Corriente'),
  c('1.2', 'Banco', 'Activo', 'Activo Corriente'),
  c('1.3', 'Clientes por cobrar', 'Activo', 'Activo Corriente'),
  c('1.4', 'Documentos por cobrar', 'Activo', 'Activo Corriente'),
  c('1.5', 'Inventarios', 'Activo', 'Activo Corriente'),
  c('1.6', 'IVA Crédito Fiscal', 'Activo', 'Activo Corriente'),
  c('1.7', 'Anticipos a proveedores', 'Activo', 'Activo Corriente'),
  c('1.71', 'Anticipos de Sueldos', 'Activo', 'Activo Corriente'),
  c('1.8', 'PPM Por recuperar', 'Activo', 'Activo Corriente'),
  c('1.9', 'Retenciones judiciales', 'Activo', 'Activo Corriente'),
  c('1.10', 'Clientes', 'Activo', 'Activo Corriente'),
  c('1.11', 'Propiedad, planta y equipo', 'Activo', 'Activo No Corriente'),
  c('1.12', 'Depreciación acumulada', 'Activo', 'Activo No Corriente', 'Acreedora'),
  c('1.13', 'Mercaderia', 'Activo', 'Activo Corriente'),
  c('1.14', 'Activos intangibles', 'Activo', 'Activo No Corriente'),

  // ── 2.x PASIVO ─────────────────────────────────────────────────────
  c('2.1', 'Proveedores', 'Pasivo', 'Pasivo Corriente', 'Acreedora'),
  c('2.2', 'Documentos por pagar', 'Pasivo', 'Pasivo Corriente', 'Acreedora'),
  c('2.3', 'IVA Débito Fiscal', 'Pasivo', 'Pasivo Corriente', 'Acreedora'),
  c('2.4', 'Remuneraciones por pagar', 'Pasivo', 'Pasivo Corriente', 'Acreedora'),
  c('2.5', 'Impuestos por pagar', 'Pasivo', 'Pasivo Corriente', 'Acreedora'),
  c('2.6', 'Retención de honorarios', 'Pasivo', 'Pasivo Corriente', 'Acreedora'),
  c('2.7', 'Leyes sociales por pagar', 'Pasivo', 'Pasivo Corriente', 'Acreedora'),
  c('2.71', 'Seguros de Vida por pagar', 'Pasivo', 'Pasivo Corriente', 'Acreedora'),
  c('2.8', 'Impuesto único de 2da categoría', 'Pasivo', 'Pasivo Corriente', 'Acreedora'),
  c('2.9', 'Préstamo solidario', 'Pasivo', 'Pasivo Corriente', 'Acreedora'),
  c('2.10', 'Préstamos bancarios (LP)', 'Pasivo', 'Pasivo No Corriente', 'Acreedora'),

  // ── 3.x PATRIMONIO ─────────────────────────────────────────────────
  c('3.1', 'Capital social', 'Patrimonio', 'Patrimonio', 'Acreedora'),
  c('3.2', 'Resultados acumulados', 'Patrimonio', 'Patrimonio', 'Acreedora'),
  c('3.3', 'Utilidad (Pérdida) del ejercicio', 'Patrimonio', 'Patrimonio', 'Acreedora'),
  c('3.4', 'Cuenta particular socio', 'Patrimonio', 'Patrimonio'),

  // ── 4.x INGRESOS ───────────────────────────────────────────────────
  c('4.1', 'Ventas', 'Ingreso', 'Ingreso', 'Acreedora'),
  c('4.2', 'Servicios', 'Ingreso', 'Ingreso', 'Acreedora'),
  c('4.3', 'Descuentos sobre ventas', 'Ingreso', 'Ingreso'),

  // ── 5.x GASTOS ─────────────────────────────────────────────────────
  c('5.1', 'Costo de ventas', 'Gasto', 'Gasto'),
  c('5.2', 'Sueldos y salarios', 'Gasto', 'Gasto'),
  c('5.3', 'Arriendo', 'Gasto', 'Gasto'),
  c('5.4', 'Servicios básicos', 'Gasto', 'Gasto'),
  c('5.5', 'Honorarios', 'Gasto', 'Gasto'),
  c('5.6', 'Publicidad y marketing', 'Gasto', 'Gasto'),
  c('5.7', 'Depreciación', 'Gasto', 'Gasto'),
  c('5.8', 'Intereses y gastos financieros', 'Gasto', 'Gasto'),
  c('5.9', 'Gastos varios', 'Gasto', 'Gasto'),
  c('5.10', 'Patentes y permisos', 'Gasto', 'Gasto'),
  c('5.11', 'Seguros obligatorios', 'Gasto', 'Gasto'),
  c('5.12', 'Multas', 'Gasto', 'Gasto'),
  c('5.13', 'Corrección monetaria', 'Gasto', 'Gasto', 'Mixta'),
]

export const cuentaFin = (codigo: string) => PLAN_FINANCIERO.find((x) => x.codigo === codigo)

export const nombreCuentaFin = (codigo: string) => cuentaFin(codigo)?.nombre ?? ''

/** Orden natural del plan: 1.1, 1.2, 1.10, 1.71, 2.1… (no alfabético). */
export const ordenCodigo = (a: string, b: string) => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  return (pa[0] ?? 0) - (pb[0] ?? 0) || (pa[1] ?? 0) - (pb[1] ?? 0)
}

export const PLAN_ORDENADO = [...PLAN_FINANCIERO].sort((x, y) => ordenCodigo(x.codigo, y.codigo))

/**
 * ── Puente analítico → financiero ──────────────────────────────────
 * Traduce el código N4 del plan de 13 niveles (4111, 2131, 1151…) a la
 * cuenta financiera que corresponde en el Libro Diario.
 *
 * Los cruces base están tomados del asiento real de remuneraciones de
 * junio 2026 que ya existe en Sistema_contable_AEB_V01.xlsx.
 */
export const MAPEO_N4_FINANCIERA: Record<string, string> = {
  // Activo
  '1111': '1.1', // CAJA
  '1112': '1.1', // FONDOS POR RENDIR
  '1113': '1.2', // BANCOS
  '1121': '1.5', // AGROQUIMICOS (materias primas)
  '1122': '1.5',
  '1123': '1.5',
  '1124': '1.5',
  '1125': '1.5',
  '1140': '1.3', // CLIENTES POR COBRAR
  '1151': '1.71', // ANTICIPO REMUNERACIONES BUIN
  '1152': '1.71',
  '1153': '1.71',
  '1155': '1.71',
  '1156': '1.71',
  '1157': '1.71', // OTROS DESCUENTOS REMUNERACIONES
  '1158': '1.71', // PRESTAMO TRABAJADORES
  '1161': '1.6', // IVA CREDITO
  '1162': '1.8', // IMPUESTOS DIFERIDOS

  // Pasivo
  '2121': '2.7', // LEYES SOCIALES POR PAGAR
  '2131': '2.4', // REMUNERACIONES POR PAGAR

  // Costos — todos van a 5.1 Costo de ventas, tal como lo registra hoy
  '4111': '5.1', // INSUMOS
  '4112': '5.1', // MANO_DE_OBRA
  '4113': '5.1', // SERVICIOS_AGRICOLAS
  '4121': '5.1', // GASTOS_OFICINA
  '4122': '5.5', // HONORARIOS
  '4123': '5.9', // MANTENCIÓN
  '4125': '5.4', // SERVICIOS_BÁSICOS
  '4126': '5.1', // SUELDOS_ADM
  '4127': '5.9', // SEGURIDAD_PREVENCIÓN (EPP)
  '4128': '5.3', // SERVICIOS_EXTERNOS (arriendos)
  '4129': '5.11', // SEGUROS
  '4130': '5.7', // DEPRECIACION
  '4131': '5.7',
  '4132': '5.7',
  '4133': '5.7',
  '4134': '5.7',
  '4135': '5.7',
  '4141': '5.1', // NO AGRICOLAS DIRECTOS
  '4142': '5.1',
  '4143': '5.9',
  '4221': '5.9', // NO OPERACIONAL

  // Ingresos
  '5111': '4.1', // VENTA FRUTA
  '5112': '4.2', // SERVICIOS AGRÍCOLAS
  '5113': '4.2', // ARRIENDOS
  '5114': '4.1',
  '5121': '4.2',
  '5122': '4.2',
  '5123': '4.1',
}

export const financieraDeN4 = (n4: string) => MAPEO_N4_FINANCIERA[n4] ?? '5.9'

/** Cuentas usadas al armar el asiento de remuneraciones. */
export const CUENTAS_REMUNERACIONES = {
  costo: '5.1',
  sueldosAdm: '5.1',
  liquidoPorPagar: '2.4',
  leyesSociales: '2.7',
  impuestoUnico: '2.5',
  anticipos: '1.71',
} as const
