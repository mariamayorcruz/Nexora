'use client';

import { useEffect, useState } from 'react';
import { LanguageProvider } from '@/context/LanguageContext';
import Navbar from '@/components/Navbar';
import LogoHero from '@/components/LogoHero';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import Demo from '@/components/Demo';
import ComparisonTable from '@/components/ComparisonTable';
import Pricing from '@/components/Pricing';
import CtaFinal from '@/components/CtaFinal';
import FAQ from '@/components/FAQ';
import Footer from '@/components/Footer';

export default function Home() {
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIntroDone(true);
    }, 5500);

    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <LanguageProvider>
      {introDone && <Navbar />}
      {!introDone && <LogoHero />}
      <main className={`pt-16 transition-opacity duration-700 ${introDone ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <Hero />
        <Features />
        <Demo />
        <ComparisonTable />
        <Pricing />
        <CtaFinal />
        <FAQ />
      </main>
      <Footer />
    </LanguageProvider>
  );
}
