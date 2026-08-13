import { useMemo, useState } from 'react'
import {
  Trophy, Gift, Sparkles, Plus, Medal, TrendingUp, HandCoins, ShieldCheck, Clock, Target,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { MovimientoSemillas } from '@/lib/types'
import {
  Badge, Barra, Card, CardHeader, Field, Kpi, Modal, PageHeader, Select, Tabs, Vacio,
} from '@/components/ui'
import { alerta } from '@/lib/alerta'
import { cn, hoy, minutosAtraso, money, nfmt, nombrePeriodo, suma } from '@/lib/utils'

const TIPOS: MovimientoSemillas['tipo'][] = ['ASISTENCIA', 'PUNTUALIDAD', 'EPP', 'RENDIMIENTO', 'CANJE', 'SANCIÓN']

const ICONO_TIPO: Record<string, any> = {
  ASISTENCIA: Target, PUNTUALIDAD: Clock, EPP: ShieldCheck,
  RENDIMIENTO: TrendingUp, CANJE: Gift, SANCIÓN: HandCoins,
}

export default function Motivacional() {
  const [tab, setTab] = useState('ranking')
  const { trabajadores, premios, semillas, campoActivo } = useStore()

  const dotacion = trabajadores.filter(
    (t) => t.estado.startsWith('ACTIVO') && (campoActivo === 'TODOS' || t.campo === campoActivo),
  )
  const totalSemillas = suma(dotacion, (t) => t.semillas)
  const canjes = semillas.filter((s) => s.tipo === 'CANJE').length
  const valorPremios = suma(premios, (p) => p.stock)

  return (
    <>
      <PageHeader
        titulo="Pack motivacional"
        descripcion="Semillas por asistencia, puntualidad, uso de EPP y rendimiento. Canjeables por premios."
        icon={Trophy}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Semillas en circulación" value={nfmt(totalSemillas, 0)} icon={Sparkles} tone="accent"
             sub={`${dotacion.length} trabajadores participando`} />
        <Kpi label="Promedio por trabajador" value={nfmt(dotacion.length ? totalSemillas / dotacion.length : 0, 0)}
             icon={Medal} sub="Semillas acumuladas" />
        <Kpi label="Canjes realizados" value={String(canjes)} icon={Gift} tone="violet" sub="Histórico" />
        <Kpi label="Premios disponibles" value={String(valorPremios)} icon={Trophy} tone="sky"
             sub={`${premios.length} tipos en catálogo`} />
      </div>

      <div className="mb-4 max-w-lg">
        <Tabs value={tab} onChange={setTab}
              tabs={[{ id: 'ranking', label: 'Ranking', count: dotacion.length },
                     { id: 'premios', label: 'Catálogo', count: premios.length },
                     { id: 'movimientos', label: 'Movimientos', count: semillas.length }]} />
      </div>

      {tab === 'ranking' && <Ranking dotacion={dotacion} />}
      {tab === 'premios' && <Catalogo />}
      {tab === 'movimientos' && <Movimientos />}
    </>
  )
}

/* ═══════════════════ Ranking ═══════════════════ */

function Ranking({ dotacion }: { dotacion: ReturnType<typeof useStore.getState>['trabajadores'] }) {
  const { tarja, premios, canjear, addSemillas, periodoActivo, entregasEpp } = useStore()
  const [modal, setModal] = useState<{ trabajadorId: string } | null>(null)
  const [f, setF] = useState<{ tipo: MovimientoSemillas['tipo']; semillas: number; motivo: string }>({
    tipo: 'ASISTENCIA', semillas: 20, motivo: '',
  })

  const lista = useMemo(() => {
    const delMes = tarja.filter((r) => r.fecha.startsWith(periodoActivo))
    return dotacion
      .map((t) => {
        const mios = delMes.filter((r) => r.trabajadorId === t.id)
        const jornadas = suma(mios, (r) => r.jornadas)
        const faltas = mios.filter((r) => r.tipoDia === 'FALTA_INJUSTIFICADA').length
        const atrasos = mios.filter((r) => minutosAtraso(r.horaLlegada) > 0).length
        const conJornada = mios.filter((r) => r.jornadas > 0).length
        return {
          t, jornadas, faltas, atrasos,
          puntualidad: conJornada > 0 ? 1 - atrasos / conJornada : 1,
          epp: entregasEpp.filter((e) => e.trabajadorId === t.id).length,
        }
      })
      .sort((a, b) => b.t.semillas - a.t.semillas)
  }, [dotacion, tarja, periodoActivo, entregasEpp])

  const max = Math.max(...lista.map((x) => x.t.semillas), 1)

  const otorgar = () => {
    if (!modal) return
    if (!f.motivo.trim()) return alerta.aviso('Falta el motivo', 'Deje constancia de por qué se otorgan las semillas.')
    addSemillas({ fecha: hoy(), trabajadorId: modal.trabajadorId, motivo: f.motivo, semillas: f.semillas, tipo: f.tipo })
    setModal(null)
    setF({ ...f, motivo: '' })
    alerta.ok('Semillas registradas', `${f.semillas > 0 ? '+' : ''}${f.semillas} semillas.`)
  }

  const abrirCanje = async (trabajadorId: string) => {
    const t = dotacion.find((x) => x.id === trabajadorId)!
    const opciones = premios.filter((p) => p.stock > 0)
    if (opciones.length === 0) return alerta.aviso('Sin premios disponibles', 'El catálogo no tiene stock.')
    const { value } = await (await import('sweetalert2')).default.fire({
      customClass: { popup: 'siga-swal' },
      title: `Canje de ${t.nombres}`,
      html: `<p style="font-size:13px;margin-bottom:8px">Dispone de <b>${t.semillas}</b> semillas.</p>`,
      input: 'select',
      inputOptions: Object.fromEntries(
        opciones.map((p) => [p.id, `${p.nombre} — ${p.costoSemillas} semillas (stock ${p.stock})`]),
      ),
      inputPlaceholder: 'Seleccione un premio',
      showCancelButton: true,
      confirmButtonText: 'Canjear',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#15803d',
      cancelButtonColor: '#64748b',
      reverseButtons: true,
    })
    if (!value) return
    const r = canjear(trabajadorId, value as string)
    if (!r.ok) alerta.error('No se pudo canjear', r.msg)
    else alerta.ok('Canje realizado', 'Las semillas fueron descontadas.')
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Ranking de semillas"
          subtitle={`Desempeño de ${nombrePeriodo(useStore.getState().periodoActivo)} — asistencia, puntualidad y EPP`}
          icon={Medal}
        />
        {lista.length === 0 ? (
          <Vacio titulo="Sin participantes" detalle="Incorpore trabajadores activos para iniciar el programa." icon={Trophy} />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="w-10 text-center">#</th><th>Trabajador</th><th>Campo</th>
                  <th className="w-36">Semillas</th><th className="text-right">Total</th>
                  <th className="text-right">Jornadas</th><th className="text-right">Faltas</th>
                  <th className="text-right">Puntualidad</th><th className="text-right">EPP</th>
                  <th className="w-40 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((x, i) => (
                  <tr key={x.t.id}>
                    <td className="text-center">
                      {i < 3 ? (
                        <span className={cn('mx-auto grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold',
                          i === 0 ? 'bg-accent-500/25 text-accent-700 dark:text-accent-300'
                          : i === 1 ? 'bg-ink-faint/20 text-ink-soft'
                          : 'bg-orange-500/18 text-orange-700 dark:text-orange-400')}>
                          {i + 1}
                        </span>
                      ) : <span className="tnum text-[12px] text-ink-faint">{i + 1}</span>}
                    </td>
                    <td className="font-medium text-ink">{x.t.apellidos}, {x.t.nombres}</td>
                    <td className="text-[12px] text-ink-faint">{x.t.campo.replace('_', ' ')}</td>
                    <td><Barra valor={x.t.semillas} max={max} tone="accent" /></td>
                    <td className="tnum text-right font-semibold text-ink">{x.t.semillas}</td>
                    <td className="tnum text-right text-ink-soft">{nfmt(x.jornadas, 1)}</td>
                    <td className="tnum text-right">
                      {x.faltas > 0 ? <span className="font-semibold text-red-500">{x.faltas}</span> : <span className="text-ink-faint">0</span>}
                    </td>
                    <td className="tnum text-right">
                      <Badge tone={x.puntualidad > 0.9 ? 'brand' : x.puntualidad > 0.75 ? 'amber' : 'red'}>
                        {Math.round(x.puntualidad * 100)}%
                      </Badge>
                    </td>
                    <td className="tnum text-right text-ink-soft">{x.epp}</td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setModal({ trabajadorId: x.t.id })}
                                className="btn-ghost !min-h-0 !px-2 !py-1 text-[11px]">
                          <Plus className="h-3 w-3" />Semillas
                        </button>
                        <button onClick={() => abrirCanje(x.t.id)}
                                className="btn-accent !min-h-0 !px-2 !py-1 text-[11px]">
                          <Gift className="h-3 w-3" />Canjear
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!modal} onClose={() => setModal(null)} title="Otorgar o descontar semillas"
             subtitle="Todo movimiento queda registrado con su motivo"
             footer={<><button onClick={() => setModal(null)} className="btn-ghost">Cancelar</button>
                       <button onClick={otorgar} className="btn-primary">Registrar</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo">
            <Select value={f.tipo} onChange={(v) => setF({ ...f, tipo: v as MovimientoSemillas['tipo'] })} options={TIPOS} />
          </Field>
          <Field label="Semillas" hint="Use un número negativo para descontar">
            <input type="number" className="input tnum" value={f.semillas}
                   onChange={(e) => setF({ ...f, semillas: Number(e.target.value) })} />
          </Field>
          <Field label="Motivo" className="sm:col-span-2">
            <input className="input" value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })}
                   placeholder="Ej.: Asistencia perfecta de la semana" />
          </Field>
        </div>
      </Modal>
    </>
  )
}

