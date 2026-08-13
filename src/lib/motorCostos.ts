/**
 * ══════════════════════════════════════════════════════════════════════
 *  MOTOR DE DISTRIBUCIÓN DE COSTO DE MANO DE OBRA
 * ══════════════════════════════════════════════════════════════════════
 *
 *  Reemplaza la macro / Power Query que hoy corre sobre la tarja.
 *
 *  Reglas de negocio (documento RRHH · Agrícola El Bosque):
 *
 *   1. Trabajador agrícola:  base = sueldo base ÷ 30 × días del mes
 *   2. Administrativo (ADM): base = sueldo base ÷ 30 × días efectivamente
 *      trabajados. Va a SUELDOS_ADM (4126) pero se integra al costo empresa.
 *   3. Si existe libro de remuneraciones del contador, la base real es
 *      (total haber − asignación familiar). Ese es el número que cuadra
 *      con contabilidad; el devengo teórico sólo se usa como proyección.
 *   4. Vacaciones → jornada VÁLIDA. Se redistribuye sobre lo efectivamente
 *      trabajado al cierre del período.
 *   5. SIN_LABOR / general sin labor → NO cuenta como jornada real.
 *   6. Fin de semana trabajado → jornada efectiva (no hay excepción).
 *   7. Trato → se convierte a equivalencia de jornada real, porque el
 *      trabajador sí asistió (trazabilidad de asistencia y seguridad).
 *
 *  El resultado es una línea de costo por cada combinación de las 13
 *  dimensiones del plan de cuentas — listo para el asiento contable.
 */

import {
  CARGOS,
  CUENTAS,
  codigoLaborEspecifica,
  codigoLaborGeneral,
  cuentaDeCargo,
  CAMPOS,
  ESPECIES,
  ETAPAS_PLANTA,
  VARIEDADES,
  CENTROS_COSTO,
  TEMPORADAS,
} from '@/data/maestros'
import type {
  ImputacionContable,
  LineaCosto,
  RegistroTarja,
  Remuneracion,
  ResumenDistribucion,
  Trabajador,
} from './types'
import { TIPO_DIA_META } from './types'
import { agrupar, diasDelMes, suma, uid } from './utils'

/** Cargos cuyo costo va a SUELDOS_ADM en lugar de MANO_DE_OBRA directa. */
export const esAdministrativo = (cargo: string) =>
  cuentaDeCargo(cargo)?.cuentaN4 === 'SUELDOS_ADM'

/**
 * Jornadas que efectivamente participan del reparto del costo.
 * Excluye licencias, faltas, lluvia, inhábiles y todo lo marcado SIN_LABOR.
 */
export function jornadasComputables(registros: RegistroTarja[]) {
  return registros.filter(
    (r) => TIPO_DIA_META[r.tipoDia].jornadaValida && r.laborGeneral !== 'SIN_LABOR',
  )
}

/** Construye el código contable completo N1-N13 de una imputación. */
export function codigoCuenta(imp: ImputacionContable) {
  const cta = CUENTAS.find(
    (c) => c.n1 === imp.n1 && c.n2 === imp.n2 && c.n3 === imp.n3 && c.n4 === imp.n4,
  )
  const n4 = cta?.codigo ?? '0000'
  const c6 = codigoLaborGeneral(imp.n6)
  const c7 = codigoLaborEspecifica(imp.n6, imp.n7)
  const c8 = ETAPAS_PLANTA.find((e) => e.nombre === imp.n8)?.codigo ?? '0'
  const c9 = ESPECIES.find((e) => e.nombre === imp.n9)?.codigo ?? '0'
  const c10 = VARIEDADES.find((v) => v.variedad === imp.n10)?.codigo ?? '0'
  const c11 = CAMPOS.find((c) => c.nombre === imp.n11)?.codigo ?? '0'
  const c12 = String(TEMPORADAS.indexOf(imp.n12) + 1 || 0)
  const c13 = CENTROS_COSTO.find((c) => c.cc === imp.n13 && c.campo === imp.n11)?.codigo ?? '0'
  return `${n4} / ${c6}-${c7}-${c8}-${c9}-${c10} / ${c11}-${c12}-${c13}`
}

