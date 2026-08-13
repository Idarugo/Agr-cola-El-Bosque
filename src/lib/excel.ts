/**
 * Exportación a Excel. El sistema reemplaza las planillas, pero la
 * información sigue saliendo en el formato que ya usan el contador,
 * el banco y las certificadoras.
 */
import * as XLSX from 'xlsx'
import type {
  Asiento, Capacitacion, CharlaSeguridad, ConfigEjercicio, EntregaEPP, Estanque, ItemEPP,
  MovimientoBodega, MovimientoCombustible, Producto, Aplicacion, RegistroAuditoria,
  RegistroTarja, Remuneracion, ResumenDistribucion, Trabajador,
} from './types'
import { cuartelesEnCarencia, estadoCarencia, inventario } from './motorBodega'
import {
  consumoPorDimension, estadoDeEstanque, hojaDeConteo, precioPromedio, serieMensual,
  type DimensionConsumo,
} from './motorCombustible'
import {
  balance8Columnas, balanceGeneral, construirMayor, controlarAsientos,
  estadoResultados, estaCuadrado,
} from './contabilidad'
import { cuentaFin } from '@/data/planFinanciero'
import { TIPO_DIA_META } from './types'
import { CUENTAS, BASE_OPERATIVA, cuentaDeCargo } from '@/data/maestros'
import {
  MESES, agrupar, diasDelMes, fechasDelMes, limpiarRut, minutosAtraso, nombrePeriodo, suma,
} from './utils'

const libro = (hojas: { nombre: string; datos: any[] }[], archivo: string) => {
  const wb = XLSX.utils.book_new()
  for (const h of hojas) {
    const ws = XLSX.utils.json_to_sheet(h.datos.length ? h.datos : [{ '': 'Sin datos' }])
    // Ancho de columnas automático y acotado
    const keys = Object.keys(h.datos[0] ?? { '': '' })
    ws['!cols'] = keys.map((k) => ({
      wch: Math.min(
        38,
        Math.max(10, k.length + 2, ...h.datos.slice(0, 200).map((r) => String(r[k] ?? '').length + 2)),
      ),
    }))
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }
    XLSX.utils.book_append_sheet(wb, ws, h.nombre.slice(0, 31))
  }
  XLSX.writeFile(wb, archivo)
}

/* ═══════════ Asiento contable de distribución ═══════════ */

export function exportarAsiento(res: ResumenDistribucion) {
  const detalle = res.lineas.map((l) => ({
    PERIODO: res.periodo,
    CODIGO_CUENTA: l.codigoCuenta,
    ID_CUENTA_N4: l.codigoN4,
    RUT: l.rut,
    TRABAJADOR: l.trabajador,
    CARGO: l.cargo,
    N1_CUENTA1: l.imputacion.n1,
    N2_CUENTA2: l.imputacion.n2,
    N3_SUBCUENTA_3: l.imputacion.n3,
    N4_SUBCUENTA_4: l.imputacion.n4,
    N5_SUBCUENTA_5: l.imputacion.n5,
    N6_LABOR_GENERAL: l.imputacion.n6,
    N7_LABOR_ESPECIFICA: l.imputacion.n7,
    N8_ETAPA_PLANTA: l.imputacion.n8,
    N9_ESPECIE: l.imputacion.n9,
    N10_VARIEDAD: l.imputacion.n10,
    N11_CAMPO: l.imputacion.n11,
    N12_TEMPORADA: l.imputacion.n12,
    N13_CC: l.imputacion.n13,
    JORNADAS: l.jornadas,
    DEBE: l.monto,
    HABER: 0,
  }))

  // Consolidado por cuenta + centro de costo: lo que realmente se asienta
  const consolidado = [...agrupar(res.lineas, (l) => `${l.codigoN4}¦${l.imputacion.n13}¦${l.imputacion.n6}`)]
    .map(([, ls]) => ({
      PERIODO: res.periodo,
      ID_CUENTA_N4: ls[0].codigoN4,
      CUENTA: ls[0].imputacion.n4,
      N6_LABOR_GENERAL: ls[0].imputacion.n6,
      N11_CAMPO: ls[0].imputacion.n11,
      N13_CC: ls[0].imputacion.n13,
      JORNADAS: Math.round(suma(ls, (l) => l.jornadas) * 100) / 100,
      MONTO: suma(ls, (l) => l.monto),
    }))
    .sort((a, b) => b.MONTO - a.MONTO)

  libro(
    [
      {
        nombre: 'Resumen',
        datos: [
          { CONCEPTO: 'Período', VALOR: nombrePeriodo(res.periodo) },
          { CONCEPTO: 'Campo', VALOR: res.campo },
          { CONCEPTO: 'Días del mes', VALOR: res.diasMes },
          { CONCEPTO: 'Base de cálculo', VALOR: res.base === 'LIBRO' ? 'Libro de remuneraciones (total haber − asig. familiar)' : 'Devengo teórico (sueldo base ÷ 30 × días del mes)' },
          { CONCEPTO: 'Trabajadores', VALOR: res.trabajadores },
          { CONCEPTO: 'Jornadas repartidas', VALOR: Math.round(res.jornadasTotales * 100) / 100 },
          { CONCEPTO: 'Total distribuido', VALOR: res.totalDistribuido },
          { CONCEPTO: 'Costo por jornada', VALOR: res.jornadasTotales ? Math.round(res.totalDistribuido / res.jornadasTotales) : 0 },
          { CONCEPTO: 'Advertencias', VALOR: res.advertencias.length },
        ],
      },
      { nombre: 'Asiento consolidado', datos: consolidado },
      { nombre: 'Detalle por trabajador', datos: detalle },
      { nombre: 'Advertencias', datos: res.advertencias.map((a, i) => ({ N: i + 1, ADVERTENCIA: a })) },
    ],
    `Asiento_MO_${res.campo}_${res.periodo}.xlsx`,
  )
}

