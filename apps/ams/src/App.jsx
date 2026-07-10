import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  AuthProvider,
  LoginPage,
  ProtectedRoute,
  ModuleShell,
  FeaturesGate,
  useAuth,
  PERMISSIONS,
} from '@hae/ui'
import Dashboard from './pages/Dashboard.jsx'
import Members from './pages/Members.jsx'
import Memberships from './pages/Memberships.jsx'
import Events from './pages/Events.jsx'
import Committees from './pages/Committees.jsx'
import MemberHome from './pages/MemberHome.jsx'
import Pricing from './pages/Pricing.jsx'
import PaymentSuccess from './pages/PaymentSuccess.jsx'
import PaymentCancel from './pages/PaymentCancel.jsx'
import Help from './pages/Help.jsx'

function amsNav({ hasPermission }) {
  if (hasPermission(PERMISSIONS.AMS_MANAGE)) {
    return [
      { to: '/', label: 'Dashboard', end: true, group: 'Membership', icon: 'home' },
      { to: '/members', label: 'Members', group: 'Membership', icon: 'users' },
      { to: '/memberships', label: 'Memberships', group: 'Membership', icon: 'building' },
      { to: '/pricing', label: 'Pricing & Stripe', group: 'Membership', icon: 'chart' },
      { to: '/events', label: 'Events', group: 'Membership', icon: 'calendar' },
      { to: '/committees', label: 'Committees', group: 'Membership', icon: 'folder' },
      { to: '/help', label: 'Help', group: 'Membership', icon: 'help' },
    ]
  }
  return [
    { to: '/', label: 'My membership', end: true, group: 'Membership', icon: 'home' },
    { to: '/events', label: 'Events', group: 'Membership', icon: 'calendar' },
    { to: '/help', label: 'Help', group: 'Membership', icon: 'help' },
  ]
}

function HomeRoute() {
  const { hasPermission } = useAuth()
  return hasPermission(PERMISSIONS.AMS_MANAGE) ? <Dashboard /> : <MemberHome />
}

export default function App() {
  return (
    <AuthProvider>
      <FeaturesGate>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
          <Routes>
            <Route path="/login" element={<LoginPage appName="HAE Membership" />} />
            <Route
              element={
                <ProtectedRoute
                  anyOf={[PERMISSIONS.AMS_READ, PERMISSIONS.AMS_MANAGE]}
                />
              }
            >
              <Route
                element={
                  <ModuleShell
                    moduleId="ams"
                    title="Membership (AMS)"
                    navItems={amsNav}
                  />
                }
              >
                <Route path="/" element={<HomeRoute />} />
                <Route path="/events" element={<Events />} />
                <Route path="/help" element={<Help />} />
                <Route path="/payment/success" element={<PaymentSuccess />} />
                <Route path="/payment/cancel" element={<PaymentCancel />} />

                <Route element={<ProtectedRoute permission={PERMISSIONS.AMS_MANAGE} />}>
                  <Route path="/members" element={<Members />} />
                  <Route path="/memberships" element={<Memberships />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/committees" element={<Committees />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </FeaturesGate>
    </AuthProvider>
  )
}
