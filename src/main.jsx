import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import 'leaflet/dist/leaflet.css';
import './index.css';

import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ReferenceProvider } from './context/ReferenceContext';
import { ToastProvider } from './context/ToastContext';
import SessionExpiryGuard from './components/SessionExpiryGuard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <ToastProvider>
          <AuthProvider>
            <ReferenceProvider>
              <SessionExpiryGuard />
              <App />
            </ReferenceProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