/* ═══════════ Planilla para el contador ═══════════ */

export function exportarPlanillaContador(
  res: ResumenDistribucion,
  trabajadores: Trabajador[],
  tarja: RegistroTarja[],
  remuneraciones: Remuneracion[],
) {
  const periodo = res.periodo
  const dias = diasDelMes(periodo)
  const delMes = tarja.filter((r) => r.fecha.startsWith(periodo) && (res.campo === 'TODOS' || r.campo === res.campo))
  const porTrab = agrupar(delMes, (r) => r.trabajadorId)

  const planilla = [...porTrab.entries()]
    .map(([id, regs]) => {
      const t = trabajadores.find((x) => x.id === id)
      if (!t) return null
      const rem = remuneraciones.find((x) => x.periodo === periodo && x.trabajadorId === id)
      const cuenta = (tipo: string) => regs.filter((r) => r.tipoDia === tipo).length
      const jornadas = suma(
        regs.filter((r) => TIPO_DIA_META[r.tipoDia].jornadaValida && r.laborGeneral !== 'SIN_LABOR'),
        (r) => r.jornadas,
      )
      return {
        RUT: t.rut,
        NOMBRE: `${t.apellidos}, ${t.nombres}`,
        CARGO: t.cargo,
        CAMPO: t.campo,
        CUENTA_N4: cuentaDeCargo(t.cargo)?.cuentaN4 ?? '',
        ID_CUENTA_N4: cuentaDeCargo(t.cargo)?.codigoN4 ?? '',
        SUELDO_BASE: t.sueldoBase,
        DIAS_MES: dias,
        JORNADAS_EFECTIVAS: Math.round(jornadas * 100) / 100,
        DIAS_TRABAJADOS: cuenta('TRABAJADO') + cuenta('TRATO'),
        DIAS_VACACIONES: cuenta('VACACIONES'),
        DIAS_LICENCIA: cuenta('LICENCIA'),
        DIAS_PERMISO: cuenta('PERMISO'),
        FALTAS_JUSTIFICADAS: cuenta('FALTA_JUSTIFICADA'),
        FALTAS_INJUSTIFICADAS: cuenta('FALTA_INJUSTIFICADA'),
        DIAS_LLUVIA: cuenta('LLUVIA'),
        FINDES_TRABAJADOS: regs.filter((r) => r.jornadas > 0 && [0, 6].includes(new Date(r.fecha + 'T12:00:00').getDay())).length,
        HORAS_EXTRA: suma(regs, (r) => r.horasExtra),
        ATRASOS_MIN: suma(regs, (r) => minutosAtraso(r.horaLlegada)),
        TOTAL_HABER: rem?.totalHaber ?? '',
        ASIG_FAMILIAR: rem?.asignacionFamiliar ?? '',
        ANTICIPO: rem?.anticipo ?? '',
        LIQUIDO: rem?.liquido ?? '',
        COSTO_DISTRIBUIDO: suma(res.lineas.filter((l) => l.trabajadorId === id), (l) => l.monto),
      }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.NOMBRE.localeCompare(b.NOMBRE))

  // Detalle día a día — trazabilidad completa de asistencia
  const asistencia = delMes
    .map((r) => {
      const t = trabajadores.find((x) => x.id === r.trabajadorId)
      return {
        FECHA: r.fecha,
        RUT: t?.rut ?? '',
        NOMBRE: t ? `${t.apellidos}, ${t.nombres}` : '',
        CAMPO: r.campo,
        TIPO_DIA: TIPO_DIA_META[r.tipoDia].label,
        JORNADAS: r.jornadas,
        LABOR_GENERAL: r.laborGeneral,
        LABOR_ESPECIFICA: r.laborEspecifica,
        ESPECIE: r.especie,
        VARIEDAD: r.variedad,
        ETAPA_PLANTA: r.etapaPlanta,
        CC: r.cc,
        TEMPORADA: r.temporada,
        HORA_LLEGADA: r.horaLlegada ?? '',
        ATRASO_MIN: minutosAtraso(r.horaLlegada),
        HORAS_EXTRA: r.horasExtra,
        RENDIMIENTO: r.rendimiento ?? '',
        UNIDAD: r.unidadRendimiento ?? '',
        OBSERVACION: r.observacion ?? '',
      }
    })
    .sort((a, b) => a.FECHA.localeCompare(b.FECHA) || a.NOMBRE.localeCompare(b.NOMBRE))

  libro(
    [
      { nombre: 'Planilla contador', datos: planilla as any[] },
      { nombre: 'Asistencia detallada', datos: asistencia },
    ],
    `Planilla_Contador_${res.campo}_${periodo}.xlsx`,
  )
}

/* ═══════════ Nómina bancaria ═══════════ */

export function exportarNomina(
  trabajadores: Trabajador[],
  remuneraciones: Remuneracion[],
  periodo: string,
  campo: string,
) {
  const filas = trabajadores
    .filter((t) => campo === 'TODOS' || t.campo === campo)
    .filter((t) => t.estado !== 'FINIQUITADO')
    .map((t) => {
      const r = remuneraciones.find((x) => x.periodo === periodo && x.trabajadorId === t.id)
      return {
        RUT: limpiarRut(t.rut).slice(0, -1),
        DV: limpiarRut(t.rut).slice(-1),
        RUT_FORMATO: t.rut,
        NOMBRE: `${t.nombres} ${t.apellidos}`,
        BANCO: t.banco ?? '',
        TIPO_CUENTA: t.tipoCuenta ?? '',
        NUMERO_CUENTA: t.nroCuenta ?? '',
        MONTO: r?.liquido ?? 0,
        GLOSA: `REMUNERACION ${nombrePeriodo(periodo).toUpperCase()}`,
        CAMPO: t.campo,
      }
    })
    .filter((f) => f.MONTO > 0)
    .sort((a, b) => a.NOMBRE.localeCompare(b.NOMBRE))

  const anticipos = trabajadores
    .filter((t) => campo === 'TODOS' || t.campo === campo)
    .map((t) => {
      const r = remuneraciones.find((x) => x.periodo === periodo && x.trabajadorId === t.id)
      return {
        RUT: t.rut, NOMBRE: `${t.nombres} ${t.apellidos}`,
        BANCO: t.banco ?? '', NUMERO_CUENTA: t.nroCuenta ?? '',
        MONTO: r?.anticipo ?? 0,
        GLOSA: `ANTICIPO ${nombrePeriodo(periodo).toUpperCase()}`,
      }
    })
    .filter((f) => f.MONTO > 0)

  libro(
    [
      { nombre: 'Nomina banco', datos: filas },
      { nombre: 'Anticipos', datos: anticipos },
      {
        nombre: 'Control',
        datos: [
          { CONCEPTO: 'Período', VALOR: nombrePeriodo(periodo) },
          { CONCEPTO: 'Campo', VALOR: campo },
          { CONCEPTO: 'Cantidad de pagos', VALOR: filas.length },
          { CONCEPTO: 'Total a transferir', VALOR: suma(filas, (f) => f.MONTO) },
          { CONCEPTO: 'Total anticipos', VALOR: suma(anticipos, (f) => f.MONTO) },
          { CONCEPTO: 'Sin datos bancarios', VALOR: filas.filter((f) => !f.NUMERO_CUENTA).length },
        ],
      },
    ],
    `Nomina_Banco_${campo}_${periodo}.xlsx`,
  )
}

/* ═══════════ Reportes de cumplimiento ═══════════ */

export function exportarPrevencion(
  trabajadores: Trabajador[],
  epp: ItemEPP[],
  entregas: EntregaEPP[],
  capacitaciones: Capacitacion[],
  charlas: CharlaSeguridad[],
) {
  const nom = (id: string) => {
    const t = trabajadores.find((x) => x.id === id)
    return t ? `${t.apellidos}, ${t.nombres}` : '—'
  }
  const rut = (id: string) => trabajadores.find((x) => x.id === id)?.rut ?? ''

  libro(
    [
      {
        nombre: 'Stock EPP',
        datos: epp.map((e) => ({
          EPP: e.nombre, UNIDAD: e.unidad, STOCK: e.stock, STOCK_MINIMO: e.stockMinimo,
          ESTADO: e.stock <= e.stockMinimo ? 'BAJO MÍNIMO' : 'OK',
          VIDA_UTIL_DIAS: e.vidaUtilDias, COSTO_UNITARIO: e.costoUnitario,
          VALOR_INVENTARIO: e.stock * e.costoUnitario,
        })),
      },
      {
        nombre: 'Entregas EPP',
        datos: entregas.map((x) => ({
          FECHA: x.fecha, RUT: rut(x.trabajadorId), TRABAJADOR: nom(x.trabajadorId),
          EPP: epp.find((e) => e.id === x.eppId)?.nombre ?? '', CANTIDAD: x.cantidad,
          MOTIVO: x.motivo, FIRMADO: x.firmado ? 'SÍ' : 'PENDIENTE',
        })),
      },
      {
        nombre: 'Capacitaciones',
        datos: capacitaciones.flatMap((c) =>
          c.asistentes.map((a) => ({
            CURSO: c.nombre, FECHA: c.fecha, HORAS: c.horas, RELATOR: c.relator,
            CAMPO: c.campo, VIGENCIA_MESES: c.vigenciaMeses,
            RUT: rut(a), TRABAJADOR: nom(a),
          })),
        ),
      },
      {
        nombre: 'Charlas diarias',
        datos: charlas.map((c) => ({
          FECHA: c.fecha, CAMPO: c.campo, LABOR: c.laborGeneral, RIESGO: c.riesgos,
          MEDIDAS: c.medidas, RESPONSABLE: c.responsable, ASISTENTES: c.asistentes.length,
        })),
      },
    ],
    `Reporte_Prevencion_${new Date().toISOString().slice(0, 10)}.xlsx`,
  )
}

/* ═══════════ Maestros del sistema ═══════════ */

export function exportarMaestros() {
  libro(
    [
      {
        nombre: 'PlanCuentas',
        datos: CUENTAS.map((c) => ({
          CUENTA1: c.n1, N1: c.c1, CUENTA2: c.n2, N2: c.c2,
          SUBCUENTA_3: c.n3, N3: c.c3, SUBCUENTA_4: c.n4, N4: c.c4,
          SUBCUENTA_5: c.n5, N5: c.c5, ID_CUENTA_N4: c.codigo,
        })),
      },
      {
        nombre: 'BaseOperativa',
        datos: BASE_OPERATIVA.map((c) => ({
          CAMPO: c.campo, TEMPORADA: c.temporada, USO: c.uso, ESPECIE: c.especie,
          ROL: c.rol, PROPIEDAD: c.propiedad, VARIEDAD: c.variedad, CCE: c.cce,
          HECTAREAS: c.hectareas, HECTAREAS_PRODUCTIVAS: c.hectareasProd,
          RIEGO: c.riego, PLANTAS: c.plantas, HILERAS: c.hileras,
        })),
      },
    ],
    `Maestros_SIGA_${new Date().toISOString().slice(0, 10)}.xlsx`,
  )
}

/* ═══════════ Libros contables ═══════════ */

/**
 * Exporta el juego completo de libros en el mismo orden y estructura que
 * Sistema_contable_AEB_V01.xlsx, para que el contador reciba lo que ya conoce.
 */
export function exportarLibrosContables(asientos: Asiento[], ej: ConfigEjercicio) {
  const validos = asientos.filter(estaCuadrado)

  // Libro Diario: una fila por línea, con la cuenta financiera y las 13 dimensiones
  const diario = asientos
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero)
    .flatMap((a) =>
      a.lineas.map((l) => {
        const def = cuentaFin(l.cuenta)
        const [y, m] = a.fecha.split('-').map(Number)
        return {
          FECHA: a.fecha,
          'N° ASIENTO': a.numero,
          'GLOSA / DESCRIPCIÓN': a.glosa,
          'CÓD. CUENTA': l.cuenta,
          'NOMBRE CUENTA': def?.nombre ?? '',
          TIPO: def?.tipo ?? '',
          'DEBE ($)': l.debe || '',
          'HABER ($)': l.haber || '',
          MES: MESES[m - 1]?.toLowerCase() ?? '',
          AÑO: y,
          'N° DOCUMENTO': a.nroDocumento ?? '',
          OBSERVACIONES: l.glosaLinea ?? a.observaciones ?? '',
          NIVEL_1: l.n1 ?? '',
          NIVEL_2: l.n2 ?? '',
          NIVEL_3: l.n3 ?? '',
          NIVEL_4: l.n4 ?? '',
          CUENTA_5: l.n5 ?? '',
          LABORES_AGRICOLAS: l.n6 ?? '',
          LABORES_AGRICOLAS_ESPECIFICA: l.n7 ?? '',
          ETAPA_PLANTA: l.n8 ?? '',
          ESPECIE: l.n9 ?? '',
          VARIEDAD: l.n10 ?? '',
          CAMPO: l.n11 ?? '',
          Temporada_Agricola: l.n12 ?? '',
          CCEsp: l.n13 ?? '',
          JORNADA: l.jornadas ?? '',
          Costo_Empresa_Entero: l.debe || '',
          NIVEL4_N: l.codigoN4 ?? '',
          ORIGEN: a.origen,
        }
      }),
    )

  const control = controlarAsientos(asientos).map((c) => ({
    'N° ASIENTO': c.numero,
    FECHA: c.fecha,
    GLOSA: c.glosa,
    'TOTAL DEBE': c.totalDebe,
    'TOTAL HABER': c.totalHaber,
    DIFERENCIA: c.diferencia,
    ESTADO: c.cuadrado ? 'CUADRADO' : 'DESCUADRADO',
  }))

  const mayor = construirMayor(validos).flatMap((m) =>
    m.movimientos.map((mv) => ({
      CÓDIGO: m.codigo,
      CUENTA: m.nombre,
      TIPO: m.tipo,
      NATURALEZA: m.naturaleza,
      FECHA: mv.fecha,
      'N° ASIENTO': mv.numero,
      GLOSA: mv.glosa,
      'DEBE ($)': mv.debe || '',
      'HABER ($)': mv.haber || '',
      'SALDO ACUMULADO ($)': mv.saldo,
    })),
  )

  const b8 = balance8Columnas(validos).map((f) => ({
    CÓDIGO: f.codigo,
    CUENTA: f.nombre,
    TIPO: f.tipo,
    SUBTIPO: f.subtipo,
    NATURALEZA: f.naturaleza,
    DEBE: f.debe,
    HABER: f.haber,
    'SALDO DEUDOR': f.saldoDeudor,
    'SALDO ACREEDOR': f.saldoAcreedor,
    ACTIVO: f.activo,
    PASIVO: f.pasivo,
    PÉRDIDAS: f.perdida,
    GANANCIAS: f.ganancia,
  }))

  const r = estadoResultados(validos, ej.tasaImpuesto)
  const eerr = [
    { CONCEPTO: 'TOTAL INGRESOS OPERACIONALES', 'MONTO ($)': r.ingresosOperacionales },
    ...r.detalle.filter((d) => d.grupo === 'INGRESOS').map((d) => ({ CONCEPTO: `   ${d.codigo} ${d.nombre}`, 'MONTO ($)': d.monto })),
    { CONCEPTO: 'COSTO DE VENTAS', 'MONTO ($)': r.costoVentas },
    { CONCEPTO: 'MARGEN DE CONTRIBUCIÓN', 'MONTO ($)': r.margenBruto },
    { CONCEPTO: 'GASTOS DE ADMINISTRACIÓN Y VENTAS', 'MONTO ($)': r.gastosAdministracion },
    ...r.detalle.filter((d) => d.grupo === 'ADMINISTRACION').map((d) => ({ CONCEPTO: `   ${d.codigo} ${d.nombre}`, 'MONTO ($)': d.monto })),
    { CONCEPTO: 'RESULTADO OPERACIONAL', 'MONTO ($)': r.resultadoOperacional },
    { CONCEPTO: 'GASTOS FINANCIEROS', 'MONTO ($)': r.gastosFinancieros },
    { CONCEPTO: 'UTILIDAD ANTES DE IMPUESTOS', 'MONTO ($)': r.utilidadAntesImpuesto },
    { CONCEPTO: `PROVISIÓN IMPUESTO (${(ej.tasaImpuesto * 100).toFixed(0)}%)`, 'MONTO ($)': r.provisionImpuesto },
    { CONCEPTO: 'UTILIDAD (PÉRDIDA) NETA DEL EJERCICIO', 'MONTO ($)': r.utilidadNeta },
  ]

  const bg = balanceGeneral(validos, ej.tasaImpuesto)
  const balance = [
    { CONCEPTO: 'Activo corriente', 'MONTO ($)': bg.activoCorriente },
    { CONCEPTO: 'Activo no corriente', 'MONTO ($)': bg.activoNoCorriente },
    { CONCEPTO: 'TOTAL ACTIVO', 'MONTO ($)': bg.totalActivo },
    { CONCEPTO: 'Pasivo corriente', 'MONTO ($)': bg.pasivoCorriente },
    { CONCEPTO: 'Pasivo no corriente', 'MONTO ($)': bg.pasivoNoCorriente },
    { CONCEPTO: 'TOTAL PASIVO', 'MONTO ($)': bg.totalPasivo },
    { CONCEPTO: 'Patrimonio', 'MONTO ($)': bg.patrimonio },
    { CONCEPTO: 'Resultado del ejercicio', 'MONTO ($)': bg.resultadoEjercicio },
    { CONCEPTO: 'TOTAL PASIVO + PATRIMONIO', 'MONTO ($)': bg.totalPasivoPatrimonio },
    { CONCEPTO: 'DESCUADRE', 'MONTO ($)': bg.descuadre },
  ]

  libro(
    [
      {
        nombre: 'Config',
        datos: [
          { CONCEPTO: 'Empresa', VALOR: ej.empresa },
          { CONCEPTO: 'RUT', VALOR: ej.rut },
          { CONCEPTO: 'Moneda', VALOR: ej.moneda },
          { CONCEPTO: 'Período', VALOR: `${ej.fechaInicio} al ${ej.fechaFin}` },
          { CONCEPTO: 'Tasa impuesto 1ª categoría', VALOR: ej.tasaImpuesto },
          { CONCEPTO: 'Asientos registrados', VALOR: asientos.length },
          { CONCEPTO: 'Asientos descuadrados', VALOR: asientos.length - validos.length },
        ],
      },
      { nombre: 'Libro_Diario', datos: diario },
      { nombre: 'Control_Asientos', datos: control },
      { nombre: 'Libro_Mayor', datos: mayor },
      { nombre: 'Balance_8_Columnas', datos: b8 },
      { nombre: 'Estado_Resultados', datos: eerr },
      { nombre: 'Balance_General', datos: balance },
    ],
    `Libros_Contables_${ej.fechaInicio.slice(0, 4)}.xlsx`,
  )
}

