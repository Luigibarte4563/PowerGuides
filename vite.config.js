import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Loaded without the VITE_ prefix filter so non-client vars (API_PROXY_TARGET)
  // are readable here too - the proxy target is a dev-server concern, never
  // shipped to the browser.
  const env = loadEnv(mode, process.cwd(), '');

  // Shared by the dev and preview servers so a relative VITE_API_BASE_URL works
  // in both, and in neither case does the browser make a cross-origin request.
  const proxy = {
    '/CrowdsourcedAPI': {
      // Point at wherever this machine serves the API. Default is XAMPP on :80.
      target: env.API_PROXY_TARGET || 'http://localhost',
      // Rewrite Host to the target's, so Apache matches its virtual host even
      // when the browser reached the dev server through a LAN IP.
      changeOrigin: true,
      secure: false,
    },
  };

  return {
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
      port: 5174,
      strictPort: true,
      // Same-origin API calls. With VITE_API_BASE_URL=/CrowdsourcedAPI the browser
      // never makes a cross-origin request, so the API's Access-Control-Allow-Origin
      // allow-list (CrowdsourcedAPI/config/cors.php) is not consulted at all. That is
      // what makes this work unchanged on any device: a LAN origin such as
      // http://192.168.1.20:5174 would not be in the API's hardcoded localhost list,
      // but the proxy makes that irrelevant.
      proxy,
    },
    // Same proxy for `npm run preview`, so the built app behaves like the dev one.
    preview: { proxy },
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
  };
});
