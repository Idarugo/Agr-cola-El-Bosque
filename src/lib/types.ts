/** Modelo de dominio SIGA · Agrícola El Bosque Ltda. */

/** Las 13 dimensiones del plan de cuentas (N1…N13). */
export interface ImputacionContable {
  n1: string // ACTIVO / PASIVO / COSTOS / INGRESOS
  n2: string // CIRCULANTE / COSTO_OPERACIONAL …
  n3: string // DISPONIBLE / DIRECTOS_DE_PRODUCCION …
  n4: string // CAJA / MANO_DE_OBRA / INSUMOS …
  n5: string // FERTILIZANTES / CONTRATISTA / SUELDOS_ADM …
  n6: string // LABOR_AGRICOLA_GENERAL
  n7: string // LABOR_AGRICOLA_ESPECIFICA
  n8: string // ETAPA_PLANTA
  n9: string // ESPECIE
  n10: string // VARIEDAD
  n11: string // CAMPO
  n12: string // TEMPORADA_AGRICOLA
  n13: string // CENTRO DE COSTO
}

export type EstadoTrabajador =
  | 'ACTIVO'
  | 'ACTIVO-LICENCIA'
  | 'FINIQUITADO'
  | 'FINIQUITO PENDIENTE'

export type TipoContrato = 'INDEFINIDO' | 'PLAZO FIJO' | 'POR FAENA' | 'HONORARIOS'

export interface Trabajador {
  id: string
  rut: string
  nombres: string
  apellidos: string
  cargo: string
  campo: string
  estado: EstadoTrabajador
  tipoContrato: TipoContrato
  fechaIngreso: string // YYYY-MM-DD
  fechaFiniquito?: string
  sueldoBase: number // CLP
  /** Ficha personal — necesaria para EPP y certificaciones */
  telefono?: string
  direccion?: string
  fechaNacimiento?: string
  tallaRopa?: string
  tallaCalzado?: string
  /** Datos de pago para la nómina bancaria */
  banco?: string
  tipoCuenta?: string
  nroCuenta?: string
  afp?: string
  salud?: string
  /** Gamificación — pack motivacional */
  semillas: number
}

/** Cómo se marca un día en la tarja. Reemplaza el "no trabajador" del Excel. */
export type TipoDia =
  | 'TRABAJADO'
  | 'TRATO'
  | 'VACACIONES'
  | 'LICENCIA'
  | 'PERMISO'
  | 'FALTA_JUSTIFICADA'
  | 'FALTA_INJUSTIFICADA'
  | 'INHABIL'
  | 'LLUVIA'

export const TIPO_DIA_META: Record<
  TipoDia,
  { label: string; corto: string; jornadaValida: boolean; color: string; descripcion: string }
> = {
  TRABAJADO: {
    label: 'Trabajado',
    corto: 'T',
    jornadaValida: true,
    color: 'brand',
    descripcion: 'Jornada efectiva. Fines de semana trabajados también cuentan.',
  },
  TRATO: {
    label: 'A trato',
    corto: 'TR',
    jornadaValida: true,
    color: 'accent',
    descripcion: 'Pago a trato convertido a equivalencia de jornada real (asistió).',
  },
  VACACIONES: {
    label: 'Vacaciones',
    corto: 'V',
    jornadaValida: true,
    color: 'sky',
    descripcion: 'Se contabiliza como jornada válida y se redistribuye al cierre.',
  },
  LICENCIA: {
    label: 'Licencia médica',
    corto: 'LM',
    jornadaValida: false,
    color: 'violet',
    descripcion: 'No genera jornada. Control interno paralelo a Nubox.',
  },
  PERMISO: {
    label: 'Permiso especial',
    corto: 'P',
    jornadaValida: false,
    color: 'slate',
    descripcion: 'Permiso autorizado, sin jornada.',
  },
  FALTA_JUSTIFICADA: {
    label: 'Falta justificada',
    corto: 'FJ',
    jornadaValida: false,
    color: 'amber',
    descripcion: 'Ausencia con respaldo documental.',
  },
  FALTA_INJUSTIFICADA: {
    label: 'Falta injustificada',
    corto: 'FI',
    jornadaValida: false,
    color: 'red',
    descripcion: 'Ausencia sin aviso. Descuenta semillas del pack motivacional.',
  },
  INHABIL: {
    label: 'Día inhábil',
    corto: 'IN',
    jornadaValida: false,
    color: 'slate',
    descripcion: 'Domingo o festivo no trabajado.',
  },
  LLUVIA: {
    label: 'Lluvia',
    corto: 'LL',
    jornadaValida: false,
    color: 'sky',
    descripcion: 'Faena detenida por clima.',
  },
}

