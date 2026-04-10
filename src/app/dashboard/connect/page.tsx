'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface AdAccount {
  id: string;
  platform: string;
  accountName: string;
  connected: boolean;
}

interface ConnectionRequest {
  id: string;
  platform: string;
  businessName?: string | null;
  contactEmail?: string | null;
  adAccountLabel?: string | null;
  websiteUrl?: string | null;
  notes?: string | null;
  setupPreference: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface ConnectUser {
  entitlements?: {
    marketingLabel: string;
    usage: {
      adAccounts: number;
      adAccountsLimit: number;
      adAccountsRemaining: number;
    };
    capabilities: {
      upgradeCta: string;
    };
  } | null;
}

const platforms = [
  {
    key: 'instagram',
    name: 'Instagram Ads',
    icon: 'IG',
    description: 'Sincroniza creatividad, audiencias y campañas de Meta con foco visual.',
    color: 'from-fuchsia-500 to-orange-400',
  },
  {
    key: 'facebook',
    name: 'Facebook Ads',
    icon: 'FB',
    description: 'Centraliza campañas de captación y remarketing para venta directa.',
    color: 'from-blue-700 to-cyan-500',
  },
  {
    key: 'google',
    name: 'Google Ads',
    icon: 'GO',
    description: 'Conecta demanda activa y mide mejor el rendimiento de tus intenciones de compra.',
    color: 'from-emerald-500 to-lime-400',
  },
  {
    key: 'tiktok',
    name: 'TikTok Ads',
    icon: 'TT',
    description: 'Activa alcance creativo y lectura de hooks para campañas de respuesta rápida.',
    color: 'from-slate-900 to-slate-700',
  },
];

const EMPTY_FORM = {
  platform: 'instagram',
  businessName: '',
  contactEmail: '',
  adAccountLabel: '',
  websiteUrl: '',
  setupPreference: 'oauth',
  notes: '',
};

export default function ConnectPage() {
  const [user, setUser] = useState<ConnectUser | null>(null);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [userResponse, requestsResponse] = await Promise.all([
        fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }),
        fetch('/api/connect/requests', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }),
      ]);

      if (!userResponse.ok) {
        throw new Error('No se pudo cargar el estado de conexiones.');
      }

      const userData = await userResponse.json();
      const requestsData = requestsResponse.ok ? await requestsResponse.json() : { requests: [] };
      setUser(userData.user);
      setAdAccounts(userData.adAccounts || []);
      setRequests(requestsData.requests || []);
    } catch (error) {
      console.error('Error fetching ad account state:', error);
      setMessage('No pudimos cargar tus conexiones. Intenta actualizar la página.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const adAccountUsage = user?.entitlements?.usage;
  const adAccountLimitReached = !!adAccountUsage && adAccountUsage.adAccounts >= adAccountUsage.adAccountsLimit;

  const helperText = useMemo(() => {
    if (!adAccountUsage) return '';
    if (adAccountLimitReached) {
      return user?.entitlements?.capabilities.upgradeCta || 'Sube de plan para conectar más cuentas.';
    }
    return `Te quedan ${adAccountUsage.adAccountsRemaining} conexiones disponibles en tu plan ${user?.entitlements?.marketingLabel}.`;
  }, [adAccountLimitReached, adAccountUsage, user?.entitlements?.capabilities.upgradeCta, user?.entitlements?.marketingLabel]);

  const handleCreateRequest = async () => {
    if (adAccountLimitReached) {
      setMessage(user?.entitlements?.capabilities.upgradeCta || 'Tu plan actual ya alcanzó el límite de conexiones.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/connect/requests', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo crear la solicitud de conexión.');
      }

      setForm(EMPTY_FORM);
      setMessage('Solicitud de conexión creada. Ya puedes seguir el estado desde esta misma pantalla.');
      await fetchData();
    } catch (error) {
      console.error('Error creating connection request:', error);
      setMessage(error instanceof Error ? error.message : 'No se pudo crear la solicitud.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-b-primary" />
          <p className="mt-4 text-gray-600">Cargando conexiones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-gray-400">Conexiones del plan</p>
            <h1 className="mt-3 text-3xl font-semibold text-gray-900">Conecta tus redes publicitarias sin perder control.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              Mientras cerramos las integraciones OAuth nativas, Nexora ya te deja iniciar cada conexión de forma operable:
              eliges plataforma, registras la cuenta y haces seguimiento del estado desde un solo lugar.
            </p>
          </div>
          <div className="rounded-[24px] bg-slate-950 px-6 py-5 text-white">
            <p className="text-sm text-slate-300">Uso actual</p>
            <p className="mt-2 text-4xl font-semibold">
              {adAccountUsage?.adAccounts || 0}/{adAccountUsage?.adAccountsLimit || 1}
            </p>
            <p className="mt-2 text-sm text-slate-300">cuentas conectadas</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">{helperText}</div>
        {message && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{message}</div>}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[28px] border border-gray-200 bg-white p-7 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Plataformas</p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">Qué canales puedes preparar hoy</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {platforms.map((platform) => (
              <article key={platform.key} className="rounded-[24px] border border-gray-200 p-5">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r ${platform.color} text-sm font-semibold text-white`}>
                  {platform.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{platform.name}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{platform.description}</p>
                <button
                  onClick={() => setForm((current) => ({ ...current, platform: platform.key }))}
                  className="mt-4 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                >
                  Preparar {platform.name}
                </button>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-7 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Nueva solicitud</p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">Inicia una conexión real</h2>

          <div className="mt-6 grid gap-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Plataforma</span>
              <select
                value={form.platform}
                onChange={(event) => setForm((current) => ({ ...current, platform: event.target.value }))}
                className="input-field"
              >
                {platforms.map((platform) => (
                  <option key={platform.key} value={platform.key}>
                    {platform.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Nombre del negocio o marca</span>
              <input
                value={form.businessName}
                onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
                className="input-field"
                placeholder="Nombre de la cuenta o marca"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Email de contacto</span>
              <input
                value={form.contactEmail}
                onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))}
                className="input-field"
                placeholder="correo@marca.com"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Nombre o ID de la cuenta publicitaria</span>
              <input
                value={form.adAccountLabel}
                onChange={(event) => setForm((current) => ({ ...current, adAccountLabel: event.target.value }))}
                className="input-field"
                placeholder="Cuenta Meta principal, MCC, Business ID..."
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Sitio web</span>
              <input
                value={form.websiteUrl}
                onChange={(event) => setForm((current) => ({ ...current, websiteUrl: event.target.value }))}
                className="input-field"
                placeholder="https://..."
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Modo de preparación</span>
              <select
                value={form.setupPreference}
                onChange={(event) => setForm((current) => ({ ...current, setupPreference: event.target.value }))}
                className="input-field"
              >
                <option value="oauth">OAuth guiado</option>
                <option value="manual">Carga manual / revisión previa</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Notas</span>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="input-field min-h-[120px]"
                placeholder="Qué necesitas conectar, qué objetivo tienes o qué acceso ya existe."
              />
            </label>
          </div>

          <button
            onClick={handleCreateRequest}
            disabled={saving || adAccountLimitReached}
            className="mt-6 btn-primary w-full disabled:opacity-60"
          >
            {saving ? 'Guardando...' : adAccountLimitReached ? 'Límite alcanzado' : 'Crear solicitud de conexión'}
          </button>
        </div>
      </section>

      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Estado de conexiones</h2>
            <p className="text-sm text-gray-500">Cuentas activas y solicitudes en curso.</p>
          </div>
          <Link href="/dashboard/billing" className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            Gestionar plan
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-gray-50 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Cuentas conectadas</p>
            {adAccounts.length === 0 ? (
              <div className="mt-4 text-sm text-gray-600">
                Aún no tienes cuentas conectadas. Puedes empezar creando una solicitud real de conexión arriba.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {adAccounts.map((account) => (
                  <div key={account.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-gray-400">{account.platform}</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">{account.accountName}</p>
                    <p className="mt-2 text-sm text-gray-600">
                      {account.connected ? 'Conectada y disponible para lectura.' : 'Pendiente de reconexión.'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-gray-50 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Solicitudes creadas</p>
            {requests.length === 0 ? (
              <div className="mt-4 text-sm text-gray-600">
                Aún no hay solicitudes de conexión registradas.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {requests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {platforms.find((platform) => platform.key === request.platform)?.name || request.platform}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {request.businessName || request.adAccountLabel || 'Solicitud sin etiqueta'}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                        {request.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-gray-600">
                      {request.contactEmail || 'Sin email'} · {request.setupPreference === 'manual' ? 'Carga manual' : 'OAuth guiado'}
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                      Actualizado {new Date(request.updatedAt).toLocaleString('es-ES')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
