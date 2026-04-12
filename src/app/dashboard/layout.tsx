'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BarChart2, KanbanSquare, LayoutDashboard, LifeBuoy, Megaphone, Receipt, Settings2, ShieldCheck, Users, Wand2 } from 'lucide-react';
import DashboardChatbot from '@/components/DashboardChatbot';
import { useAppLanguage } from '@/hooks/use-app-language';

const SIDEBAR_ICONS: Record<string, React.ElementType> = {
  OV: LayoutDashboard,
  CR: Users,
  PL: KanbanSquare,
  CN: Megaphone,
  IA: Wand2,
  FA: Receipt,
  SP: LifeBuoy,
  CO: Settings2,
  AN: BarChart2,
  AD: ShieldCheck,
};

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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage } = useAppLanguage();
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

    void fetchUser();
  }, [router]);

  const menuItems = [
    { label: language === 'en' ? 'Overview' : 'Resumen', href: '/dashboard', icon: 'OV' },
    { label: language === 'en' ? 'CRM + Sales Engine' : 'CRM + Motor de Ventas', href: '/dashboard/crm', icon: 'CR' },
    { label: language === 'en' ? 'Pipeline Board' : 'Pipeline visual', href: '/dashboard/pipeline', icon: 'PL' },
    { label: language === 'en' ? 'Campaign Hub' : 'Campañas + Canales', href: '/dashboard/connect', icon: 'CN' },
    { label: 'Nexora Studio', href: '/dashboard/studio', icon: 'IA' },
    { label: language === 'en' ? 'Billing' : 'Facturación', href: '/dashboard/billing', icon: 'FA' },
    { label: language === 'en' ? 'Support' : 'Soporte', href: '/dashboard/support', icon: 'SP' },
    { label: language === 'en' ? 'Settings' : 'Configuración', href: '/dashboard/settings', icon: 'CO' },
  ];

  if (user?.entitlements?.capabilities?.canUseAdvancedAnalytics) {
    menuItems.splice(4, 0, {
      label: language === 'en' ? 'Analytics' : 'Analítica',
      href: '/dashboard/analytics',
      icon: 'AN',
    });
  }

  const isMenuItemActive = (href: string) => {
    if (href === '/dashboard/connect') {
      return pathname === '/dashboard/connect' || pathname.startsWith('/dashboard/campaigns');
    }

    return pathname === href;
  };

  const canAccessAdminPanel = Boolean(user?.isAdmin || user?.founderAccess);
  if (canAccessAdminPanel) {
    menuItems.push({ label: language === 'en' ? 'Admin panel' : 'Panel admin', href: '/admin', icon: 'AD' });
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
    <div className="flex min-h-screen bg-slate-950">
      <aside
        className={`fixed z-40 h-screen w-60 overflow-y-auto border-r border-slate-800 bg-slate-950 transition-transform lg:relative ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="border-b border-slate-800 p-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500 text-sm font-semibold text-slate-950">
              NX
            </div>
            <div>
              <p className="text-lg font-bold text-white">Nexora</p>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                {language === 'en' ? 'Revenue Command' : 'Centro de control'}
              </p>
            </div>
          </Link>
        </div>

        <nav className="space-y-2 p-4">
          <div className="mb-3 flex gap-2 px-1">
            {(['es', 'en'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setLanguage(option)}
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                  language === option ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          {menuItems.map((item) => {
            const active = isMenuItemActive(item.href);
            const IconComponent = SIDEBAR_ICONS[item.icon] ?? LayoutDashboard;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                  active ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-900/60 hover:text-white'
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-500'}`}>
                  <IconComponent size={16} />
                </span>
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="rounded-[20px] border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm font-medium text-white">{user?.email}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
              {user?.founderAccess
                ? language === 'en'
                  ? 'Founder plan'
                  : 'Plan fundador'
                : `${language === 'en' ? 'Plan' : 'Plan'} ${user?.entitlements?.marketingLabel || user?.founderPlan || user?.subscription?.plan || 'starter'}`}
            </p>
          </div>

          <button onClick={handleLogout} className="mt-4 w-full rounded-2xl px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-900">
            {language === 'en' ? 'Log out' : 'Cerrar sesión'}
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
          <span className="text-lg font-bold text-white">Nexora</span>
          <div className="w-6" />
        </div>

        <main className="flex-1 overflow-y-auto bg-slate-950 px-6 py-6 text-slate-200">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <DashboardChatbot />
    </div>
  );
}
