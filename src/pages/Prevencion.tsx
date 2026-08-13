import { useMemo, useState } from 'react'
import {
  HardHat, PackagePlus, ShieldAlert, GraduationCap, Megaphone, FileDown,
  Boxes, TriangleAlert, PackageCheck, Grid3x3, Plus, Trash2, ClipboardCheck,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { CAMPOS, CARGOS, LABORES_GENERALES, UNIDADES } from '@/data/maestros'
import type { Capacitacion, CharlaSeguridad, EntregaEPP, ItemEPP } from '@/lib/types'
import {
  Badge, Barra, Card, CardHeader, Field, Kpi, Modal, PageHeader, SearchInput, Select, Tabs, Vacio,
} from '@/components/ui'
import { alerta } from '@/lib/alerta'
import { exportarPrevencion } from '@/lib/excel'
import { cn, hoy, money, suma } from '@/lib/utils'

export default function Prevencion() {
  const [tab, setTab] = useState('stock')
  const { trabajadores, epp, entregasEpp, capacitaciones, charlas, matrizEpp } = useStore()

  const bajoMinimo = epp.filter((e) => e.stock <= e.stockMinimo)
  const valorInventario = suma(epp, (e) => e.stock * e.costoUnitario)
  const sinFirmar = entregasEpp.filter((e) => !e.firmado).length

  const activos = trabajadores.filter((t) => t.estado.startsWith('ACTIVO'))
  const conEppCompleto = activos.filter((t) => {
    const req = matrizEpp.filter((m) => m.cargo === t.cargo && m.obligatorio)
    if (req.length === 0) return true
    return req.every((r) => entregasEpp.some((e) => e.trabajadorId === t.id && e.eppId === r.eppId))
  }).length
  const cobertura = activos.length ? conEppCompleto / activos.length : 0

  return (
    <>
      <PageHeader
        titulo="Prevención de riesgos"
        descripcion="EPP, capacitaciones y charlas diarias. Todo lo que hoy se pierde en papel y no cuadra con el stock."
        icon={HardHat}
      >
        <button
          onClick={() => {
            exportarPrevencion(trabajadores, epp, entregasEpp, capacitaciones, charlas)
            alerta.toast('Reporte de prevención descargado')
          }}
          className="btn-primary"
        >
          <FileDown className="h-4 w-4" />Reporte ACHS
        </button>
      </PageHeader>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Cobertura de EPP" value={`${Math.round(cobertura * 100)}%`} icon={PackageCheck}
             tone={cobertura > 0.85 ? 'brand' : 'red'}
             sub={`${conEppCompleto} de ${activos.length} trabajadores al día`} />
        <Kpi label="EPP bajo stock mínimo" value={String(bajoMinimo.length)} icon={TriangleAlert}
             tone={bajoMinimo.length ? 'red' : 'brand'} sub="Requieren reposición" />
        <Kpi label="Valor del inventario" value={money(valorInventario)} icon={Boxes} tone="accent"
             sub={`${epp.length} artículos en maestro`} />
        <Kpi label="Entregas sin firma" value={String(sinFirmar)} icon={ClipboardCheck}
             tone={sinFirmar ? 'amber' : 'brand'} sub="Respaldo legal pendiente" />
      </div>

      <div className="mb-4 max-w-3xl">
        <Tabs
          value={tab} onChange={setTab}
          tabs={[
            { id: 'stock', label: 'Stock de EPP', count: epp.length },
            { id: 'matriz', label: 'Matriz por cargo', count: matrizEpp.length },
            { id: 'entregas', label: 'Entregas', count: entregasEpp.length },
            { id: 'capacitaciones', label: 'Capacitaciones', count: capacitaciones.length },
            { id: 'charlas', label: 'Charlas diarias', count: charlas.length },
          ]}
        />
      </div>

      {tab === 'stock' && <Stock />}
      {tab === 'matriz' && <Matriz />}
      {tab === 'entregas' && <Entregas />}
      {tab === 'capacitaciones' && <Capacitaciones />}
      {tab === 'charlas' && <Charlas />}
    </>
  )
}

/* ═══════════════════ Stock de EPP ═══════════════════ */

function Stock() {
  const { epp, addEpp, updEpp, delEpp } = useStore()
  const [modal, setModal] = useState(false)
  const [f, setF] = useState<Omit<ItemEPP, 'id'>>({
    nombre: '', unidad: 'UNIDAD', stock: 0, stockMinimo: 5, vidaUtilDias: 180, costoUnitario: 0,
  })
  const maxStock = Math.max(...epp.map((e) => Math.max(e.stock, e.stockMinimo)), 1)

  const guardar = () => {
    if (!f.nombre.trim()) return alerta.aviso('Falta el nombre del EPP')
    addEpp(f)
    setModal(false)
    setF({ nombre: '', unidad: 'UNIDAD', stock: 0, stockMinimo: 5, vidaUtilDias: 180, costoUnitario: 0 })
    alerta.toast('EPP incorporado al maestro')
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Maestro y stock de EPP"
          subtitle="El stock se descuenta solo al registrar una entrega — por eso hoy nunca cuadra"
          icon={Boxes}
          actions={<button onClick={() => setModal(true)} className="btn-primary !min-h-0 !py-1.5">
            <PackagePlus className="h-4 w-4" />Nuevo EPP</button>}
        />
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Elemento</th><th>Unidad</th>
                <th className="w-40">Nivel de stock</th>
                <th className="text-right">Stock</th><th className="text-right">Mínimo</th>
                <th className="text-right">Vida útil</th><th className="text-right">Costo unit.</th>
                <th className="text-right">Valor</th><th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {epp.map((e) => {
                const bajo = e.stock <= e.stockMinimo
                return (
                  <tr key={e.id} className="group">
                    <td className="font-medium text-ink">
                      <span className="flex items-center gap-2">
                        {bajo && <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                        {e.nombre}
                      </span>
                    </td>
                    <td className="text-[12px] text-ink-faint">{e.unidad}</td>
                    <td><Barra valor={e.stock} max={maxStock} tone={bajo ? 'red' : 'brand'} /></td>
                    <td className="text-right">
                      <input type="number" value={e.stock} min={0}
                             onChange={(ev) => updEpp(e.id, { stock: Number(ev.target.value) })}
                             className={cn('input tnum !w-20 !px-2 !py-1 text-right text-[12px]',
                                           bajo && 'border-red-500/50')} />
                    </td>
                    <td className="tnum text-right text-ink-soft">{e.stockMinimo}</td>
                    <td className="tnum text-right text-ink-faint">{e.vidaUtilDias} d</td>
                    <td className="tnum whitespace-nowrap text-right text-ink-soft">{money(e.costoUnitario)}</td>
                    <td className="tnum whitespace-nowrap text-right font-medium text-ink">
                      {money(e.stock * e.costoUnitario)}
                    </td>
                    <td>
                      <button onClick={async () => {
                        if (await alerta.eliminar(`¿Eliminar ${e.nombre}?`, 'Se quitará también de la matriz por cargo.')) {
                          delEpp(e.id); alerta.toast('EPP eliminado', 'warning')
                        }
                      }}
                        aria-label={`Eliminar ${e.nombre}`}
                        className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-ink-faint opacity-50 transition-all duration-200 hover:bg-red-500/12 hover:text-red-500 group-hover:opacity-100">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo elemento de protección"
             footer={<><button onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
                       <button onClick={guardar} className="btn-primary">Agregar</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre" className="sm:col-span-2">
            <input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })}
                   placeholder="Ej.: Guantes de cabritilla" />
          </Field>
          <Field label="Unidad">
            <Select value={f.unidad} onChange={(v) => setF({ ...f, unidad: v })} options={UNIDADES} />
          </Field>
          <Field label="Stock inicial">
            <input type="number" className="input tnum" value={f.stock} min={0}
                   onChange={(e) => setF({ ...f, stock: Number(e.target.value) })} />
          </Field>
          <Field label="Stock mínimo" hint="Dispara la alerta de reposición">
            <input type="number" className="input tnum" value={f.stockMinimo} min={0}
                   onChange={(e) => setF({ ...f, stockMinimo: Number(e.target.value) })} />
          </Field>
          <Field label="Vida útil (días)">
            <input type="number" className="input tnum" value={f.vidaUtilDias} min={1}
                   onChange={(e) => setF({ ...f, vidaUtilDias: Number(e.target.value) })} />
          </Field>
          <Field label="Costo unitario" hint={money(f.costoUnitario)}>
            <input type="number" className="input tnum" value={f.costoUnitario} min={0}
                   onChange={(e) => setF({ ...f, costoUnitario: Number(e.target.value) })} />
          </Field>
        </div>
      </Modal>
    </>
  )
}

/* ═══════════════════ Matriz EPP por cargo ═══════════════════ */

function Matriz() {
  const { epp, matrizEpp, addMatriz, delMatriz } = useStore()
  const cargos = CARGOS.map((c) => c.cargo)

  const toggle = (cargo: string, eppId: string) => {
    const ex = matrizEpp.find((m) => m.cargo === cargo && m.eppId === eppId)
    if (ex) delMatriz(ex.id)
    else addMatriz({ cargo, eppId, cantidad: 1, obligatorio: true })
  }

  return (
    <Card>
      <CardHeader
        title="Matriz de EPP por cargo"
        subtitle="La que se levantó con la mutual. Marque el cruce cargo × elemento para hacerlo obligatorio."
        icon={Grid3x3}
      />
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 min-w-[230px] bg-surface-soft">Cargo</th>
              {epp.map((e) => (
                <th key={e.id} className="!px-1 text-center" style={{ minWidth: 62 }}>
                  <span className="block whitespace-normal text-[9px] leading-tight">{e.nombre}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargos.map((c) => (
              <tr key={c}>
                <td className="sticky left-0 z-10 bg-surface-raised text-[13px] font-medium text-ink">{c}</td>
                {epp.map((e) => {
                  const on = matrizEpp.some((m) => m.cargo === c && m.eppId === e.id)
                  return (
                    <td key={e.id} className="!p-1 text-center">
                      <button
                        onClick={() => toggle(c, e.id)}
                        aria-label={`${on ? 'Quitar' : 'Exigir'} ${e.nombre} para ${c}`}
                        aria-pressed={on}
                        className={cn(
                          'mx-auto grid h-6 w-6 cursor-pointer place-items-center rounded transition-colors duration-200',
                          on
                            ? 'bg-brand-500/25 text-brand-700 dark:text-brand-300'
                            : 'border border-dashed border-hairline text-transparent hover:border-brand-500/50 hover:text-brand-500/40',
                        )}
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ═══════════════════ Entregas ═══════════════════ */

function Entregas() {
  const { trabajadores, epp, entregasEpp, matrizEpp, entregarEpp, campoActivo } = useStore()
  const [modal, setModal] = useState(false)
  const [q, setQ] = useState('')
  const [f, setF] = useState<Omit<EntregaEPP, 'id'>>({
    fecha: hoy(), trabajadorId: '', eppId: '', cantidad: 1,
    motivo: 'ENTREGA INICIAL', firmado: true,
  })

  const dotacion = trabajadores.filter(
    (t) => t.estado.startsWith('ACTIVO') && (campoActivo === 'TODOS' || t.campo === campoActivo),
  )

  const lista = useMemo(() => {
    const t = q.trim().toUpperCase()
    return entregasEpp
      .map((e) => ({ e, t: trabajadores.find((x) => x.id === e.trabajadorId), i: epp.find((x) => x.id === e.eppId) }))
      .filter((x) => x.t && x.i)
      .filter((x) => !t || `${x.t!.nombres} ${x.t!.apellidos} ${x.i!.nombre}`.toUpperCase().includes(t))
      .sort((a, b) => b.e.fecha.localeCompare(a.e.fecha))
  }, [entregasEpp, trabajadores, epp, q])

  const trabajadorSel = trabajadores.find((t) => t.id === f.trabajadorId)
  const sugeridos = trabajadorSel
    ? matrizEpp.filter((m) => m.cargo === trabajadorSel.cargo).map((m) => m.eppId)
    : []

  const guardar = () => {
    if (!f.trabajadorId || !f.eppId) return alerta.aviso('Faltan datos', 'Seleccione trabajador y elemento.')
    const r = entregarEpp(f)
    if (!r.ok) return alerta.error('No se pudo registrar', r.msg)
    setModal(false)
    alerta.ok('Entrega registrada', 'El stock se descontó automáticamente.')
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Registro de entregas"
          subtitle="Cada entrega descuenta stock y queda como respaldo firmado"
          icon={PackageCheck}
          actions={<>
            <SearchInput value={q} onChange={setQ} placeholder="Trabajador o EPP…" className="w-52" />
            <button onClick={() => setModal(true)} className="btn-primary !min-h-0 !py-1.5">
              <Plus className="h-4 w-4" />Entregar EPP</button>
          </>}
        />
        {lista.length === 0 ? (
          <Vacio titulo="Sin entregas registradas" detalle="Registre la primera entrega para iniciar la trazabilidad." icon={PackageCheck} />
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <table className="tbl">
              <thead>
                <tr><th>Fecha</th><th>Trabajador</th><th>Cargo</th><th>EPP</th>
                    <th className="text-right">Cant.</th><th>Motivo</th><th>Firma</th></tr>
              </thead>
              <tbody>
                {lista.map(({ e, t, i }) => (
                  <tr key={e.id}>
                    <td className="tnum whitespace-nowrap text-ink-soft">{e.fecha}</td>
                    <td className="font-medium text-ink">{t!.apellidos}, {t!.nombres}</td>
                    <td className="text-[12px] text-ink-faint">{t!.cargo}</td>
                    <td className="text-ink-soft">{i!.nombre}</td>
                    <td className="tnum text-right text-ink-soft">{e.cantidad}</td>
                    <td className="text-[12px] text-ink-faint">{e.motivo}</td>
                    <td><Badge tone={e.firmado ? 'brand' : 'amber'}>{e.firmado ? 'Firmado' : 'Pendiente'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Entregar EPP"
             subtitle="El stock se descuenta al confirmar"
             footer={<><button onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
                       <button onClick={guardar} className="btn-primary">Registrar entrega</button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fecha">
            <input type="date" className="input" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
          </Field>
          <Field label="Trabajador">
            <Select value={f.trabajadorId} onChange={(v) => setF({ ...f, trabajadorId: v })}
                    placeholder="Seleccionar…"
                    options={dotacion.map((t) => ({ value: t.id, label: `${t.apellidos}, ${t.nombres}` }))} />
          </Field>
          <Field label="Elemento"
                 hint={sugeridos.length ? `${sugeridos.length} exigidos por la matriz del cargo` : undefined}
                 className="sm:col-span-2">
            <Select value={f.eppId} onChange={(v) => setF({ ...f, eppId: v })} placeholder="Seleccionar…"
                    options={epp
                      .slice()
                      .sort((a, b) => Number(sugeridos.includes(b.id)) - Number(sugeridos.includes(a.id)))
                      .map((e) => ({
                        value: e.id,
                        label: `${sugeridos.includes(e.id) ? '★ ' : ''}${e.nombre} — stock ${e.stock}`,
                      }))} />
          </Field>
          <Field label="Cantidad">
            <input type="number" min={1} className="input tnum" value={f.cantidad}
                   onChange={(e) => setF({ ...f, cantidad: Number(e.target.value) })} />
          </Field>
          <Field label="Motivo">
            <Select value={f.motivo} onChange={(v) => setF({ ...f, motivo: v as EntregaEPP['motivo'] })}
                    options={['ENTREGA INICIAL', 'RENOVACIÓN', 'REPOSICIÓN POR DAÑO', 'REPOSICIÓN POR PÉRDIDA']} />
          </Field>
          <Field label="Respaldo" className="sm:col-span-2">
            <label className="flex h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-hairline px-3 transition-colors duration-200 hover:border-brand-500/50">
              <input type="checkbox" checked={f.firmado} onChange={(e) => setF({ ...f, firmado: e.target.checked })}
                     className="h-4 w-4 cursor-pointer accent-brand-600" />
              <span className="text-sm text-ink-soft">El trabajador firmó la recepción</span>
            </label>
          </Field>
        </div>
      </Modal>
    </>
  )
}

/* ═══════════════════ Capacitaciones ═══════════════════ */

function Capacitaciones() {
  const { trabajadores, capacitaciones, addCapacitacion, delCapacitacion, campoActivo } = useStore()
  const [modal, setModal] = useState(false)
  const [f, setF] = useState<Omit<Capacitacion, 'id'>>({
    nombre: '', fecha: hoy(), horas: 4, relator: 'ACHS',
    campo: campoActivo === 'TODOS' ? 'BUIN' : campoActivo, vigenciaMeses: 12, asistentes: [],
  })

  const candidatos = trabajadores.filter((t) => t.estado.startsWith('ACTIVO') && t.campo === f.campo)

  const guardar = () => {
    if (!f.nombre.trim()) return alerta.aviso('Falta el nombre del curso')
    if (f.asistentes.length === 0) return alerta.aviso('Sin asistentes', 'Marque al menos un trabajador.')
    addCapacitacion(f)
    setModal(false)
    setF({ ...f, nombre: '', asistentes: [] })
    alerta.ok('Capacitación registrada', `${f.asistentes.length} asistentes quedaron en su ficha.`)
  }

  return (
    <>
      <Card>
        <CardHeader title="Registro de capacitaciones" subtitle="Base de datos de cursos — hoy se pierde entre correos"
                    icon={GraduationCap}
                    actions={<button onClick={() => setModal(true)} className="btn-primary !min-h-0 !py-1.5">
                      <Plus className="h-4 w-4" />Nueva capacitación</button>} />
        {capacitaciones.length === 0 ? (
          <Vacio titulo="Sin capacitaciones" detalle="Registre la primera para armar el historial exigido por la ACHS." icon={GraduationCap} />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Curso</th><th>Fecha</th><th>Relator</th><th>Campo</th>
                         <th className="text-right">Horas</th><th className="text-right">Asistentes</th>
                         <th>Vigencia</th><th className="w-12" /></tr></thead>
              <tbody>
                {capacitaciones.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((c) => {
                  const venc = new Date(c.fecha)
                  venc.setMonth(venc.getMonth() + c.vigenciaMeses)
                  const vigente = venc >= new Date()
                  return (
                    <tr key={c.id} className="group">
                      <td className="font-medium text-ink">{c.nombre}</td>
                      <td className="tnum whitespace-nowrap text-ink-soft">{c.fecha}</td>
                      <td className="text-ink-soft">{c.relator}</td>
                      <td className="text-[12px] text-ink-faint">{c.campo.replace('_', ' ')}</td>
                      <td className="tnum text-right text-ink-soft">{c.horas}</td>
                      <td className="tnum text-right font-medium text-ink">{c.asistentes.length}</td>
                      <td><Badge tone={vigente ? 'brand' : 'red'}>
                        {vigente ? `Hasta ${venc.toISOString().slice(0, 10)}` : 'Vencida'}</Badge></td>
                      <td>
                        <button onClick={async () => {
                          if (await alerta.eliminar(`¿Eliminar "${c.nombre}"?`)) { delCapacitacion(c.id); alerta.toast('Eliminada', 'warning') }
                        }} aria-label="Eliminar capacitación"
                          className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-ink-faint opacity-50 transition-all duration-200 hover:bg-red-500/12 hover:text-red-500 group-hover:opacity-100">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} wide title="Nueva capacitación"
             footer={<><button onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
                       <button onClick={guardar} className="btn-primary">Registrar</button></>}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nombre del curso" className="sm:col-span-2">
              <input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })}
                     placeholder="Ej.: Uso seguro de agroquímicos" />
            </Field>
            <Field label="Fecha">
              <input type="date" className="input" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
            </Field>
            <Field label="Relator">
              <input className="input" value={f.relator} onChange={(e) => setF({ ...f, relator: e.target.value })} />
            </Field>
            <Field label="Campo">
              <Select value={f.campo} onChange={(v) => setF({ ...f, campo: v, asistentes: [] })}
                      options={CAMPOS.map((c) => c.nombre)} />
            </Field>
            <Field label="Horas">
              <input type="number" min={1} className="input tnum" value={f.horas}
                     onChange={(e) => setF({ ...f, horas: Number(e.target.value) })} />
            </Field>
            <Field label="Vigencia (meses)">
              <input type="number" min={1} className="input tnum" value={f.vigenciaMeses}
                     onChange={(e) => setF({ ...f, vigenciaMeses: Number(e.target.value) })} />
            </Field>
          </div>
          <ListaAsistentes candidatos={candidatos} valor={f.asistentes}
                           onChange={(a) => setF({ ...f, asistentes: a })} />
        </div>
      </Modal>
    </>
  )
}

/* ═══════════════════ Charlas diarias ═══════════════════ */

function Charlas() {
  const { trabajadores, charlas, addCharla, delCharla, campoActivo } = useStore()
  const [modal, setModal] = useState(false)
  const [f, setF] = useState<Omit<CharlaSeguridad, 'id'>>({
    fecha: hoy(), campo: campoActivo === 'TODOS' ? 'BUIN' : campoActivo,
    laborGeneral: 'PODA', riesgos: '', medidas: '', responsable: 'Jefe de campo', asistentes: [],
  })
  const candidatos = trabajadores.filter((t) => t.estado.startsWith('ACTIVO') && t.campo === f.campo)

  const guardar = () => {
    if (!f.riesgos.trim()) return alerta.aviso('Falta el riesgo del día', 'Es el dato que exige la ACHS.')
    addCharla(f)
    setModal(false)
    setF({ ...f, riesgos: '', medidas: '', asistentes: [] })
    alerta.ok('Charla registrada', 'Queda como respaldo de cumplimiento.')
  }

  const lista = charlas
    .filter((c) => campoActivo === 'TODOS' || c.campo === campoActivo)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  return (
    <>
      <Card>
        <CardHeader
          title="Charlas de seguridad diarias"
          subtitle="Los 5 minutos del jefe de campo. Responde directamente a la evaluación de la ACHS."
          icon={Megaphone}
          actions={<button onClick={() => setModal(true)} className="btn-primary !min-h-0 !py-1.5">
            <Plus className="h-4 w-4" />Registrar charla</button>}
        />
        {lista.length === 0 ? (
          <Vacio titulo="Sin charlas registradas" detalle="Cada jornada debiera partir con la lectura de riesgos del día." icon={Megaphone} />
        ) : (
          <ul className="max-h-[60vh] divide-y divide-hairline/60 overflow-y-auto">
            {lista.map((c) => (
              <li key={c.id} className="group flex items-start gap-3 px-4 py-3 transition-colors duration-150 hover:bg-brand-500/[0.04]">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-500/15 text-accent-600 dark:text-accent-400">
                  <Megaphone className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tnum text-[12px] font-medium text-ink">{c.fecha}</span>
                    <Badge tone="slate">{c.campo.replace('_', ' ')}</Badge>
                    <Badge tone="accent">{c.laborGeneral}</Badge>
                    <span className="text-[11px] text-ink-faint">{c.asistentes.length} asistentes</span>
                  </div>
                  <p className="mt-1 text-[13px] font-medium text-ink">{c.riesgos}</p>
                  {c.medidas && <p className="mt-0.5 text-[12px] text-ink-faint">{c.medidas}</p>}
                </div>
                <button onClick={async () => {
                  if (await alerta.eliminar('¿Eliminar esta charla?')) { delCharla(c.id); alerta.toast('Eliminada', 'warning') }
                }} aria-label="Eliminar charla"
                  className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md text-ink-faint opacity-0 transition-all duration-200 hover:bg-red-500/12 hover:text-red-500 group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} wide title="Charla de seguridad del día"
             subtitle="Riesgos de la labor y medidas de control"
             footer={<><button onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
                       <button onClick={guardar} className="btn-primary">Registrar charla</button></>}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Fecha">
              <input type="date" className="input" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
            </Field>
            <Field label="Campo">
              <Select value={f.campo} onChange={(v) => setF({ ...f, campo: v, asistentes: [] })} options={CAMPOS.map((c) => c.nombre)} />
            </Field>
            <Field label="Labor del día">
              <Select value={f.laborGeneral} onChange={(v) => setF({ ...f, laborGeneral: v })} options={LABORES_GENERALES} />
            </Field>
            <Field label="Responsable">
              <input className="input" value={f.responsable} onChange={(e) => setF({ ...f, responsable: e.target.value })} />
            </Field>
          </div>
          <Field label="Riesgos identificados">
            <textarea className="input min-h-[70px] resize-y" value={f.riesgos}
                      onChange={(e) => setF({ ...f, riesgos: e.target.value })}
                      placeholder="Ej.: Corte con tijera de poda, exposición a radiación UV" />
          </Field>
          <Field label="Medidas de control">
            <textarea className="input min-h-[70px] resize-y" value={f.medidas}
                      onChange={(e) => setF({ ...f, medidas: e.target.value })}
                      placeholder="Ej.: Uso obligatorio de guantes, bloqueador cada 3 horas" />
          </Field>
          <ListaAsistentes candidatos={candidatos} valor={f.asistentes} onChange={(a) => setF({ ...f, asistentes: a })} />
        </div>
      </Modal>
    </>
  )
}

/* ═══════════════════ Selector de asistentes ═══════════════════ */

function ListaAsistentes({
  candidatos, valor, onChange,
}: {
  candidatos: { id: string; nombres: string; apellidos: string; cargo: string }[]
  valor: string[]
  onChange: (v: string[]) => void
}) {
  const toggle = (id: string) =>
    onChange(valor.includes(id) ? valor.filter((x) => x !== id) : [...valor, id])

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="label !mb-0">Asistentes ({valor.length})</label>
        <div className="flex gap-2">
          <button onClick={() => onChange(candidatos.map((c) => c.id))}
                  className="cursor-pointer text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Todos</button>
          <button onClick={() => onChange([])}
                  className="cursor-pointer text-xs font-medium text-ink-faint hover:underline">Ninguno</button>
        </div>
      </div>
      {candidatos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-hairline p-3 text-center text-xs text-ink-faint">
          No hay trabajadores activos en este campo.
        </p>
      ) : (
        <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-lg border border-hairline p-2 sm:grid-cols-2">
          {candidatos.map((t) => (
            <label key={t.id}
                   className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 transition-colors duration-200',
                                 valor.includes(t.id) ? 'border-brand-500/50 bg-brand-500/8' : 'border-transparent hover:bg-ink-faint/8')}>
              <input type="checkbox" checked={valor.includes(t.id)} onChange={() => toggle(t.id)}
                     className="h-4 w-4 cursor-pointer accent-brand-600" />
              <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{t.apellidos}, {t.nombres}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
