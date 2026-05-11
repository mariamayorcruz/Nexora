'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CalendarDays,
  CreditCard,
  Headphones,
  Home,
  MessageSquareText,
  PanelsTopLeft,
  Settings2,
  Sparkles,
  SquareChartGantt,
  Workflow,
} from 'lucide-react';
import DashboardChatbot from '@/components/DashboardChatbot';
import { useAppLanguage } from '@/hooks/use-app-language';

type DashboardUser = {
  id?: string;
  email: string;
  name?: string | null;
  onboardingCompletedAt?: string | null;
  onboardingData?: Record<string, unknown> | null;
  isAdmin?: boolean;
  founderAccess?: boolean;
  founderPlan?: string | null;
  entitlements?: {
    marketingLabel?: string;
    capabilities?: {
      canUseAdvancedAnalytics?: boolean;
    } | null;
  } | null;
  subscription?: {
    plan?: string | null;
    status?: string | null;
  } | null;
};

type MenuItem = {
  href: string;
  labelEs: string;
  labelEn: string;
  icon: React.ElementType;
  badge?: number;
  badgeTone?: 'cyan' | 'red';
};

const PATH_META: Record<string, { es: string; en: string }> = {
  dashboard: { es: 'Inicio', en: 'Home' },
  crm: { es: 'CRM & Leads', en: 'CRM & Leads' },
  conversaciones: { es: 'Conversaciones', en: 'Conversations' },
  studio: { es: 'Studio IA', en: 'AI Studio' },
  calendario: { es: 'Calendario', en: 'Calendar' },
  reportes: { es: 'Reportes', en: 'Reports' },
  billing: { es: 'Facturación', en: 'Billing' },
  integraciones: { es: 'Integraciones', en: 'Integrations' },
  settings: { es: 'Ajustes', en: 'Settings' },
  support: { es: 'Soporte', en: 'Support' },
  admin: { es: 'Admin', en: 'Admin' },
};

