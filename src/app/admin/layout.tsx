'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<any>(null);
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
        if (!response.ok) throw new Error('Failed to fetch admin');
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
    { label: 'Dashboard', href: '/admin', icon: '📊' },
    { label: 'Usuarios', href: '/admin/users', icon: '👥' },
    { label: 'Suscripciones', href: '/admin/subscriptions', icon: '💳' },
    { label: 'Campañas', href: '/admin/campaigns', icon: '🎯' },
    { label: 'Analíticas', href: '/admin/analytics', icon: '📈' },
    { label: 'Pagos', href: '/admin/payments', icon: '💰' },
    { label: 'Configuración', href: '/admin/settings', icon: '⚙️' },
    { label: 'Analytics', href: '/admin/analytics', icon: '📈' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">Cargando panel de administrador...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`w-64 bg-white border-r border-gray-200 fixed lg:relative h-screen overflow-y-auto transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} z-40`}>
        <div className="p-6 border-b border-gray-200">
          <Link href="/admin" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg"></div>
            <span className="font-bold text-xl text-gray-900">Nexora Admin</span>
          </Link>
          <p className="text-xs text-gray-500 mt-1">Panel de Administración</p>
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                pathname === item.href
                  ? 'bg-primary text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
          <div className="mb-4 pb-4 border-b border-gray-200">
            <p className="text-sm text-gray-600">{admin?.email}</p>
            <p className="text-xs text-gray-400 mt-1">Administrador</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center lg:hidden">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex flex-col space-y-1"
          >
            <span className="block w-6 h-0.5 bg-gray-900"></span>
            <span className="block w-6 h-0.5 bg-gray-900"></span>
            <span className="block w-6 h-0.5 bg-gray-900"></span>
          </button>
          <span className="font-bold text-lg">Nexora Admin</span>
          <div className="w-6"></div>
        </div>

        {/* Content */}
        <main className="flex-1 px-6 py-8 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-30"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
}
