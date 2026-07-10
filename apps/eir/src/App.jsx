import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  AuthProvider,
  LoginPage,
  ProtectedRoute,
  ModuleShell,
  FeaturesGate,
  PERMISSIONS,
} from '@hae/ui'
import Dashboard from './pages/Dashboard.jsx'
import Directory from './pages/Directory.jsx'
import ExpertDetail from './pages/ExpertDetail.jsx'
import ManageExperts from './pages/ManageExperts.jsx'
import HowItWorks from './pages/HowItWorks.jsx'
import Help from './pages/Help.jsx'

function eirNav({ hasPermission }) {
  const items = [
    { to: '/', label: 'Home', end: true, group: 'Experts', icon: 'home' },
    { to: '/directory', label: 'Directory', group: 'Experts', icon: 'users' },
    { to: '/how-it-works', label: 'How it works', group: 'Experts', icon: 'help' },
  ]
  if (hasPermission(PERMISSIONS.EIR_MANAGE)) {
    items.push({
      to: '/manage',
      label: 'Manage experts',
      group: 'Experts',
      icon: 'admin',
      permission: PERMISSIONS.EIR_MANAGE,
    })
  }
  items.push({ to: '/help', label: 'Help', group: 'Experts', icon: 'help' })
  return items
}

export default function App() {
  return (
    <AuthProvider>
      <FeaturesGate>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
          <Routes>
            <Route
              path="/login"
              element={<LoginPage appName="Expert Office Hours" />}
            />
            <Route
              element={
                <ProtectedRoute
                  anyOf={[PERMISSIONS.EIR_READ, PERMISSIONS.EIR_MANAGE]}
                />
              }
            >
              <Route
                element={
                  <ModuleShell
                    moduleId="eir"
                    title="Experts (EiR)"
                    navItems={eirNav}
                  />
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/directory" element={<Directory />} />
                <Route path="/experts/:expertId" element={<ExpertDetail />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/help" element={<Help />} />
                <Route element={<ProtectedRoute permission={PERMISSIONS.EIR_MANAGE} />}>
                  <Route path="/manage" element={<ManageExperts />} />
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
