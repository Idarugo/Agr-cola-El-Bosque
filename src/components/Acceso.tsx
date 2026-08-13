import { useEffect, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { puedeVer, sesionVigente, type Modulo } from '@/lib/auth'
import { Card, PageHeader, Vacio } from '@/components/ui'
import { alerta } from '@/lib/alerta'

/**
 * Guarda de módulo. Si el rol no tiene acceso, no se monta la página:
 * evita que un rol de terreno vea remuneraciones o contabilidad aunque
 * escriba la dirección a mano.
 */
export function RutaProtegida({ modulo, children }: { modulo: Modulo; children: ReactNode }) {
  const rol = useStore((s) => s.sesion?.rol)
  if (!rol) return null

  if (!puedeVer(rol, modulo))
    return (
      <>
        <PageHeader titulo="Sin acceso" icon={Lock} />
        <Card>
          <Vacio
            titulo="Este módulo no está disponible para su perfil"
            detalle="Si necesita entrar, pida al administrador que revise sus permisos."
            icon={Lock}
          />
        </Card>
      </>
    )

  return <>{children}</>
}

/**
 * Vigila el vencimiento de la sesión. En el campo los equipos se comparten,
 * así que una sesión abierta indefinidamente es un problema real.
 */
export function VigilanteDeSesion() {
  const { sesion, salir, renovarSesion } = useStore()

  useEffect(() => {
    if (!sesion) return

    const revisar = () => {
      if (!sesionVigente(sesion.expiraEn)) {
        salir()
        alerta.aviso('Sesión expirada', 'Por seguridad se cerró la sesión. Vuelva a ingresar.')
      }
    }
    const t = setInterval(revisar, 30_000)

    // Cualquier actividad renueva el plazo
    const actividad = () => renovarSesion()
    const eventos: (keyof WindowEventMap)[] = ['click', 'keydown']
    eventos.forEach((e) => window.addEventListener(e, actividad, { passive: true }))

    return () => {
      clearInterval(t)
      eventos.forEach((e) => window.removeEventListener(e, actividad))
    }
  }, [sesion, salir, renovarSesion])

  return null
}

/** Envuelve controles de edición: los oculta cuando el rol es de sólo lectura. */
export function SoloEdicion({ modulo, children }: { modulo: Modulo; children: ReactNode }) {
  const rol = useStore((s) => s.sesion?.rol)
  if (!rol) return null
  return puedeVer(rol, modulo) ? <>{children}</> : null
}
