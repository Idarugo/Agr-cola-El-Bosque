/**
 * Usuarios iniciales del sistema.
 *
 * Se crean con claves provisorias y `debeCambiarClave` activado: al primer
 * ingreso el sistema obliga a cambiarlas. Las claves provisorias aparecen en
 * la pantalla de acceso mientras el sistema está en demostración; en
 * operación real hay que quitarlas de ahí.
 */
import type { Usuario } from '@/lib/types'
import type { Rol } from '@/lib/auth'

export interface UsuarioSemilla {
  usuario: string
  nombre: string
  rut: string
  rol: Rol
  campos: string[]
  cargo: string
  clave: string
}

export const USUARIOS_SEMILLA: UsuarioSemilla[] = [
  {
    usuario: 'admin',
    nombre: 'Administrador del sistema',
    rut: '11.111.111-1',
    rol: 'ADMIN',
    campos: [],
    cargo: 'Soporte',
    clave: 'Admin2026',
  },
  {
    usuario: 'contabilidad',
    nombre: 'Contabilidad y control interno',
    rut: '12.222.222-2',
    rol: 'CONTABILIDAD',
    campos: [],
    cargo: 'Contadora',
    clave: 'Conta2026',
  },
  {
    usuario: 'gerencia',
    nombre: 'Gerencia general',
    rut: '13.333.333-3',
    rol: 'GERENCIA',
    campos: [],
    cargo: 'Gerente general',
    clave: 'Geren2026',
  },
  {
    usuario: 'buin',
    nombre: 'Administrador Buin',
    rut: '14.444.444-4',
    rol: 'ADMINISTRADOR_CAMPO',
    campos: ['BUIN'],
    cargo: 'Administrador de campo',
    clave: 'Campo2026',
  },
  {
    usuario: 'jefebuin',
    nombre: 'Jefe de campo Buin',
    rut: '15.555.555-5',
    rol: 'JEFE_CAMPO',
    campos: ['BUIN'],
    cargo: 'Jefe de campo',
    clave: 'Jefe2026',
  },
]

/**
 * Los usuarios se crean sin hash: el hash necesita `crypto.subtle`, que es
 * asíncrono, así que se calcula al arrancar la aplicación (ver `sembrarUsuarios`).
 */
export const usuariosVacios = (): Usuario[] => []