/** Imputación contable de una línea de tarja, según el cargo del trabajador. */
export function imputacionDe(t: Trabajador, r: RegistroTarja): ImputacionContable {
  const cargo = cuentaDeCargo(t.cargo)
  const n4 = cargo?.cuentaN4 ?? 'MANO_DE_OBRA'

  // Ruta contable según la cuenta N4 asociada al cargo (maestro RRHH del Excel)
  const rutas: Record<string, { n2: string; n3: string; n5: string }> = {
    MANO_DE_OBRA: {
      n2: 'COSTO_OPERACIONAL',
      n3: 'DIRECTOS_DE_PRODUCCION',
      n5: 'MANO_DE_OBRA_AGRICOLA',
    },
    SUELDOS_ADM: {
      n2: 'COSTO_OPERACIONAL',
      n3: 'ADMINISTRACION_AGRÍCOLA',
      n5: 'SUELDOS_ADM_AGRICOLA',
    },
    MANO_OBRA_NAD: {
      n2: 'COSTO_OPERACIONAL',
      n3: 'NO_AGRICOLAS_DIRECTOS',
      n5: 'MANO_OBRA_NO_AGRICOLA_DIRECTA',
    },
    MANO_OBRA_NOP: {
      n2: 'COSTO_NO_OPERACIONAL',
      n3: 'NO_OPERACIONALES',
      n5: 'MANO_OBRA_NO_OPERACIONAL',
    },
  }
  const ruta = rutas[n4] ?? rutas.MANO_DE_OBRA

  return {
    n1: 'COSTOS',
    n2: ruta.n2,
    n3: ruta.n3,
    n4,
    n5: ruta.n5,
    n6: r.laborGeneral || 'SIN_LABOR',
    n7: r.laborEspecifica || '0',
    n8: r.etapaPlanta || '0',
    n9: r.especie || '0',
    n10: r.variedad || '0',
    n11: r.campo,
    n12: r.temporada,
    n13: r.cc || 'GENERAL ' + r.campo,
  }
}

export interface OpcionesDistribucion {
  periodo: string // YYYY-MM
  campo?: string // opcional: acota a un campo
  /** 'LIBRO' usa total haber − asig. familiar; 'DEVENGO' usa sueldo base ÷ 30. */
  base?: 'LIBRO' | 'DEVENGO' | 'AUTO'
}

/**
 * Ejecuta la distribución completa del período.
 * Devuelve las líneas de costo listas para asiento + advertencias de control.
 */
