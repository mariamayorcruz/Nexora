'use client';

import Link from 'next/link';
import { CreditCard, LogOut, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type AdminProfilePayload = {
  admin?: {
    id?: string;
    email?: string;
    name?: string | null;
    role?: string;
    accessPlan?: string;
    founderAccess?: boolean;
    sessionStatus?: string;
    createdAt?: string;
  };
};

function formatDate(value?: string) {
  if (!value) return 'No disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No disponible';
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function AdminProfilePage() {
  const router = useRouter();
  const [payload, setPayload] = useState<AdminProfilePayload>({});

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    void fetch('/api/admin/me', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((data) => setPayload(data))
      .catch(() => setPayload({}));
  }, []);

  const admin = payload.admin;

  const quickActions = useMemo(
    () => [
      { href: '/dashboard', label: 'Volver al dashboard', icon: ShieldCheck },
      { href: '/admin/clientes', label: 'Ver clientes', icon: Users },
      { href: '/admin/subscriptions', label: 'Ver billing/admin subscriptions', icon: CreditCard },
      { href: '/admin/studio', label: 'Ver uso de IA', icon: Sparkles },
    ],
    []
  );

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-rose-400/20 bg-rose-500/10 px-5 py-3 text-sm font-medium text-rose-200">
        ADMIN · Perfil interno
      </section>

      <section className="rounded-[28px] border border-white/6 bg-slate-900 p-5">
        <div className="flex flex-wrap gap-2">
          {[
            { href: '/admin', label: 'Overview' },
            { href: '/admin/clientes', label: 'Clientes' },
            { href: '/admin/payments', label: 'Revenue' },
            { href: '/admin/studio', label: 'Uso IA' },
            { href: '/admin/users', label: 'Usuarios' },
            { href: '/admin/perfil', label: 'Perfil Admin' },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full px-3 py-1.5 text-xs transition-all duration-150 ${
                tab.href === '/admin/perfil' ? 'bg-cyan-500/10 text-cyan-300' : 'bg-white/[0.03] text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-white/6 bg-slate-900 p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Perfil Admin</p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.03em] text-white">
            {admin?.name || 'Admin principal'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Panel interno de operación y control de acceso.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Nombre', value: admin?.name || 'No disponible' },
              { label: 'Email', value: admin?.email || 'No disponible' },
              { label: 'Rol', value: admin?.role === 'founder' ? 'Founder' : admin?.role === 'admin' ? 'Admin' : 'No disponible' },
              { label: 'Plan / acceso', value: admin?.founderAccess ? `Founder · ${admin?.accessPlan || 'enterprise'}` : admin?.accessPlan || 'Admin access' },
              { label: 'Estado de sesión', value: admin?.sessionStatus === 'active' ? 'Activa' : admin?.sessionStatus || 'No disponible' },
              { label: 'Fecha de creación', value: formatDate(admin?.createdAt) },
            ].map((item) => (
              <div key={item.label} className="rounded-[20px] bg-[#080e1a] p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                <p className="mt-2 break-words text-sm text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[28px] border border-white/6 bg-slate-900 p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Accesos rápidos</p>
            <div className="mt-4 grid gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center gap-3 rounded-[20px] bg-[#080e1a] px-4 py-4 text-sm text-white transition-all duration-150 hover:-translate-y-[1px] hover:bg-white/[0.04]"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                      <Icon className="h-4 w-4" />
                    </span>
                    {action.label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-3 rounded-[20px] bg-white/[0.03] px-4 py-4 text-left text-sm text-slate-200 transition-all duration-150 hover:-translate-y-[1px] hover:bg-white/[0.05]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04] text-slate-300">
                  <LogOut className="h-4 w-4" />
                </span>
                Cerrar sesión
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/6 bg-slate-900 p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Estado del acceso</p>
            <div className="mt-4 rounded-[20px] bg-[#080e1a] p-4">
              <p className="text-sm text-white">
                {admin?.founderAccess
                  ? 'Acceso founder activo con visibilidad total del panel interno.'
                  : 'Acceso admin activo con permisos internos habilitados.'}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Esta vista no modifica auth core, Stripe, webhooks ni billing de clientes.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