/* ═══════════════════ Catálogo de premios ═══════════════════ */

function Catalogo() {
  const { premios, addPremio } = useStore()
  const [modal, setModal] = useState(false)
  const [f, setF] = useState({ nombre: '', costoSemillas: 100, stock: 10 })

  const guardar = () => {
    if (!f.nombre.trim()) return alerta.aviso('Falta el nombre del premio')
    addPremio(f)
    setModal(false)
    setF({ nombre: '', costoSemillas: 100, stock: 10 })
    alerta.toast('Premio agregado al catálogo')
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {premios.map((p) => (
          <Card key={p.id} hover className="p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-500/15 text-accent-600 dark:text-accent-400">
                <Gift className="h-5 w-5" />
              </span>
              <Badge tone={p.stock > 5 ? 'brand' : p.stock > 0 ? 'amber' : 'red'}>
                {p.stock > 0 ? `Stock ${p.stock}` : 'Agotado'}
              </Badge>
            </div>
            <p className="mt-3 text-[14px] font-semibold text-ink">{p.nombre}</p>
            <p className="tnum mt-1 flex items-center gap-1.5 text-[13px] text-accent-700 dark:text-accent-400">
              <Sparkles className="h-3.5 w-3.5" />
              {p.costoSemillas} semillas
            </p>
          </Card>
        ))}
        <button onClick={() => setModal(true)}
                className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hairline text-ink-faint transition-colors duration-200 hover:border-brand-500/50 hover:text-brand-600 dark:hover:text-brand-400">
          <Plus className="h-6 w-6" />
          <span className="text-[13px] font-medium">Agregar premio</span>
        </button>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo premio"
             footer={<><button onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
                       <button onClick={guardar} className="btn-primary">Agregar</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre del premio" className="sm:col-span-2">
            <input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })}
                   placeholder="Ej.: Caja de mercadería familiar" />
          </Field>
          <Field label="Costo en semillas">
            <input type="number" min={1} className="input tnum" value={f.costoSemillas}
                   onChange={(e) => setF({ ...f, costoSemillas: Number(e.target.value) })} />
          </Field>
          <Field label="Stock disponible">
            <input type="number" min={0} className="input tnum" value={f.stock}
                   onChange={(e) => setF({ ...f, stock: Number(e.target.value) })} />
          </Field>
        </div>
      </Modal>
    </>
  )
}

