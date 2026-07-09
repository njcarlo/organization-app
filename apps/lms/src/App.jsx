import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  AuthProvider,
  LoginPage,
  ProtectedRoute,
  ModuleShell,
} from '@hae/ui'
import Dashboard from './pages/Dashboard.jsx'
import Courses from './pages/Courses.jsx'
import CourseDetail from './pages/CourseDetail.jsx'
import Enrollments from './pages/Enrollments.jsx'
import Sessions from './pages/Sessions.jsx'
import CheckIns from './pages/CheckIns.jsx'
import Certificates from './pages/Certificates.jsx'

const nav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/courses', label: 'Courses' },
  { to: '/enrollments', label: 'Enrollments' },
  { to: '/sessions', label: 'Office Hours' },
  { to: '/check-ins', label: 'Check-ins' },
  { to: '/certificates', label: 'Certificates' },
]

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
        <Routes>
          <Route path="/login" element={<LoginPage appName="HAE Academy LMS" />} />
          <Route element={<ProtectedRoute />}>
            <Route
              element={
                <ModuleShell
                  moduleId="lms"
                  title="Academy LMS"
                  navItems={nav}
                />
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/courses/:courseId" element={<CourseDetail />} />
              <Route path="/enrollments" element={<Enrollments />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/check-ins" element={<CheckIns />} />
              <Route path="/certificates" element={<Certificates />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
