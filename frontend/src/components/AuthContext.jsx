import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../services/api'
import { Loader2 } from 'lucide-react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authApi.me()
      .then(userData => {
        setUser(userData)
      })
      .catch(() => {
        setUser(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const login = async (credentials) => {
    // First try the env-based admin login endpoint.
    // If the credentials don't match the env admin, it returns 401 and we
    // fall through to the regular database login — no credentials are
    // evaluated or stored in the frontend.
    try {
      const data = await authApi.adminLogin({ username: credentials.email, password: credentials.password })
      setUser(data.user)
      return data.user
    } catch {
      // Not the env admin — try normal DB login
    }
    const data = await authApi.login(credentials)
    setUser(data.user)
    return data.user
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--text-secondary)' }}>
          <Loader2 size={32} className="spinner" color="var(--accent-primary)" />
          <div style={{ fontSize: '0.85rem', letterSpacing: '0.05em' }}>Loading TestiFy...</div>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isAdmin: user?.role === 'ADMIN' }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
