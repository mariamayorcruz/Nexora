import { LanguageProvider } from '@/context/LanguageContext';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import Demo from '@/components/Demo';
import ComparisonTable from '@/components/ComparisonTable';
import Pricing from '@/components/Pricing';
import CtaFinal from '@/components/CtaFinal';
import FAQ from '@/components/FAQ';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <LanguageProvider>
      <Navbar />
      <main className="pt-16">
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
