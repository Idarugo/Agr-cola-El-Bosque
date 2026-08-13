import { useMemo, useState } from 'react'
import {
  Package, PackagePlus, SprayCan, ClipboardCheck, TriangleAlert, Plus, Trash2,
  CheckCircle2, FileDown, Layers, Boxes, CalendarClock, ShieldAlert, BookOpenCheck,
  FlaskConical, Scale,
} from 'lucide-react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '@/store/useStore'
import {
  cantidadAplicada, compararConteo, consumoPorDimension, cuartelesEnCarencia,
  cuentaN5DeCategoria, estadoCarencia, inventario, movimientosDeConteo,
  revisarBodega, valorizarConsumo, type DimensionBodega,
} from '@/lib/motorBodega'
import { CATEGORIAS_PRODUCTO, MAQUINAS_APLICACION, PLAGAS } from '@/data/bodega'
import { BASE_OPERATIVA, CAMPOS } from '@/data/maestros'
import { asientoConsumoInsumos, fechaCierre } from '@/lib/puenteContable'
import { siguienteNumero } from '@/lib/contabilidad'
import { ACCION_BODEGA_META, type Aplicacion, type MovimientoBodega } from '@/lib/types'
import {
  Badge, Barra, Card, CardHeader, Field, Kpi, Modal, PageHeader, SearchInput, Select, Tabs, Tip, Vacio,
} from '@/components/ui'
import { alerta } from '@/lib/alerta'
import { exportarBodega } from '@/lib/excel'
import { cn, hoy, money, nfmt, nombrePeriodo, suma, temporadaDe } from '@/lib/utils'

