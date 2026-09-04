/**
 * Scoped shell for the TestiFy Security add-on.
 *
 * Everything security-related is contained here:
 *  - ScanProvider (which opens a WebSocket and polls every 2.5s) is mounted
 *    only for these routes, so it never runs while the user is on a TestiFy
 *    testing page.
 *  - .security-scope applies the vibranium theme to this subtree only.
 */
import { Routes, Route } from 'react-router-dom'
import { ScanProvider } from './lib/ScanContext'
import Dashboard from './pages/Dashboard'
import UploadPage from './pages/UploadPage'
import CodeScanner from './pages/CodeScanner'
import SecretsPage from './pages/SecretsPage'
import DependenciesPage from './pages/DependenciesPage'
import SBOMPage from './pages/SBOMPage'
import OwaspPage from './pages/OwaspPage'
import AIRecommendationsPage from './pages/AIRecommendationsPage'
import ReportsPage from './pages/ReportsPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'
import Footer from './components/Footer'

export default function SecuritySection() {
  return (
    <ScanProvider>
      <div className="security-scope flex flex-col min-h-full -m-7 md:-m-8">
        <div className="flex-1 min-w-0">
          <Routes>
            <Route path="/"             element={<Dashboard />} />
            <Route path="/upload"       element={<UploadPage />} />
            <Route path="/scanner"      element={<CodeScanner />} />
            <Route path="/secrets"      element={<SecretsPage />} />
            <Route path="/dependencies" element={<DependenciesPage />} />
            <Route path="/sbom"         element={<SBOMPage />} />
            <Route path="/owasp"        element={<OwaspPage />} />
            <Route path="/ai"           element={<AIRecommendationsPage />} />
            <Route path="/reports"      element={<ReportsPage />} />
            <Route path="/history"      element={<HistoryPage />} />
            <Route path="/settings"     element={<SettingsPage />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </ScanProvider>
  )
}
