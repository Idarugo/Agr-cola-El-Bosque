import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { sesionVigente } from '@/lib/auth'
import Login, { CambioClaveObligatorio } from '@/pages/Login'
import { router } from '@/router'

/**
 * Puerta de entrada de la aplicación:
 *   sin sesión            → pantalla de acceso
 *   clave provisoria      → cambio obligatorio antes de seguir
 *   sesión válida         → el sistema
 */
export default function App() {
  const { sesion, usuarios, tema } = useStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'dark')
  }, [tema])

  if (!sesion || !sesionVigente(sesion.expiraEn)) return <Login />

  const usuario = usuarios.find((u) => u.id === sesion.usuarioId)
  if (usuario?.debeCambiarClave) return <CambioClaveObligatorio />

  return <RouterProvider router={router} />
}