/* ═══════════════════ Movimientos ═══════════════════ */

function Movimientos() {
  const { semillas, trabajadores } = useStore()
  const lista = semillas
    .map((s) => ({ s, t: trabajadores.find((x) => x.id === s.trabajadorId) }))
    .filter((x) => x.t)
    .sort((a, b) => b.s.fecha.localeCompare(a.s.fecha))

  return (
    <Card>
      <CardHeader title="Historial de movimientos" subtitle={`${lista.length} registros`} icon={Sparkles} />
      {lista.length === 0 ? (
        <Vacio titulo="Sin movimientos" detalle="Otorgue semillas desde el ranking para iniciar el historial." icon={Sparkles} />
      ) : (
        <div className="max-h-[62vh] overflow-auto">
          <table className="tbl">
            <thead><tr><th>Fecha</th><th>Trabajador</th><th>Tipo</th><th>Motivo</th><th className="text-right">Semillas</th></tr></thead>
            <tbody>
              {lista.map(({ s, t }) => {
                const Icono = ICONO_TIPO[s.tipo] ?? Sparkles
                return (
                  <tr key={s.id}>
                    <td className="tnum whitespace-nowrap text-ink-soft">{s.fecha}</td>
                    <td className="font-medium text-ink">{t!.apellidos}, {t!.nombres}</td>
                    <td>
                      <Badge tone={s.semillas >= 0 ? 'brand' : 'red'}>
                        <Icono className="h-3 w-3" />{s.tipo}
                      </Badge>
                    </td>
                    <td className="text-[12px] text-ink-faint">{s.motivo}</td>
                    <td className={cn('tnum text-right font-semibold',
                                      s.semillas >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-500')}>
                      {s.semillas > 0 ? '+' : ''}{s.semillas}
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