/** Una línea de tarja = un trabajador, un día, una labor, un centro de costo. */
export interface RegistroTarja {
  id: string
  fecha: string // YYYY-MM-DD
  trabajadorId: string
  campo: string
  cc: string
  laborGeneral: string
  laborEspecifica: string
  especie: string
  variedad: string
  etapaPlanta: string
  temporada: string
  tipoDia: TipoDia
  jornadas: number // 1 = jornada completa; 0.5 media; a trato = equivalencia
  horaLlegada?: string // HH:MM — base para atrasos y horas extra
  horasExtra: number
  rendimiento?: number // cantidad producida (kg, bins, hileras…)
  unidadRendimiento?: string
  observacion?: string
}

/** Libro de remuneraciones del contador (export Nubox). */
export interface Remuneracion {
  id: string
  periodo: string // YYYY-MM
  trabajadorId: string
  totalHaber: number
  asignacionFamiliar: number
  totalDescuentos: number
  liquido: number
  costoEmpresa: number
  anticipo: number
}

/** Resultado del motor: una línea de costo imputada a las 13 dimensiones. */
export interface LineaCosto {
  id: string
  periodo: string
  trabajadorId: string
  trabajador: string
  rut: string
  cargo: string
  imputacion: ImputacionContable
  codigoN4: string
  codigoCuenta: string
  jornadas: number
  monto: number
}

export interface ResumenDistribucion {
  periodo: string
  campo: string
  diasMes: number
  base: 'DEVENGO' | 'LIBRO'
  totalDistribuido: number
  trabajadores: number
  jornadasTotales: number
  lineas: LineaCosto[]
  advertencias: string[]
}

/* ─────────────── Prevención de riesgos ─────────────── */

export interface ItemEPP {
  id: string
  nombre: string
  unidad: string
  stock: number
  stockMinimo: number
  vidaUtilDias: number
  costoUnitario: number
}

/** Matriz EPP por cargo — hecha con la mutual, hoy en papel. */
export interface MatrizEPP {
  id: string
  cargo: string
  eppId: string
  cantidad: number
  obligatorio: boolean
}

export interface EntregaEPP {
  id: string
  fecha: string
  trabajadorId: string
  eppId: string
  cantidad: number
  motivo: 'ENTREGA INICIAL' | 'RENOVACIÓN' | 'REPOSICIÓN POR DAÑO' | 'REPOSICIÓN POR PÉRDIDA'
  firmado: boolean
}

export interface Capacitacion {
  id: string
  nombre: string
  fecha: string
  horas: number
  relator: string
  campo: string
  vigenciaMeses: number
  asistentes: string[] // ids de trabajadores
  urlMaterial?: string
}

/** Charla de 5 minutos del jefe de campo — exigencia ACHS. */
export interface CharlaSeguridad {
  id: string
  fecha: string
  campo: string
  laborGeneral: string
  riesgos: string
  medidas: string
  responsable: string
  asistentes: string[]
}

/* ─────────────── Pack motivacional ─────────────── */

export interface MovimientoSemillas {
  id: string
  fecha: string
  trabajadorId: string
  motivo: string
  semillas: number // positivo suma, negativo canje/descuento
  tipo: 'ASISTENCIA' | 'PUNTUALIDAD' | 'EPP' | 'RENDIMIENTO' | 'CANJE' | 'SANCIÓN'
}

export interface Premio {
  id: string
  nombre: string
  costoSemillas: number
  stock: number
}

/* ─────────────── Control de combustible ─────────────── */

/**
 * Estanque de petróleo de un campo. La calibración permite convertir la
 * medición con vara (centímetros) a litros, que es como se controla en terreno.
 */
export interface Estanque {
  id: string
  nombre: string
  campo: string
  capacidad: number // litros
  /** Centímetros que equivalen a 100 litros — regla de tres de la planilla. */
  cmPorCienLitros: number
  tieneContador: boolean
  activo: boolean
}

export type AccionCombustible = 'STOCK_INICIAL' | 'ENTRADA' | 'SALIDA' | 'CONTROL' | 'AJUSTE'

export const ACCION_META: Record<
  AccionCombustible,
  { label: string; corto: string; color: string; descripcion: string }
> = {
  STOCK_INICIAL: {
    label: 'Stock inicial',
    corto: 'SI',
    color: 'slate',
    descripcion: 'Apertura del control. Se registra una sola vez por estanque.',
  },
  ENTRADA: {
    label: 'Entrada',
    corto: 'E',
    color: 'brand',
    descripcion: 'Carga de combustible al estanque. Litros positivos.',
  },
  SALIDA: {
    label: 'Salida',
    corto: 'S',
    color: 'accent',
    descripcion: 'Consumo imputado a un centro de costo, labor y vehículo.',
  },
  CONTROL: {
    label: 'Control físico',
    corto: 'C',
    color: 'sky',
    descripcion: 'Medición del estanque. No mueve litros: registra lo visible.',
  },
  AJUSTE: {
    label: 'Ajuste',
    corto: 'A',
    color: 'violet',
    descripcion: 'Corrección prorrateada tras un control. Entrada si sobra, salida si falta.',
  },
}

