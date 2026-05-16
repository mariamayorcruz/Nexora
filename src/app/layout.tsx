import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import PWARegister from '@/components/PWARegister';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  applicationName: 'Nexora Studio',
  title: 'GotNexora. Stop losing customers. Start closing them.',
  description:
    'GotNexora gives your business the AI system to attract, follow up and close more customers. No agencies. No chaos.',
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
    title: 'GotNexora. Stop losing customers. Start closing them.',
    description:
      'GotNexora gives your business the AI system to attract, follow up and close more customers. No agencies. No chaos.',
    siteName: 'GotNexora',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GotNexora. Stop losing customers. Start closing them.',
    description:
      'GotNexora gives your business the AI system to attract, follow up and close more customers. No agencies. No chaos.',
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
