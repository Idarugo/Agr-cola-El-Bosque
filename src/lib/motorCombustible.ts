/**
 * ══════════════════════════════════════════════════════════════════════
 *  MOTOR DE CONTROL DE COMBUSTIBLE
 * ══════════════════════════════════════════════════════════════════════
 *
 *  Reemplaza "Planilla de control de petroleos". Implementa las reglas
 *  escritas en la hoja Recordatorio de esa planilla:
 *
 *   1. Hacer control al menos a fin de cada mes. En el control los litros
 *      van en cero y se registra el stock visible en el estanque.
 *   2. Cuando hay diferencia entre lo visible y lo estimado por registros,
 *      el ajuste se hace el primer día del mes siguiente y se prorratea
 *      entre los centros de costo según lo que cada uno consumió en el
 *      período (regla de tres).
 *   3. El ajuste se registra como entrada si la diferencia es positiva y
 *      como salida si es negativa.
 *   4. Todo ajuste queda identificado como tal en las observaciones.
 *
 *  El objetivo declarado es que la diferencia tienda a cero con el tiempo,
 *  mejorando registros y calibración del estanque.
 */

import type {
  Estanque,
  EstadoEstanque,
  LineaProrrateo,
  MovimientoCombustible,
} from './types'
import { agrupar, suma, uid } from './utils'

/* ─────────────── Medición del estanque ─────────────── */

/**
 * Convierte la medición con vara a litros.
 * La planilla usa una regla de tres: si 11,5 cm equivalen a 100 litros,
 * entonces litros = cm × 100 / 11,5.
 */
export const litrosDesdeCm = (cm: number, cmPorCienLitros: number) =>
  cmPorCienLitros > 0 ? (cm * 100) / cmPorCienLitros : 0

export const cmDesdeLitros = (litros: number, cmPorCienLitros: number) =>
  (litros * cmPorCienLitros) / 100

/* ─────────────── Estado del estanque ─────────────── */

/**
 * El orden que manda es el de registro, no el de la fecha.
 *
 * Es un detalle que parece menor y no lo es: un control y los ajustes que
 * lo siguen suelen llevar la misma fecha. Si el corte se hiciera por fecha,
 * el estimado "al momento del control" incluiría movimientos posteriores y
 * la diferencia saldría mal. La planilla original funciona por orden de
 * fila; aquí se respeta esa semántica usando la posición en el registro.
 */
export const movimientosDeEstanque = (movs: MovimientoCombustible[], estanqueId: string) =>
  movs.filter((m) => m.estanqueId === estanqueId)

/** Posición del último control en el orden de registro. -1 si no hay. */
export function indiceUltimoControl(movs: MovimientoCombustible[]) {
  for (let i = movs.length - 1; i >= 0; i--) if (movs[i].accion === 'CONTROL') return i
  return -1
}

/** Stock según registros: suma algebraica de todos los litros. */
export const stockEstimado = (movs: MovimientoCombustible[], hasta?: string) =>
  suma(
    movs.filter((m) => !hasta || m.fecha <= hasta),
    (m) => m.litros,
  )

export const ultimoControl = (movs: MovimientoCombustible[]) => {
  const i = indiceUltimoControl(movs)
  return i >= 0 ? movs[i] : undefined
}

/**
 * Estado completo de un estanque: cuánto debería haber según los registros,
 * cuánto se vio en el último control y cuánto se desvía uno del otro.
 */
export function estadoDeEstanque(
  estanque: Estanque,
  todos: MovimientoCombustible[],
): EstadoEstanque {
  const movs = movimientosDeEstanque(todos, estanque.id)
  const idx = indiceUltimoControl(movs)
  const control = idx >= 0 ? movs[idx] : undefined
  const estimado = suma(movs, (m) => m.litros)

  // La diferencia se mide contra el estimado en el momento del control.
  const estimadoAlControl = idx >= 0 ? suma(movs.slice(0, idx + 1), (m) => m.litros) : estimado
  const visible = control?.visible

  return {
    estanque,
    stockEstimado: estimado,
    ultimoControl: control,
    visibleUltimoControl: visible,
    diferencia: visible === undefined ? 0 : Math.round((visible - estimadoAlControl) * 100) / 100,
    movimientosDesdeControl: idx >= 0 ? movs.length - 1 - idx : movs.length,
    entradas: suma(movs.filter((m) => m.litros > 0), (m) => m.litros),
    salidas: suma(movs.filter((m) => m.litros < 0), (m) => m.litros),
  }
}

