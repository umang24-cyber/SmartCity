import React, { useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import LoadingScreen from './components/LoadingScreen';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import ThemeTransition from './components/ThemeTransition';
import CustomCursor from './components/CustomCursor';
import { useSubmarineAudio } from './hooks/useSubmarineAudio';

import Login from './pages/Login';
import Signup from './pages/Signup';
import CitizenDashboard from './pages/CitizenDashboard';
import SupervisorDashboard from './pages/SupervisorDashboard';
import OfficerDashboard from './pages/OfficerDashboard';
import ProtectedRoute from './components/ProtectedRoute';

function SubmarineSystems() {
  useSubmarineAudio();
  return <CustomCursor />;
}

function MainApp() {
  const [isLoading, setIsLoading] = useState(true);
  const handleComplete = useCallback(() => setIsLoading(false), []);

  return (
    <>
      <SubmarineSystems />
      <ThemeTransition />
      {isLoading && <LoadingScreen onComplete={handleComplete} />}
      {!isLoading && (
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          {/* Public Dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Protected Role-Based Routes */}
          <Route element={<ProtectedRoute allowedRoles={['user', 'citizen']} />}>
            <Route path="/user-dashboard" element={<CitizenDashboard />} />
            <Route path="/citizen" element={<CitizenDashboard />} />
          </Route>
          
          <Route element={<ProtectedRoute allowedRoles={['supervisor']} />}>
            <Route path="/supervisor" element={<SupervisorDashboard />} />
          </Route>
          
          <Route element={<ProtectedRoute allowedRoles={['officer']} />}>
            <Route path="/officer" element={<OfficerDashboard />} />
          </Route>
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      )}
    </>
  );
}

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
