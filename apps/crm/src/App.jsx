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
import Contacts from './pages/Contacts.jsx'
import Interactions from './pages/Interactions.jsx'
import Pipeline from './pages/Pipeline.jsx'
import Help from './pages/Help.jsx'

const nav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/contacts', label: 'Contacts' },
  { to: '/interactions', label: 'Interactions' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/help', label: 'Help' },
]

export default function App() {
  return (
    <AuthProvider>
      <FeaturesGate>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
          <Routes>
            <Route path="/login" element={<LoginPage appName="HAE Relationships" />} />
            <Route
              element={
                <ProtectedRoute
                  anyOf={[PERMISSIONS.CRM_READ, PERMISSIONS.CRM_WRITE]}
                />
              }
            >
              <Route
                element={
                  <ModuleShell
                    moduleId="crm"
                    title="Relationships (CRM)"
                    navItems={nav}
                  />
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/interactions" element={<Interactions />} />
                <Route path="/pipeline" element={<Pipeline />} />
                <Route path="/help" element={<Help />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </FeaturesGate>
    </AuthProvider>
  )
}