export function distribuir(
  trabajadores: Trabajador[],
  registros: RegistroTarja[],
  remuneraciones: Remuneracion[],
  opts: OpcionesDistribucion,
): ResumenDistribucion {
  const { periodo, campo } = opts
  const modo = opts.base ?? 'AUTO'
  const dias = diasDelMes(periodo)
  const advertencias: string[] = []
  const lineas: LineaCosto[] = []

  const delMes = registros.filter(
    (r) => r.fecha.startsWith(periodo) && (!campo || r.campo === campo),
  )
  const porTrabajador = agrupar(delMes, (r) => r.trabajadorId)

  let usoLibro = false
  let jornadasTotales = 0

  for (const [trabajadorId, regs] of porTrabajador) {
    const t = trabajadores.find((x) => x.id === trabajadorId)
    if (!t) {
      advertencias.push(`Hay ${regs.length} registros de un trabajador que ya no existe en RRHH.`)
      continue
    }

    const computables = jornadasComputables(regs)
    const jornadas = suma(computables, (r) => r.jornadas)

    if (jornadas <= 0) {
      const noComputable = regs.length - computables.length
      if (noComputable > 0)
        advertencias.push(
          `${t.nombres} ${t.apellidos}: ${noComputable} día(s) sin jornada computable (licencia, falta o SIN_LABOR). No recibe costo.`,
        )
      continue
    }

    // ── Base a repartir ──────────────────────────────────────────────
    const rem = remuneraciones.find((x) => x.periodo === periodo && x.trabajadorId === t.id)
    const adm = esAdministrativo(t.cargo)

    let base: number
    if (rem && modo !== 'DEVENGO') {
      // Base real del libro de remuneraciones: cuadra con contabilidad.
      base = rem.totalHaber - rem.asignacionFamiliar
      usoLibro = true
    } else {
      if (modo === 'LIBRO')
        advertencias.push(
          `${t.nombres} ${t.apellidos}: sin libro de remuneraciones cargado para ${periodo}. Se usó devengo teórico.`,
        )
      // Devengo teórico. Agrícola sobre días del mes; ADM sobre días trabajados.
      const diasBase = adm ? Math.min(jornadas, dias) : dias
      base = (t.sueldoBase / 30) * diasBase
    }

    if (base <= 0) {
      advertencias.push(`${t.nombres} ${t.apellidos}: base de reparto en cero. Revisar sueldo base.`)
      continue
    }

    const valorJornada = base / jornadas
    jornadasTotales += jornadas

    // ── Reparto proporcional sobre las 13 dimensiones ────────────────
    // Se agrupa primero para no generar una línea por cada día.
    const porImputacion = agrupar(computables, (r) =>
      [r.laborGeneral, r.laborEspecifica, r.etapaPlanta, r.especie, r.variedad, r.campo, r.cc].join(
        '¦',
      ),
    )

    let repartido = 0
    const claves = [...porImputacion.entries()]
    claves.forEach(([, grupo], i) => {
      const j = suma(grupo, (r) => r.jornadas)
      // La última línea absorbe el redondeo para que el total cuadre al peso.
      const monto =
        i === claves.length - 1 ? Math.round(base - repartido) : Math.round(valorJornada * j)
      repartido += monto

      const imp = imputacionDe(t, grupo[0])
      lineas.push({
        id: uid(),
        periodo,
        trabajadorId: t.id,
        trabajador: `${t.nombres} ${t.apellidos}`,
        rut: t.rut,
        cargo: t.cargo,
        imputacion: imp,
        codigoN4: cuentaDeCargo(t.cargo)?.codigoN4 ?? '4112',
        codigoCuenta: codigoCuenta(imp),
        jornadas: j,
        monto,
      })
    })
  }

  // Control: trabajadores activos del campo sin ningún registro en el mes
  const conRegistros = new Set(porTrabajador.keys())
  trabajadores
    .filter(
      (t) =>
        t.estado.startsWith('ACTIVO') && (!campo || t.campo === campo) && !conRegistros.has(t.id),
    )
    .forEach((t) =>
      advertencias.push(`${t.nombres} ${t.apellidos} está activo pero no tiene tarja en el período.`),
    )

  return {
    periodo,
    campo: campo ?? 'TODOS',
    diasMes: dias,
    base: usoLibro ? 'LIBRO' : 'DEVENGO',
    totalDistribuido: suma(lineas, (l) => l.monto),
    trabajadores: porTrabajador.size,
    jornadasTotales,
    lineas,
    advertencias,
  }
}

/* ─────────────── Agregaciones para el dashboard ─────────────── */

export const costoPorDimension = (
  lineas: LineaCosto[],
  dim: keyof ImputacionContable,
): { nombre: string; monto: number; jornadas: number }[] => {
  const m = agrupar(lineas, (l) => l.imputacion[dim] || '(sin asignar)')
  return [...m.entries()]
    .map(([nombre, ls]) => ({
      nombre,
      monto: suma(ls, (l) => l.monto),
      jornadas: suma(ls, (l) => l.jornadas),
    }))
    .sort((a, b) => b.monto - a.monto)
}

/** Costo por hectárea de un centro de costo — el KPI que pidió gerencia. */
export function costoPorHectarea(
  lineas: LineaCosto[],
  superficiePorCC: Map<string, number>,
): { cc: string; monto: number; has: number; costoHa: number }[] {
  const m = agrupar(lineas, (l) => l.imputacion.n13)
  return [...m.entries()]
    .map(([cc, ls]) => {
      const monto = suma(ls, (l) => l.monto)
      const has = superficiePorCC.get(cc) ?? 0
      return { cc, monto, has, costoHa: has > 0 ? monto / has : 0 }
    })
    .sort((a, b) => b.costoHa - a.costoHa)
}
