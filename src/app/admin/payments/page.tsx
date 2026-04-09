'use client';

import { useState, useEffect } from 'react';

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

export default function PaymentsPage() {
  const [settings, setSettings] = useState<PaymentSettings>({
    stripeWebhookSecret: '',
    bankAccount: {
      accountNumber: '',
      routingNumber: '',
      accountHolder: '',
      bankName: '',
    },
    paypalEmail: '',
    commissionRate: 0,
    minimumPayout: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/payment-settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        setSettings(data.settings);
      } catch (error) {
        console.error('Error fetching payment settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/payment-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error('Failed to save settings');

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving payment settings:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-2">Configuración de Pagos</h2>
      <p className="text-gray-600 mb-8">Configura cómo y dónde recibir los pagos de tus usuarios</p>

      {saved && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          ✓ Configuración guardada exitosamente
        </div>
      )}

      {/* Stripe Settings */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
        <h3 className="text-xl font-bold mb-6">Stripe (Pagos Automáticos)</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Webhook Secret
            </label>
            <input
              type="password"
              value={settings.stripeWebhookSecret}
              onChange={(e) => setSettings({...settings, stripeWebhookSecret: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="whsec_..."
            />
            <p className="text-xs text-gray-500 mt-2">
              Obtén esto en tu dashboard de Stripe → Webhooks
            </p>
          </div>
        </div>
      </div>

      {/* Bank Account Settings */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
        <h3 className="text-xl font-bold mb-6">Cuenta Bancaria (Transferencias Manuales)</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre del Banco
            </label>
            <input
              type="text"
              value={settings.bankAccount.bankName}
              onChange={(e) => setSettings({
                ...settings,
                bankAccount: {...settings.bankAccount, bankName: e.target.value}
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Banco Santander"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Titular de la Cuenta
            </label>
            <input
              type="text"
              value={settings.bankAccount.accountHolder}
              onChange={(e) => setSettings({
                ...settings,
                bankAccount: {...settings.bankAccount, accountHolder: e.target.value}
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Juan García Pérez"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número de Cuenta
            </label>
            <input
              type="text"
              value={settings.bankAccount.accountNumber}
              onChange={(e) => setSettings({
                ...settings,
                bankAccount: {...settings.bankAccount, accountNumber: e.target.value}
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="ES21 1465 0100 72 2030876293"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Código SWIFT/BIC
            </label>
            <input
              type="text"
              value={settings.bankAccount.routingNumber}
              onChange={(e) => setSettings({
                ...settings,
                bankAccount: {...settings.bankAccount, routingNumber: e.target.value}
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="BSCHESMM"
            />
          </div>
        </div>
      </div>

      {/* PayPal Settings */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
        <h3 className="text-xl font-bold mb-6">PayPal (Opcional)</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email de PayPal
          </label>
          <input
            type="email"
            value={settings.paypalEmail}
            onChange={(e) => setSettings({...settings, paypalEmail: e.target.value})}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="tu-email@paypal.com"
          />
          <p className="text-xs text-gray-500 mt-2">
            Para pagos manuales o como alternativa
          </p>
        </div>
      </div>

      {/* Commission Settings */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
        <h3 className="text-xl font-bold mb-6">Configuración de Comisiones</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comisión por Transacción (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={settings.commissionRate}
              onChange={(e) => setSettings({...settings, commissionRate: parseFloat(e.target.value)})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="2.9"
            />
            <p className="text-xs text-gray-500 mt-2">
              Porcentaje que cobra Stripe + tu margen
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monto Mínimo de Pago ($)
            </label>
            <input
              type="number"
              min="0"
              value={settings.minimumPayout}
              onChange={(e) => setSettings({...settings, minimumPayout: parseFloat(e.target.value)})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="25"
            />
            <p className="text-xs text-gray-500 mt-2">
              Monto mínimo para procesar pagos
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>

      {/* Security Notice */}
      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h4 className="font-bold text-yellow-900 mb-2">⚠️ Información de Seguridad</h4>
        <ul className="text-yellow-800 text-sm space-y-1">
          <li>• Mantén estos datos seguros y no los compartas</li>
          <li>• Usa HTTPS para todas las comunicaciones</li>
          <li>• Configura webhooks de Stripe para actualizaciones automáticas</li>
          <li>• Revisa regularmente los logs de pagos</li>
        </ul>
      </div>
    </div>
  );
}
