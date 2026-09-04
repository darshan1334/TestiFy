import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, AlertCircle, Database, Bug, BarChart2, FileText, LogOut, ChevronRight
} from 'lucide-react'
import { useAuth } from './AuthContext'

const ADMIN_NAV = [
  { label: 'Admin Dashboard',     to: '/admin',             icon: LayoutDashboard, exact: true },
  { divider: 'Management' },
  { label: 'User Management',     to: '/admin?tab=users',   icon: Users },
  { label: 'User Reported Issues',to: '/admin?tab=issues',  icon: AlertCircle },
  { divider: 'System Data' },
  { label: 'Test Sessions',       to: '/admin/sessions',    icon: Database },
  { label: 'Bugs',                to: '/admin/bugs',        icon: Bug },
  { label: 'Reports',             to: '/admin/reports',     icon: FileText },
  { label: 'Analytics',           to: '/admin/analytics',   icon: BarChart2 },
]

export default function AdminSidebar() {
  const { pathname, search } = useLocation()
  const { user, logout } = useAuth()

  function isActive(to, exact) {
    if (to.includes('?')) {
      return pathname + search === to
    }
    if (exact) return pathname === to && !search
    return pathname.startsWith(to) && !search
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <Link to="/admin" className="sidebar-logo" style={{ textDecoration: 'none' }}>
        <div className="sidebar-logo-icon" style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)' }}>
          <ShieldAlert size={17} color="white" />
        </div>
        <span className="sidebar-logo-text">TestiFy Admin</span>
      </Link>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {ADMIN_NAV.map((item, i) => {
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
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #ef4444, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Users size={16} />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
              {user?.name || 'Admin'}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#ef4444' }}>
              Administrator
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

function ShieldAlert(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width={props.size} height={props.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  )
}
