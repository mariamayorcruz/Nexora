'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface Campaign {
  id: string;
  name: string;
  budget: number;
  status: string;
  startDate: string;
  adAccount?: {
    platform: string;
    accountName: string;
  } | null;
  analytics?: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    revenue?: number;
  } | null;
}

interface CampaignUser {
  entitlements?: {
    marketingLabel: string;
    usage: {
      activeCampaigns: number;
      activeCampaignsLimit: number;
      activeCampaignsRemaining: number;
    };
    capabilities: {
      upgradeCta: string;
      canUseAutomationSuggestions: boolean;
    };
  } | null;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [user, setUser] = useState<CampaignUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await response.json();
        setCampaigns(data.campaigns || []);
        setUser(data.user);
      } catch (error) {
        console.error('Error fetching campaigns:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, []);

  const activeCampaigns = useMemo(
    () => campaigns.filter((campaign) => campaign.status === 'active'),
    [campaigns]
  );
  const campaignUsage = user?.entitlements?.usage;
  const limitReached = !!campaignUsage && campaignUsage.activeCampaigns >= campaignUsage.activeCampaignsLimit;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-b-primary" />
          <p className="mt-4 text-gray-600">Cargando campañas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-gray-400">Capacidad por plan</p>
            <h1 className="mt-3 text-3xl font-semibold text-gray-900">Tus campañas ahora viven con límites reales.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              Cada cliente ve cuántas campañas activas puede sostener con su plan actual, y cuándo conviene subir de nivel.
            </p>
          </div>

          <div className="rounded-[24px] bg-slate-950 px-6 py-5 text-white">
            <p className="text-sm text-slate-300">Campañas activas</p>
            <p className="mt-2 text-4xl font-semibold">
              {campaignUsage?.activeCampaigns || activeCampaigns.length}/{campaignUsage?.activeCampaignsLimit || 3}
            </p>
            <p className="mt-2 text-sm text-slate-300">espacios ocupados</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={limitReached}
          >
            {limitReached ? 'Límite de campañas alcanzado' : '+ Nueva campaña'}
          </button>
          <Link
            href="/dashboard/billing"
            className="rounded-2xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Ver upgrade
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          {limitReached
            ? user?.entitlements?.capabilities.upgradeCta
            : `Te quedan ${campaignUsage?.activeCampaignsRemaining || 0} campañas activas disponibles en ${
                user?.entitlements?.marketingLabel || 'tu plan actual'
              }.`}
        </div>
      </section>

      {campaigns.length === 0 ? (
        <section className="rounded-[28px] border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-3xl font-semibold text-gray-900">Aún no tienes campañas creadas.</p>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-gray-600">
            El siguiente paso es conectar una cuenta real y bajar una primera campaña con una promesa clara y una oferta visible.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/dashboard/connect" className="btn-primary">
              Conectar cuentas
            </Link>
            <Link href="/dashboard/billing" className="btn-secondary">
              Revisar capacidad del plan
            </Link>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          {campaigns.map((campaign) => {
            const roi =
              (campaign.analytics?.spend || 0) > 0 && (campaign.analytics?.revenue || 0) > 0
                ? Math.round(
                    (((campaign.analytics?.revenue || 0) - (campaign.analytics?.spend || 0)) /
                      (campaign.analytics?.spend || 1)) *
                      100
                  )
                : null;

            return (
              <article key={campaign.id} className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{campaign.name}</h2>
                    <p className="mt-2 text-sm text-gray-600">
                      {(campaign.adAccount?.platform || 'plataforma no disponible') +
                        ' · ' +
                        (campaign.adAccount?.accountName || 'sin cuenta asociada')}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                      campaign.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : campaign.status === 'paused'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {campaign.status}
                  </span>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-5">
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Presupuesto</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">${campaign.budget}</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Impresiones</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">{campaign.analytics?.impressions || 0}</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Clicks</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">{campaign.analytics?.clicks || 0}</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Conversiones</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">{campaign.analytics?.conversions || 0}</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">ROI estimado</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">{roi === null ? 'N/D' : `${roi}%`}</p>
                  </div>
                </div>

                {user?.entitlements?.capabilities.canUseAutomationSuggestions ? (
                  <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950">
                    Nexora puede sugerirte automatizaciones y ajustes de campaña según el rendimiento de esta pieza.
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                    El plan Growth desbloquea sugerencias automáticas y lectura accionable para cada campaña.
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
