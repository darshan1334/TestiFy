import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Activity, Mail, Lock, ArrowRight, GitBranch, Globe, Loader2, AlertTriangle } from 'lucide-react'
import { useAuth } from '../components/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const from = location.state?.from?.pathname || '/'

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!email || !password) {
      setError("Please fill in all fields.")
      return
    }
    
    setLoading(true)
    try {
      const user = await login({ email, password })
      if (user?.role === 'ADMIN') {
        navigate(from === '/' ? '/admin' : from, { replace: true })
      } else {
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Invalid email or password.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', width: '100vw', background: '#0a0d14', color: '#fff',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* ── Left Side (Branding & Info) ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', padding: '4rem',
        position: 'relative', overflow: 'hidden', borderRight: '1px solid rgba(255,255,255,0.05)',
      }} className="hide-on-mobile">
        
        {/* Animated Background Gradients */}
        <div style={{
          position: 'absolute', top: '-10%', left: '-10%', width: '60%', height: '60%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
          filter: 'blur(60px)', zIndex: 0, animation: 'pulse 8s infinite alternate'
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', right: '-10%', width: '70%', height: '70%',
          background: 'radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)',
          filter: 'blur(80px)', zIndex: 0, animation: 'pulse 12s infinite alternate-reverse'
        }} />

        <div style={{ zIndex: 1, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '6rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(99,102,241,0.4)'
            }}>
              <Activity color="#fff" size={24} />
            </div>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em' }}>TestiFy</span>
          </div>

          <h1 style={{ fontSize: '3.5rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '1.5rem', letterSpacing: '-0.03em' }}>
            AI-Powered <br/> Autonomous Testing <br/>
            <span style={{ background: 'linear-gradient(to right, #a78bfa, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              That Ships Quality
            </span>
          </h1>

          <p style={{ fontSize: '1.1rem', color: '#9ca3af', lineHeight: 1.6, maxWidth: 480, marginBottom: '3rem' }}>
            TestiFy explores, analyzes and tests your web applications autonomously to deliver quality you can trust.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {[
              "Autonomous Exploration",
              "AI Bug Detection",
              "Smart Analytics",
              "Security First"
            ].map(feature => (
              <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#818cf8' }} />
                </div>
                <span style={{ fontWeight: 500, color: '#e5e7eb' }}>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Side (Login Form) ── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem', background: '#0a0d14', position: 'relative', zIndex: 1
      }}>
        <div style={{
          width: '100%', maxWidth: 420, padding: '2.5rem',
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24, backdropFilter: 'blur(20px)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
        }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem', textAlign: 'center' }}>Welcome Back</h2>
          <p style={{ color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center', marginBottom: '2.5rem' }}>
            Log in to continue to your dashboard.
          </p>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.5rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fca5a5', fontSize: '0.85rem'
            }}>
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#d1d5db', marginBottom: '0.5rem' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  style={{
                    width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, padding: '0.75rem 1rem 0.75rem 2.5rem', color: '#fff', fontSize: '0.95rem',
                    transition: 'border-color 0.2s', outline: 'none'
                  }}
                  onFocus={e => e.target.style.borderColor = '#6366f1'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#d1d5db' }}>Password</label>
                <a href="#" style={{ fontSize: '0.75rem', color: '#a78bfa', textDecoration: 'none' }}>Forgot Password?</a>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, padding: '0.75rem 1rem 0.75rem 2.5rem', color: '#fff', fontSize: '0.95rem',
                    transition: 'border-color 0.2s', outline: 'none'
                  }}
                  onFocus={e => e.target.style.borderColor = '#6366f1'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <input type="checkbox" id="remember" style={{ accentColor: '#6366f1' }} />
              <label htmlFor="remember" style={{ fontSize: '0.8rem', color: '#9ca3af', cursor: 'pointer' }}>Remember Me</label>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff',
                border: 'none', borderRadius: 10, padding: '0.85rem', fontSize: '0.95rem', fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                marginTop: '1rem', boxShadow: '0 4px 14px rgba(99,102,241,0.4)', transition: 'transform 0.1s, box-shadow 0.2s',
                opacity: loading ? 0.7 : 1
              }}
              onMouseOver={e => !loading && (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseOut={e => !loading && (e.currentTarget.style.transform = 'translateY(0)')}
            >
              {loading ? <Loader2 size={18} className="spinner" /> : 'Login to TestiFy'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '2rem 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>or continue with</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
              padding: '0.75rem', color: '#d1d5db', fontSize: '0.85rem', fontWeight: 500, cursor: 'not-allowed', opacity: 0.5
            }} title="OAuth coming soon">
              <Globe size={16} /> Google
            </button>
            <button style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
              padding: '0.75rem', color: '#d1d5db', fontSize: '0.85rem', fontWeight: 500, cursor: 'not-allowed', opacity: 0.5
            }} title="OAuth coming soon">
              <GitBranch size={16} /> GitHub
            </button>
          </div>

          <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.85rem', color: '#9ca3af' }}>
            Don't have an account? <Link to="/register" style={{ color: '#a78bfa', textDecoration: 'none', fontWeight: 600 }}>Sign up</Link>
          </p>
        </div>
      </div>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1) translate(0, 0); opacity: 0.8; }
          100% { transform: scale(1.05) translate(2%, 2%); opacity: 1; }
        }
        @media (max-width: 900px) {
          .hide-on-mobile { display: none !important; }
        }
      `}</style>
    </div>
  )
}
