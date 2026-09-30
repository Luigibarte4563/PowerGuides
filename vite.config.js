import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  server: {
    // If 5173 is taken Vite falls back to 5174+. The PHP API only allows the
    // origin `http://localhost:5173` in its CORS headers, so the dev proxy below
    // keeps API calls same-origin and working on whichever port Vite picks.
    port: 5173,
    strictPort: false,
    proxy: {
      '/CrowdsourcedAPI': {
        target: 'http://localhost',
        changeOrigin: false,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the vendor libraries in their own chunks so app updates stay small.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          maps: ['leaflet', 'react-leaflet'],
          charts: ['recharts'],
        },
      },
    },
  },
});