/* ═══════════ Control de combustible ═══════════ */

export function exportarCombustible(movs: MovimientoCombustible[], estanques: Estanque[]) {
  const nombreEstanque = (id: string) => estanques.find((e) => e.id === id)?.nombre ?? ''

  const inventario = movs
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((m) => ({
      FECHA: m.fecha,
      ESTANQUE: nombreEstanque(m.estanqueId),
      'ACCIÓN': m.accion,
      'CAMPO DESTINO': m.campo,
      ESPECIE: m.especie,
      VARIEDAD: m.variedad,
      CCESP: m.cc,
      LABOR: m.labor,
      HORAS: m.horas ?? '',
      'CANTIDAD PETROLEO': m.litros || '',
      'REGISTRO CONTADOR ESTANQUE': m.contador ?? '',
      PRECIO: m.precio ?? '',
      Chofer: m.chofer ?? '',
      'Tractor/ camioneta/Otro': m.vehiculo ?? '',
      OBSERVACIONES: m.observaciones ?? '',
      'VISIBLE ESTANQUE': m.visible ?? '',
    }))

  const control = estanques.map((e) => {
    const est = estadoDeEstanque(e, movs)
    return {
      ESTANQUE: e.nombre,
      CAMPO: e.campo,
      'CAPACIDAD (L)': e.capacidad,
      'CM POR 100 L': e.cmPorCienLitros,
      'STOCK ESTIMADO (L)': Math.round(est.stockEstimado * 100) / 100,
      'ULTIMO CONTROL': est.ultimoControl?.fecha ?? '',
      'VISIBLE ESTANQUE (L)': est.visibleUltimoControl ?? '',
      'DIFERENCIA (L)': est.diferencia,
      ESTADO: Math.abs(est.diferencia) < 0.5 ? 'CUADRADO' : 'REQUIERE PRORRATEO',
      'TOTAL ENTRADAS (L)': Math.round(est.entradas),
      'TOTAL SALIDAS (L)': Math.round(Math.abs(est.salidas)),
    }
  })

  const precio = precioPromedio(movs)
  const resumen = (dim: DimensionConsumo, etiqueta: string) =>
    consumoPorDimension(movs, dim).map((d) => ({
      [etiqueta]: d.nombre,
      'LITROS': d.litros,
      '% DEL TOTAL': Math.round(d.proporcion * 1000) / 10,
      'MOVIMIENTOS': d.movimientos,
      'HORAS': d.horas || '',
      'COSTO ESTIMADO': precio > 0 ? Math.round(d.litros * precio) : '',
    }))

  // Hoja de conteo mensual, en los 5 pasos del procedimiento original
  const periodos = [...new Set(movs.map((m) => m.fecha.slice(0, 7)))].sort()
  const conteo = estanques.flatMap((e) =>
    periodos
      .map((p) => hojaDeConteo(movs, e.id, p))
      .filter((h) => h.totalIngresos !== 0 || h.totalSalidas !== 0)
      .map((h) => ({
        ESTANQUE: e.nombre,
        PERIODO: h.periodo,
        '1 · SALDO INICIAL': h.saldoInicial,
        '1 · COMPRAS': h.compras,
        '1 · TOTAL INGRESOS': h.totalIngresos,
        '2 · TOTAL SALIDAS': h.totalSalidas,
        '2 · N° ENTREGAS': h.entregas,
        '3 · CONTADOR INICIAL': h.contadorInicial ?? '',
        '3 · CONTADOR FINAL': h.contadorFinal ?? '',
        '3 · DIFERENCIA CONTADOR': h.diferenciaContador ?? '',
        '3 · DESCUADRE': h.descuadreContador ?? '',
        '3 · CONTADOR CUADRA': h.contadorCuadra ? 'SÍ' : 'NO',
        '4 · SALDO CONTABLE': h.saldoContable,
        '4 · SALDO VISIBLE': h.saldoVisible ?? '',
        '4 · FECHA CONTROL': h.fechaControl ?? '',
        '5 · DIFERENCIA': h.saldoVisible === undefined ? '' : h.diferencia,
        '5 · INTERPRETACIÓN': h.interpretacion,
        '5 · OBSERVACIÓN': h.mensaje,
      })),
  )

  libro(
    [
      { nombre: 'Control estanques', datos: control },
      { nombre: 'Hoja de conteo', datos: conteo },
      { nombre: 'Inventario', datos: inventario },
      { nombre: 'Resumen CC', datos: resumen('cc', 'CENTRO DE COSTO') },
      { nombre: 'Resumen Labor', datos: resumen('labor', 'LABOR') },
      { nombre: 'Resumen Vehiculo', datos: resumen('vehiculo', 'VEHÍCULO') },
      { nombre: 'Resumen Chofer', datos: resumen('chofer', 'CHOFER') },
      { nombre: 'Serie mensual', datos: serieMensual(movs).map((s) => ({
        PERIODO: s.periodo, 'ENTRADAS (L)': s.entradas, 'SALIDAS (L)': s.salidas, CONTROLES: s.controles,
      })) },
    ],
    `Control_Combustible_${new Date().toISOString().slice(0, 10)}.xlsx`,
  )
}

