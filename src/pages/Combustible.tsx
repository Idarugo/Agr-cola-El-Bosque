import { useMemo, useState } from 'react'
import {
  Fuel, Gauge, Plus, Ruler, Scale, TriangleAlert, Truck, Trash2, BookOpenCheck,
  ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, Calculator, Droplets, CheckCircle2,
  Layers, User, Wrench, FileDown,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis, Legend,
} from 'recharts'
import { useStore } from '@/store/useStore'
import {
  consumoPorDimension, estadoDeEstanque, hojaDeConteo, indiceUltimoControl, litrosDesdeCm,
  movimientosDeAjuste, precioPromedio, prorratearDiferencia, revisarEstanque, serieMensual,
  ultimoControl, valorizarConsumo, type DimensionConsumo,
} from '@/lib/motorCombustible'
import { asientoConsumoCombustible, fechaCierre } from '@/lib/puenteContable'
import { siguienteNumero } from '@/lib/contabilidad'
import {
  CC_COMBUSTIBLE, ESPECIES_COMBUSTIBLE, LABORES_COMBUSTIBLE, VARIEDADES_COMBUSTIBLE, VEHICULOS,
} from '@/data/combustible'
import { ACCION_META, type AccionCombustible, type MovimientoCombustible } from '@/lib/types'
import {
  Badge, Barra, Card, CardHeader, Field, Kpi, Modal, PageHeader, SearchInput, Select, Tabs, Tip, Vacio,
} from '@/components/ui'
import { alerta } from '@/lib/alerta'
import { exportarCombustible } from '@/lib/excel'
import { cn, hoy, money, nfmt, nombrePeriodo, suma, temporadaDe } from '@/lib/utils'

