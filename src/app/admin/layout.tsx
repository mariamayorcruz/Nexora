'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface AdminProfile {
  email: string;
  name?: string | null;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }

    const fetchAdmin = async () => {
      try {
        const response = await fetch('/api/admin/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch admin');
        }

        const data = await response.json();
        setAdmin(data.admin);
      } catch (error) {
        console.error('Error fetching admin:', error);
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };

    fetchAdmin();
  }, [router]);

  const menuItems = [
    { label: 'Dashboard', href: '/admin', icon: 'DA' },
    { label: 'Volver al panel', href: '/dashboard', icon: 'NX' },
    { label: 'AI Code', href: '/admin/code-assistant', icon: 'AI' },
    { label: 'Funnel', href: '/admin/funnel', icon: 'FU' },
    { label: 'Usuarios', href: '/admin/users', icon: 'US' },
    { label: 'Suscripciones', href: '/admin/subscriptions', icon: 'SU' },
    { label: 'Campañas', href: '/admin/campaigns', icon: 'CA' },
    { label: 'Analíticas', href: '/admin/analytics', icon: 'AN' },
    { label: 'Automatización', href: '/admin/automation', icon: 'AU' },
    { label: 'Soporte', href: '/admin/support', icon: 'SO' },
    { label: 'Emails', href: '/admin/emails', icon: 'EM' },
    { label: 'Pagos', href: '/admin/payments', icon: 'PA' },
    { label: 'Configuración', href: '/admin/settings', icon: 'CO' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-b-primary" />
          <p className="mt-4 text-gray-600">Cargando panel admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside
        className={`fixed z-40 h-screen w-72 overflow-y-auto border-r border-gray-200 bg-white transition-transform lg:relative ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="border-b border-gray-200 p-6">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
              AD
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">Nexora Admin</p>
              <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Control Center</p>
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
          >
            <span>Ir al panel principal</span>
            <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">NX</span>
          </Link>
        </div>

        <nav className="space-y-2 p-4">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
                pathname === item.href ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/10' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-semibold ${
                  pathname === item.href ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {item.icon}
              </span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-gray-200 p-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-900">{admin?.name || 'Admin principal'}</p>
            <p className="mt-1 text-sm text-gray-500">{admin?.email}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary">Acceso total</p>
          </div>

          <button
            onClick={handleLogout}
            className="mt-4 w-full rounded-2xl px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 lg:hidden">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex flex-col gap-1">
            <span className="block h-0.5 w-6 bg-gray-900" />
            <span className="block h-0.5 w-6 bg-gray-900" />
            <span className="block h-0.5 w-6 bg-gray-900" />
          </button>
          <span className="text-lg font-bold text-gray-900">Nexora Admin</span>
          <div className="w-6" />
        </div>

        <main className="flex-1 overflow-y-auto px-6 py-8">{children}</main>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