/* ═══════════ Bodega y registro de aplicaciones ═══════════ */

export function exportarBodega(
  productos: Producto[],
  movs: MovimientoBodega[],
  aplicaciones: Aplicacion[],
) {
  const prod = (id: string) => productos.find((p) => p.id === id)
  const campos = [...new Set(movs.map((m) => m.campo))]

  // Stock por bodega, con el mismo cuadro del Excel original
  const stock = campos.flatMap((campo) =>
    inventario(productos, movs, campo)
      .filter((f) => f.movimientos > 0)
      .map((f) => ({
        CAMPO: campo,
        PRODUCTO: f.producto.nombre,
        INGREDIENTE_ACTIVO: f.producto.ingredienteActivo,
        CATEGORIA: f.producto.categoria,
        UM: f.producto.unidad,
        'STOCK SEGUN ENTRADAS Y SALIDAS': f.stock,
        'STOCK MINIMO': f.producto.stockMinimo,
        ESTADO: f.stock < 0 ? 'NEGATIVO' : f.bajoMinimo ? 'BAJO MÍNIMO' : 'OK',
        ENTRADAS: f.entradas,
        SALIDAS: f.salidas,
        'CARENCIA (DIAS)': f.producto.carenciaDias,
        'PRECIO UNITARIO': f.producto.precioUnitario,
        'VALOR INVENTARIO': f.valor,
      })),
  )

  const movimientos = movs
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((m) => ({
      FECHA: m.fecha,
      CAMPO: m.campo,
      PRODUCTO: prod(m.productoId)?.nombre ?? '',
      UM: prod(m.productoId)?.unidad ?? '',
      ACCION: m.accion,
      CANTIDAD: m.cantidad,
      CC: m.cc ?? '',
      ESPECIE: m.especie ?? '',
      VARIEDAD: m.variedad ?? '',
      LABOR: m.labor ?? '',
      DOCUMENTO: m.documento ?? '',
      'PRECIO UNITARIO': m.precioUnitario ?? '',
      OBSERVACIONES: m.observaciones ?? '',
    }))

  // Registro de aplicaciones, en el formato del formulario M2-008-F004
  const registro = aplicaciones
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((a) => {
      const p = prod(a.productoId)
      const e = estadoCarencia(a, new Date().toISOString().slice(0, 10))
      return {
        FECHA: a.fecha,
        PREDIO: a.predio,
        CAMPO: a.campo,
        VARIEDAD: a.variedad,
        CUARTEL: a.cuartel,
        PLAGA: a.plaga,
        'NOMBRE COMERCIAL PRODUCTO': p?.nombre ?? '',
        'INGREDIENTE ACTIVO': p?.ingredienteActivo ?? '',
        'DOSIS/100 L': a.dosisPor100L ?? '',
        'DOSIS/HA': a.dosisPorHa ?? '',
        MOJAMIENTO: a.mojamiento,
        'SUPERFICIE (HA)': a.hectareas,
        'CANTIDAD PRODUCTO': a.cantidadProducto,
        UM: p?.unidad ?? '',
        CARENCIA: a.carenciaDias,
        'REINGRESO (H)': a.reingresoHoras,
        'COSECHABLE DESDE': e.fechaCosecha,
        APLICADOR: a.aplicador,
        EQUIPO: a.maquina ?? '',
        CONDICIONES: a.condiciones ?? '',
      }
    })

  const carencias = cuartelesEnCarencia(aplicaciones, new Date().toISOString().slice(0, 10)).map(
    (c) => ({
      CAMPO: c.campo,
      CUARTEL: c.cc,
      ESPECIE: c.especie,
      VARIEDAD: c.variedad,
      APLICACIONES: c.aplicaciones,
      'COSECHABLE DESDE': c.fechaCosecha,
      'DIAS RESTANTES': c.diasRestantes,
    }),
  )

  libro(
    [
      { nombre: 'Stock', datos: stock },
      { nombre: 'Registro aplicaciones', datos: registro },
      { nombre: 'Carencias vigentes', datos: carencias },
      { nombre: 'Movimientos', datos: movimientos },
      {
        nombre: 'Maestro productos',
        datos: productos.map((p) => ({
          PRODUCTO: p.nombre,
          INGREDIENTE_ACTIVO: p.ingredienteActivo,
          CATEGORIA: p.categoria,
          UM: p.unidad,
          'CARENCIA (DIAS)': p.carenciaDias,
          'REINGRESO (HORAS)': p.reingresoHoras,
          'STOCK MINIMO': p.stockMinimo,
          'PRECIO UNITARIO': p.precioUnitario,
        })),
      },
    ],
    `Bodega_y_Aplicaciones_${new Date().toISOString().slice(0, 10)}.xlsx`,
  )
}

