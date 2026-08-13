import { useMemo, useState } from 'react'
import {
  UsersRound, UserPlus, KeyRound, ShieldCheck, ScrollText, Lock, Unlock,
  CheckCircle2, XCircle, Trash2, ShieldAlert, Info, FileDown,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import {
  PERMISOS, ROL_META, estaAcotadoACampo, evaluarClave,
  type Modulo, type Rol,
} from '@/lib/auth'
import { CAMPOS } from '@/data/maestros'
import type { Usuario } from '@/lib/types'
import {
  Badge, Card, CardHeader, Field, Kpi, Modal, PageHeader, SearchInput, Select, Tabs, Vacio,
} from '@/components/ui'
import { alerta } from '@/lib/alerta'
import { exportarAuditoria } from '@/lib/excel'
import { cn, formatearRut, validarRut } from '@/lib/utils'

const ROLES: Rol[] = ['ADMIN', 'GERENCIA', 'CONTABILIDAD', 'ADMINISTRADOR_CAMPO', 'JEFE_CAMPO']

const MODULOS: { id: Modulo; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'costos', label: 'Costos y cierre' },
  { id: 'contabilidad', label: 'Contabilidad' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'tarja', label: 'Tarja digital' },
  { id: 'rrhh', label: 'Personal' },
  { id: 'combustible', label: 'Combustible' },
  { id: 'bodega', label: 'Bodega' },
  { id: 'campos', label: 'Campos' },
  { id: 'prevencion', label: 'Prevención' },
  { id: 'motivacional', label: 'Pack motivacional' },
  { id: 'plan-cuentas', label: 'Plan de cuentas' },
  { id: 'usuarios', label: 'Usuarios' },
]

export default function Usuarios() {
  const [tab, setTab] = useState('usuarios')
  const { usuarios, auditoria } = useStore()

  const activos = usuarios.filter((u) => u.activo).length
  const bloqueados = usuarios.filter((u) => u.bloqueadoHasta && Date.now() < u.bloqueadoHasta).length
  const provisorias = usuarios.filter((u) => u.debeCambiarClave).length
  const fallidos = auditoria.filter((a) => a.accion === 'INGRESO_FALLIDO').length

  return (
    <>
      <PageHeader
        titulo="Usuarios y control de acceso"
        descripcion="Quién entra, qué puede ver y qué ha hecho"
        icon={UsersRound}
      />

      <Card className="mb-5 border-l-4 border-l-accent-500">
        <div className="flex items-start gap-3 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-accent-600 dark:text-accent-400" />
          <p className="text-[13px] leading-relaxed text-ink-soft">
            <strong className="text-ink">Este control de acceso organiza, no protege.</strong>{' '}
            Mientras el sistema corra sólo en el navegador, cualquiera con conocimientos
            básicos puede leer o alterar los datos sin pasar por aquí. Las contraseñas se
            guardan con hash y sal, nunca en texto plano, pero la seguridad real llega
            cuando estas mismas reglas se validen en un servidor.
          </p>
        </div>
      </Card>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Usuarios activos" value={String(activos)} icon={UsersRound}
             sub={`${usuarios.length} en total`} />
        <Kpi label="Con clave provisoria" value={String(provisorias)} icon={KeyRound}
             tone={provisorias ? 'amber' : 'brand'} sub="Deben cambiarla al ingresar" />
        <Kpi label="Cuentas bloqueadas" value={String(bloqueados)} icon={Lock}
             tone={bloqueados ? 'red' : 'brand'} sub="Por intentos fallidos" />
        <Kpi label="Ingresos fallidos" value={String(fallidos)} icon={ShieldAlert}
             tone={fallidos > 10 ? 'red' : 'slate'} sub="Registrados en la bitácora" />
      </div>

      <div className="mb-4 max-w-lg">
        <Tabs value={tab} onChange={setTab}
              tabs={[
                { id: 'usuarios', label: 'Usuarios', count: usuarios.length },
                { id: 'permisos', label: 'Matriz de permisos' },
                { id: 'bitacora', label: 'Bitácora', count: auditoria.length },
              ]} />
      </div>

      {tab === 'usuarios' && <ListaUsuarios />}
      {tab === 'permisos' && <MatrizPermisos />}
      {tab === 'bitacora' && <Bitacora />}
    </>
  )
}

