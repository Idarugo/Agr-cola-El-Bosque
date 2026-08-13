/**
 * ══════════════════════════════════════════════════════════════════════
 *  AUTENTICACIÓN Y CONTROL DE ACCESO
 * ══════════════════════════════════════════════════════════════════════
 *
 *  ⚠️  ADVERTENCIA IMPORTANTE
 *
 *  Mientras el sistema no tenga servidor, este login **no es seguridad
 *  real**: es una puerta de organización, no una cerradura. Todo corre en
 *  el navegador, así que cualquiera con conocimientos básicos puede abrir
 *  las herramientas de desarrollo y leer o alterar los datos sin pasar por
 *  aquí. Las contraseñas se guardan con hash y sal —nunca en texto plano—
 *  pero eso sólo evita que se lean de un vistazo.
 *
 *  Para qué sirve igualmente:
 *   · cada persona ve sólo los módulos y campos que le corresponden
 *   · queda registro de quién hizo cada cosa (exigencia de ISO 9000)
 *   · evita cambios accidentales de la persona equivocada
 *   · deja el modelo listo para cuando exista backend, donde estas mismas
 *     reglas se validarán del lado del servidor, que es donde corresponde
 */

export type Rol = 'ADMIN' | 'GERENCIA' | 'CONTABILIDAD' | 'ADMINISTRADOR_CAMPO' | 'JEFE_CAMPO'

export type Modulo =
  | 'dashboard'
  | 'costos'
  | 'contabilidad'
  | 'reportes'
  | 'tarja'
  | 'rrhh'
  | 'combustible'
  | 'bodega'
  | 'campos'
  | 'prevencion'
  | 'motivacional'
  | 'plan-cuentas'
  | 'usuarios'

export type Permiso = 'ninguno' | 'ver' | 'editar'

export const ROL_META: Record<Rol, { label: string; descripcion: string; color: string }> = {
  ADMIN: {
    label: 'Administrador del sistema',
    descripcion: 'Acceso total, incluida la gestión de usuarios y la bitácora.',
    color: 'violet',
  },
  GERENCIA: {
    label: 'Gerencia',
    descripcion: 'Ve todos los campos y todos los informes, pero no modifica la operación.',
    color: 'brand',
  },
  CONTABILIDAD: {
    label: 'Contabilidad y control interno',
    descripcion: 'Cierre de costos, contabilidad, remuneraciones y reportes al contador.',
    color: 'sky',
  },
  ADMINISTRADOR_CAMPO: {
    label: 'Administrador de campo',
    descripcion: 'Opera su campo: tarja, combustible, bodega y prevención.',
    color: 'accent',
  },
  JEFE_CAMPO: {
    label: 'Jefe de campo',
    descripcion: 'Registra la tarja diaria, las charlas de seguridad y la entrega de EPP.',
    color: 'amber',
  },
}

const T = 'editar' as const
const V = 'ver' as const
const N = 'ninguno' as const

/**
 * Matriz de permisos. Está escrita a partir de cómo trabaja hoy la empresa:
 * la contadora es quien cierra y reporta, gerencia mira, y en el campo se
 * registra la operación diaria.
 */
export const PERMISOS: Record<Rol, Record<Modulo, Permiso>> = {
  ADMIN: {
    dashboard: T, costos: T, contabilidad: T, reportes: T, tarja: T, rrhh: T,
    combustible: T, bodega: T, campos: T, prevencion: T, motivacional: T,
    'plan-cuentas': T, usuarios: T,
  },
  GERENCIA: {
    dashboard: V, costos: V, contabilidad: V, reportes: V, tarja: V, rrhh: V,
    combustible: V, bodega: V, campos: V, prevencion: V, motivacional: T,
    'plan-cuentas': V, usuarios: N,
  },
  CONTABILIDAD: {
    dashboard: T, costos: T, contabilidad: T, reportes: T, tarja: T, rrhh: T,
    combustible: V, bodega: V, campos: V, prevencion: V, motivacional: V,
    'plan-cuentas': T, usuarios: N,
  },
  ADMINISTRADOR_CAMPO: {
    dashboard: V, costos: V, contabilidad: N, reportes: V, tarja: T, rrhh: V,
    combustible: T, bodega: T, campos: V, prevencion: T, motivacional: T,
    'plan-cuentas': V, usuarios: N,
  },
  JEFE_CAMPO: {
    dashboard: V, costos: N, contabilidad: N, reportes: N, tarja: T, rrhh: V,
    combustible: T, bodega: V, campos: V, prevencion: T, motivacional: V,
    'plan-cuentas': N, usuarios: N,
  },
}