/* ═══════════ Bitácora de auditoría ═══════════ */

export function exportarAuditoria(registros: RegistroAuditoria[]) {
  libro(
    [
      {
        nombre: 'Bitacora',
        datos: registros.map((a) => ({
          FECHA: a.fecha.slice(0, 10),
          HORA: a.fecha.slice(11, 19),
          USUARIO: a.usuario,
          ROL: a.rol ?? '',
          ACCION: a.accion,
          MODULO: a.modulo,
          DETALLE: a.detalle,
        })),
      },
      {
        nombre: 'Resumen por accion',
        datos: [...agrupar(registros, (a) => a.accion)].map(([accion, rs]) => ({
          ACCION: accion,
          REGISTROS: rs.length,
          'PRIMER REGISTRO': rs.map((r) => r.fecha).sort()[0]?.slice(0, 19).replace('T', ' ') ?? '',
          'ULTIMO REGISTRO': rs.map((r) => r.fecha).sort().at(-1)?.slice(0, 19).replace('T', ' ') ?? '',
        })),
      },
      {
        nombre: 'Resumen por usuario',
        datos: [...agrupar(registros, (a) => a.usuario)].map(([usuario, rs]) => ({
          USUARIO: usuario,
          ROL: rs[0].rol ?? '',
          REGISTROS: rs.length,
          INGRESOS: rs.filter((r) => r.accion === 'INGRESO').length,
          'INGRESOS FALLIDOS': rs.filter((r) => r.accion === 'INGRESO_FALLIDO').length,
          'ULTIMA ACTIVIDAD': rs.map((r) => r.fecha).sort().at(-1)?.slice(0, 19).replace('T', ' ') ?? '',
        })),
      },
    ],
    `Bitacora_SIGA_${new Date().toISOString().slice(0, 10)}.xlsx`,
  )
}

