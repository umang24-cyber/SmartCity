import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  loginUser as apiLoginUser,
  loginSupervisor as apiLoginSupervisor,
  loginOfficer as apiLoginOfficer,
  signupUser as apiSignupUser,
  signupSupervisor as apiSignupSupervisor,
  signupOfficer as apiSignupOfficer,
  signupUserWithGoogle as apiSignupUserWithGoogle,
  getMe as apiGetMe
} from '../api/smartcity';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      if (token) {
        try {
          const userData = await apiGetMe(token);
          setUser(userData);
        } catch (err) {
          console.error('Auth initialization failed:', err);
          setToken(null);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    }
    initAuth();
  }, [token]);

  const setSession = (token, userData) => {
    setToken(token);
    setUser(userData);
    localStorage.setItem('token', token);
  };

  const login = async ({ role, email, password, accessKey }) => {
    try {
      let data;
      if (role === 'supervisor') {
        data = await apiLoginSupervisor(email, accessKey);
      } else if (role === 'officer') {
        data = await apiLoginOfficer(email, password);
      } else {
        data = await apiLoginUser(email, password);
      }
      
      const tokenToSet = data.access_token || data.token;
      if (!tokenToSet) throw new Error('No token returned from login');
      
      // Get full user profile before setting session
      const userData = await apiGetMe(tokenToSet);
      setSession(tokenToSet, userData);
      return userData;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signup = async ({ method, role, name, email, password, accessKey }) => {
    try {
      let data;
      if (role === 'supervisor') {
        data = await apiSignupSupervisor(name, email, password, accessKey);
      } else if (role === 'officer') {
        data = await apiSignupOfficer(name, email, password);
      } else {
        data = method === 'google'
          ? await apiSignupUserWithGoogle(name, email)
          : await apiSignupUser(name, email, password);
      }

      const tokenToSet = data.access_token || data.token;
      if (!tokenToSet) throw new Error('No token returned from signup');

      const userData = await apiGetMe(tokenToSet);
      setSession(tokenToSet, userData);
      return userData;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
