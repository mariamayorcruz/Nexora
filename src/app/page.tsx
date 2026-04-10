import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import Demo from '@/components/Demo';
import Pricing from '@/components/Pricing';
import FAQ from '@/components/FAQ';
import Footer from '@/components/Footer';
import MasterclassLead from '@/components/MasterclassLead';

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="pt-16">
        <Hero />
        <Features />
        <Demo />
        <MasterclassLead />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
