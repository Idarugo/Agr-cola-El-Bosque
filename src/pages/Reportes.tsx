import { useRef, useState } from 'react'
import {
  FileSpreadsheet, FileDown, Upload, Landmark, BookOpenCheck, HardHat, Database, Fuel, SprayCan,
  RotateCcw, Trash2, CheckCircle2, AlertTriangle, ArrowRight,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { distribuir } from '@/lib/motorCostos'
import {
  exportarAsiento, exportarBodega, exportarCombustible, exportarLibrosContables,
  exportarMaestros, exportarNomina, exportarPlanillaContador, exportarPrevencion,
  importarRemuneraciones,
} from '@/lib/excel'
import { Badge, Card, CardHeader, Kpi, Modal, PageHeader, Vacio } from '@/components/ui'
import { alerta } from '@/lib/alerta'
import { cn, limpiarRut, money, nombrePeriodo, suma, uid } from '@/lib/utils'

export default function Reportes() {
  const store = useStore()
  const { trabajadores, tarja, remuneraciones, epp, entregasEpp, capacitaciones, charlas,
          campoActivo, periodoActivo, bulkRemuneraciones, resetDemo, limpiarTodo } = store
  const inputRef = useRef<HTMLInputElement>(null)
  const [previa, setPrevia] = useState<{ filas: any[]; sinMatch: string[] } | null>(null)

  const res = distribuir(trabajadores, tarja, remuneraciones, {
    periodo: periodoActivo,
    campo: campoActivo === 'TODOS' ? undefined : campoActivo,
  })

  const exportar = (fn: () => void, nombre: string) => {
    try {
      fn()
      alerta.toast(`${nombre} descargado`)
    } catch (e) {
      alerta.error('No se pudo generar el archivo', String(e))
    }
  }

  const onArchivo = async (file?: File) => {
    if (!file) return
    try {
      alerta.cargando('Leyendo archivo…')
      const filas = await importarRemuneraciones(file)
      alerta.cerrar()
      if (filas.length === 0)
        return alerta.aviso(
          'No se encontraron datos',
          'Verifique que el archivo tenga columnas de RUT y total haber.',
        )
      const sinMatch: string[] = []
      const validas = filas.filter((f) => {
        const t = trabajadores.find((x) => limpiarRut(x.rut) === limpiarRut(f.rut))
        if (!t) sinMatch.push(f.rut)
        return !!t
      })
      setPrevia({ filas: validas, sinMatch })
    } catch (e) {
      alerta.cerrar()
      alerta.error('Error al leer el archivo', String(e))
    }
  }

  const confirmarImportacion = () => {
    if (!previa) return
    const rs = previa.filas.map((f) => {
      const t = trabajadores.find((x) => limpiarRut(x.rut) === limpiarRut(f.rut))!
      return {
        id: uid(),
        periodo: periodoActivo,
        trabajadorId: t.id,
        totalHaber: f.totalHaber,
        asignacionFamiliar: f.asignacionFamiliar,
        totalDescuentos: Math.max(0, f.totalHaber - f.liquido - f.anticipo),
        liquido: f.liquido,
        costoEmpresa: Math.round(f.totalHaber * 1.05),
        anticipo: f.anticipo,
      }
    })
    bulkRemuneraciones(rs)
    setPrevia(null)
    alerta.ok('Libro importado', `${rs.length} liquidaciones cargadas en ${nombrePeriodo(periodoActivo)}.`)
  }

  const REPORTES = [
    {
      titulo: 'Asiento contable de mano de obra',
      detalle: 'Distribución del costo con las 13 dimensiones del plan de cuentas, consolidado y detallado por trabajador.',
      icono: BookOpenCheck,
      tono: 'brand',
      destino: 'Contabilidad externa',
      accion: () => exportar(() => exportarAsiento(res), 'Asiento'),
      disponible: res.lineas.length > 0,
    },
    {
      titulo: 'Planilla de pago para el contador',
      detalle: 'Días trabajados, vacaciones, licencias, faltas, atrasos y horas extra por trabajador, más la asistencia día a día.',
      icono: FileSpreadsheet,
      tono: 'accent',
      destino: 'Contador · Nubox',
      accion: () => exportar(() => exportarPlanillaContador(res, trabajadores, tarja, remuneraciones), 'Planilla'),
      disponible: tarja.some((r) => r.fecha.startsWith(periodoActivo)),
    },
    {
      titulo: 'Nómina bancaria',
      detalle: 'Archivo de transferencias con RUT, banco, cuenta y líquido a pagar. Incluye hoja separada de anticipos.',
      icono: Landmark,
      tono: 'sky',
      destino: 'Banco',
      accion: () => exportar(() => exportarNomina(trabajadores, remuneraciones, periodoActivo, campoActivo), 'Nómina'),
      disponible: remuneraciones.some((r) => r.periodo === periodoActivo),
    },
    {
      titulo: 'Reporte de prevención de riesgos',
      detalle: 'Stock y entregas de EPP, capacitaciones con asistentes y charlas diarias de seguridad.',
      icono: HardHat,
      tono: 'violet',
      destino: 'ACHS · certificadoras',
      accion: () => exportar(() => exportarPrevencion(trabajadores, epp, entregasEpp, capacitaciones, charlas), 'Reporte de prevención'),
      disponible: epp.length > 0,
    },
    {
      titulo: 'Libros contables del ejercicio',
      detalle: 'Libro Diario con las 13 dimensiones, control de asientos, Libro Mayor, Balance de 8 columnas, Estado de Resultados y Balance General.',
      icono: BookOpenCheck,
      tono: 'brand',
      destino: 'Contador · SII',
      accion: () => exportar(() => exportarLibrosContables(store.asientos, store.ejercicio), 'Libros contables'),
      disponible: store.asientos.length > 0,
    },
    {
      titulo: 'Control de combustible',
      detalle: 'Inventario de estanques con cuadratura, y resúmenes de consumo por centro de costo, labor, vehículo y chofer.',
      icono: Fuel,
      tono: 'accent',
      destino: 'Administración de campo',
      accion: () => exportar(() => exportarCombustible(store.combustible, store.estanques), 'Control de combustible'),
      disponible: store.combustible.length > 0,
    },
    {
      titulo: 'Bodega y registro de aplicaciones',
      detalle: 'Stock de insumos con su ingrediente activo, registro de aplicaciones M2-008-F004 y carencias vigentes por cuartel.',
      icono: SprayCan,
      tono: 'violet',
      destino: 'SAG · certificadoras',
      accion: () => exportar(() => exportarBodega(store.productos, store.bodega, store.aplicaciones), 'Bodega y aplicaciones'),
      disponible: store.bodega.length > 0,
    },
    {
      titulo: 'Maestros del sistema',
      detalle: 'Plan de cuentas completo y base operativa agrícola, en el mismo formato del Excel original.',
      icono: Database,
      tono: 'slate',
      destino: 'Respaldo · auditoría',
      accion: () => exportar(exportarMaestros, 'Maestros'),
      disponible: true,
    },
  ]

  return (
    <>
      <PageHeader
        titulo="Reportes y traspaso de información"
        descripcion={`${nombrePeriodo(periodoActivo)} · el sistema reemplaza las planillas, pero la información sigue saliendo en Excel para quien la necesite.`}
        icon={FileSpreadsheet}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Costo del período" value={money(res.totalDistribuido)} icon={BookOpenCheck}
             sub={`${res.lineas.length} líneas de asiento`} />
        <Kpi label="Liquidaciones cargadas" value={String(remuneraciones.filter((r) => r.periodo === periodoActivo).length)}
             icon={Upload} tone="accent" sub="Base real de reparto" />
        <Kpi label="Registros de tarja" value={String(tarja.filter((r) => r.fecha.startsWith(periodoActivo)).length)}
             icon={FileSpreadsheet} tone="sky" sub="Asistencia del mes" />
        <Kpi label="Advertencias" value={String(res.advertencias.length)} icon={AlertTriangle}
             tone={res.advertencias.length ? 'red' : 'brand'}
             sub={res.advertencias.length ? 'Revisar antes de exportar' : 'Listo para cerrar'} />
      </div>

      {/* Importar libro */}
      <Card className="mb-5 border-l-4 border-l-accent-500">
        <div className="flex flex-wrap items-center gap-4 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-500/15 text-accent-600 dark:text-accent-400">
            <Upload className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Importar libro de remuneraciones</p>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              Suba el export de Nubox que le devuelve el contador. El sistema cruza por RUT y usa
              <strong> total haber − asignación familiar</strong> como base real de distribución.
            </p>
          </div>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                 onChange={(e) => { onArchivo(e.target.files?.[0]); e.target.value = '' }} />
          <button onClick={() => inputRef.current?.click()} className="btn-accent">
            <Upload className="h-4 w-4" />Seleccionar archivo
          </button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {REPORTES.map((r) => (
          <Card key={r.titulo} hover className="flex flex-col p-4">
            <div className="flex items-start gap-3">
              <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                r.tono === 'brand' ? 'bg-brand-500/12 text-brand-600 dark:text-brand-400'
                : r.tono === 'accent' ? 'bg-accent-500/15 text-accent-600 dark:text-accent-400'
                : r.tono === 'sky' ? 'bg-sky-500/12 text-sky-600 dark:text-sky-400'
                : r.tono === 'violet' ? 'bg-violet-500/12 text-violet-600 dark:text-violet-400'
                : 'bg-ink-faint/12 text-ink-faint')}>
                <r.icono className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink">{r.titulo}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{r.detalle}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-hairline pt-3">
              <Badge tone="slate">{r.destino}</Badge>
              {r.disponible
                ? <Badge tone="brand"><CheckCircle2 className="h-3 w-3" />Listo</Badge>
                : <Badge tone="amber">Sin datos</Badge>}
              <button onClick={r.accion} disabled={!r.disponible} className="btn-primary ml-auto !min-h-0 !py-1.5">
                <FileDown className="h-4 w-4" />Descargar
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* Administración de datos */}
      <Card className="mt-5">
        <CardHeader title="Administración de datos" subtitle="La información se guarda en este navegador" icon={Database} />
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="mr-auto text-[13px] text-ink-soft">
            <p>{trabajadores.length} trabajadores · {tarja.length} registros de tarja · {remuneraciones.length} liquidaciones</p>
            <p className="mt-0.5 text-[12px] text-ink-faint">
              {epp.length} EPP · {capacitaciones.length} capacitaciones · {charlas.length} charlas
            </p>
          </div>
          <button
            onClick={async () => {
              if (await alerta.confirmar('¿Restaurar datos de demostración?',
                'Se reemplazarán todos los movimientos actuales por el set de ejemplo.', 'Restaurar')) {
                resetDemo()
                alerta.ok('Datos restaurados')
              }
            }}
            className="btn-ghost"
          >
            <RotateCcw className="h-4 w-4" />Restaurar demo
          </button>
          <button
            onClick={async () => {
              if (await alerta.eliminar('¿Borrar todos los movimientos?',
                'Se eliminan trabajadores, tarja, remuneraciones y registros de prevención. Los maestros del plan de cuentas se mantienen.')) {
                limpiarTodo()
                alerta.ok('Sistema vacío', 'Puede comenzar a cargar datos productivos.')
              }
            }}
            className="btn-danger"
          >
            <Trash2 className="h-4 w-4" />Limpiar todo
          </button>
        </div>
      </Card>

      {/* Previa de importación */}
      <Modal
        open={!!previa} onClose={() => setPrevia(null)} wide
        title="Previsualización de la importación"
        subtitle={previa ? `${previa.filas.length} liquidaciones cruzadas por RUT` : ''}
        footer={
          <>
            <button onClick={() => setPrevia(null)} className="btn-ghost">Cancelar</button>
            <button onClick={confirmarImportacion} className="btn-primary" disabled={!previa?.filas.length}>
              <ArrowRight className="h-4 w-4" />Importar a {nombrePeriodo(periodoActivo)}
            </button>
          </>
        }
      >
        {previa && (
          <div className="space-y-4">
            {previa.sinMatch.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-lg border border-accent-500/30 bg-accent-500/8 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-600 dark:text-accent-400" />
                <div className="text-[13px] text-ink-soft">
                  <p className="font-medium text-ink">
                    {previa.sinMatch.length} RUT sin trabajador en el sistema
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                    {previa.sinMatch.slice(0, 12).join(' · ')}
                    {previa.sinMatch.length > 12 && ` … +${previa.sinMatch.length - 12}`}
                  </p>
                </div>
              </div>
            )}
            {previa.filas.length === 0 ? (
              <Vacio titulo="Ninguna fila coincide" detalle="Verifique que los RUT del archivo existan en el módulo Personal." />
            ) : (
              <div className="max-h-72 overflow-auto rounded-lg border border-hairline">
                <table className="tbl">
                  <thead>
                    <tr><th>RUT</th><th>Trabajador</th><th className="text-right">Total haber</th>
                        <th className="text-right">Asig. fam.</th><th className="text-right">Base</th>
                        <th className="text-right">Líquido</th></tr>
                  </thead>
                  <tbody>
                    {previa.filas.map((f, i) => {
                      const t = trabajadores.find((x) => limpiarRut(x.rut) === limpiarRut(f.rut))
                      return (
                        <tr key={i}>
                          <td className="tnum font-mono text-[12px] text-ink-soft">{f.rut}</td>
                          <td className="text-ink">{t ? `${t.apellidos}, ${t.nombres}` : '—'}</td>
                          <td className="tnum whitespace-nowrap text-right text-ink">{money(f.totalHaber)}</td>
                          <td className="tnum whitespace-nowrap text-right text-ink-soft">{money(f.asignacionFamiliar)}</td>
                          <td className="tnum whitespace-nowrap text-right font-semibold text-brand-700 dark:text-brand-300">
                            {money(f.totalHaber - f.asignacionFamiliar)}
                          </td>
                          <td className="tnum whitespace-nowrap text-right text-ink-soft">{money(f.liquido)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface-soft font-semibold">
                      <td colSpan={2} className="px-3 py-2 text-ink">Totales</td>
                      <td className="tnum px-3 py-2 text-right text-ink">{money(suma(previa.filas, (f) => f.totalHaber))}</td>
                      <td className="tnum px-3 py-2 text-right text-ink">{money(suma(previa.filas, (f) => f.asignacionFamiliar))}</td>
                      <td className="tnum px-3 py-2 text-right text-ink">
                        {money(suma(previa.filas, (f) => f.totalHaber - f.asignacionFamiliar))}
                      </td>
                      <td className="tnum px-3 py-2 text-right text-ink">{money(suma(previa.filas, (f) => f.liquido))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
