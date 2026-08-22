import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// react-router doesn't scroll to #hash targets on navigation; this does.
export default function ScrollToHash() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    // Small delay lets the target page render before we look for the element
    const t = setTimeout(() => {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => clearTimeout(t);
  }, [hash]);

  return null;
}
