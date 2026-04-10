'use client';

import { useEffect, useState } from 'react';

interface PaymentSettings {
  stripeWebhookSecret: string;
  bankAccount: {
    accountNumber: string;
    routingNumber: string;
    accountHolder: string;
    bankName: string;
  };
  paypalEmail: string;
  commissionRate: number;
  minimumPayout: number;
}

const DEFAULT_SETTINGS: PaymentSettings = {
  stripeWebhookSecret: '',
  bankAccount: {
    accountNumber: '',
    routingNumber: '',
    accountHolder: '',
    bankName: '',
  },
  paypalEmail: '',
  commissionRate: 2.9,
  minimumPayout: 25,
};

function normalizeSettings(rawSettings: Partial<PaymentSettings> | null | undefined): PaymentSettings {
  return {
    stripeWebhookSecret: rawSettings?.stripeWebhookSecret || '',
    bankAccount: {
      accountNumber: rawSettings?.bankAccount?.accountNumber || '',
      routingNumber: rawSettings?.bankAccount?.routingNumber || '',
      accountHolder: rawSettings?.bankAccount?.accountHolder || '',
      bankName: rawSettings?.bankAccount?.bankName || '',
    },
    paypalEmail: rawSettings?.paypalEmail || '',
    commissionRate:
      typeof rawSettings?.commissionRate === 'number' && Number.isFinite(rawSettings.commissionRate)
        ? rawSettings.commissionRate
        : 2.9,
    minimumPayout:
      typeof rawSettings?.minimumPayout === 'number' && Number.isFinite(rawSettings.minimumPayout)
        ? rawSettings.minimumPayout
        : 25,
  };
}

export default function PaymentsPage() {
  const [settings, setSettings] = useState<PaymentSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/payment-settings', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'No se pudo cargar la configuración de pagos.');
        }

        setSettings(normalizeSettings(data.settings));
      } catch (error) {
        console.error('Error fetching payment settings:', error);
        setMessage(error instanceof Error ? error.message : 'No se pudo cargar la configuración de pagos.');
      } finally {
        setLoading(false);
      }
    };

    void fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/payment-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo guardar la configuración.');
      }

      setSettings(normalizeSettings(data.settings));
      setMessage('Configuración de pagos guardada correctamente.');
    } catch (error) {
      console.error('Error saving payment settings:', error);
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Configuración de pagos</h2>
        <p className="mt-2 text-gray-600">Centraliza Stripe, transferencias, PayPal y parámetros internos de cobro.</p>
      </div>

      {message && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
          {message}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] border border-gray-200 bg-white p-8 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900">Stripe</h3>
          <p className="mt-2 text-sm text-gray-600">Mantén aquí la referencia del webhook interno para control operativo.</p>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700">Webhook secret</label>
            <input
              type="password"
              value={settings.stripeWebhookSecret}
              onChange={(event) => setSettings((current) => ({ ...current, stripeWebhookSecret: event.target.value }))}
              className="input-field mt-2"
              placeholder="whsec_..."
            />
            <p className="mt-2 text-xs text-gray-500">Obtén este valor desde Stripe → Developers → Webhooks.</p>
          </div>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-8 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900">Parámetros del negocio</h3>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Comisión por transacción (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings.commissionRate}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    commissionRate: Number(event.target.value || 0),
                  }))
                }
                className="input-field mt-2"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Monto mínimo de pago ($)</span>
              <input
                type="number"
                min="0"
                value={settings.minimumPayout}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    minimumPayout: Number(event.target.value || 0),
                  }))
                }
                className="input-field mt-2"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-gray-200 bg-white p-8 shadow-sm">
        <h3 className="text-xl font-bold text-gray-900">Cuenta bancaria</h3>
        <p className="mt-2 text-sm text-gray-600">Datos para transferencias manuales o flujos de payout operativos.</p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Nombre del banco</span>
            <input
              type="text"
              value={settings.bankAccount.bankName}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  bankAccount: { ...current.bankAccount, bankName: event.target.value },
                }))
              }
              className="input-field mt-2"
              placeholder="Banco o entidad"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Titular de la cuenta</span>
            <input
              type="text"
              value={settings.bankAccount.accountHolder}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  bankAccount: { ...current.bankAccount, accountHolder: event.target.value },
                }))
              }
              className="input-field mt-2"
              placeholder="Nombre del titular"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Número de cuenta</span>
            <input
              type="text"
              value={settings.bankAccount.accountNumber}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  bankAccount: { ...current.bankAccount, accountNumber: event.target.value },
                }))
              }
              className="input-field mt-2"
              placeholder="Cuenta o IBAN"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Código SWIFT / routing</span>
            <input
              type="text"
              value={settings.bankAccount.routingNumber}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  bankAccount: { ...current.bankAccount, routingNumber: event.target.value },
                }))
              }
              className="input-field mt-2"
              placeholder="SWIFT, ABA o routing"
            />
          </label>
        </div>
      </section>

      <section className="rounded-[28px] border border-gray-200 bg-white p-8 shadow-sm">
        <h3 className="text-xl font-bold text-gray-900">PayPal</h3>
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700">Email de PayPal</label>
          <input
            type="email"
            value={settings.paypalEmail}
            onChange={(event) => setSettings((current) => ({ ...current, paypalEmail: event.target.value }))}
            className="input-field mt-2"
            placeholder="tu-email@paypal.com"
          />
        </div>
      </section>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-60">
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}
