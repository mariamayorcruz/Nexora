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

const PLATFORMS = [
  {
    key: 'instagram',
    name: 'Instagram Ads',
    helper: 'Reels, UGC y campañas visuales.',
    authUrl: 'https://business.facebook.com/latest/settings/ad-accounts',
  },
  {
    key: 'facebook',
    name: 'Facebook Ads',
    helper: 'Captación, remarketing y venta directa.',
    authUrl: 'https://business.facebook.com/latest/settings/ad-accounts',
  },
  {
    key: 'google',
    name: 'Google Ads',
    helper: 'Demanda activa y búsquedas con intención.',
    authUrl: 'https://ads.google.com/home/',
  },
  {
    key: 'tiktok',
    name: 'TikTok Ads',
    helper: 'Creatividad corta y respuesta rápida.',
    authUrl: 'https://ads.tiktok.com/business/',
  },
] as const;

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
      console.error('Error fetching connect state:', error);
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
  const selectedPlatform = PLATFORMS.find((platform) => platform.key === form.platform) || PLATFORMS[0];
  const openRequests = requests.filter((request) => request.status !== 'completed');

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
      setMessage('Solicitud creada. Ya puedes seguir el estado desde esta misma pantalla.');
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
            <p className="text-xs uppercase tracking-[0.28em] text-gray-400">Conectar canales</p>
            <h1 className="mt-3 text-3xl font-semibold text-gray-900">Una sola pantalla para iniciar y seguir tus conexiones.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              Aquí simplificamos todo: eliges plataforma, dejas los datos mínimos y ves el estado sin perderte entre tarjetas o pasos innecesarios.
            </p>
          </div>
          <div className="rounded-[24px] bg-slate-950 px-6 py-5 text-white">
            <p className="text-sm text-slate-300">Uso actual</p>
            <p className="mt-2 text-4xl font-semibold">
              {adAccountUsage?.adAccounts || 0}/{adAccountUsage?.adAccountsLimit || 1}
            </p>
            <p className="mt-2 text-sm text-slate-300">cuentas preparadas</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">{helperText}</div>
        {message && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{message}</div>}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] border border-gray-200 bg-white p-7 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Paso 1</p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">Elige el canal y deja lo esencial</h2>

          <div className="mt-6 flex flex-wrap gap-2">
            {PLATFORMS.map((platform) => (
              <button
                key={platform.key}
                onClick={() => setForm((current) => ({ ...current, platform: platform.key }))}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  form.platform === platform.key ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {platform.name}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">{selectedPlatform.name}</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">{selectedPlatform.helper}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={selectedPlatform.authUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Abrir centro oficial
              </a>
              <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Paso 1 abrir • Paso 2 guardar solicitud • Paso 3 seguimiento
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Nombre del negocio o marca</span>
              <input
                value={form.businessName}
                onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
                className="input-field"
                placeholder="Nombre de la marca"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
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
                <span className="mb-2 block text-sm font-medium text-gray-700">Cuenta publicitaria</span>
                <input
                  value={form.adAccountLabel}
                  onChange={(event) => setForm((current) => ({ ...current, adAccountLabel: event.target.value }))}
                  className="input-field"
                  placeholder="Business ID o cuenta principal"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
                <span className="mb-2 block text-sm font-medium text-gray-700">Modo</span>
                <select
                  value={form.setupPreference}
                  onChange={(event) => setForm((current) => ({ ...current, setupPreference: event.target.value }))}
                  className="input-field"
                >
                  <option value="oauth">OAuth guiado</option>
                  <option value="manual">Carga manual</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Notas opcionales</span>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="input-field min-h-[110px]"
                placeholder="Objetivo, acceso existente o algo que debamos saber."
              />
            </label>
          </div>

          <button
            onClick={handleCreateRequest}
            disabled={saving || adAccountLimitReached}
            className="mt-6 btn-primary w-full disabled:opacity-60"
          >
            {saving ? 'Guardando...' : adAccountLimitReached ? 'Límite alcanzado' : 'Crear solicitud'}
          </button>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Mientras cerramos OAuth nativo, aquí ya puedes abrir Meta o Google, dejar tus datos y seguir el estado desde Nexora sin perder el orden.
          </p>
        </div>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Paso 2</p>
                <h2 className="mt-2 text-2xl font-semibold text-gray-900">Seguimiento claro</h2>
              </div>
              <Link href="/dashboard/billing" className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                Gestionar plan
              </Link>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <MiniStat label="Conectadas" value={String(adAccounts.filter((account) => account.connected).length)} />
              <MiniStat label="En proceso" value={String(openRequests.length)} />
              <MiniStat label="Disponibles" value={String(adAccountUsage?.adAccountsRemaining || 0)} />
            </div>
          </section>

          <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Cuentas activas</p>
            <div className="mt-4 space-y-3">
              {adAccounts.length === 0 ? (
                <EmptyPanel text="Aún no tienes cuentas conectadas. Empieza creando una solicitud arriba." />
              ) : (
                adAccounts.map((account) => (
                  <div key={account.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-semibold capitalize text-gray-900">{account.platform}</p>
                    <p className="mt-1 text-sm text-gray-600">{account.accountName}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-emerald-700">
                      {account.connected ? 'Conectada' : 'Pendiente'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Solicitudes creadas</p>
            <div className="mt-4 space-y-3">
              {requests.length === 0 ? (
                <EmptyPanel text="Todavía no hay solicitudes creadas." />
              ) : (
                requests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {PLATFORMS.find((platform) => platform.key === request.platform)?.name || request.platform}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          {request.businessName || request.adAccountLabel || request.contactEmail || 'Solicitud sin etiqueta'}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                        {request.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-gray-500">
                      {request.setupPreference === 'manual' ? 'Carga manual' : 'OAuth guiado'} ·{' '}
                      {new Date(request.updatedAt).toLocaleString('es-ES')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">{text}</div>;
}
