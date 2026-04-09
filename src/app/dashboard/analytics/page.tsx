'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface AnalyticsCampaign {
  id: string;
  adAccount?: {
    platform: string;
  } | null;
  analytics?: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    revenue?: number;
  } | null;
}

interface AnalyticsUser {
  entitlements?: {
    marketingLabel: string;
    capabilities: {
      canUseAdvancedAnalytics: boolean;
      upgradeCta: string;
    };
  } | null;
}

export default function AnalyticsPage() {
  const [campaigns, setCampaigns] = useState<AnalyticsCampaign[]>([]);
  const [user, setUser] = useState<AnalyticsUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
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
        console.error('Error fetching analytics data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const metrics = useMemo(() => {
    const totals = campaigns.reduce(
      (accumulator, campaign) => {
        accumulator.impressions += campaign.analytics?.impressions || 0;
        accumulator.clicks += campaign.analytics?.clicks || 0;
        accumulator.conversions += campaign.analytics?.conversions || 0;
        accumulator.spend += campaign.analytics?.spend || 0;
        accumulator.revenue += campaign.analytics?.revenue || 0;

        const platform = campaign.adAccount?.platform || 'sin fuente';
        accumulator.platformSpend[platform] =
          (accumulator.platformSpend[platform] || 0) + (campaign.analytics?.spend || 0);
        return accumulator;
      },
      {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        revenue: 0,
        platformSpend: {} as Record<string, number>,
      }
    );

    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const roi = totals.spend > 0 ? ((totals.revenue - totals.spend) / totals.spend) * 100 : 0;

    return {
      ...totals,
      ctr,
      roi,
      platforms: Object.entries(totals.platformSpend).sort((a, b) => b[1] - a[1]),
    };
  }, [campaigns]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-b-primary" />
          <p className="mt-4 text-gray-600">Preparando analítica...</p>
        </div>
      </div>
    );
  }

  if (!user?.entitlements?.capabilities.canUseAdvancedAnalytics) {
    return (
      <div className="space-y-8">
        <section className="rounded-[30px] border border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-xs uppercase tracking-[0.28em] text-gray-400">Analítica avanzada</p>
          <h1 className="mt-3 text-3xl font-semibold text-gray-900">Esta vista se desbloquea desde el plan Growth.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-600">
            Tu plan actual puede ver el resumen del dashboard, pero la lectura consolidada por plataforma y rendimiento profundo vive en el siguiente nivel.
          </p>
          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            {user?.entitlements?.capabilities.upgradeCta}
          </div>
          <Link
            href="/dashboard/billing"
            className="mt-6 inline-flex rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Ver upgrade
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-gray-400">Analítica avanzada</p>
        <h1 className="mt-3 text-3xl font-semibold text-gray-900">Tu rendimiento consolidado en una sola lectura.</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Esta vista usa los datos ya asociados a tus campañas para darte una lectura más seria del negocio dentro de Nexora.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Impresiones</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900">{metrics.impressions.toLocaleString()}</p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Clicks</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900">{metrics.clicks.toLocaleString()}</p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Conversiones</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900">{metrics.conversions.toLocaleString()}</p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">CTR</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900">{metrics.ctr.toFixed(1)}%</p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">ROI</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900">{metrics.roi.toFixed(0)}%</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Inversión y retorno</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Gasto total</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">${metrics.spend.toFixed(0)}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Revenue total</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">${metrics.revenue.toFixed(0)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Distribución por plataforma</h2>
          <div className="mt-6 space-y-4">
            {metrics.platforms.length === 0 ? (
              <div className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
                Aún no hay suficiente gasto asociado a plataformas para mostrar una distribución real.
              </div>
            ) : (
              metrics.platforms.map(([platform, spend]) => (
                <div key={platform} className="flex items-center justify-between rounded-2xl bg-gray-50 px-5 py-4">
                  <span className="text-sm font-semibold capitalize text-gray-900">{platform}</span>
                  <span className="text-sm text-gray-600">${spend.toFixed(0)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
