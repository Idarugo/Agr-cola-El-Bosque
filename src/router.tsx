import { createHashRouter } from 'react-router-dom'
import Layout from '@/components/Layout'
import { RutaProtegida } from '@/components/Acceso'
import Dashboard from '@/pages/Dashboard'
import PlanCuentas from '@/pages/PlanCuentas'
import RRHH from '@/pages/RRHH'
import Tarja from '@/pages/Tarja'
import Costos from '@/pages/Costos'
import Contabilidad from '@/pages/Contabilidad'
import Combustible from '@/pages/Combustible'
import Bodega from '@/pages/Bodega'
import Prevencion from '@/pages/Prevencion'
import Campos from '@/pages/Campos'
import Motivacional from '@/pages/Motivacional'
import Reportes from '@/pages/Reportes'
import Usuarios from '@/pages/Usuarios'
import type { Modulo } from '@/lib/auth'

const p = (modulo: Modulo, el: React.ReactNode) => (
  <RutaProtegida modulo={modulo}>{el}</RutaProtegida>
)

export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: p('dashboard', <Dashboard />) },
      { path: 'plan-cuentas', element: p('plan-cuentas', <PlanCuentas />) },
      { path: 'rrhh', element: p('rrhh', <RRHH />) },
      { path: 'tarja', element: p('tarja', <Tarja />) },
      { path: 'costos', element: p('costos', <Costos />) },
      { path: 'contabilidad', element: p('contabilidad', <Contabilidad />) },
      { path: 'combustible', element: p('combustible', <Combustible />) },
      { path: 'bodega', element: p('bodega', <Bodega />) },
      { path: 'prevencion', element: p('prevencion', <Prevencion />) },
      { path: 'campos', element: p('campos', <Campos />) },
      { path: 'motivacional', element: p('motivacional', <Motivacional />) },
      { path: 'reportes', element: p('reportes', <Reportes />) },
      { path: 'usuarios', element: p('usuarios', <Usuarios />) },
    ],
  },
])
