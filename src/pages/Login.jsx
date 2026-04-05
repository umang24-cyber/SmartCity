import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Login.css';

export default function Login() {
  const [mode, setMode] = useState('supervisor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const user = await login({
        role: mode,
        email,
        password: mode === 'officer' ? password : undefined,
        accessKey: mode === 'supervisor' ? accessKey : undefined
      });
      if (user.role === 'supervisor') navigate('/supervisor');
      else if (user.role === 'officer') navigate('/officer');
      else if (user.role === 'user' || user.role === 'citizen') navigate('/supervisor'); // fallback
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="login-container flex-col items-center justify-center">
        <div className="login-card p-12 text-center">
          <div className="loading-spinner mb-4 mx-auto"></div>
          <p className="text-cyan font-mono animate-pulse">SYNCHRONIZING AUTH SYSTEMS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">ORAYA OS</h1>
        <p className="login-subtitle">COMMAND ACCESS PORTAL</p>
        <div className="auth-switch">
          <button type="button" className={mode === 'supervisor' ? 'active' : ''} onClick={() => setMode('supervisor')}>
            SUPERVISOR
          </button>
          <button type="button" className={mode === 'officer' ? 'active' : ''} onClick={() => setMode('officer')}>
            OFFICER
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label>{mode === 'supervisor' ? 'SUPERVISOR EMAIL' : 'OFFICER EMAIL'}</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="Enter ID"
            />
          </div>

          {mode === 'supervisor' ? (
            <div className="input-group">
              <label>SUPERVISOR ACCESS KEY</label>
              <input
                type="password"
                value={accessKey}
                onChange={e => setAccessKey(e.target.value)}
                required
                placeholder="Enter Supervisor Access Key"
              />
            </div>
          ) : (
            <div className="input-group">
              <label>PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Enter Password"
              />
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className="login-btn">
            {isSubmitting ? 'AUTHENTICATING...' : 'INITIALIZE UPLINK'}
          </button>
        </form>

        <div className="login-footer-link">
          <p>Don't have an account?</p>
          <button type="button" onClick={() => navigate('/signup')}>
            Register as New {mode === 'supervisor' ? 'Admin' : 'Police'}
          </button>
        </div>

        <div className="login-footer-link" style={{ marginTop: '0.5rem' }}>
          <button type="button" onClick={() => navigate('/')}>
            ← Return to Portal
          </button>
        </div>
      </div>
    </div>
  );
}
