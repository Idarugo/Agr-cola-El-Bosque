import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Asiento,
  Capacitacion,
  CharlaSeguridad,
  ConfigEjercicio,
  EntregaEPP,
  Estanque,
  ItemEPP,
  MatrizEPP,
  MovimientoBodega,
  MovimientoCombustible,
  MovimientoSemillas,
  Premio,
  Producto,
  Aplicacion,
  RegistroAuditoria,
  Sesion,
  Usuario,
  RegistroTarja,
  Remuneracion,
  Trabajador,
} from '@/lib/types'
import { uid } from '@/lib/utils'
import { salidaDeAplicacion, stockDe } from '@/lib/motorBodega'
import {
  MAX_INTENTOS, BLOQUEO_MINUTOS, estaAcotadoACampo, hashClave, generarSal,
  nuevaExpiracion, sesionVigente, verificarClave, type Rol,
} from '@/lib/auth'
import { USUARIOS_SEMILLA } from '@/data/usuarios'
import { semillaInicial } from '@/data/demo'

interface Estado {
  trabajadores: Trabajador[]
  tarja: RegistroTarja[]
  remuneraciones: Remuneracion[]
  epp: ItemEPP[]
  matrizEpp: MatrizEPP[]
  entregasEpp: EntregaEPP[]
  capacitaciones: Capacitacion[]
  charlas: CharlaSeguridad[]
  semillas: MovimientoSemillas[]
  premios: Premio[]

  // contabilidad
  asientos: Asiento[]
  ejercicio: ConfigEjercicio

  // combustible
  estanques: Estanque[]
  combustible: MovimientoCombustible[]

  // bodega de insumos
  productos: Producto[]
  bodega: MovimientoBodega[]
  aplicaciones: Aplicacion[]

  // acceso
  usuarios: Usuario[]
  sesion?: Sesion
  auditoria: RegistroAuditoria[]

  // preferencias
  tema: 'light' | 'dark'
  campoActivo: string
  periodoActivo: string

  setTema: (t: 'light' | 'dark') => void
  setCampo: (c: string) => void
  setPeriodo: (p: string) => void

  addAsiento: (a: Omit<Asiento, 'id'>) => void
  updAsiento: (id: string, a: Partial<Asiento>) => void
  delAsiento: (id: string) => void
  setEjercicio: (e: Partial<ConfigEjercicio>) => void

  addEstanque: (e: Omit<Estanque, 'id'>) => void
  updEstanque: (id: string, e: Partial<Estanque>) => void
  addCombustible: (m: Omit<MovimientoCombustible, 'id'>) => void
  bulkCombustible: (ms: MovimientoCombustible[]) => void
  delCombustible: (id: string) => void

  addProducto: (p: Omit<Producto, 'id'>) => void
  updProducto: (id: string, p: Partial<Producto>) => void
  addBodega: (m: Omit<MovimientoBodega, 'id'>) => { ok: boolean; msg?: string }
  bulkBodega: (ms: MovimientoBodega[]) => void
  delBodega: (id: string) => void
  addAplicacion: (a: Omit<Aplicacion, 'id'>) => { ok: boolean; msg?: string }
  delAplicacion: (id: string) => void

  sembrarUsuarios: () => Promise<void>
  ingresar: (usuario: string, clave: string) => Promise<{ ok: boolean; msg?: string }>
  salir: () => void
  renovarSesion: () => void
  cambiarClave: (actual: string, nueva: string) => Promise<{ ok: boolean; msg?: string }>
  crearUsuario: (u: Omit<Usuario, 'id' | 'claveHash' | 'sal' | 'creadoEn' | 'intentosFallidos' | 'debeCambiarClave'>, clave: string) => Promise<{ ok: boolean; msg?: string }>
  updUsuario: (id: string, u: Partial<Usuario>) => void
  resetearClave: (id: string, nueva: string) => Promise<{ ok: boolean; msg?: string }>
  auditar: (accion: RegistroAuditoria['accion'], modulo: string, detalle: string) => void

