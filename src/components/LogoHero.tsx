'use client';

import { useEffect, useState } from 'react';
import LogoAnimated from '@/components/LogoAnimated';

export default function LogoHero() {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFadeOut(true);
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <section
      className={`flex min-h-screen items-center justify-center bg-black transition-opacity duration-1000 ${
        fadeOut ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <LogoAnimated />
    </section>
  );
}
