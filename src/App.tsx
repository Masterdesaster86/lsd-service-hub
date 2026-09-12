import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import { AppShell } from './components/AppShell'
import { Login } from './pages/Login'
import { OrdersList } from './pages/orders/OrdersList'
import { OrderDetail } from './pages/orders/OrderDetail'
import { BerichtDetail } from './pages/orders/BerichtDetail'
import { CustomersList } from './pages/customers/CustomersList'
import { CustomerDetail } from './pages/customers/CustomerDetail'
import { MachinesList } from './pages/machines/MachinesList'
import { MachineDetail } from './pages/machines/MachineDetail'
import { Plantafel } from './pages/plantafel/Plantafel'
import { Verwaltung } from './pages/verwaltung/Verwaltung'
import { Mitarbeiter } from './pages/mitarbeiter/Mitarbeiter'
import { WissensSuche } from './pages/wissen/WissensSuche'

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { employee } = useAuth()
  if (!employee || !roles.includes(employee.role)) return <Navigate to="/auftraege" replace />
  return <>{children}</>
}

export default function App() {
  const { session, employee, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-paper text-ink-soft text-sm">Lädt…</div>
  }

  if (!session || !employee) {
    return <Login />
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/auftraege" replace />} />
        <Route path="/auftraege" element={<OrdersList />} />
        <Route path="/auftraege/:id" element={<OrderDetail />} />
        <Route path="/berichte/:id" element={<BerichtDetail />} />
        <Route path="/kunden" element={<CustomersList />} />
        <Route path="/kunden/:id" element={<CustomerDetail />} />
        <Route path="/maschinen" element={<MachinesList />} />
        <Route path="/maschinen/:id" element={<MachineDetail />} />
        <Route
          path="/plantafel"
          element={<RequireRole roles={['Administrator', 'Disposition', 'CEO']}><Plantafel /></RequireRole>}
        />
        <Route
          path="/verwaltung"
          element={<RequireRole roles={['Techniker', 'CEO']}><Verwaltung /></RequireRole>}
        />
        <Route
          path="/mitarbeiter"
          element={<RequireRole roles={['Administrator', 'CEO']}><Mitarbeiter /></RequireRole>}
        />
        <Route
          path="/wissen"
          element={<RequireRole roles={['CEO']}><WissensSuche /></RequireRole>}
        />
        <Route path="*" element={<Navigate to="/auftraege" replace />} />
      </Route>
    </Routes>
  )
}
