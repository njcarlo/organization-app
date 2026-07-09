import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  AuthProvider,
  LoginPage,
  ProtectedRoute,
  ModuleShell,
  useAuth,
} from '@hae/ui'
import Dashboard from './pages/Dashboard.jsx'
import StudentHome from './pages/StudentHome.jsx'
import Catalog from './pages/Catalog.jsx'
import Courses from './pages/Courses.jsx'
import CourseDetail from './pages/CourseDetail.jsx'
import Enrollments from './pages/Enrollments.jsx'
import Sessions from './pages/Sessions.jsx'
import CheckIns from './pages/CheckIns.jsx'
import Certificates from './pages/Certificates.jsx'
import MyCertificates from './pages/MyCertificates.jsx'

const studentNav = [
  { to: '/', label: 'My learning', end: true },
  { to: '/catalog', label: 'Catalog' },
  { to: '/my-certificates', label: 'My certificates' },
]

const staffNav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/catalog', label: 'Catalog' },
  { to: '/courses', label: 'Manage courses', adminOnly: true },
  { to: '/enrollments', label: 'Enrollments', adminOnly: true },
  { to: '/sessions', label: 'Office Hours', adminOnly: true },
  { to: '/check-ins', label: 'Check-ins', adminOnly: true },
  { to: '/certificates', label: 'Issue certificates', adminOnly: true },
]

function lmsNav({ isAdmin }) {
  return isAdmin ? staffNav : studentNav
}

function HomeRoute() {
  const { isAdmin } = useAuth()
  return isAdmin ? <Dashboard /> : <StudentHome />
}

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
                  navItems={lmsNav}
                />
              }
            >
              <Route path="/" element={<HomeRoute />} />
              <Route path="/catalog" element={<Catalog />} />
              <Route path="/my-certificates" element={<MyCertificates />} />
              <Route path="/courses/:courseId" element={<CourseDetail />} />

              <Route element={<ProtectedRoute adminOnly />}>
                <Route path="/courses" element={<Courses />} />
                <Route path="/enrollments" element={<Enrollments />} />
                <Route path="/sessions" element={<Sessions />} />
                <Route path="/check-ins" element={<CheckIns />} />
                <Route path="/certificates" element={<Certificates />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
