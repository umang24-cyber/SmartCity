/**
 * AppWithPortal.jsx
 * ─────────────────
 * NEW top-level wrapper that adds role-based entry.
 * The ORIGINAL App.jsx is untouched and still fully rendered for the main dashboard.
 * Routing: null → RoleSelect → 'user' | 'admin' → respective portal or original app.
 */

import React, { useState } from 'react';
import App from './App';
import RoleSelect from './components/RoleSelect';
import UserPortal from './components/UserPortal';
import AdminPortal from './components/AdminPortal';

export default function AppWithPortal() {
  // null = show role select, 'user' = user portal, 'admin' = admin portal, 'dashboard' = original app
  const [portal, setPortal] = useState(null);

  function handleRoleSelect(role) {
    setPortal(role); // 'user' | 'admin'
  }

  function handleBack() {
    setPortal(null);
  }

  if (portal === null) {
    return <RoleSelect onSelect={handleRoleSelect} />;
  }

  if (portal === 'user') {
    return <UserPortal onBack={handleBack} />;
  }

  if (portal === 'admin') {
    return <AdminPortal onBack={handleBack} />;
  }

  // Fallback — should not be reached
  return <App />;
}
