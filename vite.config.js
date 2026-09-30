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
    // PINNED, and strictPort so Vite refuses to start rather than silently moving.
    //
    // This is not cosmetic: the Google OAuth return trip is hardcoded on the server
    // side (`FRONTEND_URL=http://localhost:5174` in CrowdsourcedAPI/.env, read by
    // google_callback.php). With strictPort:false, Vite would fall back to 5175+ if
    // 5174 was busy, and Google would sign the user in and then redirect them to an
    // origin that is not the app they started from - the round trip just dies.
    //
    // The PHP API only allows 5173/5174 (config/cors.php); the proxy below also keeps
    // API calls same-origin, so CORS is not involved either way.
    port: 5174,
    strictPort: true,
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