/* ─────────────── Prorrateo de diferencias ─────────────── */

/**
 * Distingue el consumo imputable a un centro de costo de la reposición del
 * estanque.
 *
 * Importa porque una calibración se registra como salida y devolución del
 * mismo volumen: no es combustible usado y debe compensarse dentro del
 * centro de costo. Una compra, en cambio, no participa del reparto. Por eso
 * la planilla habla de "salidas NETAS" y no de salidas a secas.
 */
export const esConsumoDeCentroCosto = (m: MovimientoCombustible) =>
  !(m.accion === 'STOCK_INICIAL' || (m.accion === 'ENTRADA' && (m.labor === 'ENTRADA' || !!m.precio)))

/**
 * Reparte la diferencia detectada en un control entre los centros de costo,
 * en proporción a lo que cada uno consumió durante el período.
 *
 * El período va desde el control anterior (excluido) hasta el control que
 * detectó la diferencia (incluido), tomados por posición de registro y no
 * por fecha, por la misma razón explicada más arriba.
 */
export function prorratearDiferencia(
  movs: MovimientoCombustible[],
  estanqueId: string,
  diferencia: number,
): LineaProrrateo[] {
  const delEstanque = movimientosDeEstanque(movs, estanqueId)
  const idx = indiceUltimoControl(delEstanque)
  if (idx < 0) return []

  // Control anterior: el último CONTROL antes del actual.
  let idxPrevio = -1
  for (let i = idx - 1; i >= 0; i--) {
    if (delEstanque[i].accion === 'CONTROL') {
      idxPrevio = i
      break
    }
  }

  const delPeriodo = delEstanque
    .slice(idxPrevio + 1, idx + 1)
    .filter((m) => m.accion !== 'CONTROL' && esConsumoDeCentroCosto(m))

  const porCC = agrupar(delPeriodo, (m) => m.cc || 'SIN CENTRO DE COSTO')

  // Netas: dentro de cada centro de costo se compensan salidas y devoluciones.
  const netoDe = (ms: MovimientoCombustible[]) => Math.max(0, -suma(ms, (m) => m.litros))
  const totalSalidas = suma([...porCC.values()], netoDe)

  if (totalSalidas === 0) return []

  const lineas: LineaProrrateo[] = [...porCC.entries()].map(([cc, ms]) => {
    const salidasNetas = netoDe(ms)
    const proporcion = salidasNetas / totalSalidas
    return {
      cc,
      campo: ms[0].campo,
      salidasNetas: Math.round(salidasNetas * 100) / 100,
      proporcion,
      ajuste: Math.round(diferencia * proporcion * 100) / 100,
    }
  })
  const conConsumo = lineas.filter((l) => l.salidasNetas > 0)
  if (conConsumo.length === 0) return []
  lineas.length = 0
  lineas.push(...conConsumo)

  // La línea mayor absorbe el redondeo para que la suma cierre exacta.
  const repartido = suma(lineas, (l) => l.ajuste)
  const resto = Math.round((diferencia - repartido) * 100) / 100
  if (resto !== 0 && lineas.length > 0) {
    const mayor = lineas.reduce((a, b) => (Math.abs(b.ajuste) > Math.abs(a.ajuste) ? b : a))
    mayor.ajuste = Math.round((mayor.ajuste + resto) * 100) / 100
  }

  return lineas.sort((a, b) => Math.abs(b.ajuste) - Math.abs(a.ajuste))
}

/**
 * Convierte el prorrateo en movimientos de ajuste listos para registrar.
 * Positivo → entrada; negativo → salida, tal como indica el recordatorio.
 */
export function movimientosDeAjuste(
  lineas: LineaProrrateo[],
  estanqueId: string,
  fecha: string,
  movsPrevios: MovimientoCombustible[],
): MovimientoCombustible[] {
  return lineas
    .filter((l) => l.ajuste !== 0)
    .map((l) => {
      // Se hereda la especie y variedad del último consumo de ese centro de costo
      const ref = movsPrevios
        .filter((m) => m.cc === l.cc && m.litros < 0)
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .at(-1)
      return {
        id: uid(),
        fecha,
        estanqueId,
        accion: 'AJUSTE' as const,
        campo: l.campo,
        especie: ref?.especie ?? 'GENERAL',
        variedad: ref?.variedad ?? 'GENERAL',
        cc: l.cc,
        labor: 'Calibración',
        litros: l.ajuste,
        observaciones: `AJUSTE por control de estanque ${fecha} · prorrateo ${(l.proporcion * 100).toFixed(1)}% de ${l.salidasNetas} L consumidos`,
      }
    })
}

