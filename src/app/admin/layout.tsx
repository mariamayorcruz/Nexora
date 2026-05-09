'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Command, CreditCard, Settings, ShieldCheck, Users, Wand2 } from 'lucide-react';

interface AdminProfile {
  id?: string;
  email: string;
  name?: string | null;
  role?: string;
  accessPlan?: string;
  founderAccess?: boolean;
  sessionStatus?: string;
  createdAt?: string;
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
    { label: 'Overview', href: '/admin', icon: Command, badge: 'live' },
    { label: 'Clientes', href: '/admin/clientes', icon: Users },
    { label: 'Revenue', href: '/admin/payments', icon: CreditCard },
    { label: 'Uso IA', href: '/admin/studio', icon: Wand2 },
    { label: 'Usuarios', href: '/admin/users', icon: Users },
    { label: 'Perfil Admin', href: '/admin/perfil', icon: ShieldCheck },
    { label: 'Configuración', href: '/admin/settings', icon: Settings },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05080f]">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-b-cyan-400" />
          <p className="mt-4 text-sm text-slate-500">Cargando panel admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#05080f] text-slate-200">
      <aside
        className={`fixed z-40 h-screen w-[220px] overflow-y-auto bg-[#040810] transition-transform lg:relative ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-4 pb-4 pt-5">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-sm font-semibold text-white">
              AD
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold tracking-[-0.03em] text-white">Nexora Admin</p>
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
              </div>
              <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-rose-300">Internal</p>
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="mt-4 flex items-center justify-between rounded-2xl bg-[#030610] px-4 py-3 text-sm font-medium text-slate-300 transition-all duration-150 hover:bg-white/[0.04] hover:text-white"
          >
            <span>Ir al panel principal</span>
            <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] font-semibold text-cyan-300">NX</span>
          </Link>
        </div>

        <nav className="space-y-1 px-3 pb-4">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-150 ${
                pathname === item.href
                  ? 'bg-[rgba(6,182,212,0.07)] text-white'
                  : 'text-slate-500 hover:bg-white/[0.03] hover:text-white'
              }`}
            >
              {pathname === item.href ? <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full bg-cyan-400" /> : null}
              <item.icon className={`h-4 w-4 ${pathname === item.href ? 'text-cyan-300' : 'text-slate-600'}`} />
              <span className="font-medium">{item.label}</span>
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                  pathname === item.href ? 'bg-cyan-500/12 text-cyan-300' : 'bg-white/[0.04] text-slate-500'
                } ${item.badge ? '' : 'hidden'}`}
              >
                {item.badge}
              </span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/[0.05] px-3 py-4">
          <div className="rounded-[20px] bg-[#030610] p-3">
            <p className="text-sm font-medium text-white">{admin?.name || 'Admin principal'}</p>
            <p className="mt-1 text-xs text-slate-500">{admin?.email}</p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
              {admin?.founderAccess ? 'Founder access' : 'Admin access'}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="mt-3 w-full rounded-2xl bg-white/[0.03] px-3 py-2 text-left text-xs text-slate-400 transition-all duration-150 hover:bg-white/[0.05] hover:text-white"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <div className="flex min-h-[52px] items-center justify-between border-b border-white/[0.05] bg-[#05080f] px-4 py-2 lg:hidden">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.03] text-slate-300 transition-all duration-150 hover:bg-white/[0.05]"
          >
            <Command className="h-4 w-4" />
          </button>
          <span className="text-lg font-bold text-white">Nexora Admin</span>
          <div className="w-6" />
        </div>

        <main className="flex-1 overflow-y-auto bg-[#05080f] px-4 py-4 sm:px-5 lg:px-6 lg:py-5">{children}</main>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