function getInitials(value?: string | null) {
  return (value || 'NX')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatPlanLabel(user: DashboardUser | null) {
  if (!user) return 'Scale';
  return user?.entitlements?.marketingLabel || user?.founderPlan || user?.subscription?.plan || 'Scale';
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage } = useAppLanguage();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [crmCount, setCrmCount] = useState(0);
  const [conversationCount, setConversationCount] = useState(0);
  const hasRedirected = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }

    const fetchData = async () => {
      try {
        const meUrl =
          pathname === '/dashboard/billing'
            ? '/api/users/me?allowIncomplete=1'
            : '/api/users/me';

        const response = await fetch(meUrl, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          if (response.status === 403 && payload?.code === 'SUBSCRIPTION_REQUIRED') {
            if (!hasRedirected.current) {
              hasRedirected.current = true;
              router.push('/#pricing');
            }
            return;
          }
          throw new Error('Failed to fetch user');
        }

        const data = await response.json();
        const nextUser = data.user as DashboardUser;
        const subscriptionStatus = nextUser?.subscription?.status?.toLowerCase?.() || null;

        if (subscriptionStatus === 'active' && nextUser?.onboardingCompletedAt == null) {
          if (!hasRedirected.current) {
            hasRedirected.current = true;
            router.push('/onboarding');
          }
          return;
        }

        setUser(nextUser);
        setCrmCount(Number(data?.overviewFunnel?.crmLeads || 0));

        try {
          const leadsResponse = await fetch('/api/crm/leads', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          });
          const leadsData = await leadsResponse.json().catch(() => ({ leads: [] }));
          const leads = Array.isArray(leadsData?.leads) ? leadsData.leads : [];
          const activeConversations = leads.filter(
            (lead: Record<string, unknown>) =>
              String(lead.stage || '') !== 'won' && Boolean(lead.phone || lead.email)
          ).length;
          setConversationCount(activeConversations);
        } catch {
          setConversationCount(0);
        }
      } catch (error) {
        console.error('Error fetching dashboard shell:', error);
        localStorage.removeItem('token');
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [pathname, router]);

  const menu = useMemo<MenuItem[]>(() => {
    return [
      { href: '/dashboard', labelEs: 'Inicio', labelEn: 'Home', icon: Home },
      {
        href: '/dashboard/crm',
        labelEs: 'CRM & Leads',
        labelEn: 'CRM & Leads',
        icon: Workflow,
        badge: crmCount,
        badgeTone: 'cyan',
      },
      {
        href: '/dashboard/conversaciones',
        labelEs: 'Conversaciones',
        labelEn: 'Conversations',
        icon: MessageSquareText,
        badge: conversationCount,
        badgeTone: 'red',
      },
      { href: '/dashboard/studio', labelEs: 'Studio IA', labelEn: 'AI Studio', icon: Sparkles },
      { href: '/dashboard/calendario', labelEs: 'Calendario', labelEn: 'Calendar', icon: CalendarDays },
      { href: '/dashboard/reportes', labelEs: 'Reportes', labelEn: 'Reports', icon: SquareChartGantt },
      { href: '/dashboard/billing', labelEs: 'Facturación', labelEn: 'Billing', icon: CreditCard },
      { href: '/dashboard/integraciones', labelEs: 'Integraciones', labelEn: 'Integrations', icon: PanelsTopLeft },
      { href: '/dashboard/settings', labelEs: 'Ajustes', labelEn: 'Settings', icon: Settings2 },
      { href: '/dashboard/support', labelEs: 'Soporte', labelEn: 'Support', icon: Headphones },
    ];
  }, [conversationCount, crmCount]);

  const breadcrumbs = useMemo(() => {
    const pieces = pathname.split('/').filter(Boolean).slice(1);
    const root = [{ href: '/dashboard', label: language === 'en' ? 'Dashboard' : 'Dashboard' }];
    let current = '/dashboard';

    const rest = pieces.map((piece) => {
      current += `/${piece}`;
      const meta = PATH_META[piece];
      return {
        href: current,
        label: language === 'en' ? meta?.en || piece : meta?.es || piece,
      };
    });

    return root.concat(rest);
  }, [language, pathname]);

  const topbarActions = useMemo(() => {
    if (pathname.startsWith('/dashboard/crm')) {
      return [
        { href: '/dashboard/conversaciones', label: language === 'en' ? 'Open inbox' : 'Abrir inbox' },
        { href: '/dashboard/calendario', label: language === 'en' ? 'Schedule' : 'Agendar' },
      ];
    }
    if (pathname.startsWith('/dashboard/studio')) {
      return [{ href: '/dashboard/reportes', label: language === 'en' ? 'View reports' : 'Ver reportes' }];
    }
    if (pathname.startsWith('/dashboard/conversaciones')) {
      return [
        { href: '/dashboard/crm', label: language === 'en' ? 'View lead' : 'Ver lead' },
        { href: '/dashboard/calendario', label: language === 'en' ? 'Book slot' : 'Agendar cita' },
      ];
    }
    return [
      { href: '/dashboard/studio', label: language === 'en' ? 'Generate campaign' : 'Generar campaña' },
      { href: '/dashboard/crm', label: language === 'en' ? 'Review pipeline' : 'Revisar pipeline' },
    ];
  }, [language, pathname]);

  const isActive = (href: string) => (href === '/dashboard' ? pathname === href : pathname.startsWith(href));

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05080f]">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-b-cyan-400" />
          <p className="mt-4 text-sm text-slate-500">{language === 'en' ? 'Loading dashboard...' : 'Cargando dashboard...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#05080f] text-slate-100">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[196px] flex-col overflow-visible bg-[#040810] transition-transform duration-150 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-4 pb-4 pt-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-base font-semibold text-white">
              NX
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold tracking-[-0.03em] text-white">Nexora</p>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </div>
              <span className="mt-2 inline-flex rounded-full bg-cyan-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-300">
                ✦ Plan {formatPlanLabel(user)}
              </span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 pb-4">
          <div className="space-y-1">
            {menu.slice(0, 5).map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-150 ${
                    active ? 'bg-[rgba(6,182,212,0.07)] text-white' : 'text-slate-500 hover:bg-white/[0.03] hover:text-white'
                  }`}
                >
                  {active ? <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full bg-cyan-400" /> : null}
                  <Icon className={`h-4 w-4 ${active ? 'text-cyan-300' : 'text-slate-600'}`} />
                  <span className="min-w-0 flex-1 text-[11px]">{language === 'en' ? item.labelEn : item.labelEs}</span>
                  {item.badge ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        item.badgeTone === 'red' ? 'bg-rose-500/15 text-rose-300' : 'bg-cyan-500/12 text-cyan-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>

          <div className="my-4 h-px bg-white/[0.05]" />

          <div className="space-y-1">
            {menu.slice(5).map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-150 ${
                    active ? 'bg-[rgba(6,182,212,0.07)] text-white' : 'text-slate-500 hover:bg-white/[0.03] hover:text-white'
                  }`}
                >
                  {active ? <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full bg-cyan-400" /> : null}
                  <Icon className={`h-4 w-4 ${active ? 'text-cyan-300' : 'text-slate-600'}`} />
                  <span className="text-[11px]">{language === 'en' ? item.labelEn : item.labelEs}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-white/[0.05] px-3 py-4">
          <div className="mb-3 flex items-center gap-1 rounded-full bg-[#030610] p-1">
            {(['es', 'en'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setLanguage(option)}
                className={`flex-1 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition-all duration-150 ${
                  language === option ? 'bg-white/[0.05] text-cyan-300' : 'text-slate-500 hover:text-white'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="rounded-[20px] bg-[#030610] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10 text-xs font-semibold text-cyan-300">
                {getInitials(user?.name || user?.email)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-white">{user?.name || user?.email}</p>
                <p className="truncate text-[11px] text-slate-500">✦ Plan {formatPlanLabel(user)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 w-full rounded-2xl bg-white/[0.03] px-3 py-2 text-left text-xs text-slate-400 transition-all duration-150 hover:bg-white/[0.05] hover:text-white"
            >
              {language === 'en' ? 'Log out' : 'Cerrar sesión'}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col overflow-x-hidden lg:pl-[196px]">
        <header className="sticky top-0 z-30 flex min-h-[52px] items-center justify-between border-b border-white/[0.05] bg-[#05080f]/95 px-4 py-2 backdrop-blur lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((current) => !current)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.03] text-slate-300 transition-all duration-150 hover:bg-white/[0.05] lg:hidden"
            >
              <PanelsTopLeft className="h-4 w-4" />
            </button>
            <div className="flex min-w-0 items-center gap-2 text-sm text-slate-500">
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.href} className="flex items-center gap-2">
                  {index > 0 ? <span className="text-slate-700">/</span> : null}
                  <span className={index === breadcrumbs.length - 1 ? 'truncate text-white' : 'truncate'}>{crumb.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {topbarActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="hidden rounded-full bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 transition-all duration-150 hover:bg-white/[0.05] hover:text-white md:inline-flex"
              >
                {action.label}
              </Link>
            ))}
            {user?.isAdmin || user?.founderAccess ? (
              <Link
                href="/admin"
                className="rounded-full bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300 transition-all duration-150 hover:bg-rose-500/15"
              >
                ADMIN
              </Link>
            ) : null}
          </div>
        </header>

        <main className="flex-1 px-4 py-4 sm:px-5 lg:px-6 lg:py-5">{children}</main>
      </div>

      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Cerrar sidebar"
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <DashboardChatbot />
    </div>
  );
}