  addTrabajador: (t: Omit<Trabajador, 'id' | 'semillas'>) => void
  updTrabajador: (id: string, t: Partial<Trabajador>) => void
  delTrabajador: (id: string) => void

  upsertTarja: (r: Omit<RegistroTarja, 'id'> & { id?: string }) => void
  delTarja: (id: string) => void
  bulkTarja: (rs: RegistroTarja[]) => void

  upsertRemuneracion: (r: Omit<Remuneracion, 'id'> & { id?: string }) => void
  bulkRemuneraciones: (rs: Remuneracion[]) => void

  addEpp: (e: Omit<ItemEPP, 'id'>) => void
  updEpp: (id: string, e: Partial<ItemEPP>) => void
  delEpp: (id: string) => void
  addMatriz: (m: Omit<MatrizEPP, 'id'>) => void
  delMatriz: (id: string) => void
  entregarEpp: (e: Omit<EntregaEPP, 'id'>) => { ok: boolean; msg?: string }

  addCapacitacion: (c: Omit<Capacitacion, 'id'>) => void
  delCapacitacion: (id: string) => void
  addCharla: (c: Omit<CharlaSeguridad, 'id'>) => void
  delCharla: (id: string) => void

  addSemillas: (m: Omit<MovimientoSemillas, 'id'>) => void
  addPremio: (p: Omit<Premio, 'id'>) => void
  canjear: (trabajadorId: string, premioId: string) => { ok: boolean; msg?: string }

  resetDemo: () => void
  limpiarTodo: () => void
}

const inicial = semillaInicial()

