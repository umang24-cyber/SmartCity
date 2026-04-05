import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function Signup() {
  const navigate = useNavigate();
  const { signup, loading } = useAuth();
  
  // States
  const [role, setRole] = useState('user'); // 'user', 'supervisor', or 'officer'
  const [method, setMethod] = useState('password');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validation for Supervisor
    if (role === 'supervisor') {
      if (!email.endsWith('@smartcity.gov') && !email.endsWith('.gov')) {
        setError('Supervisor accounts require a @smartcity.gov email address.');
        return;
      }
      if (!accessKey) {
        setError('Supervisors must provide an Access Key.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await signup({ 
        method, 
        role,
        name, 
        email, 
        password: method === 'password' ? password : undefined,
        accessKey: role === 'supervisor' ? accessKey : undefined
      });
      
      // Redirect based on role
      if (role === 'supervisor') {
        navigate('/supervisor');
      } else if (role === 'officer') {
        navigate('/officer');
      } else {
        navigate('/user-dashboard');
      }
    } catch (err) {
      setError(err.message || 'Signup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">CREATE ACCOUNT</h1>
        <p className="login-subtitle">SECURE ACCESS TO SMARTCITY INFRASTRUCTURE</p>

        <div className="auth-switch mb-4">
          <button type="button" className={role === 'user' ? 'active' : ''} onClick={() => { setRole('user'); setMethod('password'); }}>
            CITIZEN SIGNUP
          </button>
          <button type="button" className={role === 'supervisor' ? 'active' : ''} onClick={() => { setRole('supervisor'); setMethod('password'); }}>
             OPERATOR/SUPERVISOR
          </button>
          <button type="button" className={role === 'officer' ? 'active' : ''} onClick={() => { setRole('officer'); setMethod('password'); }}>
             OFFICER/POLICE
          </button>
        </div>

        {role === 'user' && (
          <div className="auth-switch mb-4">
            <button type="button" className={method === 'password' ? 'active' : ''} onClick={() => setMethod('password')}>
              EMAIL + PASSWORD
            </button>
            <button type="button" className={method === 'google' ? 'active' : ''} onClick={() => setMethod('google')}>
              GOOGLE SIGNUP
            </button>
          </div>
        )}

        {error && <div className="login-error mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label>FULL NAME</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Legal Name" />
          </div>

          <div className="input-group">
            <label>IDENTIFIER (EMAIL)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={role === 'supervisor' || role === 'officer' ? "user@smartcity.gov" : "Enter Email"} />
            {(role === 'supervisor' || role === 'officer') && <p className="text-[10px] text-gray-500 mt-1">Must be an official government domain.</p>}
          </div>

          {method === 'password' && (
            <div className="input-group">
              <label>SECURE PASSWORD</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Enter Password" />
            </div>
          )}

          {role === 'supervisor' && (
            <div className="input-group">
              <label>SUPERVISOR ACCESS KEY</label>
              <input type="password" value={accessKey} onChange={(e) => setAccessKey(e.target.value)} required placeholder="Unique Authorization Key" />
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className="login-btn">
            {isSubmitting ? 'CREATING SECURE ACCOUNT...' : 'INITIATE REGISTRATION'}
          </button>
        </form>

        <div className="login-footer-link">
          <button type="button" onClick={() => navigate('/login')}>
            Already have an account? Login
          </button>
        </div>
      </div>
    </div>
  );
}
