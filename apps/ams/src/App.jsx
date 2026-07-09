import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  AuthProvider,
  LoginPage,
  ProtectedRoute,
  ModuleShell,
} from '@hae/ui'
import Dashboard from './pages/Dashboard.jsx'
import Members from './pages/Members.jsx'
import Memberships from './pages/Memberships.jsx'
import Events from './pages/Events.jsx'
import Committees from './pages/Committees.jsx'

const nav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/members', label: 'Members' },
  { to: '/memberships', label: 'Memberships' },
  { to: '/events', label: 'Events' },
  { to: '/committees', label: 'Committees' },
]

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
        <Routes>
          <Route path="/login" element={<LoginPage appName="HAE Membership" />} />
          <Route element={<ProtectedRoute />}>
            <Route
              element={
                <ModuleShell
                  moduleId="ams"
                  title="Membership (AMS)"
                  navItems={nav}
                />
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/members" element={<Members />} />
              <Route path="/memberships" element={<Memberships />} />
              <Route path="/events" element={<Events />} />
              <Route path="/committees" element={<Committees />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
