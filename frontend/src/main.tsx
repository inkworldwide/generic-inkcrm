import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/authStore';

// Create React Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

// Bootstrapper: Load White-Label settings before mounting App
const bootstrap = async () => {
  const host = window.location.host;
  const parts = host.split('.');
  
  let subdomain = '';
  // Check if we are running on a subdomain, e.g. sales.localhost:5173
  if (parts.length > 1 && parts[0] !== 'www' && parts[0] !== 'localhost') {
    subdomain = parts[0].toLowerCase();
  }

  // Load from local storage fallback if no subdomain
  const cachedSubdomain = localStorage.getItem('tenantSubdomain') || 'sales';
  
  // Fetch theme specifications
  await useThemeStore.getState().fetchBranding(subdomain || cachedSubdomain);
  
  // Initialize Auth user session
  useAuthStore.getState().initialize();
};

bootstrap().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>
  );
});