/* ─────────────── Hoja de conteo mensual ─────────────── */

/**
 * Procedimiento de conteo de "HOJA CONTEO LITROS PETROLEO", en sus 5 pasos.
 *
 *   PASO 1  Entradas   saldo inicial + compras = total ingresos
 *   PASO 2  Salidas    suma de cada entrega registrada
 *   PASO 3  Chequeo    contador final − contador inicial debe ser IGUAL
 *                      a la suma de salidas del paso 2
 *   PASO 4  Resultado  total entradas − total salidas = saldo contable,
 *                      que se compara con el saldo visible del estanque
 *   PASO 5  Lectura    saldo contable − saldo visible:
 *                        negativo → hay más petróleo del que indica la
 *                                   máquina → calibrar
 *                        positivo → hay menos petróleo → mal registro,
 *                                   robo en la entrega o fugas en el campo
 *
 * El paso 3 es el que la planilla de inventario no tenía: cruza el registro
 * manual contra el contador mecánico del estanque. Si no cuadran, hay
 * entregas sin registrar, y ningún ajuste posterior lo va a arreglar.
 */
export interface HojaConteo {
  periodo: string
  estanqueId: string
  // Paso 1
  saldoInicial: number
  compras: number
  totalIngresos: number
  // Paso 2
  totalSalidas: number
  entregas: number
  // Paso 3
  contadorInicial?: number
  contadorFinal?: number
  diferenciaContador?: number
  descuadreContador?: number
  contadorCuadra: boolean
  // Paso 4
  saldoContable: number
  saldoVisible?: number
  fechaControl?: string
  // Paso 5
  diferencia: number
  interpretacion: 'SIN CONTROL' | 'CUADRADO' | 'CALIBRAR' | 'INVESTIGAR'
  mensaje: string
}

export function hojaDeConteo(
  movs: MovimientoCombustible[],
  estanqueId: string,
  periodo: string,
): HojaConteo {
  const delEstanque = movimientosDeEstanque(movs, estanqueId)
  const antes = delEstanque.filter((m) => m.fecha < `${periodo}-01`)
  const delMes = delEstanque.filter((m) => m.fecha.startsWith(periodo))

  // ── Paso 1 · Entradas ────────────────────────────────────────────
  const saldoInicial = suma(antes, (m) => m.litros)
  const compras = suma(delMes.filter((m) => m.litros > 0), (m) => m.litros)
  const totalIngresos = saldoInicial + compras

  // ── Paso 2 · Salidas ─────────────────────────────────────────────
  const salidas = delMes.filter((m) => m.litros < 0)
  const totalSalidas = Math.abs(suma(salidas, (m) => m.litros))

  // ── Paso 3 · Chequeo del contador mecánico ───────────────────────
  const conContador = delEstanque.filter((m) => typeof m.contador === 'number')
  const contadorInicial = [...conContador].reverse().find((m) => m.fecha < `${periodo}-01`)?.contador
  const contadorFinal = conContador.filter((m) => m.fecha.startsWith(periodo)).at(-1)?.contador

  const diferenciaContador =
    contadorInicial !== undefined && contadorFinal !== undefined
      ? Math.round((contadorFinal - contadorInicial) * 100) / 100
      : undefined
  const descuadreContador =
    diferenciaContador !== undefined
      ? Math.round((diferenciaContador - totalSalidas) * 100) / 100
      : undefined
  const contadorCuadra = descuadreContador === undefined || Math.abs(descuadreContador) < 0.5

  // ── Paso 4 · Saldo contable contra saldo visible ─────────────────
  const saldoContable = Math.round((totalIngresos - totalSalidas) * 100) / 100
  const control = delMes.filter((m) => m.accion === 'CONTROL' && m.visible !== undefined).at(-1)
  const saldoVisible = control?.visible

  // ── Paso 5 · Interpretación, con el signo de la hoja original ────
  const diferencia =
    saldoVisible === undefined ? 0 : Math.round((saldoContable - saldoVisible) * 100) / 100

  let interpretacion: HojaConteo['interpretacion'] = 'SIN CONTROL'
  let mensaje = 'No hay control físico del estanque en el período. Mida el estanque y registre el control.'

  if (saldoVisible !== undefined) {
    if (Math.abs(diferencia) < 0.5) {
      interpretacion = 'CUADRADO'
      mensaje = 'El saldo contable coincide con el visible. No hay ajuste que hacer.'
    } else if (diferencia < 0) {
      interpretacion = 'CALIBRAR'
      mensaje = `Hay ${Math.abs(diferencia)} L más de petróleo del que indica la máquina. Corresponde revisar la calibración del estanque.`
    } else {
      interpretacion = 'INVESTIGAR'
      mensaje = `Hay ${diferencia} L menos de petróleo del que indica la máquina. Posibles causas: mal registro, entrega incompleta del proveedor o fugas en el campo.`
    }
  }

  return {
    periodo, estanqueId,
    saldoInicial: Math.round(saldoInicial * 100) / 100,
    compras: Math.round(compras * 100) / 100,
    totalIngresos: Math.round(totalIngresos * 100) / 100,
    totalSalidas: Math.round(totalSalidas * 100) / 100,
    entregas: salidas.length,
    contadorInicial, contadorFinal, diferenciaContador, descuadreContador, contadorCuadra,
    saldoContable, saldoVisible, fechaControl: control?.fecha,
    diferencia, interpretacion, mensaje,
  }
}

