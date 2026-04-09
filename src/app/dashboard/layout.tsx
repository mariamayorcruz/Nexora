'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
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
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'Conectar redes', href: '/dashboard/connect', icon: '🔗' },
    { label: 'Campañas', href: '/dashboard/campaigns', icon: '🎯' },
    { label: 'Analítica', href: '/dashboard/analytics', icon: '📈' },
    { label: 'Facturación', href: '/dashboard/billing', icon: '💳' },
    { label: 'Configuración', href: '/dashboard/settings', icon: '⚙️' },
  ];

  if (user?.isAdmin) {
    menuItems.push({ label: 'Panel admin', href: '/admin', icon: '🛡️' });
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div
        className={`fixed z-40 h-screen w-64 overflow-y-auto border-r border-gray-200 bg-white transition-transform lg:relative ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="border-b border-gray-200 p-6">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary" />
            <span className="text-xl font-bold text-gray-900">Nexora</span>
          </Link>
        </div>

        <nav className="space-y-2 p-4">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex w-full items-center space-x-3 rounded-lg px-4 py-3 transition ${
                pathname === item.href ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-4">
          <div className="mb-4 border-b border-gray-200 pb-4">
            <p className="text-sm text-gray-600">{user?.email}</p>
            <p className="mt-1 text-xs text-gray-400">Plan: {user?.subscription?.plan}</p>
            {user?.isAdmin && (
              <p className="mt-2 text-xs font-semibold text-primary">Acceso administrador habilitado</p>
            )}
            {user?.founderAccess && (
              <p className="mt-1 text-xs font-semibold text-emerald-600">
                Cuenta fundadora con acceso {user?.founderPlan || user?.subscription?.plan}
              </p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 lg:hidden">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex flex-col space-y-1">
            <span className="block h-0.5 w-6 bg-gray-900" />
            <span className="block h-0.5 w-6 bg-gray-900" />
            <span className="block h-0.5 w-6 bg-gray-900" />
          </button>
          <span className="text-lg font-bold">Nexora</span>
          <div className="w-6" />
        </div>

        <main className="flex-1 overflow-y-auto px-6 py-8">{children}</main>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
