import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  AuthProvider,
  AuthActionPage,
  LoginPage,
  ProtectedRoute,
  ModuleShell,
  FeaturesGate,
  PERMISSIONS,
} from '@hae/ui'
import PublicShell from './components/PublicShell.jsx'
import PublicHome from './pages/PublicHome.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Directory from './pages/Directory.jsx'
import ExpertDetail from './pages/ExpertDetail.jsx'
import ManageExperts from './pages/ManageExperts.jsx'
import HowItWorks from './pages/HowItWorks.jsx'
import Help from './pages/Help.jsx'

function eirNav({ hasPermission }) {
  const items = [
    { to: '/app', label: 'Home', end: true, group: 'Experts', icon: 'home' },
    { to: '/app/directory', label: 'Directory', group: 'Experts', icon: 'users' },
    {
      to: '/app/how-it-works',
      label: 'How it works',
      group: 'Experts',
      icon: 'help',
    },
  ]
  if (hasPermission(PERMISSIONS.EIR_MANAGE)) {
    items.push({
      to: '/app/manage',
      label: 'Manage experts',
      group: 'Experts',
      icon: 'admin',
      permission: PERMISSIONS.EIR_MANAGE,
    })
  }
  items.push({ to: '/app/help', label: 'Help', group: 'Experts', icon: 'help' })
  return items
}

export default function App() {
  return (
    <AuthProvider>
      <FeaturesGate>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
          <Routes>
            {/* Public Expert Office Hours site (no login) */}
            <Route element={<PublicShell />}>
              <Route path="/" element={<PublicHome />} />
              <Route
                path="/directory"
                element={<Directory basePath="" publicMode />}
              />
              <Route
                path="/experts/:expertId"
                element={<ExpertDetail basePath="" publicMode />}
              />
              <Route
                path="/how-it-works"
                element={<HowItWorks directoryPath="/directory" publicMode />}
              />
            </Route>

            <Route
              path="/login"
              element={<LoginPage appName="Expert Office Hours" redirectTo="/app" />}
            />
            <Route
              path="/auth/action"
              element={<AuthActionPage appName="Expert Office Hours" />}
            />

            {/* Authenticated member / staff workspace */}
            <Route
              element={
                <ProtectedRoute
                  anyOf={[PERMISSIONS.EIR_READ, PERMISSIONS.EIR_MANAGE]}
                />
              }
            >
              <Route
                path="/app"
                element={
                  <ModuleShell
                    moduleId="eir"
                    title="Experts (EiR)"
                    navItems={eirNav}
                  />
                }
              >
                <Route index element={<Dashboard />} />
                <Route
                  path="directory"
                  element={<Directory basePath="/app" />}
                />
                <Route
                  path="experts/:expertId"
                  element={<ExpertDetail basePath="/app" />}
                />
                <Route
                  path="how-it-works"
                  element={<HowItWorks directoryPath="/app/directory" />}
                />
                <Route path="help" element={<Help />} />
                <Route
                  element={
                    <ProtectedRoute permission={PERMISSIONS.EIR_MANAGE} />
                  }
                >
                  <Route path="manage" element={<ManageExperts />} />
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
