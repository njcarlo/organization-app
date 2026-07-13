import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AuthActionPage, FeaturesProvider, useFeatures, FEATURES } from '@hae/ui'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Setup from './pages/Setup'
import Dashboard from './pages/Dashboard'
import EventsDashboard from './pages/EventsDashboard'
import Activity from './pages/Activity'
import ProgramPage from './pages/ProgramPage'
import CategoryProgramPage from './pages/CategoryProgramPage'
import CourseRegistrations from './pages/CourseRegistrations'
import MyTasks from './pages/MyTasks'
import Calendar from './pages/Calendar'
import Notifications from './pages/Notifications'
import ExecutiveInbox from './pages/ExecutiveInbox'
import Admin from './pages/Admin'
import Help from './pages/Help'
import Surveys from './pages/Surveys'
import SurveyEditor from './pages/SurveyEditor'
import SurveyRespond from './pages/SurveyRespond'
import { PERMISSIONS } from '../../../packages/ui/src/rbac.js'
import { EXEC_INBOX_EMAILS } from './constants'

function TrackerFeaturesProvider({ children }) {
  const { isSuperAdmin } = useAuth()
  return (
    <FeaturesProvider isSuperAdmin={!!isSuperAdmin}>{children}</FeaturesProvider>
  )
}

function FeatureRoute({ feature, children }) {
  const { isEnabled } = useFeatures()
  if (!isEnabled(feature)) return <Navigate to="/" replace />
  return children
}

function ExecInboxRoute({ children }) {
  const { user } = useAuth()
  const allowed = EXEC_INBOX_EMAILS.includes((user?.email || '').toLowerCase())
  if (!allowed) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <TrackerFeaturesProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/auth/action"
              element={<AuthActionPage appName="Operations" />}
            />
            <Route path="/setup" element={<Setup />} />
            {/* Public survey response — no login required */}
            <Route path="/s/:surveyId" element={<SurveyRespond />} />

            {/* Help: any signed-in directory user (not only tracker:read) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/help" element={<Help />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute permission={PERMISSIONS.TRACKER_READ} />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/my-tasks" element={<MyTasks />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/events-dashboard" element={<EventsDashboard />} />
                <Route path="/activity" element={<Activity />} />
                <Route
                  path="/executive-inbox"
                  element={
                    <ExecInboxRoute>
                      <ExecutiveInbox />
                    </ExecInboxRoute>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <FeatureRoute feature={FEATURES.NOTIFICATIONS}>
                      <Notifications />
                    </FeatureRoute>
                  }
                />
                <Route path="/programs/:programId" element={<ProgramPage />} />
                <Route
                  path="/academy/course-registrations"
                  element={<CourseRegistrations />}
                />
                <Route
                  path="/academy/:itemId"
                  element={
                    <CategoryProgramPage
                      collectionName="academyPrograms"
                      categoryLabel="Academy"
                    />
                  }
                />
                <Route
                  path="/custom-programs/:itemId"
                  element={
                    <CategoryProgramPage
                      collectionName="customPrograms"
                      categoryLabel="Custom Program"
                    />
                  }
                />
                <Route
                  path="/documents/:itemId"
                  element={
                    <CategoryProgramPage
                      collectionName="trackerDocuments"
                      categoryLabel="Document"
                    />
                  }
                />
                <Route
                  path="/events/:itemId"
                  element={
                    <CategoryProgramPage
                      collectionName="trackerEvents"
                      categoryLabel="Event"
                    />
                  }
                />
                <Route
                  path="/graphics/:itemId"
                  element={
                    <CategoryProgramPage
                      collectionName="trackerGraphics"
                      categoryLabel="Graphic"
                    />
                  }
                />
                <Route
                  element={
                    <ProtectedRoute
                      anyOf={[PERMISSIONS.TRACKER_WRITE, PERMISSIONS.TRACKER_ADMIN]}
                    />
                  }
                >
                  <Route
                    path="/surveys"
                    element={
                      <FeatureRoute feature={FEATURES.SURVEYS}>
                        <Surveys />
                      </FeatureRoute>
                    }
                  />
                  <Route
                    path="/surveys/:surveyId"
                    element={
                      <FeatureRoute feature={FEATURES.SURVEYS}>
                        <SurveyEditor />
                      </FeatureRoute>
                    }
                  />
                </Route>
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
      </TrackerFeaturesProvider>
    </AuthProvider>
  )
}