export const permisoDe = (rol: Rol, modulo: Modulo): Permiso => PERMISOS[rol]?.[modulo] ?? 'ninguno'
export const puedeVer = (rol: Rol, modulo: Modulo) => permisoDe(rol, modulo) !== 'ninguno'
export const puedeEditar = (rol: Rol, modulo: Modulo) => permisoDe(rol, modulo) === 'editar'

/** Los roles de terreno quedan amarrados a los campos que tienen asignados. */
export const ROLES_ACOTADOS_A_CAMPO: Rol[] = ['ADMINISTRADOR_CAMPO', 'JEFE_CAMPO']
export const estaAcotadoACampo = (rol: Rol) => ROLES_ACOTADOS_A_CAMPO.includes(rol)

/* ─────────────── Contraseñas ─────────────── */

const enc = new TextEncoder()

const aHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

/** Sal aleatoria por usuario: dos usuarios con la misma clave no comparten hash. */
export const generarSal = () => {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  return aHex(b.buffer)
}

/**
 * Hash de contraseña con SHA-256 y sal.
 *
 * Un backend real debe usar bcrypt, scrypt o Argon2 con factor de trabajo;
 * SHA-256 es rápido y por lo tanto débil frente a fuerza bruta. Aquí cumple
 * el único objetivo posible sin servidor: que las claves no queden legibles
 * en el almacenamiento del navegador.
 */
export async function hashClave(clave: string, sal: string) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(`${sal}·${clave}`))
  return aHex(buf)
}

export async function verificarClave(clave: string, sal: string, hash: string) {
  return (await hashClave(clave, sal)) === hash
}

/* ─────────────── Fortaleza de la clave ─────────────── */

export interface FortalezaClave {
  puntaje: 0 | 1 | 2 | 3 | 4
  etiqueta: string
  problemas: string[]
  aceptable: boolean
}

export function evaluarClave(clave: string, contexto: string[] = []): FortalezaClave {
  const problemas: string[] = []
  if (clave.length < 8) problemas.push('Debe tener al menos 8 caracteres.')
  if (!/[a-zA-Z]/.test(clave)) problemas.push('Debe incluir letras.')
  if (!/[0-9]/.test(clave)) problemas.push('Debe incluir al menos un número.')

  const bajo = clave.toLowerCase()
  if (contexto.some((c) => c && bajo.includes(c.toLowerCase().slice(0, 5))))
    problemas.push('No use su nombre o RUT dentro de la contraseña.')

  const comunes = ['12345678', 'password', 'contrasena', 'qwerty', 'agricola', 'elbosque', 'admin123']
  if (comunes.some((c) => bajo.includes(c))) problemas.push('Es una contraseña demasiado común.')

  let puntaje = 0
  if (clave.length >= 8) puntaje++
  if (clave.length >= 12) puntaje++
  if (/[a-z]/.test(clave) && /[A-Z]/.test(clave)) puntaje++
  if (/[0-9]/.test(clave) && /[^a-zA-Z0-9]/.test(clave)) puntaje++
  if (problemas.length) puntaje = Math.min(puntaje, 1)

  const etiquetas = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte']
  return {
    puntaje: puntaje as FortalezaClave['puntaje'],
    etiqueta: etiquetas[puntaje],
    problemas,
    aceptable: problemas.length === 0,
  }
}

/* ─────────────── Sesión ─────────────── */

/** La sesión caduca sola: en el campo los equipos se comparten. */
export const DURACION_SESION_MIN = 60 * 8

export const sesionVigente = (expiraEn?: number) => !!expiraEn && Date.now() < expiraEn

export const nuevaExpiracion = () => Date.now() + DURACION_SESION_MIN * 60_000

/* ─────────────── Bloqueo por intentos ─────────────── */

export const MAX_INTENTOS = 5
export const BLOQUEO_MINUTOS = 5

export const minutosDeBloqueoRestantes = (bloqueadoHasta?: number) =>
  bloqueadoHasta && Date.now() < bloqueadoHasta
    ? Math.ceil((bloqueadoHasta - Date.now()) / 60_000)
    : 0
