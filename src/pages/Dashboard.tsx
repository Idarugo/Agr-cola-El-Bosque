import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  LayoutDashboard, Wallet, Sprout, Users, TriangleAlert, ArrowRight, Ruler,
  Scale, CalendarCheck2, HardHat, Clock, Layers, Trophy,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip as RTooltip, XAxis, YAxis, Legend,
} from 'recharts'
import { useStore } from '@/store/useStore'
import { costoPorDimension, distribuir } from '@/lib/motorCostos'
import { BASE_OPERATIVA, superficiePorCampo } from '@/data/maestros'
import { Badge, Card, CardHeader, Kpi, PageHeader, Vacio } from '@/components/ui'
import {
  agrupar, esFinDeSemana, fechasDelMes, minutosAtraso, money, moneyShort,
  nfmt, nombrePeriodo, suma, temporadaDe,
} from '@/lib/utils'

const PALETA = ['#16a34a', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#6366f1']

const ejeTooltip = {
  background: 'rgb(var(--surface-raised))',
  border: '1px solid rgb(var(--hairline))',
  borderRadius: 10,
  fontSize: 12,
  color: 'rgb(var(--ink))',
}

export default function Dashboard() {
  const { trabajadores, tarja, remuneraciones, epp, entregasEpp, charlas, campoActivo, periodoActivo } =
    useStore()

  const campo = campoActivo === 'TODOS' ? undefined : campoActivo
  const temporada = temporadaDe(`${periodoActivo}-15`)

  const res = useMemo(
    () => distribuir(trabajadores, tarja, remuneraciones, { periodo: periodoActivo, campo }),
    [trabajadores, tarja, remuneraciones, periodoActivo, campo],
  )

  const dotacion = trabajadores.filter(
    (t) => t.estado.startsWith('ACTIVO') && (!campo || t.campo === campo),
  )

  const delMes = tarja.filter((r) => r.fecha.startsWith(periodoActivo) && (!campo || r.campo === campo))

  /* Superficie y costo por hectárea */
  const superficie = useMemo(() => {
    const acc = superficiePorCampo(temporada)
    if (campo) return acc.get(campo)?.has ?? 0
    return [...acc.values()].reduce((a, x) => a + x.has, 0)
  }, [temporada, campo])

  const costoHa = superficie > 0 ? res.totalDistribuido / superficie : 0
  const costoJornada = res.jornadasTotales > 0 ? res.totalDistribuido / res.jornadasTotales : 0

  /* Serie diaria de jornadas */
  const serieDiaria = useMemo(() => {
    const fechas = fechasDelMes(periodoActivo)
    const porFecha = agrupar(delMes, (r) => r.fecha)
    return fechas.map((f) => {
      const rs = porFecha.get(f) ?? []
      return {
        dia: f.slice(-2),
        jornadas: Math.round(suma(rs, (r) => r.jornadas) * 10) / 10,
        ausencias: rs.filter((r) => ['FALTA_INJUSTIFICADA', 'FALTA_JUSTIFICADA', 'LICENCIA'].includes(r.tipoDia)).length,
        finde: esFinDeSemana(f),
      }
    })
  }, [delMes, periodoActivo])

  const porLabor = useMemo(() => costoPorDimension(res.lineas, 'n6').slice(0, 7), [res.lineas])
  const porEspecie = useMemo(
    () => costoPorDimension(res.lineas, 'n9').filter((x) => x.nombre !== '0').slice(0, 6),
    [res.lineas],
  )
  const topCC = useMemo(() => {
    const has = new Map<string, number>()
    for (const c of BASE_OPERATIVA) {
      if (c.temporada !== temporada) continue
      if (campo && c.campo !== campo) continue
      has.set(c.cce, (has.get(c.cce) ?? 0) + c.hectareas)
    }
    return costoPorDimension(res.lineas, 'n13')
      .map((x) => ({ ...x, has: has.get(x.nombre) ?? 0 }))
      .map((x) => ({ ...x, costoHa: x.has > 0 ? x.monto / x.has : 0 }))
      .filter((x) => x.has > 0)
      .sort((a, b) => b.costoHa - a.costoHa)
      .slice(0, 8)
  }, [res.lineas, temporada, campo])

  /* Alertas operativas */
  const eppBajo = epp.filter((e) => e.stock <= e.stockMinimo)
  const faltasInj = delMes.filter((r) => r.tipoDia === 'FALTA_INJUSTIFICADA').length
  const atrasos = delMes.filter((r) => minutosAtraso(r.horaLlegada) > 0).length
  const sinFirma = entregasEpp.filter((e) => !e.firmado).length
  const charlasMes = charlas.filter((c) => c.fecha.startsWith(periodoActivo) && (!campo || c.campo === campo)).length
  const remCargadas = remuneraciones.filter((r) => r.periodo === periodoActivo).length

  const alertas = [
    eppBajo.length > 0 && { txt: `${eppBajo.length} elementos de EPP bajo stock mínimo`, to: '/prevencion', tono: 'red' },
    res.advertencias.length > 0 && { txt: `${res.advertencias.length} observaciones antes de cerrar el mes`, to: '/costos', tono: 'amber' },
    faltasInj > 0 && { txt: `${faltasInj} faltas injustificadas en el período`, to: '/tarja', tono: 'amber' },
    sinFirma > 0 && { txt: `${sinFirma} entregas de EPP sin firma de respaldo`, to: '/prevencion', tono: 'amber' },
    remCargadas === 0 && { txt: 'Sin libro de remuneraciones cargado — se usa devengo teórico', to: '/costos', tono: 'sky' },
    charlasMes < 10 && { txt: `Sólo ${charlasMes} charlas de seguridad registradas este mes`, to: '/prevencion', tono: 'sky' },
  ].filter(Boolean) as { txt: string; to: string; tono: string }[]

  return (
    <>
      <PageHeader
        titulo="Panel de gestión"
        descripcion={`${nombrePeriodo(periodoActivo)} · temporada ${temporada} · ${campoActivo === 'TODOS' ? 'consolidado de los 4 campos' : campoActivo.replace('_', ' ')}`}
        icon={LayoutDashboard}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Costo mano de obra" value={money(res.totalDistribuido)} icon={Wallet}
             sub={res.base === 'LIBRO' ? 'Base libro de remuneraciones' : 'Base devengo teórico'} />
        <Kpi label="Costo por jornada" value={money(costoJornada)} icon={Scale} tone="accent"
             sub={`${nfmt(res.jornadasTotales, 0)} jornadas efectivas`} />
        <Kpi label="Costo por hectárea" value={money(costoHa)} icon={Ruler} tone="sky"
             sub={`${nfmt(superficie, 1)} ha en producción`} />
        <Kpi label="Dotación activa" value={String(dotacion.length)} icon={Users} tone="violet"
             sub={`${trabajadores.length} en el maestro`} />
      </div>

      {alertas.length > 0 && (
        <Card className="mb-5">
          <CardHeader title="Requiere su atención" subtitle="Puntos de control detectados automáticamente" icon={TriangleAlert} />
          <ul className="divide-y divide-hairline/60">
            {alertas.map((a, i) => (
              <li key={i}>
                <Link to={a.to}
                      className="group flex items-center gap-3 px-4 py-2.5 transition-colors duration-200 hover:bg-brand-500/[0.05]">
                  <Badge tone={a.tono}>{a.tono === 'red' ? 'Crítico' : a.tono === 'amber' ? 'Revisar' : 'Info'}</Badge>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">{a.txt}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand-500" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Actividad diaria del mes" subtitle="Jornadas efectivas y ausencias por día" icon={CalendarCheck2} />
          <div className="p-4">
            {delMes.length === 0 ? (
              <Vacio titulo="Sin movimientos" detalle="Registre jornadas en la Tarja digital." />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={serieDiaria} margin={{ left: -14, right: 8, top: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gJor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="dia" stroke="rgb(var(--ink-faint))" fontSize={11} tickLine={false} axisLine={false} interval={1} />
                  <YAxis stroke="rgb(var(--ink-faint))" fontSize={11} tickLine={false} axisLine={false} />
                  <RTooltip contentStyle={ejeTooltip} labelFormatter={(l) => `Día ${l}`} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                  <Area type="monotone" dataKey="jornadas" name="Jornadas" stroke="#16a34a" strokeWidth={2} fill="url(#gJor)" />
                  <Area type="monotone" dataKey="ausencias" name="Ausencias" stroke="#f59e0b" strokeWidth={1.5} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Costo por labor" subtitle="Nivel N6 del plan de cuentas" icon={Layers} />
          <div className="p-4">
            {porLabor.length === 0 ? (
              <Vacio titulo="Sin datos" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie data={porLabor} dataKey="monto" nameKey="nombre" innerRadius={48} outerRadius={78} paddingAngle={2} strokeWidth={0}>
                      {porLabor.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
                    </Pie>
                    <RTooltip contentStyle={ejeTooltip} formatter={(v: number) => money(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="mt-2 space-y-1">
                  {porLabor.map((l, i) => (
                    <li key={l.nombre} className="flex items-center gap-2 text-[12px]">
                      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: PALETA[i % PALETA.length] }} />
                      <span className="min-w-0 flex-1 truncate text-ink-soft">{l.nombre}</span>
                      <span className="tnum shrink-0 font-medium text-ink">{moneyShort(l.monto)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Costo por hectárea" subtitle="Ranking de centros de costo — el indicador que pidió gerencia" icon={Ruler} />
          <div className="p-4">
            {topCC.length === 0 ? (
              <Vacio titulo="Sin superficie asociada" detalle="Los centros de costo del período no tienen hectáreas cargadas en la temporada." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topCC.map((x) => ({ ...x, corto: x.nombre.slice(0, 14) }))}
                          margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                  <XAxis dataKey="corto" stroke="rgb(var(--ink-faint))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={moneyShort} stroke="rgb(var(--ink-faint))" fontSize={11} tickLine={false} axisLine={false} />
                  <RTooltip contentStyle={ejeTooltip} cursor={{ fill: 'rgb(var(--ink) / 0.05)' }}
                            formatter={(v: number, n) => [n === 'costoHa' ? money(v) + '/ha' : money(v), n === 'costoHa' ? 'Costo por hectárea' : 'Costo total']}
                            labelFormatter={(_, p) => p?.[0]?.payload?.nombre ?? ''} />
                  <Bar dataKey="costoHa" radius={[4, 4, 0, 0]}>
                    {topCC.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Indicadores operativos" icon={HardHat} />
          <ul className="divide-y divide-hairline/60">
            {[
              { l: 'Atrasos registrados', v: String(atrasos), i: Clock, t: atrasos > 20 ? 'amber' : 'brand' },
              { l: 'Faltas injustificadas', v: String(faltasInj), i: TriangleAlert, t: faltasInj > 0 ? 'red' : 'brand' },
              { l: 'Charlas de seguridad', v: String(charlasMes), i: HardHat, t: charlasMes >= 15 ? 'brand' : 'amber' },
              { l: 'Fines de semana efectivos', v: String(delMes.filter((r) => esFinDeSemana(r.fecha) && r.jornadas > 0).length), i: CalendarCheck2, t: 'sky' },
              { l: 'Semillas acumuladas', v: nfmt(suma(dotacion, (t) => t.semillas), 0), i: Trophy, t: 'accent' },
              { l: 'Superficie gestionada', v: `${nfmt(superficie, 1)} ha`, i: Sprout, t: 'brand' },
            ].map((x) => (
              <li key={x.l} className="flex items-center gap-3 px-4 py-2.5">
                <x.i className="h-4 w-4 shrink-0 text-ink-faint" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">{x.l}</span>
                <Badge tone={x.t}>{x.v}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        {porEspecie.length > 0 && (
          <Card className="xl:col-span-3">
            <CardHeader title="Costo de mano de obra por especie" subtitle="Nivel N9 — permite comparar duraznos, cerezos, viñas y nogales" icon={Sprout} />
            <div className="p-4">
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={porEspecie} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                  <XAxis dataKey="nombre" stroke="rgb(var(--ink-faint))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={moneyShort} stroke="rgb(var(--ink-faint))" fontSize={11} tickLine={false} axisLine={false} />
                  <RTooltip contentStyle={ejeTooltip} cursor={{ fill: 'rgb(var(--ink) / 0.05)' }} formatter={(v: number) => [money(v), 'Costo']} />
                  <Bar dataKey="monto" radius={[4, 4, 0, 0]}>
                    {porEspecie.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </>
  )
}
