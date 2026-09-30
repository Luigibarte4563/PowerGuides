import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import AppRoutes from '@/routes';

/** Reset scroll on navigation (except when an in-page anchor is used). */
function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.querySelector(hash);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname, hash]);

  return null;
}

export default function App() {
  return (
    <>
      <ScrollManager />
      <AppRoutes />
    </>
  );
}
