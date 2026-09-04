import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import DashboardPage from './pages/DashboardPage'
import NewTestPage from './pages/NewTestPage'
import HistoryPage from './pages/HistoryPage'
import TestResultsPage from './pages/TestResultsPage'
import BugsPage from './pages/BugsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import ReportsPage from './pages/ReportsPage'
import ReportPage from './pages/ReportPage'
import SettingsPage from './pages/SettingsPage'
import ReportIssuePage from './pages/ReportIssuePage'
import IssueDetailPage from './pages/IssueDetailPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AdminAreaPage from './pages/AdminAreaPage'
import { AuthProvider } from './components/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// Loaded on demand so the security add-on's heavier deps (Monaco, Chart.js)
// never enter TestiFy's initial bundle.
const SecuritySection = lazy(() => import('./security/SecuritySection'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Protected Application Routes inside Layout */}
          <Route path="/*" element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/"                    element={<DashboardPage />} />
                  <Route path="/new-test"            element={<NewTestPage />} />
                  <Route path="/history"             element={<HistoryPage />} />
                  <Route path="/results"             element={<TestResultsPage />} />
                  <Route path="/results/:sessionId"  element={<TestResultsPage />} />
                  <Route path="/bugs"                element={<BugsPage />} />
                  <Route path="/bugs/:sessionId"     element={<BugsPage />} />
                  <Route path="/analytics"           element={<AnalyticsPage />} />
                  <Route path="/reports"             element={<ReportsPage />} />
                  <Route path="/report/:sessionId"   element={<ReportPage />} />
                  <Route path="/settings"            element={<SettingsPage />} />

                  {/* User Issue Report */}
                  <Route path="/report-issue"         element={<ReportIssuePage />} />
                  <Route path="/issues/:issueId"      element={<IssueDetailPage />} />

                  {/* TestiFy Security add-on */}
                  <Route
                    path="/security/*"
                    element={
                      <Suspense fallback={
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          Loading security module…
                        </div>
                      }>
                        <SecuritySection />
                      </Suspense>
                    }
                  />
                </Routes>
              </Layout>
            </ProtectedRoute>
          } />

          {/* Protected Admin Routes */}
          <Route path="/admin/*" element={
            <ProtectedRoute requireAdmin={true}>
              <AdminLayout>
                <Routes>
                  <Route path="/"                    element={<AdminAreaPage />} />
                  <Route path="/sessions"            element={<HistoryPage />} />
                  <Route path="/bugs"                element={<BugsPage />} />
                  <Route path="/reports"             element={<ReportsPage />} />
                  <Route path="/analytics"           element={<AnalyticsPage />} />
                </Routes>
              </AdminLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
