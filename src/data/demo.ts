/**
 * Datos de demostración generados con la estructura real de la empresa.
 * Sirven para que el sistema se pueda evaluar de inmediato; el botón
 * "Limpiar todo" los borra para empezar con datos productivos.
 */
import type {
  Capacitacion,
  CharlaSeguridad,
  EntregaEPP,
  ItemEPP,
  MatrizEPP,
  MovimientoSemillas,
  Premio,
  RegistroTarja,
  Remuneracion,
  TipoDia,
  Trabajador,
} from '@/lib/types'
import { BASE_OPERATIVA, CARGOS, LABORES } from './maestros'
import { ESTANQUES_INICIALES, movimientosBuin } from './combustible'
import {
  MAQUINAS_APLICACION, PLAGAS, PRODUCTOS_INICIALES, movimientosInicialesBodega,
} from './bodega'
import { cantidadAplicada, salidaDeAplicacion } from '@/lib/motorBodega'
import type { Aplicacion, MovimientoBodega } from '@/lib/types'
import { dvRut, esFinDeSemana, fechasDelMes, temporadaDe, uid } from '@/lib/utils'
import { distribuir } from '@/lib/motorCostos'
import { asientoDeRemuneraciones, fechaCierre } from '@/lib/puenteContable'
import type { Asiento } from '@/lib/types'

/* Generador determinista — la demo siempre luce igual. */
let s = 20260812
const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
const entre = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))

const NOMBRES = [
  'José', 'María', 'Luis', 'Carmen', 'Pedro', 'Rosa', 'Juan', 'Ana', 'Carlos', 'Marta',
  'Miguel', 'Patricia', 'Sergio', 'Elena', 'Jorge', 'Claudia', 'Raúl', 'Sandra', 'Víctor', 'Nancy',
  'Héctor', 'Gloria', 'Manuel', 'Teresa', 'Óscar', 'Silvia', 'Andrés', 'Paola',
]
const APELLIDOS = [
  'González', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'Soto', 'Contreras', 'Silva', 'Martínez',
  'Sepúlveda', 'Morales', 'Rodríguez', 'López', 'Fuentes', 'Hernández', 'Torres', 'Araya',
  'Flores', 'Espinoza', 'Valenzuela', 'Castillo', 'Tapia', 'Reyes', 'Gutiérrez', 'Vega',
]
const BANCOS = ['Banco Estado', 'Banco de Chile', 'BCI', 'Santander', 'Scotiabank']
const AFPS = ['Habitat', 'Provida', 'Cuprum', 'Modelo', 'PlanVital', 'Capital']

const rutSimulado = (n: number) => {
  const cuerpo = String(9_000_000 + n * 137_713)
  return `${cuerpo}-${dvRut(cuerpo)}`
}

