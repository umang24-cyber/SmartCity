import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Login.css';

export default function Login() {
  const [mode, setMode] = useState('user');
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
        password: mode === 'user' ? password : undefined,
        accessKey: mode === 'supervisor' ? accessKey : undefined
      });
      if (user.role === 'user' || user.role === 'citizen') navigate('/user-dashboard');
      else if (user.role === 'supervisor') navigate('/supervisor');
      else if (user.role === 'officer') navigate('/officer');
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
        <h1 className="login-title">SMARTCITY OS</h1>
        <p className="login-subtitle">SECURE ACCESS PORTAL</p>
        <div className="auth-switch">
          <button type="button" className={mode === 'user' ? 'active' : ''} onClick={() => setMode('user')}>
            NORMAL USER
          </button>
          <button type="button" className={mode === 'supervisor' ? 'active' : ''} onClick={() => setMode('supervisor')}>
            SUPERVISOR
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label>{mode === 'user' ? 'USER EMAIL' : 'SUPERVISOR EMAIL'}</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required
              placeholder="Enter ID"
            />
          </div>

          {mode === 'user' ? (
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
          ) : (
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
          )}

          <button type="submit" disabled={isSubmitting} className="login-btn">
            {isSubmitting ? 'AUTHENTICATING...' : 'INITIALIZE UPLINK'}
          </button>
        </form>

        <div className="login-footer-link">
          <button type="button" onClick={() => navigate('/signup')}>
            New user? Create account
          </button>
        </div>
      </div>
    </div>
  );
}
