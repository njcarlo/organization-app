import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  AuthProvider,
  LoginPage,
  ProtectedRoute,
  ModuleShell,
  FeaturesGate,
  useAuth,
  useFeatures,
  PERMISSIONS,
  FEATURES,
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
import Help from './pages/Help.jsx'
import Tracking from './pages/Tracking.jsx'
import Progress from './pages/Progress.jsx'
import Authoring from './pages/Authoring.jsx'

function lmsNav({ hasPermission, isEnabled }) {
  const items = []
  if (hasPermission(PERMISSIONS.LMS_LEARN)) {
    items.push({ to: '/', label: 'My learning', end: true })
  } else if (hasPermission(PERMISSIONS.LMS_MANAGE)) {
    items.push({ to: '/', label: 'Dashboard', end: true })
  } else {
    items.push({ to: '/catalog', label: 'Catalog', end: true })
  }

  if (hasPermission(PERMISSIONS.LMS_CATALOG)) {
    items.push({ to: '/catalog', label: 'Catalog' })
  }
  if (hasPermission(PERMISSIONS.LMS_LEARN)) {
    items.push({ to: '/my-certificates', label: 'My certificates' })
    if (isEnabled(FEATURES.LMS_GAMIFICATION)) {
      items.push({
        to: '/progress',
        label: 'Points & badges',
        feature: FEATURES.LMS_GAMIFICATION,
      })
    }
  }
  if (hasPermission(PERMISSIONS.LMS_MANAGE)) {
    items.push(
      { to: '/courses', label: 'Manage courses', permission: PERMISSIONS.LMS_MANAGE },
      {
        to: '/authoring',
        label: 'Authoring',
        permission: PERMISSIONS.LMS_MANAGE,
        feature: FEATURES.LMS_AUTHORING,
      },
      { to: '/enrollments', label: 'Enrollments', permission: PERMISSIONS.LMS_MANAGE },
      {
        to: '/tracking',
        label: 'Tracking',
        permission: PERMISSIONS.LMS_MANAGE,
        feature: FEATURES.LMS_TRACKING,
      },
      { to: '/sessions', label: 'Office Hours', permission: PERMISSIONS.LMS_MANAGE },
      { to: '/check-ins', label: 'Check-ins', permission: PERMISSIONS.LMS_MANAGE },
      { to: '/certificates', label: 'Issue certificates', permission: PERMISSIONS.LMS_MANAGE }
    )
  }
  items.push({ to: '/help', label: 'Help' })
  return items
}

function HomeRoute() {
  const { hasPermission } = useAuth()
  if (hasPermission(PERMISSIONS.LMS_MANAGE) && !hasPermission(PERMISSIONS.LMS_LEARN)) {
    return <Dashboard />
  }
  if (hasPermission(PERMISSIONS.LMS_MANAGE)) return <Dashboard />
  if (hasPermission(PERMISSIONS.LMS_LEARN)) return <StudentHome />
  return <Catalog />
}

function FeatureRoute({ feature, children }) {
  const { isEnabled } = useFeatures()
  if (!isEnabled(feature)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <FeaturesGate>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
          <Routes>
            <Route path="/login" element={<LoginPage appName="HAE Academy LMS" />} />
            <Route
              element={
                <ProtectedRoute
                  anyOf={[
                    PERMISSIONS.LMS_CATALOG,
                    PERMISSIONS.LMS_LEARN,
                    PERMISSIONS.LMS_MANAGE,
                  ]}
                />
              }
            >
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
                <Route
                  path="/progress"
                  element={
                    <FeatureRoute feature={FEATURES.LMS_GAMIFICATION}>
                      <Progress />
                    </FeatureRoute>
                  }
                />
                <Route path="/courses/:courseId" element={<CourseDetail />} />
                <Route path="/help" element={<Help />} />

                <Route element={<ProtectedRoute permission={PERMISSIONS.LMS_MANAGE} />}>
                  <Route path="/courses" element={<Courses />} />
                  <Route
                    path="/authoring"
                    element={
                      <FeatureRoute feature={FEATURES.LMS_AUTHORING}>
                        <Authoring />
                      </FeatureRoute>
                    }
                  />
                  <Route path="/enrollments" element={<Enrollments />} />
                  <Route
                    path="/tracking"
                    element={
                      <FeatureRoute feature={FEATURES.LMS_TRACKING}>
                        <Tracking />
                      </FeatureRoute>
                    }
                  />
                  <Route path="/sessions" element={<Sessions />} />
                  <Route path="/check-ins" element={<CheckIns />} />
                  <Route path="/certificates" element={<Certificates />} />
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