const PALETA = ['#16a34a', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#6366f1']

const ejeTooltip = {
  background: 'rgb(var(--surface-raised))',
  border: '1px solid rgb(var(--hairline))',
  borderRadius: 10, fontSize: 12, color: 'rgb(var(--ink))',
}

const TONO_ACCION: Record<string, string> = {
  STOCK_INICIAL: 'slate', ENTRADA: 'brand', SALIDA: 'accent', CONTROL: 'sky', AJUSTE: 'violet',
}

export default function Combustible() {
  const [tab, setTab] = useState('estanque')
  const { estanques, combustible, campoActivo, periodoActivo } = useStore()

  const disponibles = estanques.filter(
    (e) => e.activo && (campoActivo === 'TODOS' || e.campo === campoActivo),
  )
  const [estanqueId, setEstanqueId] = useState<string>('')
  const estanque = disponibles.find((e) => e.id === estanqueId) ?? disponibles[0]

  const movs = useMemo(
    () => combustible.filter((m) => !estanque || m.estanqueId === estanque.id),
    [combustible, estanque],
  )
  const estado = useMemo(
    () => (estanque ? estadoDeEstanque(estanque, combustible) : null),
    [estanque, combustible],
  )
  const alertas = useMemo(
    () => (estado ? revisarEstanque(estado, movs) : []),
    [estado, movs],
  )
  const precio = useMemo(() => precioPromedio(combustible, estanque?.id), [combustible, estanque])

  if (!estanque)
    return (
      <>
        <PageHeader titulo="Control de combustible" icon={Fuel} />
        <Card>
          <Vacio
            titulo="Sin estanques en este campo"
            detalle="Cambie el campo activo en la barra superior o registre un estanque."
            icon={Fuel}
          />
        </Card>
      </>
    )

  const litrosSalida = Math.abs(estado!.salidas)

  return (
    <>
      <PageHeader
        titulo="Control de combustible"
        descripcion={`${estanque.nombre} · ${movs.length} movimientos registrados`}
        icon={Fuel}
      >
        {disponibles.length > 1 && (
          <Select
            value={estanque.id}
            onChange={setEstanqueId}
            options={disponibles.map((e) => ({ value: e.id, label: e.nombre }))}
            className="w-56"
          />
        )}
        <button
          onClick={() => {
            exportarCombustible(combustible, estanques)
            alerta.toast('Control de combustible descargado')
          }}
          className="btn-ghost"
        >
          <FileDown className="h-4 w-4" />Exportar
        </button>
      </PageHeader>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Stock estimado" value={`${nfmt(estado!.stockEstimado, 0)} L`} icon={Gauge}
             tone={estado!.stockEstimado < 0 ? 'red' : 'brand'}
             sub="Según entradas y salidas" />
        <Kpi label="Visible último control" value={estado!.visibleUltimoControl !== undefined
               ? `${nfmt(estado!.visibleUltimoControl, 0)} L` : '—'}
             icon={Ruler} tone="sky"
             sub={estado!.ultimoControl ? `Control del ${estado!.ultimoControl.fecha}` : 'Sin controles'} />
        <Kpi label="Diferencia" value={`${estado!.diferencia > 0 ? '+' : ''}${nfmt(estado!.diferencia, 1)} L`}
             icon={Scale} tone={Math.abs(estado!.diferencia) > 0.5 ? 'red' : 'brand'}
             sub={Math.abs(estado!.diferencia) > 0.5 ? 'Requiere prorrateo' : 'Debe ser 0'} />
        <Kpi label="Consumo acumulado" value={`${nfmt(litrosSalida, 0)} L`} icon={Truck} tone="accent"
             sub={precio > 0 ? `≈ ${money(litrosSalida * precio)} a ${Math.round(precio)} $/L` : 'Sin precio registrado'} />
      </div>

      {alertas.length > 0 && (
        <Card className="mb-5">
          <CardHeader title="Puntos de control" subtitle="Detectados automáticamente sobre este estanque" icon={TriangleAlert} />
          <ul className="divide-y divide-hairline/60">
            {alertas.map((a, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-2.5">
                <Badge tone={a.nivel === 'critico' ? 'red' : a.nivel === 'aviso' ? 'amber' : 'sky'}>
                  {a.nivel === 'critico' ? 'Crítico' : a.nivel === 'aviso' ? 'Revisar' : 'Info'}
                </Badge>
                <span className="text-[13px] text-ink-soft">{a.mensaje}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-4 max-w-3xl">
        <Tabs
          value={tab} onChange={setTab}
          tabs={[
            { id: 'estanque', label: 'Estanque' },
            { id: 'conteo', label: 'Hoja de conteo' },
            { id: 'movimientos', label: 'Movimientos', count: movs.length },
            { id: 'prorrateo', label: 'Prorrateo' },
            { id: 'consumo', label: 'Consumo' },
            { id: 'contabilizar', label: 'Contabilizar' },
          ]}
        />
      </div>

      {tab === 'estanque' && <VistaEstanque estanqueId={estanque.id} />}
      {/* La key hace que la hoja vuelva al período global cuando éste cambia */}
      {tab === 'conteo' && <HojaDeConteo key={periodoActivo} estanqueId={estanque.id} />}
      {tab === 'movimientos' && <Movimientos estanqueId={estanque.id} />}
      {tab === 'prorrateo' && <Prorrateo estanqueId={estanque.id} />}
      {tab === 'consumo' && <Consumo estanqueId={estanque.id} />}
      {tab === 'contabilizar' && <Contabilizar estanqueId={estanque.id} />}
    </>
  )
}

/* ═══════════════════ Vista del estanque ═══════════════════ */

function VistaEstanque({ estanqueId }: { estanqueId: string }) {
  const { estanques, combustible, updEstanque } = useStore()
  const estanque = estanques.find((e) => e.id === estanqueId)!
  const estado = estadoDeEstanque(estanque, combustible)
  const serie = useMemo(() => serieMensual(combustible, estanqueId), [combustible, estanqueId])
  const [cm, setCm] = useState('')

  const litrosMedidos = cm ? litrosDesdeCm(Number(cm), estanque.cmPorCienLitros) : 0
  const llenado = estanque.capacidad > 0
    ? Math.max(0, Math.min(1, estado.stockEstimado / estanque.capacidad))
    : 0

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader title="Entradas y salidas por mes" subtitle="Historial completo del estanque" icon={Droplets} />
        <div className="p-4">
          {serie.length === 0 ? (
            <Vacio titulo="Sin movimientos" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={serie} margin={{ left: -12, right: 8, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gEnt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gSal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="periodo" stroke="rgb(var(--ink-faint))" fontSize={10}
                       tickLine={false} axisLine={false} tickFormatter={(p) => p.slice(2)} />
                <YAxis stroke="rgb(var(--ink-faint))" fontSize={11} tickLine={false} axisLine={false}
                       tickFormatter={(v) => `${v} L`} />
                <RTooltip contentStyle={ejeTooltip} formatter={(v: number) => [`${v} L`, '']}
                          labelFormatter={(p) => nombrePeriodo(p)} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <Area type="monotone" dataKey="entradas" name="Entradas" stroke="#16a34a" strokeWidth={2} fill="url(#gEnt)" />
                <Area type="monotone" dataKey="salidas" name="Salidas" stroke="#f59e0b" strokeWidth={2} fill="url(#gSal)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Nivel del estanque" subtitle={`Capacidad ${nfmt(estanque.capacidad, 0)} L`} icon={Gauge} />
          <div className="p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="tnum text-2xl font-semibold text-ink">{nfmt(estado.stockEstimado, 0)} L</span>
              <span className="text-xs text-ink-faint">{Math.round(llenado * 100)}% de capacidad</span>
            </div>
            <Barra valor={Math.max(0, estado.stockEstimado)} max={estanque.capacidad}
                   tone={estado.stockEstimado < 0 ? 'red' : llenado < 0.15 ? 'accent' : 'brand'} />
            <dl className="mt-4 space-y-2">
              {[
                ['Total entradas', `${nfmt(estado.entradas, 0)} L`],
                ['Total salidas', `${nfmt(Math.abs(estado.salidas), 0)} L`],
                ['Movimientos desde el control', String(estado.movimientosDesdeControl)],
                ['Contador mecánico', estanque.tieneContador ? 'Sí' : 'No'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 border-b border-hairline/50 py-1">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{k}</dt>
                  <dd className="tnum text-[13px] text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>

        <Card>
          <CardHeader title="Medición con vara" subtitle="Convierte centímetros a litros" icon={Ruler} />
          <div className="space-y-3 p-4">
            <Field label="Calibración" hint={`${estanque.cmPorCienLitros} cm equivalen a 100 litros`}>
              <input type="number" step={0.1} min={0.1} className="input tnum"
                     value={estanque.cmPorCienLitros}
                     onChange={(e) => updEstanque(estanque.id, { cmPorCienLitros: Number(e.target.value) })} />
            </Field>
            <Field label="Medición (cm)">
              <input type="number" step={0.1} min={0} className="input tnum" value={cm}
                     onChange={(e) => setCm(e.target.value)} placeholder="Ej.: 8,1" />
            </Field>
            <div className={cn('rounded-lg border p-3 transition-colors duration-200',
                               cm ? 'border-brand-500/40 bg-brand-500/8' : 'border-dashed border-hairline')}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Litros visibles</p>
              <p className="tnum mt-1 text-xl font-semibold text-ink">
                {cm ? `${nfmt(litrosMedidos, 1)} L` : '—'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ═══════════════════ Hoja de conteo ═══════════════════ */

function HojaDeConteo({ estanqueId }: { estanqueId: string }) {
  const { combustible, estanques, periodoActivo } = useStore()
  const estanque = estanques.find((e) => e.id === estanqueId)!
  const [periodo, setPeriodo] = useState(periodoActivo)

  const periodos = useMemo(() => {
    const s = new Set(
      combustible.filter((m) => m.estanqueId === estanqueId).map((m) => m.fecha.slice(0, 7)),
    )
    s.add(periodoActivo)
    s.add(periodo)
    return [...s].sort().reverse()
  }, [combustible, estanqueId, periodoActivo, periodo])

  const h = useMemo(
    () => hojaDeConteo(combustible, estanqueId, periodo),
    [combustible, estanqueId, periodo],
  )

  const TONO: Record<string, { tono: string; icono: any; titulo: string }> = {
    'SIN CONTROL': { tono: 'slate', icono: ClipboardCheck, titulo: 'Falta el control físico' },
    CUADRADO: { tono: 'brand', icono: CheckCircle2, titulo: 'El estanque cuadra' },
    CALIBRAR: { tono: 'sky', icono: Ruler, titulo: 'Hay más petróleo del que indica la máquina' },
    INVESTIGAR: { tono: 'red', icono: TriangleAlert, titulo: 'Hay menos petróleo del que indica la máquina' },
  }
  const veredicto = TONO[h.interpretacion]

  const Paso = ({ n, titulo, children, nota }: {
    n: number; titulo: string; children: React.ReactNode; nota?: string
  }) => (
    <Card>
      <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-3">
        <span className="tnum grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-500/12 font-mono text-[12px] font-bold text-brand-700 dark:text-brand-300">
          {n}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{titulo}</h3>
          {nota && <p className="mt-0.5 text-xs text-ink-faint">{nota}</p>}
        </div>
      </div>
      {children}
    </Card>
  )

  const Linea = ({ signo, label, valor, tipo = 'normal', unidad = 'Lts' }: {
    signo?: string; label: string; valor?: number; tipo?: 'normal' | 'total'; unidad?: string
  }) => (
    <div className={cn('flex items-center gap-3 px-4 py-2',
                       tipo === 'total' && 'border-t border-hairline bg-surface-soft font-semibold')}>
      <span className="tnum w-4 shrink-0 text-center font-mono text-[13px] text-ink-faint">{signo ?? ''}</span>
      <span className={cn('min-w-0 flex-1 text-[13px]', tipo === 'total' ? 'text-ink' : 'text-ink-soft')}>
        {label}
      </span>
      <span className="tnum shrink-0 whitespace-nowrap text-[13px] text-ink">
        {valor === undefined ? '—' : `${nfmt(valor, valor % 1 === 0 ? 0 : 2)} ${unidad}`}
      </span>
    </div>
  )

  return (
    <div className="space-y-5">
      <Card className={cn('border-l-4',
        h.interpretacion === 'CUADRADO' ? 'border-l-brand-500'
        : h.interpretacion === 'CALIBRAR' ? 'border-l-sky-500'
        : h.interpretacion === 'INVESTIGAR' ? 'border-l-red-500' : 'border-l-ink-faint')}>
        <div className="flex flex-wrap items-center gap-4 p-4">
          <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl',
            h.interpretacion === 'CUADRADO' ? 'bg-brand-500/12 text-brand-600 dark:text-brand-400'
            : h.interpretacion === 'CALIBRAR' ? 'bg-sky-500/12 text-sky-600 dark:text-sky-400'
            : h.interpretacion === 'INVESTIGAR' ? 'bg-red-500/12 text-red-600 dark:text-red-400'
            : 'bg-ink-faint/12 text-ink-faint')}>
            <veredicto.icono className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{veredicto.titulo}</p>
            <p className="mt-0.5 text-[13px] text-ink-soft">{h.mensaje}</p>
          </div>
          <Select value={periodo} onChange={setPeriodo} className="w-44"
                  options={periodos.map((p) => ({ value: p, label: nombrePeriodo(p) }))} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Paso n={1} titulo="Entradas" nota="Lo que había más lo que se compró">
          <Linea signo="+" label="Saldo inicial de litros de petróleo" valor={h.saldoInicial} />
          <Linea signo="+" label="Compras de litros de petróleo" valor={h.compras} />
          <Linea signo="=" label="Total ingresos de petróleo" valor={h.totalIngresos} tipo="total" />
        </Paso>

        <Paso n={2} titulo="Salidas" nota={`${h.entregas} entregas registradas una a una`}>
          <Linea signo="−" label="Suma de cada registro de petróleo entregado" valor={h.totalSalidas} />
          <Linea signo="=" label="Total salidas del período" valor={h.totalSalidas} tipo="total" />
        </Paso>

        <Paso n={3} titulo="Chequeo del contador del estanque"
              nota="Ambos registros deben ser iguales">
          {!estanque.tieneContador ? (
            <div className="px-4 py-6 text-center text-[13px] text-ink-faint">
              Este estanque no tiene contador mecánico.
            </div>
          ) : (
            <>
              <Linea label="Registro final del contador" valor={h.contadorFinal} unidad="" />
              <Linea signo="−" label="Registro inicial del contador" valor={h.contadorInicial} unidad="" />
              <Linea signo="=" label="Diferencia del contador" valor={h.diferenciaContador} tipo="total" />
              <div className={cn('mx-4 my-3 flex items-start gap-2.5 rounded-lg border p-3',
                h.contadorCuadra ? 'border-brand-500/30 bg-brand-500/6' : 'border-red-500/30 bg-red-500/6')}>
                {h.contadorCuadra
                  ? <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                  : <TriangleAlert className="mt-px h-4 w-4 shrink-0 text-red-500" />}
                <p className="text-[12px] leading-relaxed text-ink-soft">
                  {h.diferenciaContador === undefined
                    ? 'Faltan lecturas del contador en este período para poder cruzar el dato.'
                    : h.contadorCuadra
                      ? `El contador y los registros coinciden en ${nfmt(h.totalSalidas, 0)} L.`
                      : <>El contador marca <strong className="text-ink">{nfmt(h.diferenciaContador, 0)} L</strong> pero
                         los registros suman <strong className="text-ink">{nfmt(h.totalSalidas, 0)} L</strong>.
                         Faltan <strong className="text-ink">{nfmt(Math.abs(h.descuadreContador ?? 0), 0)} L</strong> por
                         registrar: ningún ajuste posterior va a corregir eso.</>}
                </p>
              </div>
            </>
          )}
        </Paso>

        <Paso n={4} titulo="Resultados" nota={h.fechaControl ? `Control del ${h.fechaControl}` : 'Sin control en el período'}>
          <Linea label="Total entradas" valor={h.totalIngresos} />
          <Linea signo="−" label="Total salidas" valor={h.totalSalidas} />
          <Linea signo="=" label="Saldo contable" valor={h.saldoContable} tipo="total" />
          <Linea label="Saldo visible en el estanque" valor={h.saldoVisible} />
        </Paso>
      </div>

      <Paso n={5} titulo="Interpretación del resultado" nota="Saldo contable menos saldo visible">
        <div className="p-4">
          <div className={cn('mb-4 rounded-lg border p-4 text-center',
            h.interpretacion === 'CUADRADO' ? 'border-brand-500/40 bg-brand-500/8'
            : h.interpretacion === 'CALIBRAR' ? 'border-sky-500/40 bg-sky-500/8'
            : h.interpretacion === 'INVESTIGAR' ? 'border-red-500/40 bg-red-500/8'
            : 'border-dashed border-hairline')}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Diferencia</p>
            <p className="tnum mt-1 text-3xl font-semibold text-ink">
              {h.saldoVisible === undefined ? '—' : `${h.diferencia > 0 ? '+' : ''}${nfmt(h.diferencia, 0)} L`}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className={cn('rounded-lg border p-3 transition-colors duration-200',
                               h.interpretacion === 'CALIBRAR'
                                 ? 'border-sky-500/50 bg-sky-500/8' : 'border-hairline opacity-60')}>
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <Badge tone="sky">Dato negativo</Badge>
                {h.interpretacion === 'CALIBRAR' && <CheckCircle2 className="h-4 w-4 text-sky-500" />}
              </p>
              <p className="mt-1.5 text-[13px] text-ink-soft">
                Hay más petróleo del indicado por la máquina.
              </p>
              <p className="mt-1 text-[12px] font-medium text-sky-700 dark:text-sky-400">→ Calibrar el estanque</p>
            </div>

            <div className={cn('rounded-lg border p-3 transition-colors duration-200',
                               h.interpretacion === 'INVESTIGAR'
                                 ? 'border-red-500/50 bg-red-500/8' : 'border-hairline opacity-60')}>
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <Badge tone="red">Dato positivo</Badge>
                {h.interpretacion === 'INVESTIGAR' && <CheckCircle2 className="h-4 w-4 text-red-500" />}
              </p>
              <p className="mt-1.5 text-[13px] text-ink-soft">
                Hay menos petróleo del indicado por la máquina.
              </p>
              <p className="mt-1 text-[12px] font-medium text-red-600 dark:text-red-400">
                → Mal registro, entrega incompleta del proveedor o fugas en el campo
              </p>
            </div>
          </div>
        </div>
      </Paso>
    </div>
  )
}

/* ═══════════════════ Movimientos ═══════════════════ */

function Movimientos({ estanqueId }: { estanqueId: string }) {
  const { combustible, delCombustible } = useStore()
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('TODAS')
  const [editor, setEditor] = useState<AccionCombustible | null>(null)

  const lista = useMemo(() => {
    const t = q.trim().toUpperCase()
    return combustible
      .filter((m) => m.estanqueId === estanqueId)
      .filter((m) => filtro === 'TODAS' || m.accion === filtro)
      .filter((m) => !t || `${m.cc} ${m.labor} ${m.vehiculo ?? ''} ${m.chofer ?? ''} ${m.observaciones ?? ''}`.toUpperCase().includes(t))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [combustible, estanqueId, q, filtro])

  return (
    <>
      <Card>
        <CardHeader
          title="Movimientos del estanque"
          subtitle="Cada salida imputa litros a un centro de costo, labor y vehículo"
          icon={Fuel}
          actions={
            <>
              <Select value={filtro} onChange={setFiltro} className="w-40"
                      options={['TODAS', 'ENTRADA', 'SALIDA', 'CONTROL', 'AJUSTE']} />
              <SearchInput value={q} onChange={setQ} placeholder="CC, labor, vehículo…" className="w-52" />
              <button onClick={() => setEditor('SALIDA')} className="btn-primary !min-h-0 !py-1.5">
                <Plus className="h-4 w-4" />Registrar
              </button>
            </>
          }
        />
        {lista.length === 0 ? (
          <Vacio titulo="Sin movimientos" detalle="Registre la primera entrada o salida del estanque." icon={Fuel} />
        ) : (
          <div className="max-h-[62vh] overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Fecha</th><th>Acción</th><th>Centro de costo</th><th>Labor</th>
                  <th>Especie</th><th>Vehículo</th><th>Chofer</th>
                  <th className="text-right">Horas</th>
                  <th className="text-right">Litros</th>
                  <th className="text-right">Visible</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lista.map((m) => (
                  <tr key={m.id} className="group">
                    <td className="tnum whitespace-nowrap text-ink-soft">{m.fecha}</td>
                    <td>
                      <Tip texto={ACCION_META[m.accion].descripcion}>
                        <Badge tone={TONO_ACCION[m.accion]}>{ACCION_META[m.accion].label}</Badge>
                      </Tip>
                    </td>
                    <td className="text-[12px] font-medium text-ink">{m.cc}</td>
                    <td className="max-w-[170px] truncate text-[12px] text-ink-soft" title={m.labor}>{m.labor}</td>
                    <td className="max-w-[140px] truncate text-[12px] text-ink-faint" title={m.especie}>
                      {m.especie === 'GENERAL' ? '—' : m.especie}
                    </td>
                    <td className="text-[12px] text-ink-soft">{m.vehiculo ?? '—'}</td>
                    <td className="max-w-[140px] truncate text-[12px] text-ink-faint" title={m.chofer}>{m.chofer ?? '—'}</td>
                    <td className="tnum text-right text-ink-faint">{m.horas ?? '—'}</td>
                    <td className={cn('tnum whitespace-nowrap text-right font-medium',
                                      m.litros > 0 ? 'text-brand-600 dark:text-brand-400'
                                      : m.litros < 0 ? 'text-accent-600 dark:text-accent-400' : 'text-ink-faint')}>
                      {m.litros ? `${m.litros > 0 ? '+' : ''}${nfmt(m.litros, 1)}` : '—'}
                    </td>
                    <td className="tnum whitespace-nowrap text-right text-sky-600 dark:text-sky-400">
                      {m.visible !== undefined ? `${nfmt(m.visible, 0)} L` : ''}
                    </td>
                    <td>
                      <button onClick={async () => {
                        if (await alerta.eliminar('¿Eliminar este movimiento?', `${m.fecha} · ${m.cc} · ${m.litros} L`)) {
                          delCombustible(m.id); alerta.toast('Movimiento eliminado', 'warning')
                        }
                      }} aria-label="Eliminar movimiento"
                        className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-ink-faint opacity-0 transition-all duration-200 hover:bg-red-500/12 hover:text-red-500 group-hover:opacity-100">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editor && <EditorMovimiento estanqueId={estanqueId} onClose={() => setEditor(null)} />}
    </>
  )
}

/* ═══════════════════ Editor de movimiento ═══════════════════ */

function EditorMovimiento({ estanqueId, onClose }: { estanqueId: string; onClose: () => void }) {
  const { estanques, combustible, addCombustible } = useStore()
  const estanque = estanques.find((e) => e.id === estanqueId)!
  const [f, setF] = useState<Omit<MovimientoCombustible, 'id'>>({
    fecha: hoy(), estanqueId, accion: 'SALIDA', campo: estanque.campo,
    especie: 'GENERAL', variedad: 'GENERAL',
    cc: (CC_COMBUSTIBLE[estanque.campo] ?? ['GENERAL'])[0],
    labor: 'Labores generales', litros: 0,
  })
  const [cm, setCm] = useState('')

  const esControl = f.accion === 'CONTROL'
  const esEntrada = f.accion === 'ENTRADA'
  const litrosDeCm = cm ? litrosDesdeCm(Number(cm), estanque.cmPorCienLitros) : undefined

  const set = <K extends keyof MovimientoCombustible>(k: K, v: MovimientoCombustible[K]) =>
    setF((s) => {
      const n = { ...s, [k]: v }
      if (k === 'accion') {
        const a = v as AccionCombustible
        n.litros = 0
        if (a === 'CONTROL') { n.labor = 'CONTROL'; n.visible = undefined }
        else if (a === 'ENTRADA') { n.labor = 'ENTRADA'; n.cc = `GENERAL ${estanque.campo.slice(0, 2)}` }
        else n.labor = 'Labores generales'
      }
      if (k === 'especie') n.variedad = (VARIEDADES_COMBUSTIBLE[v as string] ?? ['GENERAL'])[0]
      return n
    })

  const guardar = () => {
    if (esControl) {
      const visible = f.visible ?? litrosDeCm
      if (visible === undefined || isNaN(visible))
        return alerta.aviso('Falta la medición', 'Ingrese los litros visibles o mida el estanque en centímetros.')
      addCombustible({ ...f, litros: 0, visible, labor: 'CONTROL' })
      alerta.ok('Control registrado', `Visible ${nfmt(visible, 1)} L. Revise la diferencia en la pestaña Prorrateo.`)
      onClose()
      return
    }
    const litrosAbs = Math.abs(f.litros)
    if (!litrosAbs) return alerta.aviso('Faltan los litros', 'Ingrese la cantidad de combustible.')
    if (f.accion === 'SALIDA' && !f.cc)
      return alerta.aviso('Falta el centro de costo', 'Sin centro de costo el consumo no se puede imputar.')
    addCombustible({ ...f, litros: esEntrada ? litrosAbs : -litrosAbs })
    alerta.toast('Movimiento registrado')
    onClose()
  }

  const ccs = CC_COMBUSTIBLE[estanque.campo] ?? ['GENERAL']

  return (
    <Modal
      open onClose={onClose} wide
      title="Registrar movimiento de combustible"
      subtitle={estanque.nombre}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={guardar} className="btn-primary">Registrar</button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="label">Tipo de movimiento</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['ENTRADA', 'SALIDA', 'CONTROL', 'AJUSTE'] as AccionCombustible[]).map((a) => (
              <button key={a} onClick={() => set('accion', a)}
                      className={cn('cursor-pointer rounded-lg border p-2.5 text-left transition-colors duration-200',
                                    f.accion === a ? 'border-brand-500 bg-brand-500/10' : 'border-hairline hover:border-ink-faint/50')}>
                <span className="flex items-center gap-2">
                  {a === 'ENTRADA' ? <ArrowDownToLine className="h-4 w-4 text-brand-500" />
                   : a === 'SALIDA' ? <ArrowUpFromLine className="h-4 w-4 text-accent-500" />
                   : a === 'CONTROL' ? <ClipboardCheck className="h-4 w-4 text-sky-500" />
                   : <Calculator className="h-4 w-4 text-violet-500" />}
                  <span className="truncate text-[12px] font-medium text-ink">{ACCION_META[a].label}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-faint">{ACCION_META[f.accion].descripcion}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Fecha">
            <input type="date" className="input" value={f.fecha} onChange={(e) => set('fecha', e.target.value)} />
          </Field>

          {esControl ? (
            <>
              <Field label="Medición con vara (cm)" hint={litrosDeCm ? `= ${nfmt(litrosDeCm, 1)} L` : 'Opcional'}>
                <input type="number" step={0.1} min={0} className="input tnum" value={cm}
                       onChange={(e) => setCm(e.target.value)} />
              </Field>
              <Field label="Litros visibles" hint="Se puede ingresar directamente">
                <input type="number" step={0.1} min={0} className="input tnum"
                       value={f.visible ?? (litrosDeCm ? Math.round(litrosDeCm * 10) / 10 : '')}
                       onChange={(e) => set('visible', Number(e.target.value))} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Litros" hint={f.accion === 'SALIDA' ? 'Se registra como consumo' : undefined}>
                <input type="number" step={0.1} min={0} className="input tnum" value={f.litros || ''}
                       onChange={(e) => set('litros', Number(e.target.value))} />
              </Field>
              {esEntrada && (
                <Field label="Precio por litro" hint={f.precio ? money(f.precio * Math.abs(f.litros)) : 'Valoriza el consumo'}>
                  <input type="number" min={0} className="input tnum" value={f.precio ?? ''}
                         onChange={(e) => set('precio', Number(e.target.value))} />
                </Field>
              )}
            </>
          )}

          {estanque.tieneContador && (
            <Field label="Contador del estanque">
              <input type="number" className="input tnum" value={f.contador ?? ''}
                     onChange={(e) => set('contador', Number(e.target.value))} />
            </Field>
          )}
        </div>

        {!esControl && !esEntrada && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Centro de costo">
                <Select value={f.cc} onChange={(v) => set('cc', v)} options={ccs} />
              </Field>
              <Field label="Labor">
                <Select value={f.labor} onChange={(v) => set('labor', v)} options={LABORES_COMBUSTIBLE} />
              </Field>
              <Field label="Horas de uso">
                <input type="number" step={0.5} min={0} className="input tnum" value={f.horas ?? ''}
                       onChange={(e) => set('horas', Number(e.target.value) || undefined)} />
              </Field>
              <Field label="Especie">
                <Select value={f.especie} onChange={(v) => set('especie', v)} options={ESPECIES_COMBUSTIBLE} />
              </Field>
              <Field label="Variedad">
                <Select value={f.variedad} onChange={(v) => set('variedad', v)}
                        options={VARIEDADES_COMBUSTIBLE[f.especie] ?? ['GENERAL']} />
              </Field>
              <Field label="Vehículo">
                <Select value={f.vehiculo ?? ''} onChange={(v) => set('vehiculo', v)}
                        options={VEHICULOS} placeholder="Seleccionar…" />
              </Field>
              <Field label="Chofer" className="sm:col-span-2">
                <input className="input" value={f.chofer ?? ''} onChange={(e) => set('chofer', e.target.value)} />
              </Field>
            </div>
          </>
        )}

        <Field label="Observaciones">
          <input className="input" value={f.observaciones ?? ''}
                 onChange={(e) => set('observaciones', e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

/* ═══════════════════ Prorrateo ═══════════════════ */

function Prorrateo({ estanqueId }: { estanqueId: string }) {
  const { estanques, combustible, bulkCombustible } = useStore()
  const estanque = estanques.find((e) => e.id === estanqueId)!
  const estado = estadoDeEstanque(estanque, combustible)
  const movs = combustible.filter((m) => m.estanqueId === estanqueId)

  const control = estado.ultimoControl
  const controlPrevio = useMemo(() => {
    const idx = indiceUltimoControl(movs)
    for (let i = idx - 1; i >= 0; i--) if (movs[i].accion === 'CONTROL') return movs[i]
    return undefined
  }, [movs])

  const lineas = useMemo(
    () =>
      control && Math.abs(estado.diferencia) > 0
        ? prorratearDiferencia(combustible, estanqueId, estado.diferencia)
        : [],
    [combustible, estanqueId, estado.diferencia, control],
  )

  // La regla dice hacer el ajuste el primer día del mes siguiente al control
  const fechaAjuste = useMemo(() => {
    if (!control) return hoy()
    const d = new Date(control.fecha + 'T12:00:00')
    d.setMonth(d.getMonth() + 1, 1)
    return d.toISOString().slice(0, 10)
  }, [control])

  const aplicar = async () => {
    const ok = await alerta.confirmar(
      '¿Aplicar el prorrateo?',
      `Se crearán ${lineas.filter((l) => l.ajuste !== 0).length} movimientos de ajuste con fecha ${fechaAjuste}. Después, la diferencia debería quedar en cero.`,
      'Aplicar ajuste',
    )
    if (!ok) return
    bulkCombustible(movimientosDeAjuste(lineas, estanqueId, fechaAjuste, movs))
    useStore.getState().auditar('AJUSTE', 'combustible', `Prorrateo de ${nfmt(estado.diferencia, 1)} L entre ${lineas.length} centros de costo`)
    alerta.ok('Ajuste aplicado', 'Registre un nuevo control para verificar que la diferencia quedó en cero.')
  }

  if (!control)
    return (
      <Card>
        <Vacio
          titulo="Sin controles físicos"
          detalle="Registre un control midiendo el estanque para poder detectar y prorratear diferencias."
          icon={ClipboardCheck}
        />
      </Card>
    )

  const totalAjuste = suma(lineas, (l) => l.ajuste)

  return (
    <div className="space-y-5">
      <Card className={cn('border-l-4', Math.abs(estado.diferencia) > 0.5 ? 'border-l-accent-500' : 'border-l-brand-500')}>
        <div className="flex flex-wrap items-center gap-4 p-4">
          <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                              Math.abs(estado.diferencia) > 0.5
                                ? 'bg-accent-500/15 text-accent-600 dark:text-accent-400'
                                : 'bg-brand-500/12 text-brand-600 dark:text-brand-400')}>
            {Math.abs(estado.diferencia) > 0.5 ? <Scale className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">
              {Math.abs(estado.diferencia) > 0.5
                ? `Diferencia de ${estado.diferencia > 0 ? '+' : ''}${nfmt(estado.diferencia, 1)} L en el control del ${control.fecha}`
                : 'El estanque cuadra: la diferencia es cero'}
            </p>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              {Math.abs(estado.diferencia) > 0.5 ? (
                <>
                  Se reparte entre los centros de costo según lo consumido
                  {controlPrevio ? ` desde el control del ${controlPrevio.fecha}` : ' en todo el historial'}.
                  Diferencia positiva se registra como entrada; negativa, como salida.
                </>
              ) : (
                'No hay ajustes pendientes. El objetivo es que se mantenga así mejorando registros y calibración.'
              )}
            </p>
          </div>
          {lineas.length > 0 && (
            <button onClick={aplicar} className="btn-primary">
              <Calculator className="h-4 w-4" />Aplicar ajuste
            </button>
          )}
        </div>
      </Card>

      {lineas.length > 0 && (
        <Card>
          <CardHeader
            title="Reparto por centro de costo"
            subtitle={`Regla de tres sobre ${nfmt(suma(lineas, (l) => l.salidasNetas), 1)} L consumidos en el período · ajuste con fecha ${fechaAjuste}`}
            icon={Layers}
          />
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Centro de costo</th><th>Campo</th>
                  <th className="w-40">Participación</th>
                  <th className="text-right">Salidas netas</th>
                  <th className="text-right">Proporción</th>
                  <th className="text-right">Ajuste</th>
                  <th>Se registra como</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l) => (
                  <tr key={l.cc}>
                    <td className="font-medium text-ink">{l.cc}</td>
                    <td className="text-[12px] text-ink-faint">{l.campo.replace('_', ' ')}</td>
                    <td><Barra valor={l.proporcion * 100} max={100} tone="accent" /></td>
                    <td className="tnum text-right text-ink-soft">{nfmt(l.salidasNetas, 1)} L</td>
                    <td className="tnum text-right text-ink-faint">{(l.proporcion * 100).toFixed(1)}%</td>
                    <td className={cn('tnum whitespace-nowrap text-right font-semibold',
                                      l.ajuste > 0 ? 'text-brand-600 dark:text-brand-400' : 'text-accent-600 dark:text-accent-400')}>
                      {l.ajuste > 0 ? '+' : ''}{nfmt(l.ajuste, 2)} L
                    </td>
                    <td>
                      <Badge tone={l.ajuste > 0 ? 'brand' : 'accent'}>
                        {l.ajuste > 0 ? 'Entrada' : 'Salida'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-soft font-semibold">
                  <td colSpan={3} className="px-3 py-2 text-ink">Total repartido</td>
                  <td className="tnum px-3 py-2 text-right text-ink">
                    {nfmt(suma(lineas, (l) => l.salidasNetas), 1)} L
                  </td>
                  <td className="tnum px-3 py-2 text-right text-ink">100%</td>
                  <td className="tnum px-3 py-2 text-right text-ink">{nfmt(totalAjuste, 2)} L</td>
                  <td className="px-3 py-2">
                    {Math.round((totalAjuste - estado.diferencia) * 100) === 0 ? (
                      <Badge tone="brand"><CheckCircle2 className="h-3 w-3" />Cuadra</Badge>
                    ) : (
                      <Badge tone="red">Descuadre</Badge>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

/* ═══════════════════ Consumo ═══════════════════ */

const DIMENSIONES: { key: DimensionConsumo; label: string; icon: any }[] = [
  { key: 'cc', label: 'Centro de costo', icon: Layers },
  { key: 'labor', label: 'Labor', icon: Wrench },
  { key: 'vehiculo', label: 'Vehículo', icon: Truck },
  { key: 'chofer', label: 'Chofer', icon: User },
  { key: 'especie', label: 'Especie', icon: Droplets },
]

function Consumo({ estanqueId }: { estanqueId: string }) {
  const { combustible } = useStore()
  const [dim, setDim] = useState<DimensionConsumo>('cc')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const datos = useMemo(
    () => consumoPorDimension(combustible, dim, { estanqueId, desde: desde || undefined, hasta: hasta || undefined }),
    [combustible, dim, estanqueId, desde, hasta],
  )
  const precio = precioPromedio(combustible, estanqueId)
  const totalLitros = suma(datos, (d) => d.litros)
  const grafico = datos.slice(0, 12).map((d, i) => ({
    nombre: d.nombre.length > 20 ? d.nombre.slice(0, 19) + '…' : d.nombre,
    completo: d.nombre, litros: d.litros, fill: PALETA[i % PALETA.length],
  }))

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Consumo de combustible"
          subtitle={`${nfmt(totalLitros, 0)} L${precio > 0 ? ` ≈ ${money(totalLitros * precio)}` : ''}`}
          icon={Fuel}
          actions={
            <>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
                     aria-label="Desde" className="input tnum !w-36 !py-1.5 text-[12px]" />
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
                     aria-label="Hasta" className="input tnum !w-36 !py-1.5 text-[12px]" />
            </>
          }
        />
        <div className="flex flex-wrap gap-1.5 border-b border-hairline px-4 py-3">
          {DIMENSIONES.map((d) => (
            <button key={d.key} onClick={() => setDim(d.key)}
                    className={cn('flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-200',
                                  dim === d.key ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300'
                                                : 'border-hairline text-ink-soft hover:border-ink-faint/50 hover:text-ink')}>
              <d.icon className="h-3.5 w-3.5" />{d.label}
            </button>
          ))}
        </div>
        <div className="p-4">
          {datos.length === 0 ? (
            <Vacio titulo="Sin consumo en el período" />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={grafico} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <XAxis type="number" stroke="rgb(var(--ink-faint))" fontSize={11}
                       tickLine={false} axisLine={false} tickFormatter={(v) => `${v} L`} />
                <YAxis type="category" dataKey="nombre" width={150} stroke="rgb(var(--ink-faint))"
                       fontSize={11} tickLine={false} axisLine={false} />
                <RTooltip cursor={{ fill: 'rgb(var(--ink) / 0.05)' }} contentStyle={ejeTooltip}
                          formatter={(v: number) => [`${nfmt(v, 1)} L`, 'Consumo']}
                          labelFormatter={(_, p) => p?.[0]?.payload?.completo ?? ''} />
                <Bar dataKey="litros" radius={[0, 4, 4, 0]}>
                  {grafico.map((g, i) => <Cell key={i} fill={g.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {datos.length > 0 && (
        <Card>
          <CardHeader title="Detalle" subtitle={`Por ${DIMENSIONES.find((d) => d.key === dim)?.label.toLowerCase()}`} icon={Layers} />
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Concepto</th><th className="w-40">Participación</th>
                  <th className="text-right">Litros</th><th className="text-right">%</th>
                  <th className="text-right">Movimientos</th><th className="text-right">Horas</th>
                  <th className="text-right">Costo estimado</th>
                </tr>
              </thead>
              <tbody>
                {datos.map((d) => (
                  <tr key={d.nombre}>
                    <td className="font-medium text-ink">{d.nombre}</td>
                    <td><Barra valor={d.proporcion * 100} max={100} /></td>
                    <td className="tnum text-right text-ink">{nfmt(d.litros, 1)}</td>
                    <td className="tnum text-right text-ink-faint">{(d.proporcion * 100).toFixed(1)}%</td>
                    <td className="tnum text-right text-ink-soft">{d.movimientos}</td>
                    <td className="tnum text-right text-ink-faint">{d.horas ? nfmt(d.horas, 1) : '—'}</td>
                    <td className="tnum whitespace-nowrap text-right font-medium text-ink">
                      {precio > 0 ? money(d.litros * precio) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-soft font-semibold">
                  <td colSpan={2} className="px-3 py-2 text-ink">Total</td>
                  <td className="tnum px-3 py-2 text-right text-ink">{nfmt(totalLitros, 1)}</td>
                  <td className="tnum px-3 py-2 text-right text-ink">100%</td>
                  <td colSpan={2} />
                  <td className="tnum px-3 py-2 text-right text-ink">
                    {precio > 0 ? money(totalLitros * precio) : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

/* ═══════════════════ Contabilizar ═══════════════════ */

function Contabilizar({ estanqueId }: { estanqueId: string }) {
  const { combustible, asientos, addAsiento, periodoActivo, auditar } = useStore()
  const [previa, setPrevia] = useState<ReturnType<typeof asientoConsumoCombustible> | null>(null)

  const precio = precioPromedio(combustible, estanqueId)
  const desde = `${periodoActivo}-01`
  const hasta = fechaCierre(periodoActivo)
  const costos = useMemo(
    () => valorizarConsumo(combustible, precio, { estanqueId, desde, hasta }),
    [combustible, precio, estanqueId, desde, hasta],
  )
  const total = suma(costos, (c) => c.monto)
  const litros = suma(costos, (c) => c.litros)

  const generar = () => {
    const yaExiste = asientos.find(
      (a) => a.fecha.startsWith(periodoActivo) && a.glosa.toLowerCase().includes('combustible'),
    )
    if (yaExiste)
      return alerta.aviso(
        'Ya existe un asiento de combustible',
        `El asiento N° ${yaExiste.numero} ya contabiliza el consumo de ${nombrePeriodo(periodoActivo)}.`,
      )
    setPrevia(
      asientoConsumoCombustible(costos, temporadaDe(hasta), precio, {
        numero: siguienteNumero(asientos),
        fecha: hasta,
        glosa: `Consumo de combustible · ${nombrePeriodo(periodoActivo)}`,
      }),
    )
  }

  const confirmar = () => {
    if (!previa) return
    const { id, ...datos } = previa.asiento
    addAsiento(datos)
    auditar('CONTABILIZAR', 'combustible', `Asiento N° ${datos.numero} · ${previa.resumen.litros} L · ${money(previa.resumen.monto)}`)
    setPrevia(null)
    alerta.ok('Consumo contabilizado', `N° ${datos.numero} · ${money(previa.resumen.monto)} descargados del inventario.`)
  }

  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Litros del período" value={`${nfmt(litros, 1)} L`} icon={Fuel}
             sub={nombrePeriodo(periodoActivo)} />
        <Kpi label="Precio promedio" value={precio > 0 ? `${money(precio)}/L` : '—'} icon={Scale} tone="sky"
             sub="Ponderado por compras" />
        <Kpi label="Costo a imputar" value={money(total)} icon={Calculator} tone="accent"
             sub={`${costos.length} centros de costo`} />
        <Kpi label="Cuenta de destino" value="5.1" icon={BookOpenCheck} tone="violet"
             sub="4113 · SERVICIOS_AGRICOLAS" />
      </div>

      <Card>
        <CardHeader
          title="Consumo valorizado del período"
          subtitle="Descarga el inventario de combustible y lleva el costo a cada centro de costo"
          icon={BookOpenCheck}
          actions={
            <button onClick={generar} className="btn-primary !min-h-0 !py-1.5" disabled={costos.length === 0}>
              <BookOpenCheck className="h-4 w-4" />Contabilizar
            </button>
          }
        />
        {costos.length === 0 ? (
          <Vacio
            titulo="Sin consumo en el período"
            detalle={`No hay salidas de combustible en ${nombrePeriodo(periodoActivo)}. Cambie el período en la barra superior.`}
            icon={Fuel}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Centro de costo</th><th>Campo</th><th>Especie</th><th>Variedad</th>
                  <th className="text-right">Litros</th><th className="text-right">Costo</th>
                </tr>
              </thead>
              <tbody>
                {costos.map((c, i) => (
                  <tr key={i}>
                    <td className="font-medium text-ink">{c.cc}</td>
                    <td className="text-[12px] text-ink-faint">{c.campo.replace('_', ' ')}</td>
                    <td className="text-[12px] text-ink-soft">{c.especie === 'GENERAL' ? '—' : c.especie}</td>
                    <td className="text-[12px] text-ink-soft">{c.variedad === 'GENERAL' ? '—' : c.variedad}</td>
                    <td className="tnum text-right text-ink">{nfmt(c.litros, 1)}</td>
                    <td className="tnum whitespace-nowrap text-right font-medium text-ink">{money(c.monto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-soft font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-ink">Total</td>
                  <td className="tnum px-3 py-2 text-right text-ink">{nfmt(litros, 1)}</td>
                  <td className="tnum px-3 py-2 text-right text-ink">{money(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!previa} onClose={() => setPrevia(null)} wide
        title="Asiento de consumo de combustible"
        subtitle="Descarga del inventario al costo, con las dimensiones analíticas"
        footer={
          <>
            <span className="mr-auto flex items-center gap-2 text-[13px] font-medium text-brand-600 dark:text-brand-400">
              <CheckCircle2 className="h-4 w-4" />Debe = Haber = {money(previa?.resumen.monto ?? 0)}
            </span>
            <button onClick={() => setPrevia(null)} className="btn-ghost">Cancelar</button>
            <button onClick={confirmar} className="btn-primary">
              <BookOpenCheck className="h-4 w-4" />Contabilizar asiento
            </button>
          </>
        }
      >
        {previa && (
          <div className="space-y-4">
            {previa.advertencias.length > 0 && (
              <div className="rounded-lg border border-accent-500/25 bg-accent-500/6 p-3">
                <ul className="space-y-1">
                  {previa.advertencias.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-ink-soft">
                      <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0 text-accent-600 dark:text-accent-400" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="max-h-80 overflow-auto rounded-lg border border-hairline">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Cuenta</th><th>Glosa</th><th>N9 Especie</th><th>N13 CC</th>
                    <th className="text-right">Debe</th><th className="text-right">Haber</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.asiento.lineas.map((l) => (
                    <tr key={l.id} className={l.haber > 0 ? 'bg-accent-500/[0.06]' : undefined}>
                      <td><code className="tnum font-mono text-[11px] font-semibold text-brand-700 dark:text-brand-300">{l.cuenta}</code></td>
                      <td className="max-w-[240px] truncate text-[12px] text-ink" title={l.glosaLinea}>{l.glosaLinea}</td>
                      <td className="text-[12px] text-ink-soft">{l.n9 && l.n9 !== 'GENERAL' ? l.n9 : '—'}</td>
                      <td className="text-[12px] text-ink-soft">{l.n13 ?? '—'}</td>
                      <td className="tnum whitespace-nowrap text-right font-medium text-ink">{l.debe ? money(l.debe) : ''}</td>
                      <td className="tnum whitespace-nowrap text-right font-medium text-ink">{l.haber ? money(l.haber) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