export interface MovimientoCombustible {
  id: string
  fecha: string // YYYY-MM-DD
  estanqueId: string
  accion: AccionCombustible
  campo: string
  /** Dimensiones analíticas del consumo. */
  especie: string
  variedad: string
  cc: string
  labor: string
  horas?: number
  /** Litros con signo: positivo entra, negativo sale. En CONTROL va en cero. */
  litros: number
  /** Lectura del contador mecánico del estanque, si lo tiene. */
  contador?: number
  /** Precio por litro de la compra (sólo en ENTRADA). */
  precio?: number
  chofer?: string
  vehiculo?: string
  observaciones?: string
  /** Litros visibles medidos en el estanque (sólo en CONTROL). */
  visible?: number
}

/** Estado de un estanque en un momento dado. */
export interface EstadoEstanque {
  estanque: Estanque
  stockEstimado: number
  ultimoControl?: MovimientoCombustible
  visibleUltimoControl?: number
  diferencia: number
  movimientosDesdeControl: number
  entradas: number
  salidas: number
}

/** Una línea del prorrateo de diferencias entre centros de costo. */
export interface LineaProrrateo {
  cc: string
  campo: string
  salidasNetas: number
  proporcion: number
  ajuste: number
}

/* ─────────────── Usuarios y auditoría ─────────────── */

export interface Usuario {
  id: string
  usuario: string // nombre de acceso, en minúsculas
  nombre: string
  rut: string
  rol: import('./auth').Rol
  /** Campos que puede ver. Vacío = todos, para gerencia y contabilidad. */
  campos: string[]
  cargo?: string
  email?: string
  activo: boolean
  claveHash: string
  sal: string
  /** Obliga a cambiar la clave en el primer ingreso. */
  debeCambiarClave: boolean
  creadoEn: string
  ultimoIngreso?: string
  intentosFallidos: number
  bloqueadoHasta?: number
}

export interface Sesion {
  usuarioId: string
  usuario: string
  nombre: string
  rol: import('./auth').Rol
  campos: string[]
  iniciadaEn: number
  expiraEn: number
}

export type AccionAuditoria =
  | 'INGRESO'
  | 'SALIDA'
  | 'INGRESO_FALLIDO'
  | 'CREAR'
  | 'MODIFICAR'
  | 'ELIMINAR'
  | 'CONTABILIZAR'
  | 'EXPORTAR'
  | 'AJUSTE'

/** Bitácora: quién hizo qué y cuándo. Es requisito de control documental. */
export interface RegistroAuditoria {
  id: string
  fecha: string // ISO completo
  usuarioId?: string
  usuario: string
  rol?: string
  accion: AccionAuditoria
  modulo: string
  detalle: string
}

/* ─────────────── Bodega de insumos ─────────────── */

export type CategoriaProducto =
  | 'FERTILIZANTE'
  | 'HERBICIDA'
  | 'FUNGICIDA'
  | 'INSECTICIDA'
  | 'BIOESTIMULANTE'
  | 'COADYUVANTE'
  | 'OTRO'

export interface Producto {
  id: string
  nombre: string
  /** Necesario para el registro de aplicaciones y para las certificadoras. */
  ingredienteActivo: string
  unidad: string // LT, KG
  categoria: CategoriaProducto
  stockMinimo: number
  precioUnitario: number
  /** Días entre la aplicación y la cosecha permitida. */
  carenciaDias: number
  /** Horas antes de poder reingresar al cuartel. */
  reingresoHoras: number
  activo: boolean
}

export type AccionBodega = 'STOCK_INICIAL' | 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'TRASLADO'

export const ACCION_BODEGA_META: Record<
  AccionBodega,
  { label: string; color: string; descripcion: string }
> = {
  STOCK_INICIAL: {
    label: 'Stock inicial',
    color: 'slate',
    descripcion: 'Apertura del control de bodega para el producto.',
  },
  ENTRADA: {
    label: 'Entrada',
    color: 'brand',
    descripcion: 'Compra o recepción de producto en bodega.',
  },
  SALIDA: {
    label: 'Salida',
    color: 'accent',
    descripcion: 'Consumo imputado a un centro de costo. Las aplicaciones la generan solas.',
  },
  AJUSTE: {
    label: 'Ajuste por conteo',
    color: 'violet',
    descripcion: 'Corrección tras un conteo físico: cuadra el registro con lo que hay en bodega.',
  },
  TRASLADO: {
    label: 'Traslado entre campos',
    color: 'sky',
    descripcion: 'Movimiento de producto de una bodega a otra.',
  },
}