export function semillaInicial() {
  const periodoDemo = '2026-07'
  const campos = ['BUIN', 'GRANEROS', 'LOS_LIRIOS', 'CHUMACO']

  /* ── Trabajadores ─────────────────────────────────────────── */
  const cargosAgricolas = CARGOS.filter((c) => c.cuentaN4 === 'MANO_DE_OBRA').map((c) => c.cargo)
  const cargosAdm = CARGOS.filter((c) => c.cuentaN4 === 'SUELDOS_ADM').map((c) => c.cargo)
  const cargosNad = CARGOS.filter((c) => c.cuentaN4 === 'MANO_OBRA_NAD').map((c) => c.cargo)

  const trabajadores: Trabajador[] = []
  let n = 0
  for (const campo of campos) {
    const dotacion = campo === 'BUIN' ? 18 : campo === 'GRANEROS' ? 14 : 11
    for (let i = 0; i < dotacion; i++) {
      n++
      const esAdm = i < 2
      const esNad = i === 2
      const cargo = esAdm ? pick(cargosAdm) : esNad ? pick(cargosNad) : pick(cargosAgricolas)
      const sueldo = esAdm ? entre(950, 2200) * 1000 : entre(510, 720) * 1000
      const estado: Trabajador['estado'] =
        rnd() < 0.05 ? 'ACTIVO-LICENCIA' : rnd() < 0.04 ? 'FINIQUITADO' : 'ACTIVO'
      trabajadores.push({
        id: uid(),
        rut: rutSimulado(n),
        nombres: pick(NOMBRES),
        apellidos: `${pick(APELLIDOS)} ${pick(APELLIDOS)}`,
        cargo,
        campo,
        estado,
        tipoContrato: esAdm ? 'INDEFINIDO' : rnd() < 0.5 ? 'POR FAENA' : 'PLAZO FIJO',
        fechaIngreso: `20${entre(18, 25)}-${String(entre(1, 12)).padStart(2, '0')}-${String(entre(1, 28)).padStart(2, '0')}`,
        sueldoBase: sueldo,
        telefono: `+569${entre(40000000, 99999999)}`,
        tallaRopa: pick(['S', 'M', 'L', 'XL']),
        tallaCalzado: String(entre(37, 45)),
        banco: pick(BANCOS),
        tipoCuenta: pick(['Cuenta Vista', 'Cuenta Corriente', 'Cuenta RUT']),
        nroCuenta: String(entre(10000000, 99999999)),
        afp: pick(AFPS),
        salud: rnd() < 0.75 ? 'Fonasa' : pick(['Colmena', 'Cruz Blanca', 'Banmédica']),
        semillas: entre(0, 320),
      })
    }
  }

  /* ── Tarja del período ────────────────────────────────────── */
  const laboresPorTemporada = ['PODA', 'DESBROTE', 'RALEO', 'RIEGO', 'FERTILIZACION', 'APLICACIONES_QUIMICAS', 'TRABAJOS_DE_SUELO', 'MANTENIMIENTO', 'ORTOPEDIA']
  const fechas = fechasDelMes(periodoDemo)
  const temporada = temporadaDe(fechas[0])

  const cuartelesPorCampo = new Map<string, typeof BASE_OPERATIVA>()
  for (const c of BASE_OPERATIVA) {
    if (!cuartelesPorCampo.has(c.campo)) cuartelesPorCampo.set(c.campo, [])
    cuartelesPorCampo.get(c.campo)!.push(c)
  }

  const tarja: RegistroTarja[] = []
  for (const t of trabajadores) {
    if (t.estado === 'FINIQUITADO') continue
    const cuarteles = cuartelesPorCampo.get(t.campo) ?? []
    const esAdm = CARGOS.find((c) => c.cargo === t.cargo)?.cuentaN4 === 'SUELDOS_ADM'
    // Cada trabajador se concentra en 1–3 labores del mes (realista)
    const misLabores = Array.from({ length: entre(1, 3) }, () => pick(laboresPorTemporada))
    let diasVac = rnd() < 0.12 ? entre(3, 10) : 0
    let diasLic = t.estado === 'ACTIVO-LICENCIA' ? entre(5, 15) : 0

    for (const fecha of fechas) {
      const finde = esFinDeSemana(fecha)
      let tipoDia: TipoDia
      if (diasLic > 0) {
        tipoDia = 'LICENCIA'
        diasLic--
      } else if (diasVac > 0 && !finde) {
        tipoDia = 'VACACIONES'
        diasVac--
      } else if (finde) {
        // Fin de semana: sólo a veces es jornada efectiva (riego, nochero, cosecha)
        if (rnd() < 0.18) tipoDia = 'TRABAJADO'
        else {
          tipoDia = 'INHABIL'
        }
      } else {
        const r = rnd()
        tipoDia =
          r < 0.885 ? 'TRABAJADO'
          : r < 0.915 ? 'TRATO'
          : r < 0.94 ? 'FALTA_JUSTIFICADA'
          : r < 0.958 ? 'FALTA_INJUSTIFICADA'
          : r < 0.972 ? 'PERMISO'
          : r < 0.986 ? 'LLUVIA'
          : 'TRABAJADO'
      }

      const laborGeneral = esAdm
        ? 'ADMINISTRACIÓN'
        : tipoDia === 'VACACIONES'
          ? 'VACACIONES'
          : tipoDia === 'TRABAJADO' || tipoDia === 'TRATO'
            ? pick(misLabores)
            : 'SIN_LABOR'
      const especificas = LABORES[laborGeneral] ?? ['0']
      const q = cuarteles.length ? pick(cuarteles) : undefined

      const jornadas =
        tipoDia === 'TRATO'
          ? Math.round((0.7 + rnd() * 0.7) * 100) / 100 // equivalencia de jornada
          : ['TRABAJADO', 'VACACIONES'].includes(tipoDia)
            ? 1
            : 0

      const atraso = rnd()
      tarja.push({
        id: uid(),
        fecha,
        trabajadorId: t.id,
        campo: t.campo,
        cc: q?.cce ?? `GENERAL ${t.campo}`,
        laborGeneral,
        laborEspecifica: laborGeneral === 'SIN_LABOR' ? '0' : pick(especificas),
        especie: laborGeneral === 'SIN_LABOR' || esAdm ? '0' : (q?.especie ?? '0'),
        variedad: laborGeneral === 'SIN_LABOR' || esAdm ? '0' : (q?.variedad ?? '0'),
        etapaPlanta: esAdm ? '0' : rnd() < 0.25 ? 'PLANTA EN FORMACIÓN' : 'PLANTA ADULTA',
        temporada,
        tipoDia,
        jornadas,
        horaLlegada:
          jornadas > 0 ? (atraso < 0.8 ? '08:00' : atraso < 0.93 ? '08:12' : '08:35') : undefined,
        horasExtra: jornadas > 0 && rnd() < 0.1 ? entre(1, 3) : 0,
        rendimiento: jornadas > 0 && rnd() < 0.35 ? entre(8, 45) : undefined,
        unidadRendimiento: 'HILERA',
      })
    }
  }

  /* ── Libro de remuneraciones (export Nubox simulado) ──────── */
  const remuneraciones: Remuneracion[] = trabajadores
    .filter((t) => t.estado !== 'FINIQUITADO')
    .map((t) => {
      const gratificacion = Math.round(t.sueldoBase * 0.25)
      const bonos = entre(0, 90) * 1000
      const asignacionFamiliar = rnd() < 0.4 ? entre(1, 3) * 14500 : 0
      const totalHaber = t.sueldoBase + gratificacion + bonos + asignacionFamiliar
      const descuentos = Math.round(totalHaber * 0.2)
      const anticipo = rnd() < 0.35 ? entre(50, 150) * 1000 : 0
      return {
        id: uid(),
        periodo: periodoDemo,
        trabajadorId: t.id,
        totalHaber,
        asignacionFamiliar,
        totalDescuentos: descuentos,
        liquido: totalHaber - descuentos - anticipo,
        costoEmpresa: Math.round(totalHaber * 1.05),
        anticipo,
      }
    })

  /* ── Prevención de riesgos ────────────────────────────────── */
  const eppDefs: Omit<ItemEPP, 'id'>[] = [
    { nombre: 'Casco de seguridad', unidad: 'UNIDAD', stock: 42, stockMinimo: 15, vidaUtilDias: 730, costoUnitario: 8900 },
    { nombre: 'Guantes de cabritilla', unidad: 'PACK', stock: 8, stockMinimo: 25, vidaUtilDias: 60, costoUnitario: 3200 },
    { nombre: 'Guantes de nitrilo', unidad: 'PACK', stock: 61, stockMinimo: 20, vidaUtilDias: 30, costoUnitario: 2400 },
    { nombre: 'Antiparras', unidad: 'UNIDAD', stock: 30, stockMinimo: 12, vidaUtilDias: 365, costoUnitario: 4500 },
    { nombre: 'Respirador media cara', unidad: 'UNIDAD', stock: 6, stockMinimo: 10, vidaUtilDias: 365, costoUnitario: 28900 },
    { nombre: 'Filtro para agroquímicos', unidad: 'PACK', stock: 14, stockMinimo: 20, vidaUtilDias: 90, costoUnitario: 12500 },
    { nombre: 'Traje tyvek', unidad: 'UNIDAD', stock: 22, stockMinimo: 15, vidaUtilDias: 30, costoUnitario: 6800 },
    { nombre: 'Botas de seguridad', unidad: 'PAR', stock: 19, stockMinimo: 10, vidaUtilDias: 365, costoUnitario: 24900 },
    { nombre: 'Bloqueador solar FPS50', unidad: 'UNIDAD', stock: 55, stockMinimo: 30, vidaUtilDias: 60, costoUnitario: 5600 },
    { nombre: 'Legionario / cubrenuca', unidad: 'UNIDAD', stock: 37, stockMinimo: 20, vidaUtilDias: 180, costoUnitario: 4200 },
    { nombre: 'Protector auditivo', unidad: 'PAR', stock: 26, stockMinimo: 12, vidaUtilDias: 180, costoUnitario: 3100 },
    { nombre: 'Chaleco reflectante', unidad: 'UNIDAD', stock: 11, stockMinimo: 15, vidaUtilDias: 365, costoUnitario: 5900 },
  ]
  const epp: ItemEPP[] = eppDefs.map((e) => ({ ...e, id: uid() }))
  const byName = (n: string) => epp.find((e) => e.nombre === n)!.id

  const matrizEpp: MatrizEPP[] = []
  const reglas: Record<string, string[]> = {
    'OPERARIO AGRÍCOLA': ['Guantes de cabritilla', 'Bloqueador solar FPS50', 'Legionario / cubrenuca', 'Botas de seguridad'],
    'TRACTORISTA APLICADOR SAG': ['Respirador media cara', 'Filtro para agroquímicos', 'Traje tyvek', 'Antiparras', 'Guantes de nitrilo', 'Botas de seguridad'],
    APLICADOR: ['Respirador media cara', 'Filtro para agroquímicos', 'Traje tyvek', 'Antiparras', 'Guantes de nitrilo'],
    'ENCARGADO DE RIEGO POR GOTEO': ['Botas de seguridad', 'Guantes de nitrilo', 'Bloqueador solar FPS50'],
    'ENCARGADO DE RIEGO': ['Botas de seguridad', 'Guantes de nitrilo', 'Bloqueador solar FPS50'],
    'JEFE DE CAMPO': ['Casco de seguridad', 'Chaleco reflectante', 'Botas de seguridad', 'Bloqueador solar FPS50'],
    NOCHERO: ['Chaleco reflectante', 'Protector auditivo'],
    BODEGUERO: ['Casco de seguridad', 'Guantes de cabritilla', 'Chaleco reflectante'],
    'ADMINISTRADOR CAMPO': ['Casco de seguridad', 'Chaleco reflectante'],
  }
  for (const [cargo, items] of Object.entries(reglas))
    for (const it of items)
      matrizEpp.push({ id: uid(), cargo, eppId: byName(it), cantidad: 1, obligatorio: true })

  const entregasEpp: EntregaEPP[] = []
  for (const t of trabajadores.filter((x) => x.estado === 'ACTIVO').slice(0, 34)) {
    const req = matrizEpp.filter((m) => m.cargo === t.cargo)
    for (const m of req.slice(0, entre(1, req.length || 1))) {
      entregasEpp.push({
        id: uid(),
        fecha: `2026-0${entre(4, 7)}-${String(entre(1, 28)).padStart(2, '0')}`,
        trabajadorId: t.id,
        eppId: m.eppId,
        cantidad: 1,
        motivo: rnd() < 0.7 ? 'ENTREGA INICIAL' : 'RENOVACIÓN',
        firmado: rnd() < 0.85,
      })
    }
  }

  const activos = trabajadores.filter((t) => t.estado === 'ACTIVO')
  const capacitaciones: Capacitacion[] = [
    { nombre: 'Uso seguro de agroquímicos (SAG)', fecha: '2026-04-18', horas: 8, relator: 'ACHS', campo: 'BUIN', vigenciaMeses: 24 },
    { nombre: 'Manejo manual de cargas', fecha: '2026-05-22', horas: 4, relator: 'ACHS', campo: 'GRANEROS', vigenciaMeses: 12 },
    { nombre: 'Prevención de caídas en escalera', fecha: '2026-06-10', horas: 3, relator: 'Prevencionista interno', campo: 'BUIN', vigenciaMeses: 12 },
    { nombre: 'Primeros auxilios básicos', fecha: '2026-06-27', horas: 6, relator: 'Cruz Roja', campo: 'LOS_LIRIOS', vigenciaMeses: 24 },
    { nombre: 'Operación segura de tractor', fecha: '2026-07-08', horas: 5, relator: 'ACHS', campo: 'CHUMACO', vigenciaMeses: 36 },
  ].map((c) => ({
    ...c,
    id: uid(),
    asistentes: activos
      .filter((t) => t.campo === c.campo)
      .slice(0, entre(4, 10))
      .map((t) => t.id),
  }))

  const charlas: CharlaSeguridad[] = []
  for (const campo of campos) {
    for (let i = 0; i < entre(6, 14); i++) {
      const dia = String(entre(1, 28)).padStart(2, '0')
      const labor = pick(laboresPorTemporada)
      charlas.push({
        id: uid(),
        fecha: `${periodoDemo}-${dia}`,
        campo,
        laborGeneral: labor,
        riesgos: pick([
          'Corte con herramienta de poda',
          'Exposición a radiación UV',
          'Contacto con agroquímicos',
          'Caída del mismo nivel en callejones',
          'Atrapamiento con maquinaria',
          'Sobreesfuerzo por manejo de carga',
        ]),
        medidas: pick([
          'Uso obligatorio de guantes y revisión de tijeras antes de iniciar',
          'Bloqueador cada 3 horas, legionario y sombra en colación',
          'Traje tyvek, respirador con filtro vigente y ducha post aplicación',
          'Despeje de callejones y calzado con suela antideslizante',
          'Detención total de maquinaria antes de intervenir',
        ]),
        responsable: 'Jefe de campo',
        asistentes: activos
          .filter((t) => t.campo === campo)
          .slice(0, entre(5, 12))
          .map((t) => t.id),
      })
    }
  }

  /* ── Pack motivacional ────────────────────────────────────── */
  const premios: Premio[] = [
    { id: uid(), nombre: 'Caja de mercadería familiar', costoSemillas: 400, stock: 12 },
    { id: uid(), nombre: 'Bono en dinero $30.000', costoSemillas: 300, stock: 20 },
    { id: uid(), nombre: 'Día administrativo', costoSemillas: 250, stock: 8 },
    { id: uid(), nombre: 'Set de herramientas', costoSemillas: 180, stock: 15 },
    { id: uid(), nombre: 'Vale de combustible $15.000', costoSemillas: 150, stock: 25 },
  ]

  const semillas: MovimientoSemillas[] = activos.slice(0, 30).map((t) => ({
    id: uid(),
    fecha: `${periodoDemo}-28`,
    trabajadorId: t.id,
    motivo: 'Asistencia completa del mes',
    semillas: entre(10, 60),
    tipo: 'ASISTENCIA' as const,
  }))

  /* ── Contabilidad ──────────────────────────────────────────────────
     Los asientos de remuneraciones se generan con el mismo puente que usa
     el botón "Contabilizar" del módulo de costos: lo que se ve en la demo
     es exactamente lo que el sistema produce en operación.
     Alrededor se agregan los asientos que dan contexto (capital, banco,
     anticipos, una venta y una compra con IVA) para que el balance refleje
     un ejercicio en marcha y no sólo la planilla de sueldos. */
  const asientos: Asiento[] = []
  let nAsiento = 0

  const linea = (cuenta: string, debe: number, haber: number, glosaLinea?: string) => ({
    id: uid(), cuenta, debe, haber, glosaLinea,
  })
  const asentar = (fecha: string, glosa: string, lineas: ReturnType<typeof linea>[]) => {
    nAsiento++
    asientos.push({
      id: uid(), numero: nAsiento, fecha, glosa,
      origen: 'MANUAL' as const, lineas,
    })
  }

  const cierre = fechaCierre(periodoDemo)
  const anticiposTotales = remuneraciones.reduce((a, r) => a + r.anticipo, 0)

  // Saldo de apertura del ejercicio
  asentar('2026-01-01', 'Apertura del ejercicio · aporte de capital', [
    linea('1.2', 180_000_000, 0, 'Banco'),
    linea('1.11', 620_000_000, 0, 'Plantaciones, maquinaria e infraestructura'),
    linea('3.1', 0, 800_000_000, 'Capital social'),
  ])

  // Venta de fruta con IVA (19%)
  const ventaNeta = 96_500_000
  const ivaVenta = Math.round(ventaNeta * 0.19)
  asentar(`${periodoDemo}-12`, 'Venta de fruta temporada · factura N°1042', [
    linea('1.3', ventaNeta + ivaVenta, 0, 'Clientes por cobrar'),
    linea('4.1', 0, ventaNeta, 'Ventas de fruta'),
    linea('2.3', 0, ivaVenta, 'IVA débito fiscal'),
  ])

  // Compra de insumos con IVA
  const compraNeta = 14_200_000
  const ivaCompra = Math.round(compraNeta * 0.19)
  asentar(`${periodoDemo}-18`, 'Compra de fertilizantes y agroquímicos · factura N°8871', [
    linea('1.5', compraNeta, 0, 'Inventario de insumos'),
    linea('1.6', ivaCompra, 0, 'IVA crédito fiscal'),
    linea('2.1', 0, compraNeta + ivaCompra, 'Proveedores'),
  ])

  // Anticipos entregados durante el mes
  if (anticiposTotales > 0) {
    asentar(`${periodoDemo}-15`, 'Anticipos de sueldo entregados', [
      linea('1.71', anticiposTotales, 0, 'Anticipos de sueldos'),
      linea('1.2', 0, anticiposTotales, 'Banco'),
    ])
  }

  // Remuneraciones: un asiento por campo, generado por el puente contable
  let liquidoTotal = 0
  for (const campo of campos) {
    const res = distribuir(trabajadores, tarja, remuneraciones, { periodo: periodoDemo, campo })
    if (res.lineas.length === 0) continue
    nAsiento++
    const { asiento, resumen } = asientoDeRemuneraciones(res, trabajadores, remuneraciones, {
      numero: nAsiento,
      fecha: cierre,
      glosa: `Remuneraciones ${campo.replace('_', ' ')}`,
    })
    liquidoTotal += resumen.liquido
    asientos.push(asiento)
  }

  // Pago de las remuneraciones por transferencia
  if (liquidoTotal > 0) {
    asentar(cierre, 'Pago de remuneraciones · nómina bancaria', [
      linea('2.4', Math.round(liquidoTotal), 0, 'Remuneraciones por pagar'),
      linea('1.2', 0, Math.round(liquidoTotal), 'Banco'),
    ])
  }

  /* ── Bodega y aplicaciones fitosanitarias ─────────────────────────
     El stock inicial es el conteo físico real de septiembre. Sobre él se
     simulan compras y aplicaciones, cada una descontando su producto. */
  const bodega: MovimientoBodega[] = movimientosInicialesBodega()
  const aplicaciones: Aplicacion[] = []

  const camposBodega = ['LOS_LIRIOS', 'CHUMACO']
  const fitosanitarios = PRODUCTOS_INICIALES.filter(
    (p) => ['INSECTICIDA', 'FUNGICIDA', 'HERBICIDA', 'BIOESTIMULANTE'].includes(p.categoria),
  )

  // Compras de reposición: los fitosanitarios se compran para la temporada
  for (const campo of camposBodega) {
    for (const p of fitosanitarios) {
      if (rnd() > 0.55) continue
      bodega.push({
        id: uid(),
        fecha: `2026-0${entre(4, 6)}-${String(entre(1, 28)).padStart(2, '0')}`,
        productoId: p.id,
        campo,
        accion: 'ENTRADA',
        cantidad: entre(40, 180),
        documento: `FC-${entre(1000, 9999)}`,
        precioUnitario: p.precioUnitario,
        observaciones: 'Compra de temporada',
      })
    }
    for (const p of PRODUCTOS_INICIALES.filter((x) => x.categoria === 'FERTILIZANTE')) {
      if (rnd() > 0.4) continue
      bodega.push({
        id: uid(),
        fecha: `2026-0${entre(4, 6)}-${String(entre(1, 28)).padStart(2, '0')}`,
        productoId: p.id,
        campo,
        accion: 'ENTRADA',
        cantidad: entre(10, 60) * 100,
        documento: `FC-${entre(1000, 9999)}`,
        precioUnitario: p.precioUnitario,
        observaciones: 'Compra de temporada',
      })
    }
  }

  // Aplicaciones: cada una descuenta el producto de su bodega
  const stockActual = (productoId: string, campo: string) =>
    bodega
      .filter((m) => m.productoId === productoId && m.campo === campo)
      .reduce((a, m) => a + m.cantidad, 0)

  for (const campo of camposBodega) {
    const cuarteles = (cuartelesPorCampo.get(campo) ?? []).filter((c) => c.especie !== 'PROPIEDAD')
    if (cuarteles.length === 0) continue

    for (let i = 0; i < 22; i++) {
      const p = pick(fitosanitarios)
      const q = pick(cuarteles)
      const hectareas = Math.max(1, Math.round((q.hectareas || 5) * 10) / 10)
      const mojamiento = pick([800, 1000, 1200, 1500])
      const usaHa = rnd() < 0.5
      // Dosis en rangos de etiqueta habituales
      const datos = {
        dosisPorHa: usaHa ? Math.round((0.4 + rnd() * 2.6) * 100) / 100 : undefined,
        dosisPor100L: usaHa ? undefined : Math.round((0.1 + rnd() * 0.7) * 100) / 100,
        mojamiento,
        hectareas,
      }
      const cantidad = cantidadAplicada(datos)
      if (cantidad <= 0 || stockActual(p.id, campo) < cantidad) continue

      const aplicacion: Aplicacion = {
        id: uid(),
        fecha: `2026-0${entre(6, 8)}-${String(entre(1, 28)).padStart(2, '0')}`,
        campo,
        predio: campo === 'CHUMACO' ? 'FUNDO LOS CONDORES' : 'SANTA MARTA FUNDO LAS BANDURRIAS',
        cuartel: q.cuarteles || q.cce,
        cc: q.cce,
        especie: q.especie,
        variedad: q.variedad,
        plaga: pick(PLAGAS),
        productoId: p.id,
        ...datos,
        cantidadProducto: cantidad,
        carenciaDias: p.carenciaDias,
        reingresoHoras: p.reingresoHoras,
        aplicador: pick(['Jorge Paillacán E.', 'Carlos Astorga', 'Francisco Adasme', 'Leonel Jorquera']),
        maquina: pick(MAQUINAS_APLICACION),
        condiciones: pick(['Sin viento, 18°C', 'Viento leve, 22°C', 'Nublado, 15°C', 'Despejado, 25°C']),
      }
      aplicaciones.push(aplicacion)
      bodega.push(salidaDeAplicacion(aplicacion))
    }
  }

  return {
    trabajadores,
    tarja,
    remuneraciones,
    productos: PRODUCTOS_INICIALES,
    bodega,
    aplicaciones,
    epp,
    matrizEpp,
    entregasEpp,
    capacitaciones,
    charlas,
    semillas,
    premios,
    asientos,
    estanques: ESTANQUES_INICIALES,
    // Historial real del estanque de Buin desde junio 2024
    combustible: movimientosBuin(),
    periodoDemo,
  }
}
