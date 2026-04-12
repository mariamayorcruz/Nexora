'use client';

import { Save, Settings2, ShieldCheck, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';

type PlatformSettings = {
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
  defaultSubscriptionPrice: number;
  supportEmail: string;
  platformName: string;
  platformDescription: string;
  termsUrl: string;
  privacyUrl: string;
  metaAppId: string;
  metaAppSecret: string;
  anthropicApiKey: string;
  openRouterApiKey: string;
  geminiApiKey: string;
};

type PaymentSettings = {
  stripeWebhookSecret: string;
  paypalEmail: string;
  commissionRate: number;
  minimumPayout: number;
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [payments, setPayments] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const [settingsResponse, paymentsResponse] = await Promise.all([
          fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
          fetch('/api/admin/payment-settings', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
        ]);

        const settingsData = await settingsResponse.json();
        const paymentsData = await paymentsResponse.json();
        setSettings(settingsData.settings);
        setPayments(paymentsData.settings);
      } catch (error) {
        console.error('Error loading admin settings:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const handleSave = async () => {
    if (!settings || !payments) return;
    setSaving(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const [settingsResponse, paymentsResponse] = await Promise.all([
        fetch('/api/admin/settings', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings }),
        }),
        fetch('/api/admin/payment-settings', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payments),
        }),
      ]);

      if (!settingsResponse.ok || !paymentsResponse.ok) {
        throw new Error('No se pudo guardar la configuración consolidada.');
      }

      setMessage('Configuración guardada correctamente.');
    } catch (error) {
      console.error('Error saving admin settings:', error);
      setMessage('No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings || !payments) {
    return <div className="py-12 text-center text-slate-500">Cargando configuración...</div>;
  }

  return (
    <div className="space-y-6 text-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Configuración</h1>
          <p className="mt-1 text-sm text-slate-400">General, legal y Stripe en una sola pantalla.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60">
          <Save size={16} />
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {message ? <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">{message}</div> : null}

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 xl:col-span-1">
          <div className="flex items-center gap-2">
            <Settings2 size={18} className="text-cyan-400" />
            <h2 className="font-semibold text-white">General</h2>
          </div>
          <div className="mt-4 space-y-4 text-sm">
            <label className="block">
              <span className="mb-2 block text-slate-400">Nombre plataforma</span>
              <input value={settings.platformName} onChange={(e) => setSettings({ ...settings, platformName: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200" />
            </label>
            <label className="block">
              <span className="mb-2 block text-slate-400">Support email</span>
              <input value={settings.supportEmail} onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200" />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-3">
              <span>Maintenance mode</span>
              <input type="checkbox" checked={settings.maintenanceMode} onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })} />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-3">
              <span>Nuevos registros</span>
              <input type="checkbox" checked={settings.allowNewRegistrations} onChange={(e) => setSettings({ ...settings, allowNewRegistrations: e.target.checked })} />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 xl:col-span-1">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-400" />
            <h2 className="font-semibold text-white">Legal</h2>
          </div>
          <div className="mt-4 space-y-4 text-sm">
            <label className="block">
              <span className="mb-2 block text-slate-400">Descripción</span>
              <textarea value={settings.platformDescription} onChange={(e) => setSettings({ ...settings, platformDescription: e.target.value })} className="min-h-[100px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200" />
            </label>
            <label className="block">
              <span className="mb-2 block text-slate-400">Terms URL</span>
              <input value={settings.termsUrl} onChange={(e) => setSettings({ ...settings, termsUrl: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200" />
            </label>
            <label className="block">
              <span className="mb-2 block text-slate-400">Privacy URL</span>
              <input value={settings.privacyUrl} onChange={(e) => setSettings({ ...settings, privacyUrl: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200" />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 xl:col-span-1">
          <div className="flex items-center gap-2">
            <Wallet size={18} className="text-violet-400" />
            <h2 className="font-semibold text-white">Stripe & pagos</h2>
          </div>
          <div className="mt-4 space-y-4 text-sm">
            <label className="block">
              <span className="mb-2 block text-slate-400">Webhook secret</span>
              <input type="password" value={payments.stripeWebhookSecret || ''} onChange={(e) => setPayments({ ...payments, stripeWebhookSecret: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200" />
            </label>
            <label className="block">
              <span className="mb-2 block text-slate-400">PayPal email</span>
              <input value={payments.paypalEmail || ''} onChange={(e) => setPayments({ ...payments, paypalEmail: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-2 block text-slate-400">Comisión %</span>
                <input type="number" value={payments.commissionRate} onChange={(e) => setPayments({ ...payments, commissionRate: Number(e.target.value || 0) })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200" />
              </label>
              <label className="block">
                <span className="mb-2 block text-slate-400">Payout mínimo</span>
                <input type="number" value={payments.minimumPayout} onChange={(e) => setPayments({ ...payments, minimumPayout: Number(e.target.value || 0) })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200" />
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 xl:col-span-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-cyan-400" />
            <h2 className="font-semibold text-white">Integraciones (desde la web)</h2>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Configura aquí Meta OAuth y proveedores IA para que todo funcione desde Nexora sin editar variables en código.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-slate-400">Meta App ID</span>
              <input
                value={settings.metaAppId || ''}
                onChange={(e) => setSettings({ ...settings, metaAppId: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
                placeholder="123456789012345"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-slate-400">Meta App Secret</span>
              <input
                type="password"
                value={settings.metaAppSecret || ''}
                onChange={(e) => setSettings({ ...settings, metaAppSecret: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
                placeholder="Meta app secret"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-slate-400">Claude (Anthropic) API Key</span>
              <input
                type="password"
                value={settings.anthropicApiKey || ''}
                onChange={(e) => setSettings({ ...settings, anthropicApiKey: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
                placeholder="sk-ant-..."
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-slate-400">OpenRouter API Key</span>
              <input
                type="password"
                value={settings.openRouterApiKey || ''}
                onChange={(e) => setSettings({ ...settings, openRouterApiKey: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
                placeholder="sk-or-..."
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-slate-400">Gemini API Key</span>
              <input
                type="password"
                value={settings.geminiApiKey || ''}
                onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
                placeholder="AIza..."
              />
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}