export interface MovimientoBodega {
  id: string
  fecha: string
  productoId: string
  campo: string
  accion: AccionBodega
  /** Cantidad con signo: positiva entra, negativa sale. */
  cantidad: number
  cc?: string
  especie?: string
  variedad?: string
  labor?: string
  documento?: string
  precioUnitario?: number
  observaciones?: string
  /** Enlace a la aplicación que originó la salida, si corresponde. */
  aplicacionId?: string
}

export interface ConteoFisico {
  producto: Producto
  campo: string
  stockTeorico: number
  stockContado: number
  ajuste: number
}

/* ─────────────── Registro de aplicaciones fitosanitarias ─────────────── */

/**
 * Formulario M2-008-F004 · "Registro de aplicaciones".
 * Es exigencia de las certificadoras y del SAG: cada aplicación debe quedar
 * con producto, ingrediente activo, dosis, mojamiento y carencia.
 */
export interface Aplicacion {
  id: string
  fecha: string
  campo: string
  predio: string
  cuartel: string
  cc: string
  especie: string
  variedad: string
  plaga: string
  productoId: string
  /** Dosis por cada 100 litros de agua. */
  dosisPor100L?: number
  /** Dosis por hectárea. */
  dosisPorHa?: number
  /** Litros de caldo por hectárea. */
  mojamiento: number
  hectareas: number
  /** Cantidad total de producto usada — descuenta stock de bodega. */
  cantidadProducto: number
  carenciaDias: number
  reingresoHoras: number
  aplicador: string
  maquina?: string
  condiciones?: string
  observaciones?: string
}

export interface EstadoCarencia {
  aplicacion: Aplicacion
  fechaReingreso: string
  fechaCosecha: string
  diasParaCosecha: number
  vigente: boolean
}

/* ─────────────── Contabilidad de doble entrada ─────────────── */

/**
 * Una línea del Libro Diario. Lleva simultáneamente:
 *  · la cuenta financiera (1.x–5.x) que manda en los estados financieros
 *  · las 13 dimensiones analíticas que mandan en la gestión de costos
 * Ese doble registro es lo que une las dos fuentes de información que
 * hoy la empresa maneja por separado.
 */
export interface LineaAsiento {
  id: string
  cuenta: string // código financiero: 5.1, 2.4, 1.71…
  debe: number
  haber: number
  glosaLinea?: string
  /** Dimensiones analíticas — opcionales fuera de las cuentas de costo. */
  n1?: string
  n2?: string
  n3?: string
  n4?: string
  n5?: string
  n6?: string
  n7?: string
  n8?: string
  n9?: string
  n10?: string
  n11?: string
  n12?: string
  n13?: string
  codigoN4?: string // 4111, 2131…
  jornadas?: number
}

export type OrigenAsiento = 'MANUAL' | 'REMUNERACIONES' | 'COMPRAS' | 'VENTAS' | 'AJUSTE'

export interface Asiento {
  id: string
  numero: number
  fecha: string // YYYY-MM-DD
  glosa: string
  origen: OrigenAsiento
  nroDocumento?: string
  observaciones?: string
  lineas: LineaAsiento[]
}

export interface ConfigEjercicio {
  empresa: string
  rut: string
  moneda: string
  fechaInicio: string
  fechaFin: string
  tasaImpuesto: number // 0.27 = 27% primera categoría
}

/** Una fila del Libro Mayor: movimiento con saldo acumulado. */
export interface MovimientoMayor {
  fecha: string
  numero: number
  glosa: string
  debe: number
  haber: number
  saldo: number
}

export interface CuentaMayor {
  codigo: string
  nombre: string
  tipo: string
  subtipo: string
  naturaleza: string
  movimientos: MovimientoMayor[]
  totalDebe: number
  totalHaber: number
  saldoFinal: number
}

/** Una fila del Balance de 8 columnas. */
export interface FilaBalance8 {
  codigo: string
  nombre: string
  tipo: string
  subtipo: string
  naturaleza: string
  debe: number
  haber: number
  saldoDeudor: number
  saldoAcreedor: number
  activo: number
  pasivo: number
  perdida: number
  ganancia: number
}

export interface EstadoResultados {
  ingresosOperacionales: number
  costoVentas: number
  margenBruto: number
  gastosAdministracion: number
  resultadoOperacional: number
  gastosFinancieros: number
  otrosIngresos: number
  utilidadAntesImpuesto: number
  provisionImpuesto: number
  utilidadNeta: number
  detalle: { codigo: string; nombre: string; monto: number; grupo: string }[]
}

export interface BalanceGeneral {
  activoCorriente: number
  activoNoCorriente: number
  totalActivo: number
  pasivoCorriente: number
  pasivoNoCorriente: number
  totalPasivo: number
  patrimonio: number
  resultadoEjercicio: number
  totalPasivoPatrimonio: number
  descuadre: number
}