const PALETA = ['#16a34a', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316']
const ejeTooltip = {
  background: 'rgb(var(--surface-raised))', border: '1px solid rgb(var(--hairline))',
  borderRadius: 10, fontSize: 12, color: 'rgb(var(--ink))',
}
const TONO_CAT: Record<string, string> = {
  FERTILIZANTE: 'brand', HERBICIDA: 'amber', FUNGICIDA: 'sky',
  INSECTICIDA: 'red', BIOESTIMULANTE: 'violet', COADYUVANTE: 'slate', OTRO: 'slate',
}

export default function Bodega() {
  const [tab, setTab] = useState('stock')
  const { productos, bodega, aplicaciones, campoActivo } = useStore()

  const filas = useMemo(
    () => inventario(productos, bodega, campoActivo),
    [productos, bodega, campoActivo],
  )
  const alertas = useMemo(() => revisarBodega(filas, aplicaciones, hoy()), [filas, aplicaciones])
  const carencias = useMemo(() => cuartelesEnCarencia(aplicaciones, hoy()), [aplicaciones])

  const conMovimiento = filas.filter((f) => f.movimientos > 0)
  const conStock = conMovimiento.filter((f) => f.stock !== 0)
  const valorTotal = suma(conStock, (f) => f.valor)
  const bajoMinimo = conStock.filter((f) => f.bajoMinimo).length

  return (
    <>
      <PageHeader
        titulo="Bodega de insumos"
        descripcion={`${productos.length} productos en maestro · ${campoActivo === 'TODOS' ? 'todas las bodegas' : campoActivo.replace('_', ' ')}`}
        icon={Package}
      >
        <button
          onClick={() => {
            exportarBodega(productos, bodega, aplicaciones)
            alerta.toast('Bodega y aplicaciones descargadas')
          }}
          className="btn-ghost"
        >
          <FileDown className="h-4 w-4" />Exportar
        </button>
      </PageHeader>

      {conMovimiento.length === 0 && (
        <Card className="mb-5 border-l-4 border-l-accent-500">
          <div className="flex items-center gap-4 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-500/15 text-accent-600 dark:text-accent-400">
              <Package className="h-5 w-5" />
            </span>
            <p className="text-[13px] text-ink-soft">
              <strong className="text-ink">
                {campoActivo === 'TODOS' ? 'Sin movimientos de bodega' : `${campoActivo.replace('_', ' ')} no tiene bodega cargada`}
              </strong>
              {' · '}
              El conteo físico de septiembre sólo se levantó en Los Lirios y Chumaco.
              Cambie el campo en la barra superior o registre la primera entrada.
            </p>
          </div>
        </Card>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Productos con stock" value={String(conStock.length)} icon={Boxes}
             sub={`${conMovimiento.length} con movimiento en esta bodega`} />
        <Kpi label="Valor del inventario" value={money(valorTotal)} icon={Scale} tone="accent"
             sub="A precio de referencia" />
        <Kpi label="Bajo stock mínimo" value={String(bajoMinimo)} icon={TriangleAlert}
             tone={bajoMinimo ? 'red' : 'brand'} sub="Requieren reposición" />
        <Kpi label="Cuarteles en carencia" value={String(carencias.length)} icon={CalendarClock}
             tone={carencias.length ? 'red' : 'brand'}
             sub={carencias.length ? `Vence ${carencias[0].fechaCosecha}` : 'Todos cosechables'} />
      </div>

      {alertas.length > 0 && (
        <Card className="mb-5">
          <CardHeader title="Puntos de control" subtitle="Detectados sobre la bodega y las aplicaciones" icon={TriangleAlert} />
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
            { id: 'stock', label: 'Stock', count: conStock.length },
            { id: 'movimientos', label: 'Movimientos', count: bodega.length },
            { id: 'aplicaciones', label: 'Aplicaciones', count: aplicaciones.length },
            { id: 'carencias', label: 'Carencias', count: carencias.length || undefined },
            { id: 'conteo', label: 'Conteo físico' },
            { id: 'contabilizar', label: 'Contabilizar' },
          ]}
        />
      </div>

      {tab === 'stock' && <Stock />}
      {tab === 'movimientos' && <Movimientos />}
      {tab === 'aplicaciones' && <Aplicaciones />}
      {tab === 'carencias' && <Carencias />}
      {tab === 'conteo' && <Conteo />}
      {tab === 'contabilizar' && <Contabilizar />}
    </>
  )
}

/* ═══════════════════ Stock ═══════════════════ */

function Stock() {
  const { productos, bodega, campoActivo, updProducto } = useStore()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('TODAS')
  const [soloConStock, setSolo] = useState(true)
  const [dim, setDim] = useState<DimensionBodega>('categoria')

  const filas = useMemo(() => {
    const t = q.trim().toUpperCase()
    return inventario(productos, bodega, campoActivo)
      .filter((f) => (soloConStock ? f.stock !== 0 || f.movimientos > 0 : true))
      .filter((f) => cat === 'TODAS' || f.producto.categoria === cat)
      .filter((f) => !t || `${f.producto.nombre} ${f.producto.ingredienteActivo}`.toUpperCase().includes(t))
  }, [productos, bodega, campoActivo, q, cat, soloConStock])

  const consumo = useMemo(
    () => consumoPorDimension(productos, bodega, dim, { campo: campoActivo }).slice(0, 10),
    [productos, bodega, dim, campoActivo],
  )
  const maxStock = Math.max(...filas.map((f) => Math.abs(f.stock)), 1)

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Inventario"
          subtitle={`${filas.length} productos · el stock se descuenta solo al registrar una aplicación`}
          icon={Boxes}
          actions={
            <>
              <Select value={cat} onChange={setCat} className="w-44"
                      options={['TODAS', ...CATEGORIAS_PRODUCTO]} />
              <SearchInput value={q} onChange={setQ} placeholder="Producto o ingrediente…" className="w-56" />
            </>
          }
        />
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-soft">
            <input type="checkbox" checked={soloConStock} onChange={(e) => setSolo(e.target.checked)}
                   className="h-4 w-4 cursor-pointer accent-brand-600" />
            Sólo productos con movimiento
          </label>
        </div>
        {filas.length === 0 ? (
          <Vacio titulo="Sin productos" detalle="Ajuste los filtros o registre una entrada de bodega." icon={Package} />
        ) : (
          <div className="max-h-[58vh] overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Producto</th><th>Ingrediente activo</th><th>Categoría</th>
                  <th className="w-32">Nivel</th>
                  <th className="text-right">Stock</th><th>UM</th>
                  <th className="text-right">Mínimo</th>
                  <th className="text-right">Carencia</th>
                  <th className="text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.producto.id}>
                    <td className="font-medium text-ink">
                      <span className="flex items-center gap-2">
                        {f.stock < 0 && <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                        {f.producto.nombre}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate text-[12px] text-ink-faint"
                        title={f.producto.ingredienteActivo}>
                      {f.producto.ingredienteActivo || (
                        <Tip texto="Sin ingrediente activo el registro de aplicaciones queda incompleto para la certificadora.">
                          <span className="cursor-help text-amber-600 dark:text-amber-400">— falta</span>
                        </Tip>
                      )}
                    </td>
                    <td><Badge tone={TONO_CAT[f.producto.categoria]}>{f.producto.categoria}</Badge></td>
                    <td>
                      <Barra valor={Math.max(0, f.stock)} max={maxStock}
                             tone={f.stock < 0 ? 'red' : f.bajoMinimo ? 'accent' : 'brand'} />
                    </td>
                    <td className={cn('tnum whitespace-nowrap text-right font-medium',
                                      f.stock < 0 ? 'text-red-500' : 'text-ink')}>
                      {nfmt(f.stock, f.stock % 1 === 0 ? 0 : 2)}
                    </td>
                    <td className="text-[12px] text-ink-faint">{f.producto.unidad}</td>
                    <td className="text-right">
                      <input type="number" min={0} value={f.producto.stockMinimo}
                             onChange={(e) => updProducto(f.producto.id, { stockMinimo: Number(e.target.value) })}
                             className="input tnum !w-20 !px-2 !py-1 text-right text-[12px]" />
                    </td>
                    <td className="text-right">
                      <input type="number" min={0} value={f.producto.carenciaDias}
                             onChange={(e) => updProducto(f.producto.id, { carenciaDias: Number(e.target.value) })}
                             className="input tnum !w-16 !px-2 !py-1 text-right text-[12px]" />
                    </td>
                    <td className="tnum whitespace-nowrap text-right text-ink-soft">{money(f.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Consumo de insumos"
          subtitle="Valorizado a precio de referencia"
          icon={Layers}
          actions={
            <Select value={dim} onChange={(v) => setDim(v as DimensionBodega)} className="w-48"
                    options={[
                      { value: 'categoria', label: 'Por categoría' },
                      { value: 'producto', label: 'Por producto' },
                      { value: 'cc', label: 'Por centro de costo' },
                      { value: 'especie', label: 'Por especie' },
                      { value: 'campo', label: 'Por campo' },
                    ]} />
          }
        />
        <div className="p-4">
          {consumo.length === 0 ? (
            <Vacio titulo="Sin consumo registrado" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={consumo.map((c) => ({ ...c, corto: c.nombre.length > 22 ? c.nombre.slice(0, 21) + '…' : c.nombre }))}
                        layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <XAxis type="number" stroke="rgb(var(--ink-faint))" fontSize={11}
                       tickLine={false} axisLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                <YAxis type="category" dataKey="corto" width={160} stroke="rgb(var(--ink-faint))"
                       fontSize={11} tickLine={false} axisLine={false} />
                <RTooltip cursor={{ fill: 'rgb(var(--ink) / 0.05)' }} contentStyle={ejeTooltip}
                          formatter={(v: number) => [money(v), 'Consumo']}
                          labelFormatter={(_, p) => p?.[0]?.payload?.nombre ?? ''} />
                <Bar dataKey="monto" radius={[0, 4, 4, 0]}>
                  {consumo.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  )
}

/* ═══════════════════ Movimientos ═══════════════════ */

function Movimientos() {
  const { productos, bodega, campoActivo, addBodega, delBodega } = useStore()
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)

  const lista = useMemo(() => {
    const t = q.trim().toUpperCase()
    return bodega
      .filter((m) => campoActivo === 'TODOS' || m.campo === campoActivo)
      .map((m) => ({ m, p: productos.find((x) => x.id === m.productoId) }))
      .filter((x) => x.p)
      .filter((x) => !t || `${x.p!.nombre} ${x.m.cc ?? ''} ${x.m.documento ?? ''}`.toUpperCase().includes(t))
      .sort((a, b) => b.m.fecha.localeCompare(a.m.fecha))
      .slice(0, 300)
  }, [bodega, productos, campoActivo, q])

  return (
    <>
      <Card>
        <CardHeader
          title="Movimientos de bodega"
          subtitle="Las salidas por aplicación se generan solas desde el registro fitosanitario"
          icon={Package}
          actions={
            <>
              <SearchInput value={q} onChange={setQ} placeholder="Producto, CC o documento…" className="w-56" />
              <button onClick={() => setModal(true)} className="btn-primary !min-h-0 !py-1.5">
                <Plus className="h-4 w-4" />Registrar
              </button>
            </>
          }
        />
        {lista.length === 0 ? (
          <Vacio titulo="Sin movimientos" detalle="Registre la primera entrada de bodega." icon={Package} />
        ) : (
          <div className="max-h-[62vh] overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Fecha</th><th>Producto</th><th>Acción</th><th>Campo</th>
                  <th>Centro de costo</th><th>Documento</th>
                  <th className="text-right">Cantidad</th><th>UM</th><th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lista.map(({ m, p }) => (
                  <tr key={m.id} className="group">
                    <td className="tnum whitespace-nowrap text-ink-soft">{m.fecha}</td>
                    <td className="max-w-[220px] truncate font-medium text-ink" title={p!.nombre}>{p!.nombre}</td>
                    <td>
                      <Tip texto={ACCION_BODEGA_META[m.accion].descripcion}>
                        <Badge tone={ACCION_BODEGA_META[m.accion].color}>
                          {ACCION_BODEGA_META[m.accion].label}
                        </Badge>
                      </Tip>
                    </td>
                    <td className="text-[12px] text-ink-faint">{m.campo.replace('_', ' ')}</td>
                    <td className="text-[12px] text-ink-soft">{m.cc ?? '—'}</td>
                    <td className="text-[12px] text-ink-faint">{m.documento ?? '—'}</td>
                    <td className={cn('tnum whitespace-nowrap text-right font-medium',
                                      m.cantidad > 0 ? 'text-brand-600 dark:text-brand-400' : 'text-accent-600 dark:text-accent-400')}>
                      {m.cantidad > 0 ? '+' : ''}{nfmt(m.cantidad, m.cantidad % 1 === 0 ? 0 : 2)}
                    </td>
                    <td className="text-[12px] text-ink-faint">{p!.unidad}</td>
                    <td>
                      {!m.aplicacionId && (
                        <button onClick={async () => {
                          if (await alerta.eliminar('¿Eliminar este movimiento?')) {
                            delBodega(m.id); alerta.toast('Movimiento eliminado', 'warning')
                          }
                        }} aria-label="Eliminar movimiento"
                          className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-ink-faint opacity-0 transition-all duration-200 hover:bg-red-500/12 hover:text-red-500 group-hover:opacity-100">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modal && <EditorMovimiento onClose={() => setModal(false)} />}
    </>
  )
}

function EditorMovimiento({ onClose }: { onClose: () => void }) {
  const { productos, campoActivo, addBodega } = useStore()
  const [f, setF] = useState<Omit<MovimientoBodega, 'id'>>({
    fecha: hoy(), productoId: '', campo: campoActivo === 'TODOS' ? 'LOS_LIRIOS' : campoActivo,
    accion: 'ENTRADA', cantidad: 0,
  })
  const producto = productos.find((p) => p.id === f.productoId)

  const guardar = () => {
    if (!f.productoId) return alerta.aviso('Falta el producto')
    const cant = Math.abs(f.cantidad)
    if (!cant) return alerta.aviso('Falta la cantidad')
    const r = addBodega({ ...f, cantidad: f.accion === 'ENTRADA' ? cant : -cant })
    if (!r.ok) return alerta.error('No se pudo registrar', r.msg)
    alerta.toast('Movimiento registrado')
    onClose()
  }

  return (
    <Modal open onClose={onClose} wide title="Movimiento de bodega"
           footer={<><button onClick={onClose} className="btn-ghost">Cancelar</button>
                     <button onClick={guardar} className="btn-primary">Registrar</button></>}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Fecha">
          <input type="date" className="input" value={f.fecha}
                 onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        </Field>
        <Field label="Tipo">
          <Select value={f.accion} onChange={(v) => setF({ ...f, accion: v as MovimientoBodega['accion'] })}
                  options={['ENTRADA', 'SALIDA', 'TRASLADO']} />
        </Field>
        <Field label="Campo">
          <Select value={f.campo} onChange={(v) => setF({ ...f, campo: v })}
                  options={CAMPOS.map((c) => c.nombre)} />
        </Field>
        <Field label="Producto" className="sm:col-span-2">
          <Select value={f.productoId} onChange={(v) => setF({ ...f, productoId: v })}
                  placeholder="Seleccionar…"
                  options={productos.map((p) => ({ value: p.id, label: `${p.nombre} (${p.unidad})` }))} />
        </Field>
        <Field label="Cantidad" hint={producto ? producto.unidad : undefined}>
          <input type="number" step={0.01} min={0} className="input tnum" value={f.cantidad || ''}
                 onChange={(e) => setF({ ...f, cantidad: Number(e.target.value) })} />
        </Field>
        {f.accion === 'ENTRADA' ? (
          <>
            <Field label="Documento">
              <input className="input" value={f.documento ?? ''} placeholder="N° factura"
                     onChange={(e) => setF({ ...f, documento: e.target.value })} />
            </Field>
            <Field label="Precio unitario" hint={producto ? money(producto.precioUnitario) : undefined}>
              <input type="number" min={0} className="input tnum" value={f.precioUnitario ?? ''}
                     onChange={(e) => setF({ ...f, precioUnitario: Number(e.target.value) })} />
            </Field>
          </>
        ) : (
          <Field label="Centro de costo">
            <Select value={f.cc ?? ''} onChange={(v) => setF({ ...f, cc: v })} placeholder="Seleccionar…"
                    options={[...new Set(BASE_OPERATIVA.filter((c) => c.campo === f.campo).map((c) => c.cce))]} />
          </Field>
        )}
        <Field label="Observaciones" className="sm:col-span-3">
          <input className="input" value={f.observaciones ?? ''}
                 onChange={(e) => setF({ ...f, observaciones: e.target.value })} />
        </Field>
      </div>
    </Modal>
  )
}

/* ═══════════════════ Aplicaciones ═══════════════════ */

function Aplicaciones() {
  const { productos, aplicaciones, campoActivo, ejercicio, delAplicacion } = useStore()
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)

  const lista = useMemo(() => {
    const t = q.trim().toUpperCase()
    return aplicaciones
      .filter((a) => campoActivo === 'TODOS' || a.campo === campoActivo)
      .map((a) => ({ a, p: productos.find((x) => x.id === a.productoId) }))
      .filter((x) => !t || `${x.a.plaga} ${x.a.variedad} ${x.a.cuartel} ${x.p?.nombre ?? ''}`.toUpperCase().includes(t))
      .sort((x, y) => y.a.fecha.localeCompare(x.a.fecha))
  }, [aplicaciones, productos, campoActivo, q])

  return (
    <>
      <Card>
        <div className="border-b border-hairline px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <SprayCan className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                Registro de aplicaciones
              </h3>
              <p className="mt-0.5 text-xs text-ink-faint">
                {ejercicio.empresa} · formulario M2-008-F004 · edición 03
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SearchInput value={q} onChange={setQ} placeholder="Plaga, variedad, producto…" className="w-52" />
              <button onClick={() => setModal(true)} className="btn-primary !min-h-0 !py-1.5">
                <Plus className="h-4 w-4" />Nueva aplicación
              </button>
            </div>
          </div>
        </div>
        {lista.length === 0 ? (
          <Vacio
            titulo="Sin aplicaciones registradas"
            detalle="Este es el registro que exigen el SAG y las certificadoras. Cada aplicación descuenta su producto de bodega."
            icon={SprayCan}
          />
        ) : (
          <div className="max-h-[62vh] overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Fecha</th><th>Variedad</th><th>Cuartel</th><th>Plaga</th>
                  <th>Producto</th><th>Ingrediente activo</th>
                  <th className="text-right">Dosis/100 L</th><th className="text-right">Dosis/ha</th>
                  <th className="text-right">Mojamiento</th><th className="text-right">Carencia</th>
                  <th className="text-right">Cantidad</th><th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lista.map(({ a, p }) => (
                  <tr key={a.id} className="group">
                    <td className="tnum whitespace-nowrap text-ink-soft">{a.fecha}</td>
                    <td className="text-[12px] text-ink">{a.variedad}</td>
                    <td className="text-[12px] text-ink-soft">{a.cuartel}</td>
                    <td className="max-w-[150px] truncate text-[12px] text-ink" title={a.plaga}>{a.plaga}</td>
                    <td className="max-w-[170px] truncate font-medium text-ink" title={p?.nombre}>{p?.nombre ?? '—'}</td>
                    <td className="max-w-[170px] truncate text-[12px] text-ink-faint" title={p?.ingredienteActivo}>
                      {p?.ingredienteActivo || <span className="text-amber-600 dark:text-amber-400">— falta</span>}
                    </td>
                    <td className="tnum text-right text-ink-soft">{a.dosisPor100L ? nfmt(a.dosisPor100L, 2) : '—'}</td>
                    <td className="tnum text-right text-ink-soft">{a.dosisPorHa ? nfmt(a.dosisPorHa, 2) : '—'}</td>
                    <td className="tnum text-right text-ink-faint">{nfmt(a.mojamiento, 0)} L/ha</td>
                    <td className="tnum text-right">
                      {a.carenciaDias > 0
                        ? <Badge tone="amber">{a.carenciaDias} d</Badge>
                        : <span className="text-ink-faint">—</span>}
                    </td>
                    <td className="tnum whitespace-nowrap text-right font-medium text-ink">
                      {nfmt(a.cantidadProducto, 2)} {p?.unidad}
                    </td>
                    <td>
                      <button onClick={async () => {
                        if (await alerta.eliminar('¿Eliminar esta aplicación?',
                          'Se devolverá el producto a la bodega.')) {
                          delAplicacion(a.id); alerta.toast('Aplicación eliminada', 'warning')
                        }
                      }} aria-label="Eliminar aplicación"
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

      {modal && <EditorAplicacion onClose={() => setModal(false)} />}
    </>
  )
}

function EditorAplicacion({ onClose }: { onClose: () => void }) {
  const { productos, bodega, campoActivo, addAplicacion } = useStore()
  const campoInicial = campoActivo === 'TODOS' ? 'LOS_LIRIOS' : campoActivo
  const [f, setF] = useState<Omit<Aplicacion, 'id' | 'cantidadProducto'>>({
    fecha: hoy(), campo: campoInicial,
    predio: campoInicial === 'CHUMACO' ? 'FUNDO LOS CONDORES' : '',
    cuartel: '', cc: '', especie: '', variedad: '', plaga: PLAGAS[0], productoId: '',
    dosisPorHa: undefined, dosisPor100L: undefined, mojamiento: 1000, hectareas: 1,
    carenciaDias: 0, reingresoHoras: 0, aplicador: '', maquina: MAQUINAS_APLICACION[0],
  })

  const cuarteles = BASE_OPERATIVA.filter((c) => c.campo === f.campo)
  const producto = productos.find((p) => p.id === f.productoId)
  const cantidad = cantidadAplicada(f)
  const stock = f.productoId
    ? bodega.filter((m) => m.productoId === f.productoId && m.campo === f.campo)
        .reduce((a, m) => a + m.cantidad, 0)
    : 0
  const alcanza = cantidad > 0 && stock >= cantidad

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((s) => {
      const n = { ...s, [k]: v }
      if (k === 'cc') {
        const q = BASE_OPERATIVA.find((c) => c.campo === s.campo && c.cce === v)
        if (q) {
          n.especie = q.especie
          n.variedad = q.variedad
          n.cuartel = q.cuarteles || q.cce
          n.hectareas = q.hectareas || 1
          n.predio = q.propiedad || n.predio
        }
      }
      if (k === 'productoId') {
        const p = productos.find((x) => x.id === v)
        if (p) {
          n.carenciaDias = p.carenciaDias
          n.reingresoHoras = p.reingresoHoras
        }
      }
      return n
    })

  const guardar = () => {
    if (!f.productoId) return alerta.aviso('Falta el producto')
    if (!f.cc) return alerta.aviso('Falta el cuartel', 'Sin centro de costo la aplicación no se puede imputar.')
    if (!f.aplicador.trim()) return alerta.aviso('Falta el aplicador', 'Es dato obligatorio del registro.')
    const r = addAplicacion({ ...f, cantidadProducto: cantidad })
    if (!r.ok) return alerta.error('No se pudo registrar', r.msg)
    useStore.getState().auditar('CREAR', 'bodega', `Aplicación ${f.plaga} en ${f.cc} · ${producto?.nombre} ${nfmt(cantidad, 2)} ${producto?.unidad}`)
    alerta.ok('Aplicación registrada',
      `${nfmt(cantidad, 2)} ${producto?.unidad} descontados de bodega.` +
      (f.carenciaDias > 0 ? ` Carencia de ${f.carenciaDias} días.` : ''))
    onClose()
  }

  return (
    <Modal open onClose={onClose} wide
           title="Registro de aplicación" subtitle="Formulario M2-008-F004"
           footer={
             <>
               <span className={cn('mr-auto text-[13px] font-medium',
                                   alcanza ? 'text-brand-600 dark:text-brand-400' : 'text-ink-faint')}>
                 {cantidad > 0
                   ? `${nfmt(cantidad, 2)} ${producto?.unidad ?? ''} · stock ${nfmt(stock, 2)}`
                   : 'Complete dosis y superficie'}
               </span>
               <button onClick={onClose} className="btn-ghost">Cancelar</button>
               <button onClick={guardar} className="btn-primary" disabled={!alcanza}>Registrar</button>
             </>
           }>
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Fecha">
            <input type="date" className="input" value={f.fecha} onChange={(e) => set('fecha', e.target.value)} />
          </Field>
          <Field label="Campo">
            <Select value={f.campo} onChange={(v) => set('campo', v)} options={CAMPOS.map((c) => c.nombre)} />
          </Field>
          <Field label="Cuartel (centro de costo)">
            <Select value={f.cc} onChange={(v) => set('cc', v)} placeholder="Seleccionar…"
                    options={[...new Set(cuarteles.map((c) => c.cce))]} />
          </Field>
          <Field label="Predio">
            <input className="input" value={f.predio} onChange={(e) => set('predio', e.target.value)} />
          </Field>
          <Field label="Especie">
            <input className="input" value={f.especie} onChange={(e) => set('especie', e.target.value)} />
          </Field>
          <Field label="Variedad">
            <input className="input" value={f.variedad} onChange={(e) => set('variedad', e.target.value)} />
          </Field>
          <Field label="Superficie tratada (ha)">
            <input type="number" step={0.01} min={0} className="input tnum" value={f.hectareas}
                   onChange={(e) => set('hectareas', Number(e.target.value))} />
          </Field>
          <Field label="Plaga / objetivo">
            <Select value={f.plaga} onChange={(v) => set('plaga', v)} options={PLAGAS} />
          </Field>
        </div>

        <div>
          <h4 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-ink">
            <FlaskConical className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            Producto y dosis
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Producto comercial" className="sm:col-span-2"
                   hint={producto?.ingredienteActivo || (producto ? 'Sin ingrediente activo registrado' : undefined)}>
              <Select value={f.productoId} onChange={(v) => set('productoId', v)} placeholder="Seleccionar…"
                      options={productos.map((p) => ({ value: p.id, label: `${p.nombre} (${p.unidad})` }))} />
            </Field>
            <Field label="Dosis por 100 L" hint="Alternativa a dosis/ha">
              <input type="number" step={0.01} min={0} className="input tnum" value={f.dosisPor100L ?? ''}
                     onChange={(e) => set('dosisPor100L', Number(e.target.value) || undefined)} />
            </Field>
            <Field label="Dosis por hectárea" hint="Si se completa, manda sobre dosis/100 L">
              <input type="number" step={0.01} min={0} className="input tnum" value={f.dosisPorHa ?? ''}
                     onChange={(e) => set('dosisPorHa', Number(e.target.value) || undefined)} />
            </Field>
            <Field label="Mojamiento (L/ha)">
              <input type="number" min={0} className="input tnum" value={f.mojamiento}
                     onChange={(e) => set('mojamiento', Number(e.target.value))} />
            </Field>
            <Field label="Carencia (días)" hint="Días hasta poder cosechar">
              <input type="number" min={0} className="input tnum" value={f.carenciaDias}
                     onChange={(e) => set('carenciaDias', Number(e.target.value))} />
            </Field>
            <Field label="Reingreso (horas)">
              <input type="number" min={0} className="input tnum" value={f.reingresoHoras}
                     onChange={(e) => set('reingresoHoras', Number(e.target.value))} />
            </Field>
            <Field label="Cantidad de producto" hint="Calculada automáticamente">
              <div className={cn('flex h-[38px] items-center rounded-lg border px-3 tnum text-sm',
                                 alcanza ? 'border-brand-500/40 bg-brand-500/8 text-ink'
                                 : cantidad > 0 ? 'border-red-500/40 bg-red-500/8 text-red-600 dark:text-red-400'
                                 : 'border-dashed border-hairline text-ink-faint')}>
                {cantidad > 0 ? `${nfmt(cantidad, 2)} ${producto?.unidad ?? ''}` : '—'}
              </div>
            </Field>
          </div>
          {cantidad > 0 && !alcanza && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-500">
              <TriangleAlert className="h-3.5 w-3.5" />
              Stock insuficiente: hay {nfmt(stock, 2)} {producto?.unidad} en la bodega de {f.campo.replace('_', ' ')}.
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Aplicador">
            <input className="input" value={f.aplicador} onChange={(e) => set('aplicador', e.target.value)} />
          </Field>
          <Field label="Equipo">
            <Select value={f.maquina ?? ''} onChange={(v) => set('maquina', v)} options={MAQUINAS_APLICACION} />
          </Field>
          <Field label="Condiciones climáticas">
            <input className="input" value={f.condiciones ?? ''} placeholder="Viento, temperatura"
                   onChange={(e) => set('condiciones', e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

/* ═══════════════════ Carencias ═══════════════════ */

function Carencias() {
  const { aplicaciones, productos, campoActivo } = useStore()
  const hoyStr = hoy()

  const carencias = useMemo(
    () => cuartelesEnCarencia(
      aplicaciones.filter((a) => campoActivo === 'TODOS' || a.campo === campoActivo),
      hoyStr,
    ),
    [aplicaciones, campoActivo, hoyStr],
  )

  const detalle = useMemo(
    () => aplicaciones
      .filter((a) => campoActivo === 'TODOS' || a.campo === campoActivo)
      .map((a) => ({ e: estadoCarencia(a, hoyStr), p: productos.find((x) => x.id === a.productoId) }))
      .filter((x) => x.e.vigente)
      .sort((a, b) => b.e.diasParaCosecha - a.e.diasParaCosecha),
    [aplicaciones, productos, campoActivo, hoyStr],
  )

  return (
    <div className="space-y-5">
      <Card className={cn('border-l-4', carencias.length ? 'border-l-red-500' : 'border-l-brand-500')}>
        <div className="flex items-center gap-4 p-4">
          <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                              carencias.length ? 'bg-red-500/12 text-red-600 dark:text-red-400'
                                               : 'bg-brand-500/12 text-brand-600 dark:text-brand-400')}>
            {carencias.length ? <CalendarClock className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              {carencias.length
                ? `${carencias.length} cuartel(es) no se pueden cosechar todavía`
                : 'Ningún cuartel está en carencia'}
            </p>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              Cosechar antes de que venza la carencia invalida la certificación y puede
              significar el rechazo del embarque.
            </p>
          </div>
        </div>
      </Card>

      {carencias.length > 0 && (
        <Card>
          <CardHeader title="Cuarteles bloqueados" subtitle="Manda la carencia que vence más tarde" icon={CalendarClock} />
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Campo</th><th>Cuartel</th><th>Especie</th><th>Variedad</th>
                  <th className="text-right">Aplicaciones</th>
                  <th>Cosechable desde</th><th className="text-right">Faltan</th>
                </tr>
              </thead>
              <tbody>
                {carencias.map((c) => (
                  <tr key={`${c.campo}-${c.cc}`}>
                    <td className="text-[12px] text-ink-faint">{c.campo.replace('_', ' ')}</td>
                    <td className="font-medium text-ink">{c.cc}</td>
                    <td className="text-[12px] text-ink-soft">{c.especie}</td>
                    <td className="text-[12px] text-ink-soft">{c.variedad}</td>
                    <td className="tnum text-right text-ink-soft">{c.aplicaciones}</td>
                    <td className="tnum whitespace-nowrap text-ink">{c.fechaCosecha}</td>
                    <td className="tnum text-right">
                      <Badge tone={c.diasRestantes > 7 ? 'red' : 'amber'}>{c.diasRestantes} días</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Detalle por aplicación" subtitle={`${detalle.length} carencias vigentes`} icon={SprayCan} />
        {detalle.length === 0 ? (
          <Vacio titulo="Sin carencias vigentes" detalle="Todos los cuarteles se pueden cosechar." icon={CheckCircle2} />
        ) : (
          <div className="max-h-[50vh] overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Aplicada</th><th>Cuartel</th><th>Producto</th><th>Plaga</th>
                  <th>Reingreso permitido</th><th>Cosechable desde</th><th className="text-right">Faltan</th>
                </tr>
              </thead>
              <tbody>
                {detalle.map(({ e, p }) => (
                  <tr key={e.aplicacion.id}>
                    <td className="tnum whitespace-nowrap text-ink-soft">{e.aplicacion.fecha}</td>
                    <td className="text-[12px] font-medium text-ink">{e.aplicacion.cc}</td>
                    <td className="max-w-[180px] truncate text-[12px] text-ink" title={p?.nombre}>{p?.nombre}</td>
                    <td className="max-w-[140px] truncate text-[12px] text-ink-faint">{e.aplicacion.plaga}</td>
                    <td className="tnum whitespace-nowrap text-[12px] text-ink-soft">{e.fechaReingreso}</td>
                    <td className="tnum whitespace-nowrap text-ink">{e.fechaCosecha}</td>
                    <td className="tnum text-right text-ink-soft">{e.diasParaCosecha} d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

/* ═══════════════════ Conteo físico ═══════════════════ */

function Conteo() {
  const { productos, bodega, campoActivo, bulkBodega } = useStore()
  const campo = campoActivo === 'TODOS' ? 'LOS_LIRIOS' : campoActivo
  const [fecha, setFecha] = useState(hoy())
  const [contados, setContados] = useState<Record<string, string>>({})
  const [q, setQ] = useState('')

  const filas = useMemo(() => {
    const t = q.trim().toUpperCase()
    return inventario(productos, bodega, campo)
      .filter((f) => f.movimientos > 0)
      .filter((f) => !t || f.producto.nombre.toUpperCase().includes(t))
  }, [productos, bodega, campo, q])

  const conteos = useMemo(() => {
    const nums: Record<string, number> = {}
    for (const [k, v] of Object.entries(contados)) {
      if (v.trim() !== '' && !isNaN(Number(v))) nums[k] = Number(v)
    }
    return compararConteo(productos, bodega, campo, nums, fecha)
  }, [contados, productos, bodega, campo, fecha])

  const conAjuste = conteos.filter((c) => c.ajuste !== 0)

  const aplicar = async () => {
    if (conAjuste.length === 0)
      return alerta.aviso('Sin diferencias', 'Lo contado coincide con el registro. No hay ajuste que hacer.')
    const ok = await alerta.confirmar(
      '¿Aplicar el ajuste por conteo?',
      `Se crearán ${conAjuste.length} movimientos con fecha ${fecha}. El registro quedará igual a lo que hay en bodega.`,
      'Aplicar ajuste',
    )
    if (!ok) return
    bulkBodega(movimientosDeConteo(conAjuste, fecha))
    useStore.getState().auditar('AJUSTE', 'bodega', `Conteo físico en ${campo}: ${conAjuste.length} productos ajustados`)
    setContados({})
    alerta.ok('Conteo aplicado', 'El stock del sistema quedó igual al conteo físico.')
  }

  return (
    <Card>
      <CardHeader
        title={`Conteo físico · ${campo.replace('_', ' ')}`}
        subtitle="Escriba lo contado en bodega. El sistema calcula la diferencia y la registra como ajuste."
        icon={ClipboardCheck}
        actions={
          <>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
                   aria-label="Fecha del conteo" className="input tnum !w-36 !py-1.5 text-[12px]" />
            <SearchInput value={q} onChange={setQ} placeholder="Producto…" className="w-44" />
            <button onClick={aplicar} className="btn-primary !min-h-0 !py-1.5" disabled={conAjuste.length === 0}>
              <ClipboardCheck className="h-4 w-4" />Aplicar ({conAjuste.length})
            </button>
          </>
        }
      />
      {filas.length === 0 ? (
        <Vacio titulo="Sin productos con movimiento en esta bodega" icon={Package} />
      ) : (
        <div className="max-h-[64vh] overflow-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Producto</th><th>UM</th>
                <th className="text-right">Stock según registros</th>
                <th className="w-32 text-right">Contado en bodega</th>
                <th className="text-right">Ajuste</th><th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const c = conteos.find((x) => x.producto.id === f.producto.id)
                return (
                  <tr key={f.producto.id}>
                    <td className="font-medium text-ink">{f.producto.nombre}</td>
                    <td className="text-[12px] text-ink-faint">{f.producto.unidad}</td>
                    <td className={cn('tnum text-right', f.stock < 0 ? 'text-red-500' : 'text-ink-soft')}>
                      {nfmt(f.stock, f.stock % 1 === 0 ? 0 : 2)}
                    </td>
                    <td className="text-right">
                      <input type="number" step={0.01} className="input tnum !w-28 !px-2 !py-1 text-right text-[12px]"
                             value={contados[f.producto.id] ?? ''} placeholder="—"
                             onChange={(e) => setContados({ ...contados, [f.producto.id]: e.target.value })} />
                    </td>
                    <td className={cn('tnum whitespace-nowrap text-right font-medium',
                                      !c ? 'text-ink-faint'
                                      : c.ajuste > 0 ? 'text-brand-600 dark:text-brand-400'
                                      : c.ajuste < 0 ? 'text-accent-600 dark:text-accent-400' : 'text-ink-faint')}>
                      {c ? `${c.ajuste > 0 ? '+' : ''}${nfmt(c.ajuste, 2)}` : '—'}
                    </td>
                    <td>
                      {!c ? <span className="text-[12px] text-ink-faint">Sin contar</span>
                        : c.ajuste === 0 ? <Badge tone="brand"><CheckCircle2 className="h-3 w-3" />Cuadra</Badge>
                        : <Badge tone={c.ajuste > 0 ? 'sky' : 'amber'}>
                            {c.ajuste > 0 ? 'Sobra en bodega' : 'Falta en bodega'}
                          </Badge>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

/* ═══════════════════ Contabilizar ═══════════════════ */

function Contabilizar() {
  const { productos, bodega, asientos, addAsiento, campoActivo, periodoActivo, auditar } = useStore()
  const [previa, setPrevia] = useState<ReturnType<typeof asientoConsumoInsumos> | null>(null)

  const desde = `${periodoActivo}-01`
  const hasta = fechaCierre(periodoActivo)
  const costos = useMemo(
    () => valorizarConsumo(productos, bodega, { campo: campoActivo, desde, hasta }),
    [productos, bodega, campoActivo, desde, hasta],
  )
  const total = suma(costos, (c) => c.monto)

  const generar = () => {
    const yaExiste = asientos.find(
      (a) => a.fecha.startsWith(periodoActivo) && a.glosa.toLowerCase().includes('insumos'),
    )
    if (yaExiste)
      return alerta.aviso('Ya existe un asiento de insumos',
        `El asiento N° ${yaExiste.numero} ya contabiliza el consumo de ${nombrePeriodo(periodoActivo)}.`)
    setPrevia(
      asientoConsumoInsumos(costos, temporadaDe(hasta), {
        numero: siguienteNumero(asientos),
        fecha: hasta,
        glosa: `Consumo de insumos · ${nombrePeriodo(periodoActivo)}`,
      }),
    )
  }

  const confirmar = () => {
    if (!previa) return
    const { id, ...datos } = previa.asiento
    addAsiento(datos)
    auditar('CONTABILIZAR', 'bodega', `Asiento N° ${datos.numero} · ${money(previa.resumen.monto)} en ${previa.resumen.centrosCosto} centros de costo`)
    setPrevia(null)
    alerta.ok('Consumo contabilizado', `N° ${datos.numero} · ${money(previa.resumen.monto)} descargados del inventario.`)
  }

  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Costo a imputar" value={money(total)} icon={Scale} sub={nombrePeriodo(periodoActivo)} />
        <Kpi label="Centros de costo" value={String(new Set(costos.map((c) => c.cc)).size)} icon={Layers} tone="sky" />
        <Kpi label="Agroquímicos" value={money(suma(costos.filter((c) => c.categoria !== 'FERTILIZANTE'), (c) => c.monto))}
             icon={SprayCan} tone="violet" sub="Cuenta N5 AGROQUIMICOS" />
        <Kpi label="Fertilizantes" value={money(suma(costos.filter((c) => c.categoria === 'FERTILIZANTE'), (c) => c.monto))}
             icon={FlaskConical} tone="accent" sub="Cuenta N5 FERTILIZANTES" />
      </div>

      <Card>
        <CardHeader
          title="Consumo valorizado del período"
          subtitle="Descarga el inventario y lleva el costo a cada centro de costo, separando agroquímicos de fertilizantes"
          icon={BookOpenCheck}
          actions={
            <button onClick={generar} className="btn-primary !min-h-0 !py-1.5" disabled={costos.length === 0}>
              <BookOpenCheck className="h-4 w-4" />Contabilizar
            </button>
          }
        />
        {costos.length === 0 ? (
          <Vacio titulo="Sin consumo en el período"
                 detalle={`No hay salidas de bodega en ${nombrePeriodo(periodoActivo)}.`} icon={Package} />
        ) : (
          <div className="max-h-[56vh] overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Centro de costo</th><th>Campo</th><th>Especie</th>
                  <th>Categoría</th><th>Cuenta N5</th><th className="text-right">Costo</th>
                </tr>
              </thead>
              <tbody>
                {costos.map((c, i) => (
                  <tr key={i}>
                    <td className="font-medium text-ink">{c.cc}</td>
                    <td className="text-[12px] text-ink-faint">{c.campo.replace('_', ' ')}</td>
                    <td className="text-[12px] text-ink-soft">{c.especie === '0' ? '—' : c.especie}</td>
                    <td><Badge tone={TONO_CAT[c.categoria]}>{c.categoria}</Badge></td>
                    <td className="font-mono text-[11px] text-brand-700 dark:text-brand-300">
                      {cuentaN5DeCategoria(c.categoria)}
                    </td>
                    <td className="tnum whitespace-nowrap text-right font-medium text-ink">{money(c.monto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-soft font-semibold">
                  <td colSpan={5} className="px-3 py-2 text-ink">Total</td>
                  <td className="tnum px-3 py-2 text-right text-ink">{money(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!previa} onClose={() => setPrevia(null)} wide
        title="Asiento de consumo de insumos"
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
          <div className="max-h-80 overflow-auto rounded-lg border border-hairline">
            <table className="tbl">
              <thead>
                <tr><th>Cuenta</th><th>Glosa</th><th>N5</th><th>N13 CC</th>
                    <th className="text-right">Debe</th><th className="text-right">Haber</th></tr>
              </thead>
              <tbody>
                {previa.asiento.lineas.map((l) => (
                  <tr key={l.id} className={l.haber > 0 ? 'bg-accent-500/[0.06]' : undefined}>
                    <td><code className="tnum font-mono text-[11px] font-semibold text-brand-700 dark:text-brand-300">{l.cuenta}</code></td>
                    <td className="max-w-[240px] truncate text-[12px] text-ink" title={l.glosaLinea}>{l.glosaLinea}</td>
                    <td className="text-[12px] text-ink-soft">{l.n5 ?? '—'}</td>
                    <td className="text-[12px] text-ink-soft">{l.n13 ?? '—'}</td>
                    <td className="tnum whitespace-nowrap text-right font-medium text-ink">{l.debe ? money(l.debe) : ''}</td>
                    <td className="tnum whitespace-nowrap text-right font-medium text-ink">{l.haber ? money(l.haber) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </>
  )
}