export const useStore = create<Estado>()(
  persist(
    (set, get) => ({
      ...inicial,
      usuarios: [],
      sesion: undefined,
      auditoria: [],
      tema: 'dark',
      campoActivo: 'BUIN',
      periodoActivo: inicial.periodoDemo,
      ejercicio: {
        empresa: 'AGRICOLA EL BOSQUE LIMITADA',
        rut: '78.993.480-0',
        moneda: 'CLP',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        tasaImpuesto: 0.27,
      },

      setTema: (tema) => set({ tema }),
      setCampo: (campoActivo) => set({ campoActivo }),
      setPeriodo: (periodoActivo) => set({ periodoActivo }),

      addAsiento: (a) => set((s) => ({ asientos: [...s.asientos, { ...a, id: uid() }] })),
      updAsiento: (id, a) =>
        set((s) => ({ asientos: s.asientos.map((x) => (x.id === id ? { ...x, ...a } : x)) })),
      delAsiento: (id) => set((s) => ({ asientos: s.asientos.filter((x) => x.id !== id) })),
      setEjercicio: (e) => set((s) => ({ ejercicio: { ...s.ejercicio, ...e } })),

      addEstanque: (e) => set((s) => ({ estanques: [...s.estanques, { ...e, id: uid() }] })),
      updEstanque: (id, e) =>
        set((s) => ({ estanques: s.estanques.map((x) => (x.id === id ? { ...x, ...e } : x)) })),
      addCombustible: (m) =>
        set((s) => ({ combustible: [...s.combustible, { ...m, id: uid() }] })),
      bulkCombustible: (ms) => set((s) => ({ combustible: [...s.combustible, ...ms] })),
      delCombustible: (id) =>
        set((s) => ({ combustible: s.combustible.filter((x) => x.id !== id) })),

      addProducto: (p) => set((s) => ({ productos: [...s.productos, { ...p, id: uid() }] })),
      updProducto: (id, p) =>
        set((s) => ({ productos: s.productos.map((x) => (x.id === id ? { ...x, ...p } : x)) })),

      addBodega: (m) => {
        const s = get()
        // Una salida no puede dejar la bodega en negativo sin que quede constancia
        if (m.cantidad < 0) {
          const stock = stockDe(s.bodega, m.productoId, m.campo)
          if (stock + m.cantidad < 0) {
            const p = s.productos.find((x) => x.id === m.productoId)
            return {
              ok: false,
              msg: `Sólo hay ${stock} ${p?.unidad ?? ''} en bodega y se intentan sacar ${Math.abs(m.cantidad)}. Registre primero la entrada o haga un conteo físico.`,
            }
          }
        }
        set((st) => ({ bodega: [...st.bodega, { ...m, id: uid() }] }))
        return { ok: true }
      },
      bulkBodega: (ms) => set((s) => ({ bodega: [...s.bodega, ...ms] })),
      delBodega: (id) => set((s) => ({ bodega: s.bodega.filter((x) => x.id !== id) })),

      addAplicacion: (a) => {
        const s = get()
        const stock = stockDe(s.bodega, a.productoId, a.campo)
        const p = s.productos.find((x) => x.id === a.productoId)
        if (a.cantidadProducto <= 0)
          return { ok: false, msg: 'La cantidad de producto resulta cero. Revise dosis y mojamiento.' }
        if (stock < a.cantidadProducto)
          return {
            ok: false,
            msg: `Sólo hay ${stock} ${p?.unidad ?? ''} de ${p?.nombre ?? 'producto'} en la bodega de ${a.campo.replace('_', ' ')} y la aplicación necesita ${a.cantidadProducto}.`,
          }
        const aplicacion = { ...a, id: uid() } as Aplicacion
        set((st) => ({
          aplicaciones: [...st.aplicaciones, aplicacion],
          bodega: [...st.bodega, salidaDeAplicacion(aplicacion)],
        }))
        return { ok: true }
      },
      delAplicacion: (id) =>
        set((s) => ({
          aplicaciones: s.aplicaciones.filter((x) => x.id !== id),
          // Se revierte también la salida de bodega que generó
          bodega: s.bodega.filter((x) => x.aplicacionId !== id),
        })),

      /* ─────────────── Acceso ─────────────── */

      /** Crea los usuarios iniciales. El hash es asíncrono, por eso va aparte. */
      sembrarUsuarios: async () => {
        if (get().usuarios.length > 0) return
        const usuarios: Usuario[] = []
        for (const u of USUARIOS_SEMILLA) {
          const sal = generarSal()
          usuarios.push({
            id: uid(),
            usuario: u.usuario,
            nombre: u.nombre,
            rut: u.rut,
            rol: u.rol,
            campos: u.campos,
            cargo: u.cargo,
            activo: true,
            claveHash: await hashClave(u.clave, sal),
            sal,
            debeCambiarClave: true,
            creadoEn: new Date().toISOString(),
            intentosFallidos: 0,
          })
        }
        set({ usuarios })
      },

      ingresar: async (nombreUsuario, clave) => {
        const login = nombreUsuario.trim().toLowerCase()
        const u = get().usuarios.find((x) => x.usuario === login)

        // El mensaje es el mismo exista o no el usuario: no se confirma quién existe
        const generico = 'Usuario o contraseña incorrectos.'
        if (!u) {
          get().auditar('INGRESO_FALLIDO', 'acceso', `Intento con usuario inexistente "${login}"`)
          return { ok: false, msg: generico }
        }
        if (!u.activo) return { ok: false, msg: 'Esta cuenta está desactivada. Hable con el administrador.' }

        if (u.bloqueadoHasta && Date.now() < u.bloqueadoHasta) {
          const min = Math.ceil((u.bloqueadoHasta - Date.now()) / 60_000)
          return { ok: false, msg: `Cuenta bloqueada por intentos fallidos. Reintente en ${min} minuto(s).` }
        }

        const ok = await verificarClave(clave, u.sal, u.claveHash)
        if (!ok) {
          const intentos = u.intentosFallidos + 1
          const bloquea = intentos >= MAX_INTENTOS
          set((s) => ({
            usuarios: s.usuarios.map((x) =>
              x.id === u.id
                ? {
                    ...x,
                    intentosFallidos: bloquea ? 0 : intentos,
                    bloqueadoHasta: bloquea ? Date.now() + BLOQUEO_MINUTOS * 60_000 : undefined,
                  }
                : x,
            ),
          }))
          get().auditar('INGRESO_FALLIDO', 'acceso', `Contraseña incorrecta para "${login}"`)
          return {
            ok: false,
            msg: bloquea
              ? `Demasiados intentos fallidos. La cuenta queda bloqueada ${BLOQUEO_MINUTOS} minutos.`
              : `${generico} Quedan ${MAX_INTENTOS - intentos} intento(s).`,
          }
        }

        const sesion: Sesion = {
          usuarioId: u.id,
          usuario: u.usuario,
          nombre: u.nombre,
          rol: u.rol,
          campos: u.campos,
          iniciadaEn: Date.now(),
          expiraEn: nuevaExpiracion(),
        }
        set((s) => ({
          sesion,
          usuarios: s.usuarios.map((x) =>
            x.id === u.id
              ? { ...x, ultimoIngreso: new Date().toISOString(), intentosFallidos: 0, bloqueadoHasta: undefined }
              : x,
          ),
          // Los roles de terreno entran directo a su campo
          campoActivo: estaAcotadoACampo(u.rol) && u.campos.length ? u.campos[0] : s.campoActivo,
        }))
        get().auditar('INGRESO', 'acceso', `Ingreso de ${u.nombre} (${u.rol})`)
        return { ok: true }
      },

      salir: () => {
        const s = get()
        if (s.sesion) s.auditar('SALIDA', 'acceso', `Cierre de sesión de ${s.sesion.nombre}`)
        set({ sesion: undefined })
      },

      renovarSesion: () =>
        set((s) => (s.sesion ? { sesion: { ...s.sesion, expiraEn: nuevaExpiracion() } } : {})),

      cambiarClave: async (actual, nueva) => {
        const s = get()
        if (!s.sesion) return { ok: false, msg: 'No hay sesión iniciada.' }
        const u = s.usuarios.find((x) => x.id === s.sesion!.usuarioId)
        if (!u) return { ok: false, msg: 'Usuario no encontrado.' }
        if (!(await verificarClave(actual, u.sal, u.claveHash)))
          return { ok: false, msg: 'La contraseña actual no es correcta.' }
        const sal = generarSal()
        const claveHash = await hashClave(nueva, sal)
        set((st) => ({
          usuarios: st.usuarios.map((x) =>
            x.id === u.id ? { ...x, sal, claveHash, debeCambiarClave: false } : x,
          ),
        }))
        get().auditar('MODIFICAR', 'acceso', 'Cambio de contraseña propia')
        return { ok: true }
      },

      crearUsuario: async (datos, clave) => {
        const s = get()
        const login = datos.usuario.trim().toLowerCase()
        if (s.usuarios.some((x) => x.usuario === login))
          return { ok: false, msg: `Ya existe un usuario "${login}".` }
        const sal = generarSal()
        const nuevo: Usuario = {
          ...datos,
          usuario: login,
          id: uid(),
          claveHash: await hashClave(clave, sal),
          sal,
          debeCambiarClave: true,
          creadoEn: new Date().toISOString(),
          intentosFallidos: 0,
        }
        set((st) => ({ usuarios: [...st.usuarios, nuevo] }))
        get().auditar('CREAR', 'usuarios', `Usuario "${login}" con rol ${datos.rol}`)
        return { ok: true }
      },

      updUsuario: (id, datos) => {
        set((s) => ({ usuarios: s.usuarios.map((x) => (x.id === id ? { ...x, ...datos } : x)) }))
        const u = get().usuarios.find((x) => x.id === id)
        get().auditar('MODIFICAR', 'usuarios', `Usuario "${u?.usuario ?? id}" actualizado`)
      },

      resetearClave: async (id, nueva) => {
        const u = get().usuarios.find((x) => x.id === id)
        if (!u) return { ok: false, msg: 'Usuario no encontrado.' }
        const sal = generarSal()
        const claveHash = await hashClave(nueva, sal)
        set((s) => ({
          usuarios: s.usuarios.map((x) =>
            x.id === id
              ? { ...x, sal, claveHash, debeCambiarClave: true, intentosFallidos: 0, bloqueadoHasta: undefined }
              : x,
          ),
        }))
        get().auditar('MODIFICAR', 'usuarios', `Contraseña reiniciada para "${u.usuario}"`)
        return { ok: true }
      },

      auditar: (accion, modulo, detalle) =>
        set((s) => ({
          auditoria: [
            {
              id: uid(),
              fecha: new Date().toISOString(),
              usuarioId: s.sesion?.usuarioId,
              usuario: s.sesion?.nombre ?? '(sin sesión)',
              rol: s.sesion?.rol,
              accion,
              modulo,
              detalle,
            },
            // Se conservan los últimos 2.000 registros para no llenar el navegador
            ...s.auditoria,
          ].slice(0, 2000),
        })),

      addTrabajador: (t) =>
        set((s) => ({ trabajadores: [...s.trabajadores, { ...t, id: uid(), semillas: 0 }] })),
      updTrabajador: (id, t) =>
        set((s) => ({
          trabajadores: s.trabajadores.map((x) => (x.id === id ? { ...x, ...t } : x)),
        })),
      delTrabajador: (id) =>
        set((s) => ({
          trabajadores: s.trabajadores.filter((x) => x.id !== id),
          tarja: s.tarja.filter((x) => x.trabajadorId !== id),
        })),

      upsertTarja: (r) =>
        set((s) => {
          // clave natural: trabajador + fecha + labor + centro de costo
          const existente = s.tarja.find(
            (x) =>
              (r.id && x.id === r.id) ||
              (!r.id &&
                x.trabajadorId === r.trabajadorId &&
                x.fecha === r.fecha &&
                x.laborGeneral === r.laborGeneral &&
                x.cc === r.cc),
          )
          if (existente)
            return { tarja: s.tarja.map((x) => (x.id === existente.id ? { ...x, ...r, id: x.id } : x)) }
          return { tarja: [...s.tarja, { ...r, id: uid() } as RegistroTarja] }
        }),
      delTarja: (id) => set((s) => ({ tarja: s.tarja.filter((x) => x.id !== id) })),
      bulkTarja: (rs) => set((s) => ({ tarja: [...s.tarja, ...rs] })),

      upsertRemuneracion: (r) =>
        set((s) => {
          const ex = s.remuneraciones.find(
            (x) => x.periodo === r.periodo && x.trabajadorId === r.trabajadorId,
          )
          if (ex)
            return {
              remuneraciones: s.remuneraciones.map((x) => (x.id === ex.id ? { ...x, ...r, id: x.id } : x)),
            }
          return { remuneraciones: [...s.remuneraciones, { ...r, id: uid() } as Remuneracion] }
        }),
      bulkRemuneraciones: (rs) =>
        set((s) => {
          const map = new Map(s.remuneraciones.map((x) => [`${x.periodo}¦${x.trabajadorId}`, x]))
          for (const r of rs) map.set(`${r.periodo}¦${r.trabajadorId}`, r)
          return { remuneraciones: [...map.values()] }
        }),

      addEpp: (e) => set((s) => ({ epp: [...s.epp, { ...e, id: uid() }] })),
      updEpp: (id, e) => set((s) => ({ epp: s.epp.map((x) => (x.id === id ? { ...x, ...e } : x)) })),
      delEpp: (id) =>
        set((s) => ({
          epp: s.epp.filter((x) => x.id !== id),
          matrizEpp: s.matrizEpp.filter((x) => x.eppId !== id),
        })),
      addMatriz: (m) => set((s) => ({ matrizEpp: [...s.matrizEpp, { ...m, id: uid() }] })),
      delMatriz: (id) => set((s) => ({ matrizEpp: s.matrizEpp.filter((x) => x.id !== id) })),

      entregarEpp: (e) => {
        const item = get().epp.find((x) => x.id === e.eppId)
        if (!item) return { ok: false, msg: 'El EPP no existe en el maestro.' }
        if (item.stock < e.cantidad)
          return { ok: false, msg: `Stock insuficiente: quedan ${item.stock} ${item.unidad}.` }
        set((s) => ({
          entregasEpp: [...s.entregasEpp, { ...e, id: uid() }],
          epp: s.epp.map((x) => (x.id === e.eppId ? { ...x, stock: x.stock - e.cantidad } : x)),
        }))
        return { ok: true }
      },

      addCapacitacion: (c) => set((s) => ({ capacitaciones: [...s.capacitaciones, { ...c, id: uid() }] })),
      delCapacitacion: (id) =>
        set((s) => ({ capacitaciones: s.capacitaciones.filter((x) => x.id !== id) })),
      addCharla: (c) => set((s) => ({ charlas: [...s.charlas, { ...c, id: uid() }] })),
      delCharla: (id) => set((s) => ({ charlas: s.charlas.filter((x) => x.id !== id) })),

      addSemillas: (m) =>
        set((s) => ({
          semillas: [...s.semillas, { ...m, id: uid() }],
          trabajadores: s.trabajadores.map((t) =>
            t.id === m.trabajadorId ? { ...t, semillas: Math.max(0, t.semillas + m.semillas) } : t,
          ),
        })),
      addPremio: (p) => set((s) => ({ premios: [...s.premios, { ...p, id: uid() }] })),

      canjear: (trabajadorId, premioId) => {
        const s = get()
        const t = s.trabajadores.find((x) => x.id === trabajadorId)
        const p = s.premios.find((x) => x.id === premioId)
        if (!t || !p) return { ok: false, msg: 'Trabajador o premio no encontrado.' }
        if (p.stock <= 0) return { ok: false, msg: 'Sin stock de este premio.' }
        if (t.semillas < p.costoSemillas)
          return {
            ok: false,
            msg: `Le faltan ${p.costoSemillas - t.semillas} semillas para canjear "${p.nombre}".`,
          }
        set((st) => ({
          premios: st.premios.map((x) => (x.id === premioId ? { ...x, stock: x.stock - 1 } : x)),
          trabajadores: st.trabajadores.map((x) =>
            x.id === trabajadorId ? { ...x, semillas: x.semillas - p.costoSemillas } : x,
          ),
          semillas: [
            ...st.semillas,
            {
              id: uid(),
              fecha: new Date().toISOString().slice(0, 10),
              trabajadorId,
              motivo: `Canje: ${p.nombre}`,
              semillas: -p.costoSemillas,
              tipo: 'CANJE' as const,
            },
          ],
        }))
        return { ok: true }
      },

      resetDemo: () => {
        const s = semillaInicial()
        set({ ...s, periodoActivo: s.periodoDemo })
      },
      limpiarTodo: () =>
        set({
          trabajadores: [],
          tarja: [],
          remuneraciones: [],
          entregasEpp: [],
          capacitaciones: [],
          charlas: [],
          semillas: [],
          asientos: [],
          combustible: [],
          bodega: [],
          aplicaciones: [],
          // Los usuarios y la bitácora no se borran: sin usuarios nadie puede entrar
        }),
    }),
    {
      name: 'siga-elbosque-v2',
      /**
       * Sin datos guardados se usa la semilla completa. Con datos guardados,
       * las claves que aún no existían (contabilidad) caen en su valor inicial
       * en lugar de quedar indefinidas.
       */
      merge: (persisted, current) => {
        if (!persisted) return current
        const p = persisted as Partial<Estado>
        return {
          ...current,
          ...p,
          asientos: p.asientos ?? current.asientos,
          ejercicio: p.ejercicio ?? current.ejercicio,
          productos: p.productos ?? current.productos,
          bodega: p.bodega ?? current.bodega,
          aplicaciones: p.aplicaciones ?? current.aplicaciones,
          usuarios: p.usuarios ?? current.usuarios,
          auditoria: p.auditoria ?? current.auditoria,
          // Una sesión vencida no revive al recargar
          sesion: sesionVigente(p.sesion?.expiraEn) ? p.sesion : undefined,
        }
      },
    },
  ),
)