/* ═══════════ Importación de libro de remuneraciones ═══════════ */

export interface FilaImportada {
  rut: string
  totalHaber: number
  asignacionFamiliar: number
  liquido: number
  anticipo: number
}

/** Lee un export de Nubox y busca las columnas por nombre aproximado. */
export async function importarRemuneraciones(file: File): Promise<FilaImportada[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const filas = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' })

  const buscar = (fila: Record<string, any>, claves: string[]) => {
    for (const k of Object.keys(fila)) {
      const norm = k.toUpperCase().replace(/[^A-Z]/g, '')
      if (claves.some((c) => norm.includes(c))) return fila[k]
    }
    return ''
  }
  const numero = (v: any) => {
    if (typeof v === 'number') return v
    const n = Number(String(v).replace(/[^\d,-]/g, '').replace(',', '.'))
    return isNaN(n) ? 0 : n
  }

  return filas
    .map((f) => ({
      rut: String(buscar(f, ['RUT', 'RUN'])).trim(),
      totalHaber: numero(buscar(f, ['TOTALHABER', 'TOTALHABERES', 'HABERES'])),
      asignacionFamiliar: numero(buscar(f, ['ASIGNACIONFAMILIAR', 'ASIGFAMILIAR', 'ASIGNFAM'])),
      liquido: numero(buscar(f, ['LIQUIDO', 'ALQUIDO', 'APAGAR'])),
      anticipo: numero(buscar(f, ['ANTICIPO'])),
    }))
    .filter((f) => f.rut && limpiarRut(f.rut).length >= 7)
}
