import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, Mail, Lock, User, ArrowRight, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { authApi } from '../services/api'

export default function RegisterPage() {
  const navigate = useNavigate()
  
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    
    if (!form.name || !form.email || !form.password || !form.confirmPassword) {
      setError("Please fill in all fields.")
      return
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }
    
    setLoading(true)
    try {
      await authApi.register({ name: form.name, email: form.email, password: form.password })
      setSuccess(true)
    } catch (err) {
      setError(err?.response?.data?.detail || "Registration failed. Email might already be in use.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', width: '100vw', background: '#0a0d14', color: '#fff',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* ── Left Side (Branding) ── */}
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
            Join the <br/> Autonomous Testing <br/>
            <span style={{ background: 'linear-gradient(to right, #a78bfa, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Revolution
            </span>
          </h1>

          <p style={{ fontSize: '1.1rem', color: '#9ca3af', lineHeight: 1.6, maxWidth: 480 }}>
            Create an account to start testing your web applications autonomously.
          </p>
        </div>
      </div>

      {/* ── Right Side (Register Form) ── */}
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
          {success ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem'
              }}>
                <CheckCircle2 size={32} color="#22c55e" />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Account Created!</h2>
              <p style={{ color: '#9ca3af', fontSize: '0.95rem', marginBottom: '2rem' }}>
                Your account has been successfully created. You can now log in.
              </p>
              <Link to="/login" style={{
                display: 'inline-flex', background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff',
                padding: '0.75rem 2rem', borderRadius: 10, textDecoration: 'none', fontWeight: 600
              }}>
                Go to Login
              </Link>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem', textAlign: 'center' }}>Create an Account</h2>
              <p style={{ color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center', marginBottom: '2.5rem' }}>
                Sign up to start using TestiFy.
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
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#d1d5db', marginBottom: '0.5rem' }}>Full Name</label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
                    <input
                      name="name" type="text" value={form.name} onChange={handleChange} placeholder="John Doe"
                      style={{
                        width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 10, padding: '0.75rem 1rem 0.75rem 2.5rem', color: '#fff', fontSize: '0.95rem',
                        transition: 'border-color 0.2s', outline: 'none'
                      }}
                      onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#d1d5db', marginBottom: '0.5rem' }}>Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
                    <input
                      name="email" type="email" value={form.email} onChange={handleChange} placeholder="name@company.com"
                      style={{
                        width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 10, padding: '0.75rem 1rem 0.75rem 2.5rem', color: '#fff', fontSize: '0.95rem',
                        transition: 'border-color 0.2s', outline: 'none'
                      }}
                      onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#d1d5db', marginBottom: '0.5rem' }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
                    <input
                      name="password" type="password" value={form.password} onChange={handleChange} placeholder="••••••••"
                      style={{
                        width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 10, padding: '0.75rem 1rem 0.75rem 2.5rem', color: '#fff', fontSize: '0.95rem',
                        transition: 'border-color 0.2s', outline: 'none'
                      }}
                      onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#d1d5db', marginBottom: '0.5rem' }}>Confirm Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
                    <input
                      name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder="••••••••"
                      style={{
                        width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 10, padding: '0.75rem 1rem 0.75rem 2.5rem', color: '#fff', fontSize: '0.95rem',
                        transition: 'border-color 0.2s', outline: 'none'
                      }}
                      onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>
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
                  {loading ? <Loader2 size={18} className="spinner" /> : 'Create Account'}
                  {!loading && <ArrowRight size={18} />}
                </button>
              </form>

              <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.85rem', color: '#9ca3af' }}>
                Already have an account? <Link to="/login" style={{ color: '#a78bfa', textDecoration: 'none', fontWeight: 600 }}>Log in</Link>
              </p>
            </>
          )}
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
