import { useMemo, useState } from 'react'
import {
  Calculator, PlayCircle, FileDown, AlertTriangle, BookOpenCheck, Scale,
  Layers, Wallet, Upload, CheckCircle2, Landmark,
} from 'lucide-react'
import {
  Bar, BarChart, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts'
import { useStore } from '@/store/useStore'
import { costoPorDimension, distribuir } from '@/lib/motorCostos'
import type { ImputacionContable, LineaCosto } from '@/lib/types'
import {
  Badge, Card, CardHeader, Kpi, Modal, PageHeader, Select, Tabs, Vacio,
} from '@/components/ui'
import { alerta } from '@/lib/alerta'
import { exportarAsiento, exportarNomina, exportarPlanillaContador } from '@/lib/excel'
import { asientoDeRemuneraciones, fechaCierre } from '@/lib/puenteContable'
import { siguienteNumero } from '@/lib/contabilidad'
import { cn, diasDelMes, money, moneyShort, nfmt, nombrePeriodo, suma } from '@/lib/utils'

const DIMENSIONES: { key: keyof ImputacionContable; label: string; nivel: string }[] = [
  { key: 'n13', label: 'Centro de costo', nivel: 'N13' },
  { key: 'n6', label: 'Labor general', nivel: 'N6' },
  { key: 'n7', label: 'Labor específica', nivel: 'N7' },
  { key: 'n9', label: 'Especie', nivel: 'N9' },
  { key: 'n10', label: 'Variedad', nivel: 'N10' },
  { key: 'n11', label: 'Campo', nivel: 'N11' },
  { key: 'n4', label: 'Cuenta contable', nivel: 'N4' },
  { key: 'n8', label: 'Etapa planta', nivel: 'N8' },
]

const PALETA = ['#16a34a', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#6366f1']

export default function Costos() {
  const { trabajadores, tarja, remuneraciones, campoActivo, periodoActivo, asientos, addAsiento, auditar } =
    useStore()
  const [modo, setModo] = useState<'AUTO' | 'LIBRO' | 'DEVENGO'>('AUTO')
  const [dim, setDim] = useState<keyof ImputacionContable>('n13')
  const [tab, setTab] = useState('resumen')
  const [verAdv, setVerAdv] = useState(false)
  const [previaAsiento, setPreviaAsiento] = useState<ReturnType<typeof asientoDeRemuneraciones> | null>(null)

  const resultado = useMemo(
    () =>
      distribuir(trabajadores, tarja, remuneraciones, {
        periodo: periodoActivo,
        campo: campoActivo === 'TODOS' ? undefined : campoActivo,
        base: modo,
      }),
    [trabajadores, tarja, remuneraciones, periodoActivo, campoActivo, modo],
  )

  const { lineas, advertencias } = resultado
  const agregado = useMemo(() => costoPorDimension(lineas, dim), [lineas, dim])
  const grafico = agregado.slice(0, 12).map((x, i) => ({
    nombre: x.nombre.length > 18 ? x.nombre.slice(0, 17) + '…' : x.nombre,
    completo: x.nombre,
    monto: x.monto,
    fill: PALETA[i % PALETA.length],
  }))

  const conLibro = remuneraciones.filter((r) => r.periodo === periodoActivo).length
  const costoJornada = resultado.jornadasTotales > 0 ? resultado.totalDistribuido / resultado.jornadasTotales : 0

  const exportar = async (tipo: 'asiento' | 'contador' | 'nomina') => {
    if (lineas.length === 0) return alerta.aviso('Nada que exportar', 'No hay líneas de costo en el período.')
    alerta.cargando('Generando archivo…')
    try {
      if (tipo === 'asiento') exportarAsiento(resultado)
      if (tipo === 'contador') exportarPlanillaContador(resultado, trabajadores, tarja, remuneraciones)
      if (tipo === 'nomina') exportarNomina(trabajadores, remuneraciones, periodoActivo, campoActivo)
      alerta.cerrar()
      alerta.toast('Archivo descargado')
    } catch (e) {
      alerta.cerrar()
      alerta.error('No se pudo generar el archivo', String(e))
    }
  }

  const contabilizar = () => {
    const yaExiste = asientos.find(
      (a) =>
        a.origen === 'REMUNERACIONES' &&
        a.fecha.startsWith(periodoActivo) &&
        a.glosa.includes(campoActivo === 'TODOS' ? 'todos los campos' : campoActivo.replace('_', ' ')),
    )
    if (yaExiste) {
      alerta.aviso(
        'Ya existe un asiento para este período',
        `El asiento N° ${yaExiste.numero} ya contabiliza las remuneraciones de ${nombrePeriodo(periodoActivo)}. Elimínelo en Contabilidad si desea regenerarlo.`,
      )
      return
    }
    const campoGlosa = campoActivo === 'TODOS' ? 'todos los campos' : campoActivo.replace('_', ' ')
    setPreviaAsiento(
      asientoDeRemuneraciones(resultado, trabajadores, remuneraciones, {
        numero: siguienteNumero(asientos),
        fecha: fechaCierre(periodoActivo),
        glosa: `Remuneraciones ${campoGlosa} · ${nombrePeriodo(periodoActivo)}`,
      }),
    )
  }

  const confirmarContabilizacion = () => {
    if (!previaAsiento) return
    const { id, ...datos } = previaAsiento.asiento
    addAsiento(datos)
    auditar('CONTABILIZAR', 'costos', `Asiento N° ${datos.numero} · ${datos.glosa} · ${money(previaAsiento.resumen.costoTotal)}`)
    setPreviaAsiento(null)
    alerta.ok(
      'Asiento contabilizado',
      `N° ${datos.numero} · ${datos.lineas.length} líneas · ${money(previaAsiento.resumen.costoTotal)}. Ya aparece en el Libro Diario, Mayor y Balance.`,
    )
  }

  return (
    <>
      <PageHeader
        titulo="Costos y cierre mensual"
        descripcion={`${nombrePeriodo(periodoActivo)} · ${resultado.diasMes} días · ${campoActivo === 'TODOS' ? 'todos los campos' : campoActivo.replace('_', ' ')}`}
        icon={Calculator}
      >
        <Select
          value={modo}
          onChange={(v) => setModo(v as typeof modo)}
          options={[
            { value: 'AUTO', label: 'Base automática' },
            { value: 'LIBRO', label: 'Forzar libro de remuneraciones' },
            { value: 'DEVENGO', label: 'Forzar devengo teórico' },
          ]}
          className="w-60"
        />
        <button onClick={() => exportar('asiento')} className="btn-ghost">
          <FileDown className="h-4 w-4" />Exportar
        </button>
        <button onClick={contabilizar} className="btn-primary" disabled={lineas.length === 0}>
          <BookOpenCheck className="h-4 w-4" />Contabilizar
        </button>
      </PageHeader>

      {/* Estado de la base de cálculo */}
      <Card className={cn('mb-5 border-l-4', resultado.base === 'LIBRO' ? 'border-l-brand-500' : 'border-l-accent-500')}>
        <div className="flex flex-wrap items-center gap-4 p-4">
          <span className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
            resultado.base === 'LIBRO' ? 'bg-brand-500/12 text-brand-600 dark:text-brand-400' : 'bg-accent-500/15 text-accent-600 dark:text-accent-400',
          )}>
            {resultado.base === 'LIBRO' ? <BookOpenCheck className="h-5 w-5" /> : <Scale className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">
              {resultado.base === 'LIBRO'
                ? 'Base real — libro de remuneraciones'
                : 'Base teórica — devengo sobre sueldo base'}
            </p>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              {resultado.base === 'LIBRO'
                ? <>Se reparte <strong>total haber − asignación familiar</strong> según las jornadas efectivas. Este es el número que cuadra con contabilidad.</>
                : <>Se reparte <strong>sueldo base ÷ 30 × {resultado.diasMes} días</strong>. Cargue el libro de remuneraciones para cuadrar con el contador.</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={conLibro > 0 ? 'brand' : 'amber'}>
              {conLibro} liquidación(es) cargada(s)
            </Badge>
            {advertencias.length > 0 && (
              <button onClick={() => setVerAdv(true)} className="btn-ghost !border-accent-500/40 !text-accent-700 dark:!text-accent-400">
                <AlertTriangle className="h-4 w-4" />
                {advertencias.length} alerta(s)
              </button>
            )}
          </div>
        </div>
      </Card>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Costo mano de obra" value={money(resultado.totalDistribuido)} icon={Wallet}
             sub={`${lineas.length} líneas de imputación`} />
        <Kpi label="Jornadas repartidas" value={nfmt(resultado.jornadasTotales, 1)} icon={Layers} tone="sky"
             sub={`${resultado.trabajadores} trabajadores`} />
        <Kpi label="Costo real por jornada" value={money(costoJornada)} icon={Scale} tone="accent"
             sub="El dato que pidió gerencia" />
        <Kpi label="Advertencias de control" value={String(advertencias.length)} icon={AlertTriangle}
             tone={advertencias.length ? 'red' : 'brand'} sub={advertencias.length ? 'Revisar antes de cerrar' : 'Sin observaciones'} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onChange={setTab}
              tabs={[{ id: 'resumen', label: 'Análisis por dimensión' },
                     { id: 'detalle', label: 'Detalle del asiento', count: lineas.length },
                     { id: 'libro', label: 'Libro de remuneraciones', count: conLibro }]} />
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={() => exportar('contador')} className="btn-ghost">
            <Upload className="h-4 w-4" />Planilla para el contador
          </button>
          <button onClick={() => exportar('nomina')} className="btn-ghost">
            <Landmark className="h-4 w-4" />Nómina bancaria
          </button>
        </div>
      </div>

      {lineas.length === 0 ? (
        <Card>
          <Vacio
            titulo="Sin costos para este período"
            detalle="Registre jornadas en la Tarja digital y vuelva a ejecutar el cierre."
            icon={PlayCircle}
          />
        </Card>
      ) : tab === 'resumen' ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
          <Card>
            <CardHeader
              title="Distribución del costo"
              subtitle="Las 13 dimensiones permiten mirar el mismo peso desde cualquier ángulo"
              icon={Layers}
              actions={
                <Select
                  value={dim as string}
                  onChange={(v) => setDim(v as keyof ImputacionContable)}
                  options={DIMENSIONES.map((d) => ({ value: d.key as string, label: `${d.nivel} · ${d.label}` }))}
                  className="w-56"
                />
              }
            />
            <div className="p-4">
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={grafico} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <XAxis type="number" tickFormatter={moneyShort} stroke="rgb(var(--ink-faint))"
                         fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="nombre" width={130} stroke="rgb(var(--ink-faint))"
                         fontSize={11} tickLine={false} axisLine={false} />
                  <RTooltip
                    cursor={{ fill: 'rgb(var(--ink) / 0.05)' }}
                    contentStyle={{
                      background: 'rgb(var(--surface-raised))',
                      border: '1px solid rgb(var(--hairline))',
                      borderRadius: 10, fontSize: 12, color: 'rgb(var(--ink))',
                    }}
                    formatter={(v: number) => [money(v), 'Costo']}
                    labelFormatter={(_, p) => p?.[0]?.payload?.completo ?? ''}
                  />
                  <Bar dataKey="monto" radius={[0, 4, 4, 0]}>
                    {grafico.map((g, i) => <Cell key={i} fill={g.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title="Ranking" subtitle={`Por ${DIMENSIONES.find((d) => d.key === dim)?.label.toLowerCase()}`} icon={Scale} />
            <div className="max-h-[380px] overflow-y-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th className="text-right">Jorn.</th>
                    <th className="text-right">Costo</th>
                    <th className="text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {agregado.map((a) => (
                    <tr key={a.nombre}>
                      <td className="max-w-[160px] truncate text-ink" title={a.nombre}>{a.nombre}</td>
                      <td className="tnum text-right text-ink-soft">{nfmt(a.jornadas, 1)}</td>
                      <td className="tnum whitespace-nowrap text-right font-medium text-ink">{money(a.monto)}</td>
                      <td className="tnum text-right text-ink-faint">
                        {((a.monto / resultado.totalDistribuido) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-soft font-semibold">
                    <td className="px-3 py-2 text-ink">Total</td>
                    <td className="tnum px-3 py-2 text-right text-ink">{nfmt(resultado.jornadasTotales, 1)}</td>
                    <td className="tnum px-3 py-2 text-right text-ink">{money(resultado.totalDistribuido)}</td>
                    <td className="tnum px-3 py-2 text-right text-ink">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>
      ) : tab === 'detalle' ? (
        <DetalleAsiento lineas={lineas} />
      ) : (
        <LibroRemuneraciones />
      )}

      {/* Previsualización del asiento contable */}
      <Modal
        open={!!previaAsiento} onClose={() => setPreviaAsiento(null)} wide
        title="Asiento de remuneraciones"
        subtitle="Así quedará registrado en el Libro Diario. Revíselo antes de confirmar."
        footer={
          <>
            <span className="mr-auto flex items-center gap-2 text-[13px] font-medium text-brand-600 dark:text-brand-400">
              <CheckCircle2 className="h-4 w-4" />
              Debe = Haber = {money(previaAsiento?.resumen.costoTotal ?? 0)}
            </span>
            <button onClick={() => setPreviaAsiento(null)} className="btn-ghost">Cancelar</button>
            <button onClick={confirmarContabilizacion} className="btn-primary">
              <BookOpenCheck className="h-4 w-4" />Contabilizar asiento
            </button>
          </>
        }
      >
        {previaAsiento && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Costo al debe" value={money(previaAsiento.resumen.costoTotal)} icon={Wallet}
                   sub={`${previaAsiento.asiento.lineas.filter((l) => l.debe > 0).length} líneas de costo`} />
              <Kpi label="Leyes sociales" value={money(previaAsiento.resumen.leyesSociales)} icon={Landmark} tone="sky" />
              <Kpi label="Anticipos" value={money(previaAsiento.resumen.anticipos)} icon={Upload} tone="accent" />
              <Kpi label="Líquido por pagar" value={money(previaAsiento.resumen.liquido)} icon={CheckCircle2} tone="brand" />
            </div>

            {previaAsiento.advertencias.length > 0 && (
              <div className="rounded-lg border border-accent-500/25 bg-accent-500/6 p-3">
                <p className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-accent-700 dark:text-accent-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {previaAsiento.advertencias.length} observación(es)
                </p>
                <ul className="space-y-1">
                  {previaAsiento.advertencias.slice(0, 5).map((a, i) => (
                    <li key={i} className="text-[12px] text-ink-soft">· {a}</li>
                  ))}
                  {previaAsiento.advertencias.length > 5 && (
                    <li className="text-[12px] text-ink-faint">
                      … y {previaAsiento.advertencias.length - 5} más
                    </li>
                  )}
                </ul>
              </div>
            )}

            <div className="max-h-80 overflow-auto rounded-lg border border-hairline">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Cuenta</th><th>Glosa de línea</th><th>N6 Labor</th><th>N13 CC</th>
                    <th className="text-right">Debe</th><th className="text-right">Haber</th>
                  </tr>
                </thead>
                <tbody>
                  {previaAsiento.asiento.lineas.map((l) => (
                    <tr key={l.id} className={l.haber > 0 ? 'bg-accent-500/[0.06]' : undefined}>
                      <td><code className="tnum font-mono text-[11px] font-semibold text-brand-700 dark:text-brand-300">{l.cuenta}</code></td>
                      <td className="max-w-[220px] truncate text-[12px] text-ink" title={l.glosaLinea}>{l.glosaLinea}</td>
                      <td className="text-[12px] text-ink-soft">{l.n6 ?? '—'}</td>
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

      <Modal
        open={verAdv} onClose={() => setVerAdv(false)} wide
        title="Alertas de control interno"
        subtitle="Revíselas antes de enviar la información al contador"
        footer={<button onClick={() => setVerAdv(false)} className="btn-ghost">Cerrar</button>}
      >
        <ul className="space-y-2">
          {advertencias.map((a, i) => (
            <li key={i} className="flex items-start gap-2.5 rounded-lg border border-accent-500/25 bg-accent-500/6 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-600 dark:text-accent-400" />
              <span className="text-[13px] text-ink-soft">{a}</span>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  )
}

/* ═══════════════════ Detalle del asiento ═══════════════════ */

function DetalleAsiento({ lineas }: { lineas: LineaCosto[] }) {
  const [pagina, setPagina] = useState(0)
  const porPagina = 60
  const paginas = Math.ceil(lineas.length / porPagina)
  const vista = lineas.slice(pagina * porPagina, (pagina + 1) * porPagina)

  return (
    <Card>
      <CardHeader
        title="Asiento de distribución de mano de obra"
        subtitle={`${lineas.length} líneas · cada una lleva las 13 dimensiones del plan de cuentas`}
        icon={BookOpenCheck}
        actions={
          paginas > 1 ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setPagina((p) => Math.max(0, p - 1))} disabled={pagina === 0} className="btn-ghost !min-h-0 !px-2 !py-1 text-xs">Anterior</button>
              <span className="tnum text-xs text-ink-faint">{pagina + 1} / {paginas}</span>
              <button onClick={() => setPagina((p) => Math.min(paginas - 1, p + 1))} disabled={pagina >= paginas - 1} className="btn-ghost !min-h-0 !px-2 !py-1 text-xs">Siguiente</button>
            </div>
          ) : undefined
        }
      />
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Código de cuenta (N1–N13)</th>
              <th>Trabajador</th>
              <th>Cargo</th>
              <th>N6 Labor</th>
              <th>N7 Específica</th>
              <th>N9 Especie</th>
              <th>N13 CC</th>
              <th className="text-right">Jorn.</th>
              <th className="text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {vista.map((l) => (
              <tr key={l.id}>
                <td>
                  <code className="tnum whitespace-nowrap font-mono text-[11px] text-brand-700 dark:text-brand-300">
                    {l.codigoCuenta}
                  </code>
                </td>
                <td className="max-w-[150px] truncate text-ink" title={l.trabajador}>{l.trabajador}</td>
                <td className="max-w-[130px] truncate text-[12px] text-ink-faint" title={l.cargo}>{l.cargo}</td>
                <td className="text-[12px] text-ink-soft">{l.imputacion.n6}</td>
                <td className="max-w-[130px] truncate text-[12px] text-ink-faint" title={l.imputacion.n7}>{l.imputacion.n7}</td>
                <td className="text-[12px] text-ink-soft">{l.imputacion.n9}</td>
                <td className="text-[12px] text-ink-soft">{l.imputacion.n13}</td>
                <td className="tnum text-right text-ink-soft">{nfmt(l.jornadas, 2)}</td>
                <td className="tnum whitespace-nowrap text-right font-medium text-ink">{money(l.monto)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-soft font-semibold">
              <td colSpan={7} className="px-3 py-2 text-ink">Total del asiento</td>
              <td className="tnum px-3 py-2 text-right text-ink">{nfmt(suma(lineas, (l) => l.jornadas), 1)}</td>
              <td className="tnum px-3 py-2 text-right text-ink">{money(suma(lineas, (l) => l.monto))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}

/* ═══════════════════ Libro de remuneraciones ═══════════════════ */

function LibroRemuneraciones() {
  const { trabajadores, remuneraciones, periodoActivo, campoActivo, upsertRemuneracion } = useStore()

  const filas = useMemo(() => {
    return trabajadores
      .filter((t) => campoActivo === 'TODOS' || t.campo === campoActivo)
      .filter((t) => t.estado !== 'FINIQUITADO')
      .map((t) => ({
        t,
        r: remuneraciones.find((x) => x.periodo === periodoActivo && x.trabajadorId === t.id),
      }))
      .sort((a, b) => a.t.apellidos.localeCompare(b.t.apellidos))
  }, [trabajadores, remuneraciones, periodoActivo, campoActivo])

  const cargadas = filas.filter((f) => f.r).length
  const totalHaber = suma(filas, (f) => f.r?.totalHaber ?? 0)
  const totalLiquido = suma(filas, (f) => f.r?.liquido ?? 0)

  const editar = (trabajadorId: string, campo: 'totalHaber' | 'asignacionFamiliar' | 'liquido' | 'anticipo', valor: number) => {
    const actual = remuneraciones.find((x) => x.periodo === periodoActivo && x.trabajadorId === trabajadorId)
    upsertRemuneracion({
      ...(actual ?? {
        periodo: periodoActivo, trabajadorId, totalHaber: 0, asignacionFamiliar: 0,
        totalDescuentos: 0, liquido: 0, costoEmpresa: 0, anticipo: 0,
      }),
      [campo]: valor,
    })
  }

  return (
    <Card>
      <CardHeader
        title="Libro de remuneraciones"
        subtitle={`${cargadas} de ${filas.length} liquidaciones · esta es la base real que reparte el motor`}
        icon={BookOpenCheck}
        actions={
          <Badge tone={cargadas === filas.length ? 'brand' : 'amber'}>
            {cargadas === filas.length ? <><CheckCircle2 className="h-3 w-3" />Completo</> : `Faltan ${filas.length - cargadas}`}
          </Badge>
        }
      />
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Trabajador</th>
              <th>RUT</th>
              <th className="text-right">Total haber</th>
              <th className="text-right">Asig. familiar</th>
              <th className="text-right">Base a repartir</th>
              <th className="text-right">Anticipo</th>
              <th className="text-right">Líquido</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ t, r }) => {
              const base = (r?.totalHaber ?? 0) - (r?.asignacionFamiliar ?? 0)
              return (
                <tr key={t.id}>
                  <td className="font-medium text-ink">{t.apellidos}, {t.nombres}</td>
                  <td className="tnum font-mono text-[12px] text-ink-soft">{t.rut}</td>
                  <td className="text-right">
                    <input type="number" value={r?.totalHaber ?? ''} placeholder="0"
                           onChange={(e) => editar(t.id, 'totalHaber', Number(e.target.value))}
                           className="input tnum !w-28 !px-2 !py-1 text-right text-[12px]" />
                  </td>
                  <td className="text-right">
                    <input type="number" value={r?.asignacionFamiliar ?? ''} placeholder="0"
                           onChange={(e) => editar(t.id, 'asignacionFamiliar', Number(e.target.value))}
                           className="input tnum !w-24 !px-2 !py-1 text-right text-[12px]" />
                  </td>
                  <td className="tnum whitespace-nowrap text-right font-semibold text-brand-700 dark:text-brand-300">
                    {base > 0 ? money(base) : '—'}
                  </td>
                  <td className="text-right">
                    <input type="number" value={r?.anticipo ?? ''} placeholder="0"
                           onChange={(e) => editar(t.id, 'anticipo', Number(e.target.value))}
                           className="input tnum !w-24 !px-2 !py-1 text-right text-[12px]" />
                  </td>
                  <td className="text-right">
                    <input type="number" value={r?.liquido ?? ''} placeholder="0"
                           onChange={(e) => editar(t.id, 'liquido', Number(e.target.value))}
                           className="input tnum !w-28 !px-2 !py-1 text-right text-[12px]" />
                  </td>
                  <td><Badge tone={r ? 'brand' : 'slate'}>{r ? 'Cargada' : 'Pendiente'}</Badge></td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-surface-soft font-semibold">
              <td colSpan={2} className="px-3 py-2 text-ink">Totales</td>
              <td className="tnum px-3 py-2 text-right text-ink">{money(totalHaber)}</td>
              <td colSpan={3} />
              <td className="tnum px-3 py-2 text-right text-ink">{money(totalLiquido)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}
