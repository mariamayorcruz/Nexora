import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Nexora | Plataforma para operar y vender mejor tus anuncios',
  description:
    'Nexora centraliza campañas, analítica, administración y cobros en una sola experiencia para equipos que necesitan una operación publicitaria más ordenada.',
  metadataBase: new URL(`https://${process.env.NEXT_PUBLIC_DOMAIN || 'gotnexora.com'}`),
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'Nexora | Plataforma para operar y vender mejor tus anuncios',
    description:
      'Centraliza campañas, analítica y administración en una sola experiencia más clara, más rápida y lista para crecer.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexora | Plataforma para operar y vender mejor tus anuncios',
    description:
      'Una landing más fuerte y una base de producto más creíble para vender mejor tu software de anuncios.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
