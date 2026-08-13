import { useMemo, useState } from 'react'
import {
  CalendarRange,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sprout,
  Info,
  CalendarDays,
  Layers3,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { TIPO_DIA_META, type RegistroTarja, type TipoDia } from '@/lib/types'
import { CENTROS_COSTO, ETAPAS_PLANTA, LABORES, LABORES_GENERALES, BASE_OPERATIVA } from '@/data/maestros'
import {
  Badge, Card, CardHeader, Field, Kpi, Modal, PageHeader, Select, Tip, Vacio,
} from '@/components/ui'
import { alerta } from '@/lib/alerta'
import {
  agrupar, cn, diaSemanaCorto, esFinDeSemana, fechasDelMes, minutosAtraso,
  nombrePeriodo, suma, temporadaDe, uid,
} from '@/lib/utils'

const COLOR_CELDA: Record<string, string> = {
  brand: 'bg-brand-500/22 text-brand-800 dark:text-brand-200 hover:bg-brand-500/35',
  accent: 'bg-accent-500/25 text-accent-800 dark:text-accent-200 hover:bg-accent-500/40',
  sky: 'bg-sky-500/22 text-sky-800 dark:text-sky-200 hover:bg-sky-500/35',
  violet: 'bg-violet-500/22 text-violet-800 dark:text-violet-200 hover:bg-violet-500/35',
  amber: 'bg-amber-500/25 text-amber-800 dark:text-amber-200 hover:bg-amber-500/40',
  red: 'bg-red-500/22 text-red-700 dark:text-red-300 hover:bg-red-500/35',
  slate: 'bg-ink-faint/12 text-ink-faint hover:bg-ink-faint/22',
}

export default function Tarja() {
  const { trabajadores, tarja, campoActivo, periodoActivo, upsertTarja, bulkTarja } = useStore()
  const [celda, setCelda] = useState<{ trabajadorId: string; fecha: string } | null>(null)
  const [masivo, setMasivo] = useState(false)

  const fechas = useMemo(() => fechasDelMes(periodoActivo), [periodoActivo])
  const temporada = temporadaDe(fechas[0])

  const dotacion = useMemo(
    () =>
      trabajadores
        .filter((t) => campoActivo === 'TODOS' || t.campo === campoActivo)
        .filter((t) => t.estado !== 'FINIQUITADO')
        .sort((a, b) => a.apellidos.localeCompare(b.apellidos)),
    [trabajadores, campoActivo],
  )

  /* Índice: trabajadorId¦fecha → registros del día */
  const indice = useMemo(() => {
    const m = new Map<string, RegistroTarja[]>()
    for (const r of tarja) {
      if (!r.fecha.startsWith(periodoActivo)) continue
      const k = `${r.trabajadorId}¦${r.fecha}`
      const l = m.get(k)
      l ? l.push(r) : m.set(k, [r])
    }
    return m
  }, [tarja, periodoActivo])

  const delMes = useMemo(
    () =>
      tarja.filter(
        (r) => r.fecha.startsWith(periodoActivo) && (campoActivo === 'TODOS' || r.campo === campoActivo),
      ),
    [tarja, periodoActivo, campoActivo],
  )

  const jornadas = suma(delMes, (r) => r.jornadas)
  const faltasInj = delMes.filter((r) => r.tipoDia === 'FALTA_INJUSTIFICADA').length
  const atrasos = delMes.filter((r) => minutosAtraso(r.horaLlegada) > 0).length
  const finesDeSemana = delMes.filter((r) => esFinDeSemana(r.fecha) && r.jornadas > 0).length
  const sinLabor = delMes.filter((r) => r.jornadas > 0 && r.laborGeneral === 'SIN_LABOR').length

  const registroDe = (tId: string, fecha: string) => indice.get(`${tId}¦${fecha}`)?.[0]

  return (
    <>
      <PageHeader
        titulo="Tarja digital"
        descripcion={`${nombrePeriodo(periodoActivo)} · temporada ${temporada} · ${campoActivo === 'TODOS' ? 'todos los campos' : campoActivo.replace('_', ' ')}`}
        icon={CalendarRange}
      >
        <button onClick={() => setMasivo(true)} className="btn-primary">
          <Zap className="h-4 w-4" />
          Carga masiva
        </button>
      </PageHeader>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Jornadas del mes" value={String(Math.round(jornadas * 100) / 100)} icon={Sprout}
             sub={`${dotacion.length} trabajadores`} />
        <Kpi label="Fines de semana efectivos" value={String(finesDeSemana)} icon={CalendarDays} tone="sky"
             sub="Cuentan como jornada" />
        <Kpi label="Faltas injustificadas" value={String(faltasInj)} icon={AlertTriangle} tone="red"
             sub="Descuentan semillas" />
        <Kpi label="Atrasos registrados" value={String(atrasos)} icon={Clock} tone="accent"
             sub="Base de horas extra" />
        <Kpi label="Jornadas sin labor" value={String(sinLabor)} icon={Info} tone="violet"
             sub="No entran al reparto" />
      </div>

      <Leyenda />

      <Card className="mt-4 overflow-hidden">
        <CardHeader
          title="Grilla mensual de asistencia"
          subtitle="Haga clic en cualquier celda para registrar el día. El formato es único para los 4 campos."
          icon={Layers3}
        />
        {dotacion.length === 0 ? (
          <Vacio titulo="Sin dotación en este campo" detalle="Incorpore trabajadores en el módulo Personal." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 min-w-[190px] bg-surface-soft">Trabajador</th>
                  {fechas.map((f) => {
                    const finde = esFinDeSemana(f)
                    return (
                      <th
                        key={f}
                        className={cn('!px-0 text-center', finde && 'bg-ink-faint/8')}
                        style={{ minWidth: 30 }}
                      >
                        <span className="block text-[10px] leading-tight text-ink-faint/70">
                          {diaSemanaCorto(f)}
                        </span>
                        <span className="tnum block text-[11px] leading-tight">{f.slice(-2)}</span>
                      </th>
                    )
                  })}
                  <th className="text-right">Jorn.</th>
                  <th className="text-right">Faltas</th>
                </tr>
              </thead>
              <tbody>
                {dotacion.map((t) => {
                  const mios = fechas.map((f) => registroDe(t.id, f))
                  const jor = suma(mios.filter(Boolean) as RegistroTarja[], (r) => r.jornadas)
                  const fal = mios.filter((r) => r?.tipoDia === 'FALTA_INJUSTIFICADA').length
                  return (
                    <tr key={t.id}>
                      <td className="sticky left-0 z-10 bg-surface-raised">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {t.apellidos}, {t.nombres}
                        </p>
                        <p className="truncate text-[10px] uppercase tracking-wide text-ink-faint">
                          {t.cargo}
                        </p>
                      </td>
                      {fechas.map((f, i) => {
                        const r = mios[i]
                        const meta = r ? TIPO_DIA_META[r.tipoDia] : null
                        const finde = esFinDeSemana(f)
                        const atraso = r ? minutosAtraso(r.horaLlegada) : 0
                        return (
                          <td key={f} className={cn('!p-0.5', finde && 'bg-ink-faint/5')}>
                            <button
                              onClick={() => setCelda({ trabajadorId: t.id, fecha: f })}
                              title={
                                r
                                  ? `${meta!.label}${r.laborGeneral !== 'SIN_LABOR' ? ` · ${r.laborGeneral}` : ''}${r.cc ? ` · ${r.cc}` : ''}${atraso ? ` · ${atraso} min de atraso` : ''}`
                                  : 'Sin registro — clic para agregar'
                              }
                              className={cn(
                                'relative grid h-7 w-full cursor-pointer place-items-center rounded text-[10px] font-semibold transition-colors duration-150',
                                meta
                                  ? COLOR_CELDA[meta.color]
                                  : 'border border-dashed border-hairline text-ink-faint/40 hover:border-brand-500/50 hover:text-brand-500',
                              )}
                            >
                              {meta ? meta.corto : '·'}
                              {atraso > 0 && (
                                <span className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-accent-500" />
                              )}
                            </button>
                          </td>
                        )
                      })}
                      <td className="tnum text-right font-semibold text-ink">{Math.round(jor * 100) / 100}</td>
                      <td className="tnum text-right">
                        {fal > 0 ? (
                          <span className="font-semibold text-red-500">{fal}</span>
                        ) : (
                          <span className="text-ink-faint">0</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {celda && (
        <EditorDia
          trabajadorId={celda.trabajadorId}
          fecha={celda.fecha}
          registro={registroDe(celda.trabajadorId, celda.fecha)}
          onClose={() => setCelda(null)}
          onGuardar={(r) => {
            upsertTarja(r)
            setCelda(null)
            alerta.toast('Día registrado')
          }}
        />
      )}

      <CargaMasiva
        open={masivo}
        onClose={() => setMasivo(false)}
        dotacion={dotacion}
        fechas={fechas}
        temporada={temporada}
        onAplicar={(rs) => {
          bulkTarja(rs)
          setMasivo(false)
          alerta.ok('Carga aplicada', `${rs.length} registros incorporados a la tarja.`)
        }}
      />
    </>
  )
}

/* ═══════════════════ Leyenda ═══════════════════ */

function Leyenda() {
  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Leyenda</span>
        {(Object.entries(TIPO_DIA_META) as [TipoDia, (typeof TIPO_DIA_META)[TipoDia]][]).map(([k, m]) => (
          <Tip key={k} texto={m.descripcion}>
            <span className="flex cursor-help items-center gap-1.5">
              <span
                className={cn(
                  'grid h-5 w-6 place-items-center rounded text-[10px] font-semibold',
                  COLOR_CELDA[m.color],
                )}
              >
                {m.corto}
              </span>
              <span className="text-[12px] text-ink-soft">{m.label}</span>
              {m.jornadaValida && (
                <CheckCircle2 className="h-3 w-3 text-brand-500" aria-label="Cuenta como jornada" />
              )}
            </span>
          </Tip>
        ))}
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-ink-faint">
          <CheckCircle2 className="h-3 w-3 text-brand-500" />
          cuenta como jornada para el reparto de costo
        </span>
      </div>
    </Card>
  )
}

/* ═══════════════════ Editor de un día ═══════════════════ */

function EditorDia({
  trabajadorId,
  fecha,
  registro,
  onClose,
  onGuardar,
}: {
  trabajadorId: string
  fecha: string
  registro?: RegistroTarja
  onClose: () => void
  onGuardar: (r: Omit<RegistroTarja, 'id'> & { id?: string }) => void
}) {
  const { trabajadores } = useStore()
  const t = trabajadores.find((x) => x.id === trabajadorId)!
  const cuartelesCampo = BASE_OPERATIVA.filter((c) => c.campo === t.campo)

  const [f, setF] = useState<Omit<RegistroTarja, 'id'>>(() =>
    registro
      ? { ...registro }
      : {
          fecha,
          trabajadorId,
          campo: t.campo,
          cc: '',
          laborGeneral: 'SIN_LABOR',
          laborEspecifica: '0',
          especie: '0',
          variedad: '0',
          etapaPlanta: '0',
          temporada: temporadaDe(fecha),
          tipoDia: esFinDeSemana(fecha) ? 'INHABIL' : 'TRABAJADO',
          jornadas: esFinDeSemana(fecha) ? 0 : 1,
          horaLlegada: esFinDeSemana(fecha) ? undefined : '08:00',
          horasExtra: 0,
        },
  )

  const set = <K extends keyof RegistroTarja>(k: K, v: RegistroTarja[K]) =>
    setF((s) => {
      const n = { ...s, [k]: v } as Omit<RegistroTarja, 'id'>
      if (k === 'tipoDia') {
        const meta = TIPO_DIA_META[v as TipoDia]
        n.jornadas = meta.jornadaValida ? (v === 'TRATO' ? s.jornadas || 1 : 1) : 0
        if (!meta.jornadaValida) {
          n.laborGeneral = 'SIN_LABOR'
          n.laborEspecifica = '0'
          n.horaLlegada = undefined
        } else if (v === 'VACACIONES') {
          n.laborGeneral = 'VACACIONES'
          n.laborEspecifica = 'VACACIONES LEGALES'
        } else if (s.laborGeneral === 'SIN_LABOR' || s.laborGeneral === 'VACACIONES') {
          n.laborGeneral = 'SIN_LABOR'
        }
      }
      if (k === 'laborGeneral') n.laborEspecifica = (LABORES[v as string] ?? ['0'])[0] ?? '0'
      if (k === 'cc') {
        const q = cuartelesCampo.find((c) => c.cce === v)
        if (q) {
          n.especie = q.especie
          n.variedad = q.variedad
        }
      }
      return n
    })

  const meta = TIPO_DIA_META[f.tipoDia]
  const atraso = minutosAtraso(f.horaLlegada)
  const ccs = [...new Set(CENTROS_COSTO.filter((c) => c.campo === t.campo).map((c) => c.cc))]
  const variedades = [...new Set(cuartelesCampo.filter((c) => c.especie === f.especie).map((c) => c.variedad))]

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`${t.nombres} ${t.apellidos}`}
      subtitle={`${fecha} · ${esFinDeSemana(fecha) ? 'fin de semana' : 'día hábil'} · ${t.cargo}`}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={() => onGuardar({ ...f, id: registro?.id })} className="btn-primary">
            Guardar día
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="label">Tipo de día</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.entries(TIPO_DIA_META) as [TipoDia, (typeof TIPO_DIA_META)[TipoDia]][]).map(([k, m]) => (
              <button
                key={k}
                onClick={() => set('tipoDia', k)}
                className={cn(
                  'cursor-pointer rounded-lg border p-2.5 text-left transition-colors duration-200',
                  f.tipoDia === k
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-hairline hover:border-ink-faint/50',
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cn('grid h-5 w-6 shrink-0 place-items-center rounded text-[10px] font-semibold', COLOR_CELDA[m.color])}>
                    {m.corto}
                  </span>
                  <span className="truncate text-[12px] font-medium text-ink">{m.label}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-faint">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            {meta.descripcion}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Jornadas"
            hint={f.tipoDia === 'TRATO' ? 'Equivalencia de jornada real según lo producido' : undefined}
          >
            <input
              type="number" step={0.05} min={0} max={2}
              className="input tnum"
              value={f.jornadas}
              disabled={!meta.jornadaValida}
              onChange={(e) => set('jornadas', Number(e.target.value))}
            />
          </Field>
          <Field label="Hora de llegada" error={atraso > 0 ? `${atraso} min de atraso` : undefined}>
            <input
              type="time" className="input tnum"
              value={f.horaLlegada ?? ''}
              disabled={!meta.jornadaValida}
              onChange={(e) => set('horaLlegada', e.target.value)}
            />
          </Field>
          <Field label="Horas extra">
            <input
              type="number" min={0} max={12} className="input tnum"
              value={f.horasExtra}
              disabled={!meta.jornadaValida}
              onChange={(e) => set('horasExtra', Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="N6 · Labor general">
            <Select
              value={f.laborGeneral}
              onChange={(v) => set('laborGeneral', v)}
              options={LABORES_GENERALES}
              disabled={!meta.jornadaValida}
            />
          </Field>
          <Field label="N7 · Labor específica">
            <Select
              value={f.laborEspecifica}
              onChange={(v) => set('laborEspecifica', v)}
              options={LABORES[f.laborGeneral] ?? ['0']}
              disabled={!meta.jornadaValida}
            />
          </Field>
          <Field label="N13 · Centro de costo">
            <Select value={f.cc} onChange={(v) => set('cc', v)} options={ccs} placeholder="Seleccionar…" />
          </Field>
          <Field label="N8 · Etapa de la planta">
            <Select value={f.etapaPlanta} onChange={(v) => set('etapaPlanta', v)}
                    options={['0', ...ETAPAS_PLANTA.map((e) => e.nombre)]} />
          </Field>
          <Field label="N9 · Especie">
            <Select value={f.especie} onChange={(v) => set('especie', v)}
                    options={['0', ...new Set(cuartelesCampo.map((c) => c.especie))]} />
          </Field>
          <Field label="N10 · Variedad">
            <Select value={f.variedad} onChange={(v) => set('variedad', v)}
                    options={['0', ...variedades]} disabled={f.especie === '0'} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Rendimiento">
            <input type="number" min={0} className="input tnum" value={f.rendimiento ?? ''}
                   onChange={(e) => set('rendimiento', Number(e.target.value) || undefined)} />
          </Field>
          <Field label="Unidad">
            <Select value={f.unidadRendimiento ?? ''} onChange={(v) => set('unidadRendimiento', v)}
                    options={['HILERA', 'PLANTA', 'KILOGRAMO', 'BIN', 'CAJA', 'HECTAREA', 'METRO']}
                    placeholder="—" />
          </Field>
          <Field label="Observación" className="sm:col-span-1">
            <input className="input" value={f.observacion ?? ''} onChange={(e) => set('observacion', e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

/* ═══════════════════ Carga masiva ═══════════════════ */

function CargaMasiva({
  open, onClose, dotacion, fechas, temporada, onAplicar,
}: {
  open: boolean
  onClose: () => void
  dotacion: ReturnType<typeof useStore.getState>['trabajadores']
  fechas: string[]
  temporada: string
  onAplicar: (rs: RegistroTarja[]) => void
}) {
  const [desde, setDesde] = useState(fechas[0])
  const [hasta, setHasta] = useState(fechas[Math.min(4, fechas.length - 1)])
  const [labor, setLabor] = useState('PODA')
  const [especifica, setEspecifica] = useState(LABORES.PODA?.[0] ?? '0')
  const [cc, setCc] = useState('')
  const [incluirFinde, setIncluirFinde] = useState(false)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())

  const campos = [...new Set(dotacion.map((t) => t.campo))]
  const ccs = [...new Set(CENTROS_COSTO.filter((c) => campos.includes(c.campo)).map((c) => c.cc))]

  const rango = fechas.filter((f) => f >= desde && f <= hasta && (incluirFinde || !esFinDeSemana(f)))
  const total = rango.length * seleccion.size

  const aplicar = () => {
    if (seleccion.size === 0) return alerta.aviso('Seleccione trabajadores', 'Debe marcar al menos uno.')
    if (!cc) return alerta.aviso('Falta el centro de costo', 'El N13 es obligatorio para imputar el costo.')
    const rs: RegistroTarja[] = []
    for (const tId of seleccion) {
      const t = dotacion.find((x) => x.id === tId)!
      const q = BASE_OPERATIVA.find((c) => c.campo === t.campo && c.cce === cc)
      for (const fecha of rango) {
        rs.push({
          id: uid(), fecha, trabajadorId: tId, campo: t.campo, cc,
          laborGeneral: labor, laborEspecifica: especifica,
          especie: q?.especie ?? '0', variedad: q?.variedad ?? '0',
          etapaPlanta: 'PLANTA ADULTA', temporada,
          tipoDia: 'TRABAJADO', jornadas: 1, horaLlegada: '08:00', horasExtra: 0,
        })
      }
    }
    onAplicar(rs)
  }

  const toggle = (id: string) =>
    setSeleccion((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const porCampo = agrupar(dotacion, (t) => t.campo)

  return (
    <Modal
      open={open} onClose={onClose} wide
      title="Carga masiva de tarja"
      subtitle="Asigna una labor y centro de costo a una cuadrilla completa en un rango de fechas"
      footer={
        <>
          <span className="mr-auto text-xs text-ink-faint">
            {total > 0 ? `Se crearán ${total} registros (${seleccion.size} × ${rango.length} días)` : 'Sin registros por crear'}
          </span>
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={aplicar} className="btn-primary" disabled={total === 0}>
            <Zap className="h-4 w-4" />Aplicar
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Desde">
            <Select value={desde} onChange={setDesde} options={fechas} />
          </Field>
          <Field label="Hasta">
            <Select value={hasta} onChange={setHasta} options={fechas.filter((f) => f >= desde)} />
          </Field>
          <Field label="Centro de costo (N13)">
            <Select value={cc} onChange={setCc} options={ccs} placeholder="Seleccionar…" />
          </Field>
          <Field label="Labor general (N6)">
            <Select value={labor} onChange={(v) => { setLabor(v); setEspecifica((LABORES[v] ?? ['0'])[0]) }}
                    options={LABORES_GENERALES} />
          </Field>
          <Field label="Labor específica (N7)">
            <Select value={especifica} onChange={setEspecifica} options={LABORES[labor] ?? ['0']} />
          </Field>
          <Field label="Fines de semana" hint="Si se trabajó, cuenta como jornada efectiva">
            <label className="flex h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-hairline px-3 transition-colors duration-200 hover:border-brand-500/50">
              <input type="checkbox" checked={incluirFinde} onChange={(e) => setIncluirFinde(e.target.checked)}
                     className="h-4 w-4 cursor-pointer accent-brand-600" />
              <span className="text-sm text-ink-soft">Incluir sábados y domingos</span>
            </label>
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="label !mb-0">Cuadrilla ({seleccion.size} seleccionados)</label>
            <div className="flex gap-2">
              <button onClick={() => setSeleccion(new Set(dotacion.map((t) => t.id)))}
                      className="cursor-pointer text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                Todos
              </button>
              <button onClick={() => setSeleccion(new Set())}
                      className="cursor-pointer text-xs font-medium text-ink-faint hover:underline">
                Ninguno
              </button>
            </div>
          </div>
          <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-hairline p-3">
            {[...porCampo.entries()].map(([campo, ts]) => (
              <div key={campo}>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                  {campo.replace('_', ' ')}
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {ts.map((t) => (
                    <label key={t.id}
                           className={cn(
                             'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 transition-colors duration-200',
                             seleccion.has(t.id) ? 'border-brand-500/50 bg-brand-500/8' : 'border-hairline hover:border-ink-faint/40',
                           )}>
                      <input type="checkbox" checked={seleccion.has(t.id)} onChange={() => toggle(t.id)}
                             className="h-4 w-4 cursor-pointer accent-brand-600" />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink">
                        {t.apellidos}, {t.nombres}
                      </span>
                      <Badge tone="slate">{t.cargo.split(' ')[0]}</Badge>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
