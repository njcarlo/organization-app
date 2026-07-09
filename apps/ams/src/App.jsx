import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  AuthProvider,
  LoginPage,
  ProtectedRoute,
  ModuleShell,
  useAuth,
  PERMISSIONS,
} from '@hae/ui'
import Dashboard from './pages/Dashboard.jsx'
import Members from './pages/Members.jsx'
import Memberships from './pages/Memberships.jsx'
import Events from './pages/Events.jsx'
import Committees from './pages/Committees.jsx'
import MemberHome from './pages/MemberHome.jsx'
import Help from './pages/Help.jsx'

function amsNav({ hasPermission }) {
  if (hasPermission(PERMISSIONS.AMS_MANAGE)) {
    return [
      { to: '/', label: 'Dashboard', end: true },
      { to: '/members', label: 'Members' },
      { to: '/memberships', label: 'Memberships' },
      { to: '/events', label: 'Events' },
      { to: '/committees', label: 'Committees' },
      { to: '/help', label: 'Help' },
    ]
  }
  return [
    { to: '/', label: 'My membership', end: true },
    { to: '/events', label: 'Events' },
    { to: '/help', label: 'Help' },
  ]
}

function HomeRoute() {
  const { hasPermission } = useAuth()
  return hasPermission(PERMISSIONS.AMS_MANAGE) ? <Dashboard /> : <MemberHome />
}

export default function App() {
  return (
    <AuthProvider>
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

              <Route element={<ProtectedRoute permission={PERMISSIONS.AMS_MANAGE} />}>
                <Route path="/members" element={<Members />} />
                <Route path="/memberships" element={<Memberships />} />
                <Route path="/committees" element={<Committees />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
