import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Setup from './pages/Setup'
import Dashboard from './pages/Dashboard'
import ProgramPage from './pages/ProgramPage'
import MyTasks from './pages/MyTasks'
import Admin from './pages/Admin'
import Help from './pages/Help'
import { PERMISSIONS } from '../../../packages/ui/src/rbac.js'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/setup" element={<Setup />} />

          <Route element={<ProtectedRoute permission={PERMISSIONS.TRACKER_READ} />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/my-tasks" element={<MyTasks />} />
              <Route path="/help" element={<Help />} />
              <Route path="/programs/:programId" element={<ProgramPage />} />
              <Route
                element={
                  <ProtectedRoute
                    anyOf={[PERMISSIONS.TRACKER_ADMIN, PERMISSIONS.PLATFORM_USERS]}
                  />
                }
              >
                <Route path="/admin" element={<Admin />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
