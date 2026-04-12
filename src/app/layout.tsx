import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import PWARegister from '@/components/PWARegister';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  applicationName: 'Nexora Studio',
  title: 'Nexora | Plataforma para operar y vender mejor tus anuncios',
  description:
    'Nexora centraliza campañas, analítica, administración y cobros en una sola experiencia para equipos que necesitan una operación publicitaria más ordenada.',
  metadataBase: new URL(`https://${process.env.NEXT_PUBLIC_DOMAIN || 'gotnexora.com'}`),
  manifest: '/manifest.webmanifest',
  icons: {
    icon: ['/favicon.ico', '/icon.svg'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Nexora',
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

export const viewport: Viewport = {
  themeColor: '#06b6d4',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
