import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  AuthProvider,
  LoginPage,
  ProtectedRoute,
  ModuleShell,
} from '@hae/ui'
import Dashboard from './pages/Dashboard.jsx'
import Directory from './pages/Directory.jsx'
import ExpertDetail from './pages/ExpertDetail.jsx'
import ManageExperts from './pages/ManageExperts.jsx'
import HowItWorks from './pages/HowItWorks.jsx'

const nav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/directory', label: 'Directory' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/manage', label: 'Manage experts' },
]

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
        <Routes>
          <Route
            path="/login"
            element={<LoginPage appName="Expert Office Hours" />}
          />
          <Route element={<ProtectedRoute />}>
            <Route
              element={
                <ModuleShell
                  moduleId="eir"
                  title="Experts (EiR)"
                  navItems={nav}
                />
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/directory" element={<Directory />} />
              <Route path="/experts/:expertId" element={<ExpertDetail />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/manage" element={<ManageExperts />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
