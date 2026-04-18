'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BarChart2, LayoutDashboard, LifeBuoy, Megaphone, Receipt, Settings2, ShieldCheck, Users, Wand2, Zap } from 'lucide-react';
import DashboardChatbot from '@/components/DashboardChatbot';
import { useAppLanguage } from '@/hooks/use-app-language';

const SIDEBAR_ICONS: Record<string, React.ElementType> = {
  OV: LayoutDashboard,
  CL: Users,
  AU: Zap,
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

type MenuLinkRow = { kind: 'link'; label: string; href: string; icon: string };
type MenuGroupRow = {
  kind: 'group';
  label: string;
  icon: string;
  children: { label: string; href: string }[];
};
type MenuRow = MenuLinkRow | MenuGroupRow;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage } = useAppLanguage();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [billingCheckoutFocus, setBillingCheckoutFocus] = useState(false);
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    setBillingCheckoutFocus(
      pathname === '/dashboard/billing' &&
        searchParams.get('autostart') === '1' &&
        Boolean(searchParams.get('plan'))
    );
  }, [pathname]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }

    const fetchUser = async () => {
      try {
        const meUrl =
          pathname === '/dashboard/billing'
            ? '/api/users/me?allowIncomplete=1'
            : '/api/users/me';

        const response = await fetch(meUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);

          if (response.status === 403 && payload?.code === 'SUBSCRIPTION_REQUIRED') {
            if (hasRedirected.current) return;
            hasRedirected.current = true;
            router.push('/#pricing');
            return;
          }

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
  }, [pathname]);

  const menuRows: MenuRow[] = [
    { kind: 'link', label: language === 'en' ? 'Overview' : 'Resumen', href: '/dashboard', icon: 'OV' },
    {
      kind: 'group',
      label: language === 'en' ? 'Clients' : 'Clientes',
      icon: 'CL',
      children: [
        { label: language === 'en' ? 'List' : 'Lista', href: '/dashboard/leads' },
        { label: 'CRM', href: '/dashboard/crm' },
        { label: 'Pipeline', href: '/dashboard/pipeline' },
      ],
    },
    {
      kind: 'group',
      label: language === 'en' ? 'Automations' : 'Automatizaciones',
      icon: 'AU',
      children: [
        {
          label: language === 'en' ? 'Sequences & calendar' : 'Secuencias y calendario',
          href: '/dashboard/crm',
        },
      ],
    },
    {
      kind: 'link',
      label: language === 'en' ? 'Campaign Hub' : 'Campañas + Canales',
      href: '/dashboard/connect',
      icon: 'CN',
    },
    { kind: 'link', label: 'Nexora Studio', href: '/dashboard/studio', icon: 'IA' },
    { kind: 'link', label: language === 'en' ? 'Billing' : 'Facturación', href: '/dashboard/billing', icon: 'FA' },
    { kind: 'link', label: language === 'en' ? 'Support' : 'Soporte', href: '/dashboard/support', icon: 'SP' },
    { kind: 'link', label: language === 'en' ? 'Settings' : 'Configuración', href: '/dashboard/settings', icon: 'CO' },
  ];

  if (user?.entitlements?.capabilities?.canUseAdvancedAnalytics) {
    menuRows.splice(4, 0, {
      kind: 'link',
      label: language === 'en' ? 'Analytics' : 'Analítica',
      href: '/dashboard/analytics',
      icon: 'AN',
    });
  }

  const isChildActive = (href: string) => {
    if (href === '/dashboard/connect') {
      return pathname === '/dashboard/connect' || pathname.startsWith('/dashboard/campaigns');
    }
    if (href === '/dashboard/leads') {
      return pathname === '/dashboard/leads' || pathname.startsWith('/dashboard/leads/');
    }
    if (href === '/dashboard/crm') {
      return pathname === '/dashboard/crm' || pathname.startsWith('/dashboard/crm/');
    }
    if (href === '/dashboard/pipeline') {
      return pathname === '/dashboard/pipeline' || pathname.startsWith('/dashboard/pipeline/');
    }
    return pathname === href;
  };

  const canAccessAdminPanel = Boolean(user?.isAdmin || user?.founderAccess);
  if (canAccessAdminPanel) {
    menuRows.push({
      kind: 'link',
      label: language === 'en' ? 'Admin panel' : 'Panel admin',
      href: '/admin',
      icon: 'AD',
    });
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
      {!billingCheckoutFocus && (
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
          {menuRows.map((row) => {
            if (row.kind === 'link') {
              const active = isChildActive(row.href);
              const IconComponent = SIDEBAR_ICONS[row.icon] ?? LayoutDashboard;
              return (
                <Link
                  key={row.href}
                  href={row.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                    active ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-900/60 hover:text-white'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-500'}`}
                  >
                    <IconComponent size={16} />
                  </span>
                  <span className="text-sm font-medium">{row.label}</span>
                </Link>
              );
            }

            const IconComponent = SIDEBAR_ICONS[row.icon] ?? LayoutDashboard;
            const groupActive = row.children.some((c) => isChildActive(c.href));
            return (
              <div key={row.label} className="space-y-1">
                <div
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 ${groupActive ? 'text-white' : 'text-slate-500'}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${groupActive ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-600'}`}
                  >
                    <IconComponent size={16} />
                  </span>
                  <span className="text-sm font-semibold">{row.label}</span>
                </div>
                <div className="space-y-0.5 border-l border-slate-800 pl-2 ml-4">
                  {row.children.map((child) => {
                    const active = isChildActive(child.href);
                    return (
                      <Link
                        key={`${row.label}-${child.href}-${child.label}`}
                        href={child.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center rounded-lg px-3 py-2 text-sm transition ${
                          active ? 'bg-slate-900 font-medium text-white' : 'text-slate-400 hover:bg-slate-900/60 hover:text-white'
                        }`}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
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
      )}

      <div className="flex flex-1 flex-col">
        {!billingCheckoutFocus && (
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4 lg:hidden">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex flex-col gap-1">
            <span className="block h-0.5 w-6 bg-white" />
            <span className="block h-0.5 w-6 bg-white" />
            <span className="block h-0.5 w-6 bg-white" />
          </button>
          <span className="text-lg font-bold text-white">Nexora</span>
          <div className="w-6" />
        </div>
        )}

        <main
          className={`flex-1 overflow-y-auto bg-slate-950 text-slate-200 ${
            billingCheckoutFocus ? 'px-4 py-10 sm:px-6' : 'px-6 py-6'
          }`}
        >
          <div className={`mx-auto w-full ${billingCheckoutFocus ? 'max-w-3xl' : 'max-w-[1440px]'}`}>{children}</div>
        </main>
      </div>

      {!billingCheckoutFocus && sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      {!billingCheckoutFocus && <DashboardChatbot />}
    </div>
  );
}