/* ─────────────── Análisis de consumo ─────────────── */

export type DimensionConsumo = 'cc' | 'labor' | 'vehiculo' | 'chofer' | 'especie' | 'campo'

export function consumoPorDimension(
  movs: MovimientoCombustible[],
  dim: DimensionConsumo,
  filtro?: { estanqueId?: string; desde?: string; hasta?: string },
) {
  const salidas = movs.filter(
    (m) =>
      m.litros < 0 &&
      (!filtro?.estanqueId || m.estanqueId === filtro.estanqueId) &&
      (!filtro?.desde || m.fecha >= filtro.desde) &&
      (!filtro?.hasta || m.fecha <= filtro.hasta),
  )

  const porClave = agrupar(salidas, (m) => (m[dim] as string) || '(sin registrar)')
  const total = Math.abs(suma(salidas, (m) => m.litros))

  return [...porClave.entries()]
    .map(([nombre, ms]) => {
      const litros = Math.abs(suma(ms, (m) => m.litros))
      return {
        nombre,
        litros: Math.round(litros * 100) / 100,
        movimientos: ms.length,
        horas: suma(ms, (m) => m.horas ?? 0),
        proporcion: total > 0 ? litros / total : 0,
      }
    })
    .sort((a, b) => b.litros - a.litros)
}

