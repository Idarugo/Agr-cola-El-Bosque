import { useMemo, useState } from 'react'
import {
  Users,
  UserPlus,
  Pencil,
  Trash2,
  IdCard,
  Briefcase,
  Landmark,
  ShieldCheck,
  GraduationCap,
  Sprout,
  CircleDollarSign,
  UserRound,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { CAMPOS, CARGOS, cuentaDeCargo } from '@/data/maestros'
import type { EstadoTrabajador, TipoContrato, Trabajador } from '@/lib/types'
import {
  Badge, Card, CardHeader, Field, Kpi, Modal, PageHeader, SearchInput, Select, Tabs, Vacio,
} from '@/components/ui'
import { alerta } from '@/lib/alerta'
import { cn, formatearRut, limpiarRut, money, suma, validarRut } from '@/lib/utils'

const ESTADOS: EstadoTrabajador[] = ['ACTIVO', 'ACTIVO-LICENCIA', 'FINIQUITO PENDIENTE', 'FINIQUITADO']
const CONTRATOS: TipoContrato[] = ['INDEFINIDO', 'PLAZO FIJO', 'POR FAENA', 'HONORARIOS']

const TONO_ESTADO: Record<string, string> = {
  ACTIVO: 'brand',
  'ACTIVO-LICENCIA': 'violet',
  'FINIQUITO PENDIENTE': 'amber',
  FINIQUITADO: 'slate',
}

type Form = Omit<Trabajador, 'id' | 'semillas'>

const nuevo = (campo: string): Form => ({
  rut: '', nombres: '', apellidos: '', cargo: CARGOS[0]?.cargo ?? '',
  campo: campo === 'TODOS' ? 'BUIN' : campo,
  estado: 'ACTIVO', tipoContrato: 'INDEFINIDO',
  fechaIngreso: new Date().toISOString().slice(0, 10),
  sueldoBase: 510000, telefono: '', tallaRopa: 'M', tallaCalzado: '41',
  banco: 'Banco Estado', tipoCuenta: 'Cuenta RUT', nroCuenta: '',
  afp: 'Modelo', salud: 'Fonasa',
})

export default function RRHH() {
  const { trabajadores, campoActivo, addTrabajador, updTrabajador, delTrabajador,
          capacitaciones, entregasEpp } = useStore()
  const [q, setQ] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('ACTIVOS')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Trabajador | null>(null)
  const [form, setForm] = useState<Form>(nuevo(campoActivo))
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [ficha, setFicha] = useState<Trabajador | null>(null)

  const delCampo = useMemo(
    () => trabajadores.filter((t) => campoActivo === 'TODOS' || t.campo === campoActivo),
    [trabajadores, campoActivo],
  )

  const lista = useMemo(() => {
    const t = q.trim().toUpperCase()
    return delCampo
      .filter((x) =>
        filtroEstado === 'ACTIVOS' ? x.estado.startsWith('ACTIVO')
        : filtroEstado === 'TODOS' ? true
        : x.estado === filtroEstado,
      )
      .filter((x) =>
        !t ? true
        : `${x.nombres} ${x.apellidos} ${x.rut} ${x.cargo}`.toUpperCase().includes(t) ||
          limpiarRut(x.rut).includes(limpiarRut(t)),
      )
      .sort((a, b) => a.apellidos.localeCompare(b.apellidos))
  }, [delCampo, q, filtroEstado])

  const activos = delCampo.filter((t) => t.estado.startsWith('ACTIVO'))
  const masaSalarial = suma(activos, (t) => t.sueldoBase)

  const abrirNuevo = () => {
    setEditando(null)
    setForm(nuevo(campoActivo))
    setErrores({})
    setModal(true)
  }

  const abrirEditar = (t: Trabajador) => {
    setEditando(t)
    const { id, semillas, ...rest } = t
    setForm(rest)
    setErrores({})
    setModal(true)
  }

  const validar = () => {
    const e: Record<string, string> = {}
    if (!form.nombres.trim()) e.nombres = 'Obligatorio'
    if (!form.apellidos.trim()) e.apellidos = 'Obligatorio'
    if (!form.rut.trim()) e.rut = 'Obligatorio'
    else if (!validarRut(form.rut)) e.rut = 'RUT inválido — revise el dígito verificador'
    else {
      const dup = trabajadores.find(
        (t) => limpiarRut(t.rut) === limpiarRut(form.rut) && t.id !== editando?.id,
      )
      if (dup) e.rut = `Ya existe: ${dup.nombres} ${dup.apellidos}`
    }
    if (!form.sueldoBase || form.sueldoBase < 1) e.sueldoBase = 'Debe ser mayor a cero'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const guardar = () => {
    if (!validar()) {
      alerta.aviso('Revise el formulario', 'Hay campos con errores.')
      return
    }
    const datos = { ...form, rut: formatearRut(form.rut) }
    if (editando) {
      updTrabajador(editando.id, datos)
      alerta.toast('Trabajador actualizado')
    } else {
      addTrabajador(datos)
      alerta.toast('Trabajador incorporado')
    }
    setModal(false)
  }

  const eliminar = async (t: Trabajador) => {
    const ok = await alerta.eliminar(
      `¿Eliminar a ${t.nombres} ${t.apellidos}?`,
      'Se borrarán también sus registros de tarja. Para bajas normales use el estado FINIQUITADO.',
    )
    if (ok) {
      delTrabajador(t.id)
      alerta.toast('Trabajador eliminado', 'warning')
    }
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((s) => ({ ...s, [k]: v }))

  return (
    <>
      <PageHeader
        titulo="Personal"
        descripcion={`Dotación de ${campoActivo === 'TODOS' ? 'todos los campos' : campoActivo.replace('_', ' ')}. Cada cargo queda enlazado a su cuenta contable.`}
        icon={Users}
      >
        <button onClick={abrirNuevo} className="btn-primary">
          <UserPlus className="h-4 w-4" />
          Nuevo trabajador
        </button>
      </PageHeader>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Dotación activa" value={String(activos.length)} icon={Users}
             sub={`${delCampo.length} en total`} />
        <Kpi label="Masa salarial base" value={money(masaSalarial)} icon={CircleDollarSign} tone="accent"
             sub="Suma de sueldos base" />
        <Kpi label="Con licencia médica" value={String(delCampo.filter((t) => t.estado === 'ACTIVO-LICENCIA').length)}
             icon={ShieldCheck} tone="violet" sub="Control interno" />
        <Kpi label="Sueldo promedio" value={money(activos.length ? masaSalarial / activos.length : 0)}
             icon={Briefcase} tone="sky" sub="Base contractual" />
      </div>

      <Card>
        <CardHeader
          title="Nómina de personal"
          subtitle={`${lista.length} trabajador(es)`}
          icon={IdCard}
          actions={
            <>
              <Select
                value={filtroEstado}
                onChange={setFiltroEstado}
                options={['ACTIVOS', 'TODOS', ...ESTADOS]}
                className="w-44"
              />
              <SearchInput value={q} onChange={setQ} placeholder="Nombre, RUT o cargo…" className="w-56" />
            </>
          }
        />
        {lista.length === 0 ? (
          <Vacio
            titulo="Sin trabajadores"
            detalle="Ajuste los filtros o incorpore el primer trabajador del campo."
            icon={UserRound}
            accion={<button onClick={abrirNuevo} className="btn-primary">
              <UserPlus className="h-4 w-4" />Nuevo trabajador</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Trabajador</th>
                  <th>RUT</th>
                  <th>Cargo</th>
                  <th>Cuenta N4</th>
                  <th>Campo</th>
                  <th>Contrato</th>
                  <th className="text-right">Sueldo base</th>
                  <th>Estado</th>
                  <th className="w-24 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((t) => {
                  const cta = cuentaDeCargo(t.cargo)
                  return (
                    <tr key={t.id} className="group">
                      <td>
                        <button
                          onClick={() => setFicha(t)}
                          className="cursor-pointer text-left font-medium text-ink transition-colors duration-200 hover:text-brand-600 dark:hover:text-brand-400"
                        >
                          {t.apellidos}, {t.nombres}
                        </button>
                      </td>
                      <td className="tnum whitespace-nowrap font-mono text-[12px] text-ink-soft">{t.rut}</td>
                      <td className="text-ink-soft">{t.cargo}</td>
                      <td>
                        <span className="tnum inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-faint">
                          <code className="rounded bg-ink-faint/12 px-1.5 py-0.5 font-semibold">
                            {cta?.codigoN4 ?? '—'}
                          </code>
                          {cta?.cuentaN4 ?? 'sin mapear'}
                        </span>
                      </td>
                      <td className="text-ink-soft">{t.campo.replace('_', ' ')}</td>
                      <td className="text-[12px] text-ink-faint">{t.tipoContrato}</td>
                      <td className="tnum whitespace-nowrap text-right font-medium text-ink">
                        {money(t.sueldoBase)}
                      </td>
                      <td>
                        <Badge tone={TONO_ESTADO[t.estado]}>{t.estado}</Badge>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity duration-200 group-hover:opacity-100">
                          <button
                            onClick={() => abrirEditar(t)}
                            aria-label={`Editar a ${t.nombres}`}
                            className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-ink-faint transition-colors duration-200 hover:bg-brand-500/12 hover:text-brand-600 dark:hover:text-brand-400"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => eliminar(t)}
                            aria-label={`Eliminar a ${t.nombres}`}
                            className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-ink-faint transition-colors duration-200 hover:bg-red-500/12 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Formulario ── */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        wide
        title={editando ? 'Editar trabajador' : 'Nuevo trabajador'}
        subtitle="Ficha de ingreso — reemplaza la Ficha Ingreso Trabajador AEB en papel"
        footer={
          <>
            <button onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
            <button onClick={guardar} className="btn-primary">
              {editando ? 'Guardar cambios' : 'Incorporar trabajador'}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <Seccion titulo="Identificación" icon={IdCard}>
            <Field label="RUT" error={errores.rut} className="sm:col-span-1">
              <input
                className="input tnum font-mono"
                value={form.rut}
                onChange={(e) => set('rut', e.target.value)}
                onBlur={(e) => validarRut(e.target.value) && set('rut', formatearRut(e.target.value))}
                placeholder="12.345.678-9"
              />
            </Field>
            <Field label="Nombres" error={errores.nombres}>
              <input className="input" value={form.nombres} onChange={(e) => set('nombres', e.target.value)} />
            </Field>
            <Field label="Apellidos" error={errores.apellidos}>
              <input className="input" value={form.apellidos} onChange={(e) => set('apellidos', e.target.value)} />
            </Field>
            <Field label="Teléfono">
              <input className="input" value={form.telefono ?? ''} onChange={(e) => set('telefono', e.target.value)} placeholder="+569…" />
            </Field>
          </Seccion>

          <Seccion titulo="Vínculo laboral" icon={Briefcase}>
            <Field label="Cargo" hint={cuentaDeCargo(form.cargo)
              ? `Imputa a ${cuentaDeCargo(form.cargo)!.cuentaN4} (${cuentaDeCargo(form.cargo)!.codigoN4})`
              : 'Cargo sin cuenta asociada'}>
              <Select value={form.cargo} onChange={(v) => set('cargo', v)} options={CARGOS.map((c) => c.cargo)} />
            </Field>
            <Field label="Campo">
              <Select value={form.campo} onChange={(v) => set('campo', v)} options={CAMPOS.map((c) => c.nombre)} />
            </Field>
            <Field label="Tipo de contrato">
              <Select value={form.tipoContrato} onChange={(v) => set('tipoContrato', v as TipoContrato)} options={CONTRATOS} />
            </Field>
            <Field label="Estado">
              <Select value={form.estado} onChange={(v) => set('estado', v as EstadoTrabajador)} options={ESTADOS} />
            </Field>
            <Field label="Fecha de ingreso">
              <input type="date" className="input" value={form.fechaIngreso} onChange={(e) => set('fechaIngreso', e.target.value)} />
            </Field>
            <Field label="Sueldo base (CLP)" error={errores.sueldoBase} hint={money(form.sueldoBase)}>
              <input type="number" className="input tnum" value={form.sueldoBase}
                     onChange={(e) => set('sueldoBase', Number(e.target.value))} min={0} step={1000} />
            </Field>
          </Seccion>

          <Seccion titulo="Pago y previsión" icon={Landmark}>
            <Field label="Banco">
              <Select value={form.banco ?? ''} onChange={(v) => set('banco', v)}
                      options={['Banco Estado', 'Banco de Chile', 'BCI', 'Santander', 'Scotiabank', 'Itaú', 'Falabella']} />
            </Field>
            <Field label="Tipo de cuenta">
              <Select value={form.tipoCuenta ?? ''} onChange={(v) => set('tipoCuenta', v)}
                      options={['Cuenta RUT', 'Cuenta Vista', 'Cuenta Corriente', 'Cuenta de Ahorro']} />
            </Field>
            <Field label="N° de cuenta" hint="Se usa para generar la nómina bancaria">
              <input className="input tnum font-mono" value={form.nroCuenta ?? ''} onChange={(e) => set('nroCuenta', e.target.value)} />
            </Field>
            <Field label="AFP">
              <Select value={form.afp ?? ''} onChange={(v) => set('afp', v)}
                      options={['Habitat', 'Provida', 'Cuprum', 'Modelo', 'PlanVital', 'Capital', 'Uno']} />
            </Field>
            <Field label="Salud">
              <Select value={form.salud ?? ''} onChange={(v) => set('salud', v)}
                      options={['Fonasa', 'Colmena', 'Cruz Blanca', 'Banmédica', 'Consalud', 'Vida Tres']} />
            </Field>
          </Seccion>

          <Seccion titulo="Datos para EPP" icon={ShieldCheck}>
            <Field label="Talla de ropa" hint="Necesario para entregar EPP correctamente">
              <Select value={form.tallaRopa ?? ''} onChange={(v) => set('tallaRopa', v)} options={['XS', 'S', 'M', 'L', 'XL', 'XXL']} />
            </Field>
            <Field label="Talla de calzado">
              <input className="input tnum" value={form.tallaCalzado ?? ''} onChange={(e) => set('tallaCalzado', e.target.value)} />
            </Field>
          </Seccion>
        </div>
      </Modal>

      {/* ── Ficha del trabajador ── */}
      <Modal
        open={!!ficha}
        onClose={() => setFicha(null)}
        wide
        title={ficha ? `${ficha.nombres} ${ficha.apellidos}` : ''}
        subtitle={ficha ? `${ficha.cargo} · ${ficha.campo.replace('_', ' ')}` : ''}
        footer={<button onClick={() => setFicha(null)} className="btn-ghost">Cerrar</button>}
      >
        {ficha && <FichaTrabajador t={ficha} capacitaciones={capacitaciones} entregas={entregasEpp} />}
      </Modal>
    </>
  )
}

function Seccion({ titulo, icon: Icon, children }: { titulo: string; icon: any; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-ink">
        <Icon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
        {titulo}
      </h4>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  )
}

function FichaTrabajador({ t, capacitaciones, entregas }: { t: Trabajador; capacitaciones: any[]; entregas: any[] }) {
  const { tarja, epp } = useStore()
  const misCap = capacitaciones.filter((c) => c.asistentes.includes(t.id))
  const misEpp = entregas.filter((e) => e.trabajadorId === t.id)
  const misDias = tarja.filter((r) => r.trabajadorId === t.id)
  const jornadas = suma(misDias, (r) => r.jornadas)
  const cta = cuentaDeCargo(t.cargo)

  const datos = [
    ['RUT', t.rut], ['Estado', t.estado], ['Contrato', t.tipoContrato],
    ['Ingreso', t.fechaIngreso], ['Sueldo base', money(t.sueldoBase)],
    ['Cuenta contable', `${cta?.codigoN4 ?? '—'} · ${cta?.cuentaN4 ?? '—'}`],
    ['AFP', t.afp ?? '—'], ['Salud', t.salud ?? '—'],
    ['Banco', `${t.banco ?? '—'} · ${t.tipoCuenta ?? ''}`],
    ['Talla ropa / calzado', `${t.tallaRopa ?? '—'} / ${t.tallaCalzado ?? '—'}`],
  ]

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Jornadas registradas" value={String(jornadas)} icon={Sprout} />
        <Kpi label="Capacitaciones" value={String(misCap.length)} icon={GraduationCap} tone="sky" />
        <Kpi label="Semillas acumuladas" value={String(t.semillas)} icon={ShieldCheck} tone="accent" />
      </div>

      <Card>
        <CardHeader title="Datos contractuales" icon={IdCard} />
        <dl className="grid gap-x-6 gap-y-2 p-4 sm:grid-cols-2">
          {datos.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 border-b border-hairline/50 py-1">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{k}</dt>
              <dd className="truncate text-[13px] text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <CardHeader title="Capacitaciones y cursos" subtitle={`${misCap.length} realizada(s)`} icon={GraduationCap} />
        {misCap.length === 0 ? (
          <Vacio titulo="Sin capacitaciones registradas" detalle="Se cargan desde el módulo de Prevención." icon={GraduationCap} />
        ) : (
          <ul className="divide-y divide-hairline/60">
            {misCap.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink">{c.nombre}</p>
                  <p className="text-[11px] text-ink-faint">{c.relator} · {c.horas} h</p>
                </div>
                <Badge tone="sky">{c.fecha}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Historial de EPP entregado" subtitle={`${misEpp.length} entrega(s)`} icon={ShieldCheck} />
        {misEpp.length === 0 ? (
          <Vacio titulo="Sin entregas de EPP" detalle="El historial se genera al entregar EPP desde Prevención." icon={ShieldCheck} />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Fecha</th><th>EPP</th><th>Motivo</th><th>Firmado</th></tr></thead>
              <tbody>
                {misEpp.map((e) => (
                  <tr key={e.id}>
                    <td className="tnum whitespace-nowrap text-ink-soft">{e.fecha}</td>
                    <td className="text-ink">{epp.find((x) => x.id === e.eppId)?.nombre ?? '—'}</td>
                    <td className="text-[12px] text-ink-faint">{e.motivo}</td>
                    <td>
                      <Badge tone={e.firmado ? 'brand' : 'amber'}>{e.firmado ? 'Sí' : 'Pendiente'}</Badge>
                    </td>
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
