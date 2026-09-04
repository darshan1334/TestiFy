import { Link, useLocation } from 'react-router-dom'
import {
  Zap, LayoutDashboard, PlusCircle, History, ClipboardList,
  Bug, BarChart2, FileText, Settings, ChevronRight,
  ShieldCheck, UploadCloud, ScanSearch, KeyRound, PackageSearch, ShieldAlert, ScrollText,
  MessageSquareWarning, User, LogOut, ShieldCheck as AdminIcon
} from 'lucide-react'
import { useAuth } from './AuthContext'

const NAV_ITEMS = [
  { label: 'Dashboard',       to: '/',               icon: LayoutDashboard },
  { label: 'New Test',        to: '/new-test',        icon: PlusCircle },
  { divider: 'Testing' },
  { label: 'Test History',    to: '/history',         icon: History },
  { label: 'Test Results',    to: '/results',         icon: ClipboardList },
  { label: 'Bugs',            to: '/bugs',            icon: Bug },
  { label: 'Report an Issue', to: '/report-issue',    icon: MessageSquareWarning },
  { divider: 'Insights' },
  { label: 'Analytics',       to: '/analytics',       icon: BarChart2 },
  { label: 'Reports',         to: '/reports',         icon: FileText },
  { divider: 'Security' },
  { label: 'Security Scan',   to: '/security',              icon: ShieldCheck, exact: true },
  { label: 'Upload Project',  to: '/security/upload',       icon: UploadCloud },
  { label: 'Code Scanner',    to: '/security/scanner',      icon: ScanSearch },
  { label: 'Secrets',         to: '/security/secrets',      icon: KeyRound },
  { label: 'Dependencies',    to: '/security/dependencies', icon: PackageSearch },
  { label: 'OWASP Top 10',    to: '/security/owasp',        icon: ShieldAlert },
  { label: 'Scan History',    to: '/security/history',      icon: ScrollText },
  { divider: 'System' },
  { label: 'Settings',        to: '/settings',        icon: Settings },
]

export default function Sidebar() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()

  function isActive(to, exact) {
    if (to === '/' || exact) return pathname === to
    return pathname.startsWith(to)
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <Link to="/" className="sidebar-logo" style={{ textDecoration: 'none' }}>
        <div className="sidebar-logo-icon">
          <Zap size={17} color="white" fill="white" />
        </div>
        <span className="sidebar-logo-text">TestiFy</span>
        <span className="sidebar-logo-badge">AI</span>
      </Link>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item, i) => {
          if (item.divider) {
            return (
              <div key={`div-${i}`} className="sidebar-section-label">
                {item.divider}
              </div>
            )
          }
          const Icon = item.icon
          const active = isActive(item.to, item.exact)
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`nav-item ${active ? 'active' : ''}`}
            >
              <Icon size={15} className="nav-item-icon" />
              <span style={{ flex: 1 }}>{item.label}</span>
              {active && <ChevronRight size={12} style={{ opacity: 0.5 }} />}
            </Link>
          )
        })}
      </nav>

      {/* Footer / User Profile */}
      <div style={{
        padding: '1rem',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <User size={16} />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
              {user?.name || 'User'}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              {user?.role === 'ADMIN' ? 'Administrator' : 'Standard User'}
            </div>
          </div>
        </div>
        <button 
          onClick={logout}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
          title="Log out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}
