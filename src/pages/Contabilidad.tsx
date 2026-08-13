import { useMemo, useState } from 'react'
import {
  BookOpen, BookOpenCheck, Scale, FileBarChart, Landmark, Plus, Trash2, CheckCircle2,
  XCircle, ChevronRight, ChevronDown, Settings2, FileDown, Layers, TrendingUp,
  TrendingDown, AlertTriangle, ListTree, Building2,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import {
  balance8Columnas, balanceGeneral, construirMayor, controlarAsientos,
  estadoResultados, estaCuadrado, saldoNetoBalance, siguienteNumero,
  totalDebe, totalHaber, totalesBalance8,
} from '@/lib/contabilidad'
import { PLAN_ORDENADO, cuentaFin, financieraDeN4 } from '@/data/planFinanciero'
import { LABORES, LABORES_GENERALES, CAMPOS, CENTROS_COSTO, ESPECIES, ETAPAS_PLANTA, TEMPORADAS } from '@/data/maestros'
import type { Asiento, LineaAsiento } from '@/lib/types'
import {
  Badge, Card, CardHeader, Field, Kpi, Modal, PageHeader, SearchInput, Select, Tabs, Vacio,
} from '@/components/ui'
import { alerta } from '@/lib/alerta'
import { exportarLibrosContables } from '@/lib/excel'
import { cn, hoy, money, nfmt, uid } from '@/lib/utils'

export default function Contabilidad() {
  const [tab, setTab] = useState('diario')
  const { asientos, ejercicio } = useStore()

  const control = useMemo(() => controlarAsientos(asientos), [asientos])
  const descuadrados = control.filter((c) => !c.cuadrado).length
  const eerr = useMemo(() => estadoResultados(asientos, ejercicio.tasaImpuesto), [asientos, ejercicio])
  const balance = useMemo(() => balanceGeneral(asientos, ejercicio.tasaImpuesto), [asientos, ejercicio])
  const totalMovido = control.reduce((a, c) => a + c.totalDebe, 0)

  return (
    <>
      <PageHeader
        titulo="Contabilidad"
        descripcion={`${ejercicio.empresa} · RUT ${ejercicio.rut} · ejercicio ${ejercicio.fechaInicio.slice(0, 4)}`}
        icon={BookOpen}
      >
        <button
          onClick={() => {
            exportarLibrosContables(asientos, ejercicio)
            alerta.toast('Libros contables descargados')
          }}
          className="btn-primary"
        >
          <FileDown className="h-4 w-4" />Exportar libros
        </button>
      </PageHeader>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Asientos del ejercicio" value={String(asientos.length)} icon={BookOpenCheck}
             sub={`${control.reduce((a, c) => a + c.lineas, 0)} líneas de diario`} />
        <Kpi label="Total movido" value={money(totalMovido)} icon={Scale} tone="sky" sub="Suma del Debe" />
        <Kpi label="Resultado del ejercicio" value={money(eerr.utilidadNeta)}
             icon={eerr.utilidadNeta >= 0 ? TrendingUp : TrendingDown}
             tone={eerr.utilidadNeta >= 0 ? 'brand' : 'red'}
             sub={eerr.utilidadNeta >= 0 ? 'Utilidad neta' : 'Pérdida del ejercicio'} />
        <Kpi label="Asientos descuadrados" value={String(descuadrados)} icon={AlertTriangle}
             tone={descuadrados ? 'red' : 'brand'}
             sub={descuadrados ? 'Distorsionan todos los informes' : 'Todos cuadrados'} />
      </div>

      {balance.descuadre !== 0 && asientos.length > 0 && (
        <Card className="mb-5 border-l-4 border-l-red-500">
          <div className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
            <p className="text-[13px] text-ink-soft">
              El balance no cuadra por <strong className="text-ink">{money(Math.abs(balance.descuadre))}</strong>.
              Revise el control de asientos antes de emitir informes.
            </p>
          </div>
        </Card>
      )}

      <div className="mb-4 max-w-4xl">
        <Tabs
          value={tab} onChange={setTab}
          tabs={[
            { id: 'diario', label: 'Libro Diario', count: asientos.length },
            { id: 'control', label: 'Control', count: descuadrados || undefined },
            { id: 'mayor', label: 'Libro Mayor' },
            { id: 'balance8', label: 'Balance 8 columnas' },
            { id: 'eerr', label: 'Estado de Resultados' },
            { id: 'general', label: 'Balance General' },
            { id: 'plan', label: 'Plan financiero', count: PLAN_ORDENADO.length },
          ]}
        />
      </div>

      {tab === 'diario' && <LibroDiario />}
      {tab === 'control' && <ControlAsientos />}
      {tab === 'mayor' && <LibroMayor />}
      {tab === 'balance8' && <Balance8 />}
      {tab === 'eerr' && <EERR />}
      {tab === 'general' && <BalanceGeneralView />}
      {tab === 'plan' && <PlanFinanciero />}
    </>
  )
}

/* ═══════════════════ Libro Diario ═══════════════════ */

function LibroDiario() {
  const { asientos, delAsiento } = useStore()
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState<Set<string>>(new Set())
  const [editor, setEditor] = useState<Asiento | 'nuevo' | null>(null)

  const lista = useMemo(() => {
    const t = q.trim().toUpperCase()
    return asientos
      .filter((a) =>
        !t ||
        a.glosa.toUpperCase().includes(t) ||
        String(a.numero) === t ||
        a.lineas.some((l) => l.cuenta.includes(t) || (l.n13 ?? '').toUpperCase().includes(t)),
      )
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero - a.numero)
  }, [asientos, q])

  const toggle = (id: string) =>
    setAbierto((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  return (
    <>
      <Card>
        <CardHeader
          title="Libro Diario"
          subtitle="Único punto de ingreso. Cada línea lleva la cuenta financiera y las 13 dimensiones analíticas."
          icon={BookOpen}
          actions={
            <>
              <SearchInput value={q} onChange={setQ} placeholder="N°, glosa, cuenta o CC…" className="w-56" />
              <button onClick={() => setEditor('nuevo')} className="btn-primary !min-h-0 !py-1.5">
                <Plus className="h-4 w-4" />Nuevo asiento
              </button>
            </>
          }
        />
        {lista.length === 0 ? (
          <Vacio
            titulo="Sin asientos"
            detalle="Registre uno manualmente, o genérelo desde el cierre de costos con el botón Contabilizar."
            icon={BookOpen}
            accion={<button onClick={() => setEditor('nuevo')} className="btn-primary">
              <Plus className="h-4 w-4" />Nuevo asiento</button>}
          />
        ) : (
          <ul className="divide-y divide-hairline/60">
            {lista.map((a) => {
              const d = totalDebe(a)
              const h = totalHaber(a)
              const ok = estaCuadrado(a)
              const open = abierto.has(a.id)
              return (
                <li key={a.id}>
                  <div className="group flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-brand-500/[0.04]">
                    <button onClick={() => toggle(a.id)} aria-expanded={open}
                            aria-label={`${open ? 'Contraer' : 'Expandir'} asiento ${a.numero}`}
                            className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md text-ink-faint transition-colors duration-200 hover:bg-ink-faint/10 hover:text-ink">
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <code className="tnum shrink-0 rounded bg-ink-faint/12 px-2 py-0.5 font-mono text-[11px] font-semibold text-ink-soft">
                      N° {a.numero}
                    </code>
                    <span className="tnum shrink-0 text-[12px] text-ink-faint">{a.fecha}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{a.glosa}</span>
                    <Badge tone={a.origen === 'MANUAL' ? 'slate' : 'sky'}>{a.origen}</Badge>
                    <span className="tnum shrink-0 whitespace-nowrap text-[13px] font-semibold text-ink">{money(d)}</span>
                    {ok ? (
                      <Badge tone="brand"><CheckCircle2 className="h-3 w-3" />Cuadrado</Badge>
                    ) : (
                      <Badge tone="red"><XCircle className="h-3 w-3" />{money(d - h)}</Badge>
                    )}
                    <div className="flex shrink-0 gap-1 opacity-50 transition-opacity duration-200 group-hover:opacity-100">
                      <button onClick={() => setEditor(a)} aria-label={`Editar asiento ${a.numero}`}
                              className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-ink-faint transition-colors duration-200 hover:bg-brand-500/12 hover:text-brand-600 dark:hover:text-brand-400">
                        <Settings2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={async () => {
                        if (await alerta.eliminar(`¿Eliminar el asiento N° ${a.numero}?`, a.glosa)) {
                          delAsiento(a.id); alerta.toast('Asiento eliminado', 'warning')
                        }
                      }} aria-label={`Eliminar asiento ${a.numero}`}
                        className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-ink-faint transition-colors duration-200 hover:bg-red-500/12 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {open && (
                    <div className="overflow-x-auto border-t border-hairline/60 bg-surface-soft/50">
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Cuenta</th><th>Nombre</th><th>Glosa de línea</th>
                            <th>N6 Labor</th><th>N9 Especie</th><th>N11 Campo</th><th>N13 CC</th>
                            <th className="text-right">Jorn.</th>
                            <th className="text-right">Debe</th><th className="text-right">Haber</th>
                          </tr>
                        </thead>
                        <tbody>
                          {a.lineas.map((l) => (
                            <tr key={l.id}>
                              <td><code className="tnum font-mono text-[11px] font-semibold text-brand-700 dark:text-brand-300">{l.cuenta}</code></td>
                              <td className="text-[12px] text-ink">{cuentaFin(l.cuenta)?.nombre ?? '—'}</td>
                              <td className="max-w-[200px] truncate text-[12px] text-ink-faint" title={l.glosaLinea}>{l.glosaLinea ?? '—'}</td>
                              <td className="text-[12px] text-ink-soft">{l.n6 ?? '—'}</td>
                              <td className="text-[12px] text-ink-soft">{l.n9 && l.n9 !== '0' ? l.n9 : '—'}</td>
                              <td className="text-[12px] text-ink-soft">{l.n11 ?? '—'}</td>
                              <td className="text-[12px] text-ink-soft">{l.n13 ?? '—'}</td>
                              <td className="tnum text-right text-ink-faint">{l.jornadas ? nfmt(l.jornadas, 2) : '—'}</td>
                              <td className="tnum whitespace-nowrap text-right font-medium text-ink">{l.debe ? money(l.debe) : ''}</td>
                              <td className="tnum whitespace-nowrap text-right font-medium text-ink">{l.haber ? money(l.haber) : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-surface-soft font-semibold">
                            <td colSpan={8} className="px-3 py-2 text-ink">Totales del asiento</td>
                            <td className="tnum px-3 py-2 text-right text-ink">{money(d)}</td>
                            <td className="tnum px-3 py-2 text-right text-ink">{money(h)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {editor && <EditorAsiento asiento={editor === 'nuevo' ? null : editor} onClose={() => setEditor(null)} />}
    </>
  )
}

/* ═══════════════════ Editor de asiento ═══════════════════ */

const lineaVacia = (): LineaAsiento => ({ id: uid(), cuenta: '', debe: 0, haber: 0 })

function EditorAsiento({ asiento, onClose }: { asiento: Asiento | null; onClose: () => void }) {
  const { asientos, addAsiento, updAsiento, campoActivo } = useStore()
  const [f, setF] = useState<Omit<Asiento, 'id'>>(() =>
    asiento
      ? { ...asiento, lineas: asiento.lineas.map((l) => ({ ...l })) }
      : {
          numero: siguienteNumero(asientos),
          fecha: hoy(),
          glosa: '',
          origen: 'MANUAL' as const,
          lineas: [lineaVacia(), lineaVacia()],
        },
  )
  const [expandida, setExpandida] = useState<string | null>(null)

  const d = f.lineas.reduce((a, l) => a + (l.debe || 0), 0)
  const h = f.lineas.reduce((a, l) => a + (l.haber || 0), 0)
  const dif = Math.round(d - h)
  const cuadrado = dif === 0 && d > 0

  const setLinea = (id: string, patch: Partial<LineaAsiento>) =>
    setF((s) => ({ ...s, lineas: s.lineas.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))

  const guardar = () => {
    if (!f.glosa.trim()) return alerta.aviso('Falta la glosa', 'Describa brevemente el movimiento.')
    const conCuenta = f.lineas.filter((l) => l.cuenta && (l.debe > 0 || l.haber > 0))
    if (conCuenta.length < 2)
      return alerta.aviso('Asiento incompleto', 'Se necesitan al menos dos líneas con cuenta y monto.')
    if (dif !== 0)
      return alerta.error(
        'El asiento no cuadra',
        `Diferencia de ${money(Math.abs(dif))} entre Debe y Haber. Un asiento descuadrado distorsiona todos los informes.`,
      )
    const datos = { ...f, lineas: conCuenta }
    if (asiento) {
      updAsiento(asiento.id, datos)
      alerta.toast('Asiento actualizado')
    } else {
      addAsiento(datos)
      alerta.ok('Asiento registrado', `N° ${f.numero} · ${money(d)}`)
    }
    onClose()
  }

  return (
    <Modal
      open onClose={onClose} wide
      title={asiento ? `Editar asiento N° ${asiento.numero}` : 'Nuevo asiento'}
      subtitle="El asiento debe cuadrar: suma del Debe = suma del Haber"
      footer={
        <>
          <span className={cn('mr-auto flex items-center gap-2 text-[13px] font-medium',
                              cuadrado ? 'text-brand-600 dark:text-brand-400' : 'text-red-500')}>
            {cuadrado ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            Debe {money(d)} · Haber {money(h)}
            {dif !== 0 && ` · diferencia ${money(Math.abs(dif))}`}
          </span>
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={guardar} className="btn-primary" disabled={!cuadrado}>Guardar asiento</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="N° asiento">
            <input type="number" className="input tnum" value={f.numero}
                   onChange={(e) => setF({ ...f, numero: Number(e.target.value) })} />
          </Field>
          <Field label="Fecha">
            <input type="date" className="input" value={f.fecha}
                   onChange={(e) => setF({ ...f, fecha: e.target.value })} />
          </Field>
          <Field label="Glosa / descripción" className="sm:col-span-2">
            <input className="input" value={f.glosa} onChange={(e) => setF({ ...f, glosa: e.target.value })}
                   placeholder="Ej.: Compra de fertilizantes factura N°1234" />
          </Field>
          <Field label="N° documento">
            <input className="input" value={f.nroDocumento ?? ''}
                   onChange={(e) => setF({ ...f, nroDocumento: e.target.value })} />
          </Field>
          <Field label="Observaciones" className="sm:col-span-3">
            <input className="input" value={f.observaciones ?? ''}
                   onChange={(e) => setF({ ...f, observaciones: e.target.value })} />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="label !mb-0">Líneas del asiento</label>
            <button onClick={() => setF((s) => ({ ...s, lineas: [...s.lineas, lineaVacia()] }))}
                    className="btn-ghost !min-h-0 !px-2 !py-1 text-xs">
              <Plus className="h-3 w-3" />Agregar línea
            </button>
          </div>

          <div className="space-y-2">
            {f.lineas.map((l) => (
              <div key={l.id} className="rounded-lg border border-hairline p-2.5">
                <div className="grid gap-2 sm:grid-cols-[1.6fr_1.4fr_1fr_1fr_auto] sm:items-end">
                  <Field label="Cuenta">
                    <Select
                      value={l.cuenta}
                      onChange={(v) => setLinea(l.id, { cuenta: v })}
                      placeholder="Seleccionar…"
                      options={PLAN_ORDENADO.map((c) => ({ value: c.codigo, label: `${c.codigo} · ${c.nombre}` }))}
                    />
                  </Field>
                  <Field label="Glosa de línea">
                    <input className="input" value={l.glosaLinea ?? ''}
                           onChange={(e) => setLinea(l.id, { glosaLinea: e.target.value })} />
                  </Field>
                  <Field label="Debe">
                    <input type="number" min={0} className="input tnum text-right" value={l.debe || ''}
                           onChange={(e) => setLinea(l.id, { debe: Number(e.target.value) || 0, haber: 0 })} />
                  </Field>
                  <Field label="Haber">
                    <input type="number" min={0} className="input tnum text-right" value={l.haber || ''}
                           onChange={(e) => setLinea(l.id, { haber: Number(e.target.value) || 0, debe: 0 })} />
                  </Field>
                  <div className="flex gap-1 pb-0.5">
                    <button
                      onClick={() => setExpandida(expandida === l.id ? null : l.id)}
                      aria-label="Dimensiones analíticas"
                      title="Dimensiones analíticas N1–N13"
                      className={cn(
                        'grid h-[38px] w-9 cursor-pointer place-items-center rounded-lg border transition-colors duration-200',
                        expandida === l.id
                          ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400'
                          : 'border-hairline text-ink-faint hover:border-brand-500/50 hover:text-ink',
                      )}
                    >
                      <ListTree className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setF((s) => ({ ...s, lineas: s.lineas.filter((x) => x.id !== l.id) }))}
                      aria-label="Eliminar línea"
                      disabled={f.lineas.length <= 2}
                      className="grid h-[38px] w-9 cursor-pointer place-items-center rounded-lg border border-hairline text-ink-faint transition-colors duration-200 hover:border-red-500/40 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {expandida === l.id && (
                  <div className="mt-3 grid gap-2 border-t border-hairline pt-3 sm:grid-cols-3 lg:grid-cols-4">
                    <Field label="N6 · Labor general">
                      <Select value={l.n6 ?? ''} onChange={(v) => setLinea(l.id, { n6: v })}
                              options={LABORES_GENERALES} placeholder="—" />
                    </Field>
                    <Field label="N7 · Labor específica">
                      <Select value={l.n7 ?? ''} onChange={(v) => setLinea(l.id, { n7: v })}
                              options={LABORES[l.n6 ?? ''] ?? []} placeholder="—" disabled={!l.n6} />
                    </Field>
                    <Field label="N8 · Etapa planta">
                      <Select value={l.n8 ?? ''} onChange={(v) => setLinea(l.id, { n8: v })}
                              options={ETAPAS_PLANTA.map((e) => e.nombre)} placeholder="—" />
                    </Field>
                    <Field label="N9 · Especie">
                      <Select value={l.n9 ?? ''} onChange={(v) => setLinea(l.id, { n9: v })}
                              options={ESPECIES.map((e) => e.nombre).filter(Boolean)} placeholder="—" />
                    </Field>
                    <Field label="N11 · Campo">
                      <Select value={l.n11 ?? ''} onChange={(v) => setLinea(l.id, { n11: v })}
                              options={CAMPOS.map((c) => c.nombre)} placeholder="—" />
                    </Field>
                    <Field label="N12 · Temporada">
                      <Select value={l.n12 ?? ''} onChange={(v) => setLinea(l.id, { n12: v })}
                              options={TEMPORADAS} placeholder="—" />
                    </Field>
                    <Field label="N13 · Centro de costo">
                      <Select value={l.n13 ?? ''} onChange={(v) => setLinea(l.id, { n13: v })}
                              options={CENTROS_COSTO.filter((c) => !l.n11 || c.campo === l.n11).map((c) => c.cc)}
                              placeholder="—" />
                    </Field>
                    <Field label="Jornadas">
                      <input type="number" step={0.01} min={0} className="input tnum"
                             value={l.jornadas ?? ''} onChange={(e) => setLinea(l.id, { jornadas: Number(e.target.value) || undefined })} />
                    </Field>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ═══════════════════ Control de asientos ═══════════════════ */

function ControlAsientos() {
  const { asientos } = useStore()
  const control = useMemo(() => controlarAsientos(asientos), [asientos])
  const todosOk = control.every((c) => c.cuadrado)

  return (
    <Card>
      <CardHeader
        title="Control de asientos"
        subtitle="Verificación de cuadratura. Todos deben mostrar CUADRADO antes de emitir informes."
        icon={CheckCircle2}
        actions={
          <Badge tone={todosOk ? 'brand' : 'red'}>
            {todosOk ? 'Contabilidad consistente' : `${control.filter((c) => !c.cuadrado).length} con problemas`}
          </Badge>
        }
      />
      {control.length === 0 ? (
        <Vacio titulo="Sin asientos que controlar" icon={CheckCircle2} />
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>N° asiento</th><th>Fecha</th><th>Glosa</th>
                <th className="text-right">Líneas</th>
                <th className="text-right">Total Debe</th><th className="text-right">Total Haber</th>
                <th className="text-right">Diferencia</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {control.map((c) => (
                <tr key={c.numero}>
                  <td><code className="tnum font-mono text-[11px] font-semibold text-ink-soft">N° {c.numero}</code></td>
                  <td className="tnum whitespace-nowrap text-ink-soft">{c.fecha}</td>
                  <td className="max-w-[280px] truncate text-ink" title={c.glosa}>{c.glosa}</td>
                  <td className="tnum text-right text-ink-faint">{c.lineas}</td>
                  <td className="tnum whitespace-nowrap text-right text-ink">{money(c.totalDebe)}</td>
                  <td className="tnum whitespace-nowrap text-right text-ink">{money(c.totalHaber)}</td>
                  <td className={cn('tnum whitespace-nowrap text-right font-medium',
                                    c.diferencia === 0 ? 'text-ink-faint' : 'text-red-500')}>
                    {money(c.diferencia)}
                  </td>
                  <td>
                    {c.cuadrado
                      ? <Badge tone="brand"><CheckCircle2 className="h-3 w-3" />Cuadrado</Badge>
                      : <Badge tone="red"><XCircle className="h-3 w-3" />Descuadrado</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

/* ═══════════════════ Libro Mayor ═══════════════════ */

function LibroMayor() {
  const { asientos } = useStore()
  const mayor = useMemo(() => construirMayor(asientos), [asientos])
  const [sel, setSel] = useState<string>('')

  const cuenta = mayor.find((m) => m.codigo === sel) ?? mayor[0]

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <Card className="lg:sticky lg:top-[88px] lg:self-start">
        <CardHeader title="Cuentas con movimiento" subtitle={`${mayor.length} cuentas`} icon={Layers} />
        {mayor.length === 0 ? (
          <Vacio titulo="Sin movimientos" />
        ) : (
          <ul className="max-h-[60vh] divide-y divide-hairline/60 overflow-y-auto">
            {mayor.map((m) => (
              <li key={m.codigo}>
                <button
                  onClick={() => setSel(m.codigo)}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left transition-colors duration-200',
                    cuenta?.codigo === m.codigo ? 'bg-brand-500/10' : 'hover:bg-ink-faint/8',
                  )}
                >
                  <code className="tnum shrink-0 font-mono text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                    {m.codigo}
                  </code>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{m.nombre}</span>
                  <span className="tnum shrink-0 text-[11px] font-medium text-ink-soft">
                    {money(m.saldoFinal)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        {cuenta ? (
          <>
            <CardHeader
              title={`${cuenta.codigo} · ${cuenta.nombre}`}
              subtitle={`${cuenta.tipo} · ${cuenta.subtipo} · naturaleza ${cuenta.naturaleza}`}
              icon={BookOpenCheck}
              actions={<Badge tone={cuenta.saldoFinal >= 0 ? 'brand' : 'red'}>
                Saldo {money(cuenta.saldoFinal)}
              </Badge>}
            />
            <div className="max-h-[62vh] overflow-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Fecha</th><th>N° asiento</th><th>Glosa del movimiento</th>
                    <th className="text-right">Debe</th><th className="text-right">Haber</th>
                    <th className="text-right">Saldo acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {cuenta.movimientos.map((m, i) => (
                    <tr key={i}>
                      <td className="tnum whitespace-nowrap text-ink-soft">{m.fecha}</td>
                      <td><code className="tnum font-mono text-[11px] text-ink-faint">N° {m.numero}</code></td>
                      <td className="max-w-[300px] truncate text-ink" title={m.glosa}>{m.glosa}</td>
                      <td className="tnum whitespace-nowrap text-right text-ink">{m.debe ? money(m.debe) : ''}</td>
                      <td className="tnum whitespace-nowrap text-right text-ink">{m.haber ? money(m.haber) : ''}</td>
                      <td className="tnum whitespace-nowrap text-right font-medium text-ink">{money(m.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-soft font-semibold">
                    <td colSpan={3} className="px-3 py-2 text-ink">Totales</td>
                    <td className="tnum px-3 py-2 text-right text-ink">{money(cuenta.totalDebe)}</td>
                    <td className="tnum px-3 py-2 text-right text-ink">{money(cuenta.totalHaber)}</td>
                    <td className="tnum px-3 py-2 text-right text-ink">{money(cuenta.saldoFinal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : (
          <Vacio titulo="Sin cuentas con movimiento" detalle="Registre asientos en el Libro Diario." />
        )}
      </Card>
    </div>
  )
}

/* ═══════════════════ Balance 8 columnas ═══════════════════ */

function Balance8() {
  const { asientos } = useStore()
  const [soloConMovimiento, setSolo] = useState(true)
  const todas = useMemo(() => balance8Columnas(asientos), [asientos])
  const filas = soloConMovimiento ? todas.filter((f) => f.debe || f.haber) : todas
  const t = totalesBalance8(filas)
  const resultado = t.ganancia - t.perdida

  return (
    <Card>
      <CardHeader
        title="Balance de 8 columnas"
        subtitle="Hoja de trabajo: sumas, saldos, inventario y resultados. Se recalcula desde el Libro Diario."
        icon={Scale}
        actions={
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-soft">
            <input type="checkbox" checked={soloConMovimiento} onChange={(e) => setSolo(e.target.checked)}
                   className="h-4 w-4 cursor-pointer accent-brand-600" />
            Sólo cuentas con movimiento
          </label>
        }
      />
      {filas.length === 0 ? (
        <Vacio titulo="Sin movimientos contables" detalle="Registre asientos para construir el balance." />
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th rowSpan={2}>Código</th><th rowSpan={2}>Cuenta</th>
                <th colSpan={2} className="!text-center">Sumas</th>
                <th colSpan={2} className="!text-center">Saldos</th>
                <th colSpan={2} className="!text-center">Inventario</th>
                <th colSpan={2} className="!text-center">Resultados</th>
              </tr>
              <tr>
                <th className="text-right">Debe</th><th className="text-right">Haber</th>
                <th className="text-right">Deudor</th><th className="text-right">Acreedor</th>
                <th className="text-right">Activo</th><th className="text-right">Pasivo</th>
                <th className="text-right">Pérdidas</th><th className="text-right">Ganancias</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.codigo}>
                  <td><code className="tnum font-mono text-[11px] font-semibold text-brand-700 dark:text-brand-300">{f.codigo}</code></td>
                  <td className="text-ink">{f.nombre}</td>
                  <td className="tnum whitespace-nowrap text-right text-ink-soft">{f.debe ? money(f.debe) : '—'}</td>
                  <td className="tnum whitespace-nowrap text-right text-ink-soft">{f.haber ? money(f.haber) : '—'}</td>
                  <td className="tnum whitespace-nowrap text-right text-ink">{f.saldoDeudor ? money(f.saldoDeudor) : '—'}</td>
                  <td className="tnum whitespace-nowrap text-right text-ink">{f.saldoAcreedor ? money(f.saldoAcreedor) : '—'}</td>
                  <td className="tnum whitespace-nowrap text-right text-ink-soft">{f.activo ? money(f.activo) : '—'}</td>
                  <td className="tnum whitespace-nowrap text-right text-ink-soft">{f.pasivo ? money(f.pasivo) : '—'}</td>
                  <td className="tnum whitespace-nowrap text-right text-ink-soft">{f.perdida ? money(f.perdida) : '—'}</td>
                  <td className="tnum whitespace-nowrap text-right text-ink-soft">{f.ganancia ? money(f.ganancia) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-soft font-semibold">
                <td colSpan={2} className="px-3 py-2 text-ink">Sumas iguales</td>
                <td className="tnum px-3 py-2 text-right text-ink">{money(t.debe)}</td>
                <td className="tnum px-3 py-2 text-right text-ink">{money(t.haber)}</td>
                <td className="tnum px-3 py-2 text-right text-ink">{money(t.saldoDeudor)}</td>
                <td className="tnum px-3 py-2 text-right text-ink">{money(t.saldoAcreedor)}</td>
                <td className="tnum px-3 py-2 text-right text-ink">{money(t.activo)}</td>
                <td className="tnum px-3 py-2 text-right text-ink">{money(t.pasivo)}</td>
                <td className="tnum px-3 py-2 text-right text-ink">{money(t.perdida)}</td>
                <td className="tnum px-3 py-2 text-right text-ink">{money(t.ganancia)}</td>
              </tr>
              <tr className="bg-brand-500/8 font-semibold">
                <td colSpan={8} className="px-3 py-2 text-ink">
                  {resultado >= 0 ? 'Utilidad del ejercicio' : 'Pérdida del ejercicio'}
                </td>
                <td colSpan={2} className="tnum px-3 py-2 text-right text-ink">{money(Math.abs(resultado))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  )
}

/* ═══════════════════ Estado de Resultados ═══════════════════ */

function EERR() {
  const { asientos, ejercicio } = useStore()
  const r = useMemo(() => estadoResultados(asientos, ejercicio.tasaImpuesto), [asientos, ejercicio])
  const det = (g: string) => r.detalle.filter((d) => d.grupo === g)

  const Fila = ({ label, monto, tipo = 'normal', codigo }: {
    label: string; monto: number; tipo?: 'normal' | 'subtotal' | 'total'; codigo?: string
  }) => (
    <tr className={cn(
      tipo === 'subtotal' && 'bg-surface-soft font-semibold',
      tipo === 'total' && 'bg-brand-500/10 font-semibold',
    )}>
      <td className="w-16">
        {codigo && <code className="tnum font-mono text-[11px] text-brand-700 dark:text-brand-300">{codigo}</code>}
      </td>
      <td className={cn('text-ink', tipo === 'normal' && 'pl-6 text-ink-soft')}>{label}</td>
      <td className={cn('tnum whitespace-nowrap text-right text-ink',
                        tipo !== 'normal' && 'font-semibold',
                        monto < 0 && tipo !== 'normal' && 'text-red-500')}>
        {money(monto)}
      </td>
    </tr>
  )

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader
          title="Estado de Resultados"
          subtitle={`Ejercicio ${ejercicio.fechaInicio.slice(0, 4)} · ${ejercicio.empresa}`}
          icon={FileBarChart}
        />
        <table className="tbl">
          <tbody>
            <tr className="bg-surface-soft"><td colSpan={3} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Ingresos de actividades ordinarias</td></tr>
            {det('INGRESOS').length === 0 && <Fila label="Sin ingresos registrados" monto={0} />}
            {det('INGRESOS').map((d) => <Fila key={d.codigo} codigo={d.codigo} label={d.nombre} monto={d.monto} />)}
            <Fila label="TOTAL INGRESOS OPERACIONALES" monto={r.ingresosOperacionales} tipo="subtotal" />

            <tr className="bg-surface-soft"><td colSpan={3} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Costo de ventas</td></tr>
            {det('COSTO_VENTAS').map((d) => <Fila key={d.codigo} codigo={d.codigo} label={d.nombre} monto={d.monto} />)}
            <Fila label="MARGEN DE CONTRIBUCIÓN (UTILIDAD BRUTA)" monto={r.margenBruto} tipo="subtotal" />

            <tr className="bg-surface-soft"><td colSpan={3} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Gastos de administración y ventas</td></tr>
            {det('ADMINISTACION').length === 0 && det('ADMINISTRACION').length === 0 && <Fila label="Sin gastos de administración" monto={0} />}
            {det('ADMINISTRACION').map((d) => <Fila key={d.codigo} codigo={d.codigo} label={d.nombre} monto={d.monto} />)}
            <Fila label="RESULTADO OPERACIONAL" monto={r.resultadoOperacional} tipo="subtotal" />

            <tr className="bg-surface-soft"><td colSpan={3} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Resultado no operacional</td></tr>
            {det('FINANCIERO').length === 0 && <Fila label="Sin gastos financieros" monto={0} />}
            {det('FINANCIERO').map((d) => <Fila key={d.codigo} codigo={d.codigo} label={d.nombre} monto={d.monto} />)}
            <Fila label="UTILIDAD ANTES DE IMPUESTOS" monto={r.utilidadAntesImpuesto} tipo="subtotal" />

            <tr className="bg-surface-soft"><td colSpan={3} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Impuesto a la renta (1ª categoría)</td></tr>
            <Fila label={`Provisión impuesto (${(ejercicio.tasaImpuesto * 100).toFixed(0)}%)`} monto={r.provisionImpuesto} />
            <Fila label="UTILIDAD (PÉRDIDA) NETA DEL EJERCICIO" monto={r.utilidadNeta} tipo="total" />
          </tbody>
        </table>
      </Card>

      <div className="space-y-4 lg:sticky lg:top-[88px] lg:self-start">
        <Kpi label="Ingresos operacionales" value={money(r.ingresosOperacionales)} icon={TrendingUp} tone="brand" />
        <Kpi label="Costo de ventas" value={money(r.costoVentas)} icon={TrendingDown} tone="accent" />
        <Kpi label="Resultado del ejercicio" value={money(r.utilidadNeta)}
             icon={r.utilidadNeta >= 0 ? TrendingUp : TrendingDown}
             tone={r.utilidadNeta >= 0 ? 'brand' : 'red'}
             sub={r.ingresosOperacionales === 0 ? 'Aún sin ingresos contabilizados' : undefined} />
        {r.ingresosOperacionales === 0 && r.costoVentas > 0 && (
          <Card className="border-accent-500/30 bg-accent-500/6 p-3">
            <p className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-soft">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-600 dark:text-accent-400" />
              Hay costos contabilizados sin ingresos. Es lo normal a mitad de temporada:
              el costo se acumula antes de la cosecha.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════ Balance General ═══════════════════ */

function BalanceGeneralView() {
  const { asientos, ejercicio } = useStore()
  const b = useMemo(() => balanceGeneral(asientos, ejercicio.tasaImpuesto), [asientos, ejercicio])
  const filas = useMemo(() => balance8Columnas(asientos), [asientos])

  /** Cuentas del subtipo con saldo neto distinto de cero. */
  const grupo = (subtipo: string) =>
    filas
      .filter((f) => f.subtipo === subtipo)
      .map((f) => ({ ...f, neto: saldoNetoBalance(f) }))
      .filter((f) => f.neto !== 0)

  const Seccion = ({ titulo, cuentas, total }: {
    titulo: string; cuentas: ReturnType<typeof grupo>; total: number
  }) => (
    <>
      <tr className="bg-surface-soft">
        <td colSpan={3} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{titulo}</td>
      </tr>
      {cuentas.length === 0 && (
        <tr><td /><td className="pl-6 text-ink-faint">Sin saldos</td><td className="tnum text-right text-ink-faint">{money(0)}</td></tr>
      )}
      {cuentas.map((f) => (
        <tr key={f.codigo}>
          <td className="w-16"><code className="tnum font-mono text-[11px] text-brand-700 dark:text-brand-300">{f.codigo}</code></td>
          <td className="pl-6 text-ink-soft">
            {f.nombre}
            {f.neto < 0 && (
              <span className="ml-1.5 text-[11px] text-ink-faint">(rebaja el rubro)</span>
            )}
          </td>
          <td className={cn('tnum whitespace-nowrap text-right', f.neto < 0 ? 'text-red-500' : 'text-ink')}>
            {money(f.neto)}
          </td>
        </tr>
      ))}
      <tr className="bg-surface-soft font-semibold">
        <td /><td className="text-ink">Total {titulo.toLowerCase()}</td>
        <td className="tnum whitespace-nowrap text-right text-ink">{money(total)}</td>
      </tr>
    </>
  )

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Activo" subtitle="Bienes y derechos" icon={Building2} />
        <table className="tbl">
          <tbody>
            <Seccion titulo="Activo corriente" cuentas={grupo('Activo Corriente')} total={b.activoCorriente} />
            <Seccion titulo="Activo no corriente" cuentas={grupo('Activo No Corriente')} total={b.activoNoCorriente} />
            <tr className="bg-brand-500/10 font-semibold">
              <td /><td className="text-ink">TOTAL ACTIVO</td>
              <td className="tnum whitespace-nowrap text-right text-ink">{money(b.totalActivo)}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHeader title="Pasivo y Patrimonio" subtitle="Obligaciones y capital" icon={Landmark} />
        <table className="tbl">
          <tbody>
            <Seccion titulo="Pasivo corriente" cuentas={grupo('Pasivo Corriente')} total={b.pasivoCorriente} />
            <Seccion titulo="Pasivo no corriente" cuentas={grupo('Pasivo No Corriente')} total={b.pasivoNoCorriente} />
            <Seccion titulo="Patrimonio" cuentas={grupo('Patrimonio')} total={b.patrimonio} />
            <tr>
              <td /><td className="pl-6 text-ink-soft">Resultado del ejercicio</td>
              <td className={cn('tnum whitespace-nowrap text-right', b.resultadoEjercicio < 0 ? 'text-red-500' : 'text-ink')}>
                {money(b.resultadoEjercicio)}
              </td>
            </tr>
            <tr className="bg-brand-500/10 font-semibold">
              <td /><td className="text-ink">TOTAL PASIVO + PATRIMONIO</td>
              <td className="tnum whitespace-nowrap text-right text-ink">{money(b.totalPasivoPatrimonio)}</td>
            </tr>
            {b.descuadre !== 0 && (
              <tr className="bg-red-500/10 font-semibold">
                <td /><td className="text-red-600 dark:text-red-400">Descuadre</td>
                <td className="tnum whitespace-nowrap text-right text-red-600 dark:text-red-400">{money(b.descuadre)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

/* ═══════════════════ Plan financiero ═══════════════════ */

function PlanFinanciero() {
  const [q, setQ] = useState('')
  const { asientos, ejercicio, setEjercicio } = useStore()
  const mayor = useMemo(() => new Map(construirMayor(asientos).map((m) => [m.codigo, m])), [asientos])

  const filtradas = useMemo(() => {
    const t = q.trim().toUpperCase()
    return PLAN_ORDENADO.filter((c) => !t || `${c.codigo} ${c.nombre} ${c.tipo}`.toUpperCase().includes(t))
  }, [q])

  const TONO: Record<string, string> = {
    Activo: 'brand', Pasivo: 'red', Patrimonio: 'violet', Ingreso: 'sky', Gasto: 'accent',
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Configuración del ejercicio" subtitle="Estos datos encabezan todos los informes" icon={Settings2} />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Razón social">
            <input className="input" value={ejercicio.empresa} onChange={(e) => setEjercicio({ empresa: e.target.value })} />
          </Field>
          <Field label="RUT">
            <input className="input tnum font-mono" value={ejercicio.rut} onChange={(e) => setEjercicio({ rut: e.target.value })} />
          </Field>
          <Field label="Moneda">
            <Select value={ejercicio.moneda} onChange={(v) => setEjercicio({ moneda: v })} options={['CLP', 'USD', 'UF']} />
          </Field>
          <Field label="Inicio del período">
            <input type="date" className="input" value={ejercicio.fechaInicio} onChange={(e) => setEjercicio({ fechaInicio: e.target.value })} />
          </Field>
          <Field label="Fin del período">
            <input type="date" className="input" value={ejercicio.fechaFin} onChange={(e) => setEjercicio({ fechaFin: e.target.value })} />
          </Field>
          <Field label="Tasa impuesto 1ª categoría" hint={`${(ejercicio.tasaImpuesto * 100).toFixed(0)}%`}>
            <input type="number" step={0.01} min={0} max={1} className="input tnum"
                   value={ejercicio.tasaImpuesto} onChange={(e) => setEjercicio({ tasaImpuesto: Number(e.target.value) })} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Plan de cuentas financiero"
          subtitle="Convive con el plan analítico de 13 niveles: éste manda en los estados financieros"
          icon={ListTree}
          actions={<SearchInput value={q} onChange={setQ} placeholder="Código, nombre o tipo…" className="w-56" />}
        />
        <div className="max-h-[60vh] overflow-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Código</th><th>Nombre de la cuenta</th><th>Tipo</th><th>Subtipo</th>
                <th>Naturaleza</th><th className="text-right">Movimiento</th><th className="text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => {
                const m = mayor.get(c.codigo)
                return (
                  <tr key={c.codigo}>
                    <td><code className="tnum font-mono text-[11px] font-semibold text-brand-700 dark:text-brand-300">{c.codigo}</code></td>
                    <td className="text-ink">{c.nombre}</td>
                    <td><Badge tone={TONO[c.tipo]}>{c.tipo}</Badge></td>
                    <td className="text-[12px] text-ink-faint">{c.subtipo}</td>
                    <td className="text-[12px] text-ink-soft">{c.naturaleza}</td>
                    <td className="tnum text-right text-ink-faint">{m ? m.movimientos.length : '—'}</td>
                    <td className="tnum whitespace-nowrap text-right font-medium text-ink">
                      {m ? money(m.saldoFinal) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
