/**
 * src/main_portal.jsx
 * ───────────────────
 * NEW alternative Vite entry point — renders AppWithPortal instead of App.
 * DOES NOT modify main.jsx or App.jsx at all.
 *
 * To use:
 *   1. In index.html, change:  <script ... src="/src/main.jsx">
 *                         to:  <script ... src="/src/main_portal.jsx">
 *   2. npm run dev  →  opens with RoleSelect → User / Admin portal
 *
 * To revert:  change back to /src/main.jsx — original app restored instantly.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AppWithPortal from './AppWithPortal.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppWithPortal />
  </StrictMode>,
);