/* ═══════════════════ Lista de usuarios ═══════════════════ */

function ListaUsuarios() {
  const { usuarios, sesion, updUsuario, resetearClave } = useStore()
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)

  const lista = useMemo(() => {
    const t = q.trim().toUpperCase()
    return usuarios
      .filter((u) => !t || `${u.usuario} ${u.nombre} ${u.rut} ${u.rol}`.toUpperCase().includes(t))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [usuarios, q])

  const resetear = async (u: Usuario) => {
    const Swal = (await import('sweetalert2')).default
    const { value } = await Swal.fire({
      customClass: { popup: 'siga-swal' },
      title: `Reiniciar contraseña de ${u.nombre}`,
      html: '<p style="font-size:13px">Se le pedirá cambiarla al ingresar.</p>',
      input: 'password',
      inputPlaceholder: 'Contraseña provisoria',
      inputAttributes: { autocomplete: 'new-password' },
      showCancelButton: true,
      confirmButtonText: 'Reiniciar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#15803d',
      cancelButtonColor: '#64748b',
      reverseButtons: true,
      inputValidator: (v) => {
        const f = evaluarClave(v ?? '', [u.usuario, u.nombre])
        return f.aceptable ? null : f.problemas[0]
      },
    })
    if (!value) return
    const r = await resetearClave(u.id, value as string)
    if (!r.ok) return alerta.error('No se pudo reiniciar', r.msg)
    alerta.ok('Contraseña reiniciada', `Entregue la clave provisoria a ${u.nombre}.`)
  }

  const desbloquear = (u: Usuario) => {
    updUsuario(u.id, { bloqueadoHasta: undefined, intentosFallidos: 0 })
    alerta.toast('Cuenta desbloqueada')
  }

  const alternarActivo = async (u: Usuario) => {
    if (u.id === sesion?.usuarioId)
      return alerta.aviso('No puede desactivarse a sí mismo', 'Pida a otro administrador que lo haga.')
    if (u.activo) {
      const ok = await alerta.confirmar(`¿Desactivar a ${u.nombre}?`, 'No podrá ingresar al sistema.', 'Desactivar')
      if (!ok) return
    }
    updUsuario(u.id, { activo: !u.activo })
    alerta.toast(u.activo ? 'Usuario desactivado' : 'Usuario activado')
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Usuarios del sistema"
          subtitle="Cada rol ve un conjunto distinto de módulos y campos"
          icon={UsersRound}
          actions={
            <>
              <SearchInput value={q} onChange={setQ} placeholder="Nombre, usuario o RUT…" className="w-56" />
              <button onClick={() => setModal(true)} className="btn-primary !min-h-0 !py-1.5">
                <UserPlus className="h-4 w-4" />Nuevo usuario
              </button>
            </>
          }
        />
        {lista.length === 0 ? (
          <Vacio titulo="Sin usuarios" icon={UsersRound} />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nombre</th><th>Usuario</th><th>RUT</th><th>Rol</th><th>Campos</th>
                  <th>Último ingreso</th><th>Estado</th><th className="w-28 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((u) => {
                  const bloqueado = !!u.bloqueadoHasta && Date.now() < u.bloqueadoHasta
                  return (
                    <tr key={u.id} className="group">
                      <td className="font-medium text-ink">
                        {u.nombre}
                        {u.id === sesion?.usuarioId && (
                          <span className="ml-2 text-[11px] text-brand-600 dark:text-brand-400">(usted)</span>
                        )}
                      </td>
                      <td className="font-mono text-[12px] text-ink-soft">{u.usuario}</td>
                      <td className="tnum font-mono text-[12px] text-ink-faint">{u.rut}</td>
                      <td><Badge tone={ROL_META[u.rol].color}>{ROL_META[u.rol].label}</Badge></td>
                      <td className="text-[12px] text-ink-soft">
                        {u.campos.length ? u.campos.map((c) => c.replace('_', ' ')).join(', ') : 'Todos'}
                      </td>
                      <td className="tnum whitespace-nowrap text-[12px] text-ink-faint">
                        {u.ultimoIngreso ? u.ultimoIngreso.slice(0, 16).replace('T', ' ') : 'Nunca'}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={u.activo ? 'brand' : 'slate'}>
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                          {bloqueado && <Badge tone="red"><Lock className="h-3 w-3" />Bloqueado</Badge>}
                          {u.debeCambiarClave && <Badge tone="amber">Clave provisoria</Badge>}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity duration-200 group-hover:opacity-100">
                          <button onClick={() => resetear(u)} aria-label={`Reiniciar clave de ${u.nombre}`}
                                  title="Reiniciar contraseña"
                                  className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-ink-faint transition-colors duration-200 hover:bg-brand-500/12 hover:text-brand-600 dark:hover:text-brand-400">
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          {bloqueado && (
                            <button onClick={() => desbloquear(u)} aria-label={`Desbloquear a ${u.nombre}`}
                                    title="Desbloquear"
                                    className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-ink-faint transition-colors duration-200 hover:bg-sky-500/12 hover:text-sky-600 dark:hover:text-sky-400">
                              <Unlock className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button onClick={() => alternarActivo(u)}
                                  aria-label={`${u.activo ? 'Desactivar' : 'Activar'} a ${u.nombre}`}
                                  title={u.activo ? 'Desactivar' : 'Activar'}
                                  className={cn('grid h-7 w-7 cursor-pointer place-items-center rounded-md transition-colors duration-200',
                                                u.activo ? 'text-ink-faint hover:bg-red-500/12 hover:text-red-500'
                                                         : 'text-ink-faint hover:bg-brand-500/12 hover:text-brand-600')}>
                            {u.activo ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
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

      {modal && <EditorUsuario onClose={() => setModal(false)} />}
    </>
  )
}

function EditorUsuario({ onClose }: { onClose: () => void }) {
  const { crearUsuario } = useStore()
  const [f, setF] = useState({
    usuario: '', nombre: '', rut: '', rol: 'JEFE_CAMPO' as Rol,
    campos: [] as string[], cargo: '', email: '', activo: true,
  })
  const [clave, setClave] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})

  const fuerza = evaluarClave(clave, [f.usuario, f.nombre])
  const acotado = estaAcotadoACampo(f.rol)

  const guardar = async () => {
    const e: Record<string, string> = {}
    if (!f.usuario.trim()) e.usuario = 'Obligatorio'
    else if (!/^[a-z0-9._-]+$/i.test(f.usuario.trim())) e.usuario = 'Sólo letras, números, punto, guion y guion bajo'
    if (!f.nombre.trim()) e.nombre = 'Obligatorio'
    if (!f.rut.trim()) e.rut = 'Obligatorio'
    else if (!validarRut(f.rut)) e.rut = 'RUT inválido'
    if (!fuerza.aceptable) e.clave = fuerza.problemas[0]
    if (acotado && f.campos.length === 0) e.campos = 'Asigne al menos un campo'
    setErrores(e)
    if (Object.keys(e).length) return

    const r = await crearUsuario({ ...f, rut: formatearRut(f.rut) }, clave)
    if (!r.ok) return alerta.error('No se pudo crear', r.msg)
    alerta.ok('Usuario creado', `Entregue la clave provisoria a ${f.nombre}. Deberá cambiarla al ingresar.`)
    onClose()
  }

  const toggleCampo = (c: string) =>
    setF((s) => ({ ...s, campos: s.campos.includes(c) ? s.campos.filter((x) => x !== c) : [...s.campos, c] }))

  return (
    <Modal open onClose={onClose} wide title="Nuevo usuario"
           subtitle="La contraseña que asigne será provisoria: el usuario deberá cambiarla al ingresar"
           footer={<><button onClick={onClose} className="btn-ghost">Cancelar</button>
                     <button onClick={guardar} className="btn-primary">Crear usuario</button></>}>
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nombre completo" error={errores.nombre}>
            <input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          </Field>
          <Field label="Usuario de acceso" error={errores.usuario} hint="En minúsculas, sin espacios">
            <input className="input font-mono" value={f.usuario}
                   onChange={(e) => setF({ ...f, usuario: e.target.value.toLowerCase() })} />
          </Field>
          <Field label="RUT" error={errores.rut}>
            <input className="input tnum font-mono" value={f.rut} placeholder="12.345.678-9"
                   onChange={(e) => setF({ ...f, rut: e.target.value })}
                   onBlur={(e) => validarRut(e.target.value) && setF({ ...f, rut: formatearRut(e.target.value) })} />
          </Field>
          <Field label="Cargo">
            <input className="input" value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value })} />
          </Field>
          <Field label="Correo">
            <input type="email" className="input" value={f.email}
                   onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Rol" hint={ROL_META[f.rol].descripcion}>
            <Select value={f.rol} onChange={(v) => setF({ ...f, rol: v as Rol, campos: [] })}
                    options={ROLES.map((r) => ({ value: r, label: ROL_META[r].label }))} />
          </Field>
        </div>

        <Field label={`Campos asignados${acotado ? '' : ' (opcional — sin selección ve todos)'}`}
               error={errores.campos}>
          <div className="flex flex-wrap gap-2">
            {CAMPOS.filter((c) => c.nombre !== 'GENERAL').map((c) => (
              <label key={c.nombre}
                     className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] transition-colors duration-200',
                                   f.campos.includes(c.nombre)
                                     ? 'border-brand-500 bg-brand-500/10 text-ink'
                                     : 'border-hairline text-ink-soft hover:border-ink-faint/50')}>
                <input type="checkbox" checked={f.campos.includes(c.nombre)}
                       onChange={() => toggleCampo(c.nombre)}
                       className="h-4 w-4 cursor-pointer accent-brand-600" />
                {c.nombre.replace('_', ' ')}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Contraseña provisoria" error={errores.clave}
               hint={clave ? `${fuerza.etiqueta}${fuerza.problemas.length ? ` · ${fuerza.problemas[0]}` : ''}` : 'Mínimo 8 caracteres, con letras y números'}>
          <input type="text" className="input font-mono" value={clave}
                 onChange={(e) => setClave(e.target.value)} autoComplete="off" />
        </Field>

        <div className="rounded-lg border border-hairline bg-surface-soft p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-ink">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
            Lo que verá este rol
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MODULOS.map((m) => {
              const p = PERMISOS[f.rol][m.id]
              if (p === 'ninguno') return null
              return (
                <Badge key={m.id} tone={p === 'editar' ? 'brand' : 'slate'}>
                  {m.label}{p === 'ver' ? ' · sólo ver' : ''}
                </Badge>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ═══════════════════ Matriz de permisos ═══════════════════ */

function MatrizPermisos() {
  return (
    <Card>
      <CardHeader
        title="Matriz de permisos por rol"
        subtitle="Está escrita a partir de cómo trabaja hoy la empresa"
        icon={ShieldCheck}
      />
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 min-w-[170px] bg-surface-soft">Módulo</th>
              {ROLES.map((r) => (
                <th key={r} className="text-center" style={{ minWidth: 120 }}>
                  <span className="block whitespace-normal leading-tight">{ROL_META[r].label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULOS.map((m) => (
              <tr key={m.id}>
                <td className="sticky left-0 z-10 bg-surface-raised font-medium text-ink">{m.label}</td>
                {ROLES.map((r) => {
                  const p = PERMISOS[r][m.id]
                  return (
                    <td key={r} className="text-center">
                      {p === 'editar' ? <Badge tone="brand">Editar</Badge>
                        : p === 'ver' ? <Badge tone="slate">Sólo ver</Badge>
                        : <span className="text-[12px] text-ink-faint/50">—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-start gap-2 border-t border-hairline p-4">
        <Info className="mt-px h-4 w-4 shrink-0 text-ink-faint" />
        <p className="text-[12px] leading-relaxed text-ink-soft">
          Los roles de terreno —administrador y jefe de campo— quedan además acotados a los
          campos que tengan asignados: no pueden cambiar el selector de campo de la barra
          superior.
        </p>
      </div>
    </Card>
  )
}

/* ═══════════════════ Bitácora ═══════════════════ */

const TONO_ACCION: Record<string, string> = {
  INGRESO: 'brand', SALIDA: 'slate', INGRESO_FALLIDO: 'red',
  CREAR: 'sky', MODIFICAR: 'accent', ELIMINAR: 'red',
  CONTABILIZAR: 'violet', EXPORTAR: 'slate', AJUSTE: 'amber',
}

function Bitacora() {
  const { auditoria } = useStore()
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('TODAS')

  const lista = useMemo(() => {
    const t = q.trim().toUpperCase()
    return auditoria
      .filter((a) => filtro === 'TODAS' || a.accion === filtro)
      .filter((a) => !t || `${a.usuario} ${a.modulo} ${a.detalle}`.toUpperCase().includes(t))
      .slice(0, 400)
  }, [auditoria, q, filtro])

  return (
    <Card>
      <CardHeader
        title="Bitácora del sistema"
        subtitle="Quién hizo qué y cuándo — es la base del control documental que exige ISO 9000"
        icon={ScrollText}
        actions={
          <>
            <Select value={filtro} onChange={setFiltro} className="w-44"
                    options={['TODAS', 'INGRESO', 'INGRESO_FALLIDO', 'SALIDA', 'CREAR',
                              'MODIFICAR', 'ELIMINAR', 'CONTABILIZAR', 'EXPORTAR', 'AJUSTE']} />
            <SearchInput value={q} onChange={setQ} placeholder="Usuario, módulo o detalle…" className="w-52" />
            <button onClick={() => { exportarAuditoria(auditoria); alerta.toast('Bitácora descargada') }}
                    className="btn-ghost !min-h-0 !py-1.5">
              <FileDown className="h-4 w-4" />Exportar
            </button>
          </>
        }
      />
      {lista.length === 0 ? (
        <Vacio titulo="Sin registros" detalle="La bitácora se llena a medida que se usa el sistema." icon={ScrollText} />
      ) : (
        <div className="max-h-[62vh] overflow-auto">
          <table className="tbl">
            <thead>
              <tr><th>Fecha y hora</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Módulo</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id}>
                  <td className="tnum whitespace-nowrap text-[12px] text-ink-soft">
                    {a.fecha.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td className="text-[12px] font-medium text-ink">{a.usuario}</td>
                  <td className="text-[11px] text-ink-faint">
                    {a.rol ? ROL_META[a.rol as Rol]?.label ?? a.rol : '—'}
                  </td>
                  <td><Badge tone={TONO_ACCION[a.accion] ?? 'slate'}>{a.accion.replace('_', ' ')}</Badge></td>
                  <td className="text-[12px] text-ink-soft">{a.modulo}</td>
                  <td className="max-w-[340px] truncate text-[12px] text-ink-faint" title={a.detalle}>
                    {a.detalle}
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
