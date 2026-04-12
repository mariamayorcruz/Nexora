'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Command, Settings, Users, Wand2, Zap } from 'lucide-react';

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
    { label: 'Operación', href: '/admin/operacion', icon: Command, badge: 'live' },
    { label: 'Clientes & Ingresos', href: '/admin/clientes', icon: Users },
    { label: 'Automation & Funnel', href: '/admin/automation', icon: Zap },
    { label: 'Nexora Studio', href: '/admin/studio', icon: Wand2 },
    { label: 'Configuración', href: '/admin/settings', icon: Settings },
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
    <div className="flex min-h-screen bg-slate-950 text-slate-200">
      <aside
        className={`fixed z-40 h-screen w-72 overflow-y-auto border-r border-slate-800 bg-slate-950 transition-transform lg:relative ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="border-b border-slate-800 p-6">
          <Link href="/admin/operacion" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-sm font-semibold text-slate-950">
              AD
            </div>
            <div>
              <p className="text-lg font-bold text-white">Nexora Admin</p>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Mission Control</p>
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="mt-5 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-300 transition hover:border-slate-700 hover:bg-slate-900/80"
          >
            <span>Ir al panel principal</span>
            <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-400">NX</span>
          </Link>
        </div>

        <nav className="space-y-2 p-4">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition ${
                pathname === item.href ? 'bg-slate-900 text-white shadow-lg shadow-black/20' : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                  pathname === item.href ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-500'
                } ${item.badge ? '' : 'hidden'}`}
              >
                {item.badge}
              </span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm font-medium text-white">{admin?.name || 'Admin principal'}</p>
            <p className="mt-1 text-sm text-slate-500">{admin?.email}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">Acceso total</p>
          </div>

          <button
            onClick={handleLogout}
            className="mt-4 w-full rounded-xl px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-900"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4 lg:hidden">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex flex-col gap-1">
            <span className="block h-0.5 w-6 bg-white" />
            <span className="block h-0.5 w-6 bg-white" />
            <span className="block h-0.5 w-6 bg-white" />
          </button>
          <span className="text-lg font-bold text-white">Nexora Admin</span>
          <div className="w-6" />
        </div>

        <main className="flex-1 overflow-y-auto bg-slate-950 px-6 py-8">{children}</main>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
