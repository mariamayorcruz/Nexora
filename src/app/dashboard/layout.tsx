'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface DashboardUser {
  email: string;
  isAdmin?: boolean;
  founderAccess?: boolean;
  founderPlan?: string | null;
  entitlements?: {
    marketingLabel?: string;
    capabilities?: {
      canUseRadar?: boolean;
      canUseAdvancedAnalytics?: boolean;
    } | null;
  } | null;
  subscription?: {
    plan?: string | null;
  } | null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }

    const fetchUser = async () => {
      try {
        const response = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }

        const data = await response.json();
        setUser(data.user);
      } catch (error) {
        console.error('Error fetching user:', error);
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  const menuItems = [
    { label: 'Dashboard', href: '/dashboard', icon: 'DA' },
    { label: 'Conectar redes', href: '/dashboard/connect', icon: 'CR' },
    { label: 'Campañas', href: '/dashboard/campaigns', icon: 'CA' },
    { label: 'Soporte', href: '/dashboard/support', icon: 'SP' },
    { label: 'Facturación', href: '/dashboard/billing', icon: 'FA' },
    { label: 'Configuración', href: '/dashboard/settings', icon: 'CO' },
  ];

  if (user?.entitlements?.capabilities?.canUseRadar) {
    menuItems.splice(1, 0, { label: 'Radar creativo', href: '/dashboard/radar', icon: 'RC' });
  }

  if (user?.entitlements?.capabilities?.canUseAdvancedAnalytics) {
    menuItems.splice(user?.entitlements?.capabilities?.canUseRadar ? 4 : 3, 0, {
      label: 'Analítica',
      href: '/dashboard/analytics',
      icon: 'AN',
    });
  }

  if (user?.isAdmin) {
    menuItems.push({ label: 'Panel admin', href: '/admin', icon: 'AD' });
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-b-primary" />
          <p className="mt-4 text-gray-600">Cargando...</p>
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
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-primary text-sm font-semibold text-white">
              NX
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">Nexora</p>
              <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Growth OS</p>
            </div>
          </Link>
        </div>

        <nav className="space-y-2 p-4">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
                pathname === item.href ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-semibold ${
                  pathname === item.href ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
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
            <p className="text-sm font-medium text-gray-900">{user?.email}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.24em] text-gray-400">
              {user?.founderAccess
                ? 'Plan fundador'
                : `Plan ${user?.entitlements?.marketingLabel || user?.founderPlan || user?.subscription?.plan || 'starter'}`}
            </p>
            {user?.isAdmin && (
              <p className="mt-3 text-xs font-semibold text-primary">Acceso total al centro de control</p>
            )}
            {user?.founderAccess && (
              <p className="mt-2 text-xs font-semibold text-emerald-600">
                Cuenta fundadora con prioridad creativa y ventajas exclusivas activas
              </p>
            )}
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
          <span className="text-lg font-bold text-gray-900">Nexora</span>
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
