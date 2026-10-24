import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { FarmCorralProvider } from './context/FarmCorralContext';
import Dashboard from './pages/dashboard';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <FarmCorralProvider>
        <Dashboard />
      </FarmCorralProvider>
    </AuthProvider>
  </StrictMode>
);