/** Serie mensual de entradas y salidas, para ver la estacionalidad. */
export function serieMensual(movs: MovimientoCombustible[], estanqueId?: string) {
  const filtrados = movs.filter((m) => !estanqueId || m.estanqueId === estanqueId)
  const porMes = agrupar(filtrados, (m) => m.fecha.slice(0, 7))
  return [...porMes.entries()]
    .map(([periodo, ms]) => ({
      periodo,
      entradas: Math.round(suma(ms.filter((m) => m.litros > 0), (m) => m.litros)),
      salidas: Math.round(Math.abs(suma(ms.filter((m) => m.litros < 0), (m) => m.litros))),
      controles: ms.filter((m) => m.accion === 'CONTROL').length,
    }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
}

/* ─────────────── Valorización ─────────────── */

/**
 * Precio promedio ponderado de las compras. Es el criterio que corresponde
 * cuando el combustible se acumula en un estanque común y no se puede
 * identificar de qué carga salió cada litro.
 */
export function precioPromedio(movs: MovimientoCombustible[], estanqueId?: string) {
  const compras = movs.filter(
    (m) => m.litros > 0 && m.precio && m.precio > 0 && (!estanqueId || m.estanqueId === estanqueId),
  )
  if (compras.length === 0) return 0
  const valor = suma(compras, (m) => m.litros * (m.precio ?? 0))
  const litros = suma(compras, (m) => m.litros)
  return litros > 0 ? valor / litros : 0
}

export interface CostoCombustibleCC {
  cc: string
  campo: string
  especie: string
  variedad: string
  litros: number
  monto: number
}

/**
 * Valoriza el consumo de un período por centro de costo.
 * Es lo que después se convierte en asiento contable.
 */
export function valorizarConsumo(
  movs: MovimientoCombustible[],
  precio: number,
  filtro?: { estanqueId?: string; desde?: string; hasta?: string; campo?: string },
): CostoCombustibleCC[] {
  const salidas = movs.filter(
    (m) =>
      m.litros < 0 &&
      m.accion !== 'CONTROL' &&
      (!filtro?.estanqueId || m.estanqueId === filtro.estanqueId) &&
      (!filtro?.campo || filtro.campo === 'TODOS' || m.campo === filtro.campo) &&
      (!filtro?.desde || m.fecha >= filtro.desde) &&
      (!filtro?.hasta || m.fecha <= filtro.hasta),
  )

  const porCC = agrupar(salidas, (m) => [m.campo, m.cc, m.especie, m.variedad].join('¦'))

  return [...porCC.values()]
    .map((ms) => {
      const litros = Math.round(Math.abs(suma(ms, (m) => m.litros)) * 100) / 100
      return {
        cc: ms[0].cc || 'SIN CENTRO DE COSTO',
        campo: ms[0].campo,
        especie: ms[0].especie,
        variedad: ms[0].variedad,
        litros,
        monto: Math.round(litros * precio),
      }
    })
    .filter((x) => x.litros > 0)
    .sort((a, b) => b.monto - a.monto)
}

/* ─────────────── Controles de consistencia ─────────────── */

export interface AlertaCombustible {
  nivel: 'critico' | 'aviso' | 'info'
  mensaje: string
}

export function revisarEstanque(estado: EstadoEstanque, movs: MovimientoCombustible[]) {
  const alertas: AlertaCombustible[] = []
  const { estanque, stockEstimado: stock, diferencia, ultimoControl: ctrl } = estado

  if (Math.abs(diferencia) > 0.5)
    alertas.push({
      nivel: Math.abs(diferencia) > 100 ? 'critico' : 'aviso',
      mensaje: `Diferencia de ${diferencia > 0 ? '+' : ''}${diferencia} L entre lo visible y lo estimado. Corresponde prorratear el ajuste entre los centros de costo.`,
    })

  if (stock < 0)
    alertas.push({
      nivel: 'critico',
      mensaje: `El stock estimado es negativo (${Math.round(stock)} L). Faltan entradas por registrar o hay salidas duplicadas.`,
    })

  if (stock > estanque.capacidad)
    alertas.push({
      nivel: 'aviso',
      mensaje: `El stock estimado (${Math.round(stock)} L) supera la capacidad del estanque (${estanque.capacidad} L).`,
    })

  if (!ctrl) {
    alertas.push({ nivel: 'aviso', mensaje: 'Este estanque nunca ha tenido un control físico.' })
  } else {
    const dias = Math.round(
      (Date.parse(movs.at(-1)?.fecha ?? ctrl.fecha) - Date.parse(ctrl.fecha)) / 86_400_000,
    )
    if (dias > 45)
      alertas.push({
        nivel: 'aviso',
        mensaje: `Han pasado ${dias} días desde el último control. La regla es controlar al menos a fin de cada mes.`,
      })
  }

  const sinCC = movs.filter((m) => m.litros < 0 && !m.cc).length
  if (sinCC > 0)
    alertas.push({
      nivel: 'aviso',
      mensaje: `${sinCC} salidas sin centro de costo: ese consumo no se puede imputar.`,
    })

  // Chequeo del contador mecánico sobre el último período con lecturas
  if (estanque.tieneContador) {
    const conLectura = movs.filter((m) => typeof m.contador === 'number')
    const ultimo = conLectura.at(-1)
    if (ultimo) {
      const hoja = hojaDeConteo(movs, estanque.id, ultimo.fecha.slice(0, 7))
      if (!hoja.contadorCuadra)
        alertas.push({
          nivel: 'critico',
          mensaje: `El contador del estanque marca ${hoja.diferenciaContador} L en ${hoja.periodo} pero se registraron ${hoja.totalSalidas} L de entregas: faltan ${Math.abs(hoja.descuadreContador ?? 0)} L por registrar.`,
        })
    }
  }

  return alertas
}
