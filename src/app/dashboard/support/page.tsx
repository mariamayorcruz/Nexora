'use client';

import { useEffect, useState } from 'react';

interface SupportReply {
  title: string;
  message: string;
  nextSteps: string[];
}

interface DashboardSupportUser {
  entitlements?: {
    marketingLabel: string;
    capabilities: {
      canUsePrioritySupport: boolean;
    };
  } | null;
}

export default function SupportPage() {
  const [user, setUser] = useState<DashboardSupportUser | null>(null);
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState<SupportReply | null>(null);
  const [supportEmail, setSupportEmail] = useState('support@nexora.com');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await response.json();
        setUser(data.user);
      } catch (error) {
        console.error('Error loading support user:', error);
      }
    };

    loadUser();
  }, []);

  const handleAsk = async () => {
    if (!message.trim()) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/support/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No pudimos responder.');
      }

      setReply(data.reply);
      setSupportEmail(data.supportEmail || 'support@nexora.com');
    } catch (error) {
      console.error('Error asking support assistant:', error);
      setReply({
        title: 'No disponible por ahora',
        message: 'El asistente no pudo responder en este momento. Puedes escribir al soporte y te ayudamos manualmente.',
        nextSteps: ['Escribe tu caso por email.', 'Incluye una captura o explica que estabas intentando hacer.'],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-gray-400">Post-venta y soporte</p>
        <h1 className="mt-3 text-3xl font-semibold text-gray-900">Soporte tecnico con IA y seguimiento despues de la compra.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
          Este centro acompaña al cliente despues de vender: onboarding, dudas tecnicas, friccion de campañas y escalado a soporte humano cuando haga falta.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-gray-50 p-5">
            <p className="text-sm text-gray-500">Plan actual</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{user?.entitlements?.marketingLabel || 'Starter'}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-5">
            <p className="text-sm text-gray-500">Soporte IA</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">Activo</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-5">
            <p className="text-sm text-gray-500">Escalado humano</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {user?.entitlements?.capabilities.canUsePrioritySupport ? 'Prioritario' : 'Por email'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Asistente IA</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Escribe tu duda sobre campañas, facturación, conexiones o configuración y Nexora te devuelve pasos accionables.
          </p>

          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="mt-5 min-h-[180px] w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-primary"
            placeholder="Ejemplo: mi campaña tiene gasto pero no convierte, ¿qué debería revisar primero?"
          />

          <button onClick={handleAsk} disabled={loading} className="mt-4 btn-primary disabled:opacity-60">
            {loading ? 'Analizando...' : 'Preguntar al soporte IA'}
          </button>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Respuesta y siguiente paso</h2>
          {reply ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-slate-950 p-5 text-white">
                <p className="text-sm uppercase tracking-[0.22em] text-slate-300">{reply.title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-100">{reply.message}</p>
              </div>
              {reply.nextSteps.map((step) => (
                <div key={step} className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                  {step}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-gray-50 p-5 text-sm leading-6 text-gray-600">
              Aun no hay consulta. Cuando escribas una duda, aqui apareceran diagnostico y pasos recomendados.
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-gray-200 p-4 text-sm text-gray-700">
            Si necesitas seguimiento humano, escribe a <span className="font-semibold text-gray-900">{supportEmail}</span>.
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Bienvenida</h3>
          <p className="mt-3 text-sm leading-6 text-gray-600">Primera activación para que el cliente conecte una cuenta y entienda su plan.</p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Seguimiento</h3>
          <p className="mt-3 text-sm leading-6 text-gray-600">Check-ins de 3 y 7 días para que la compra no se enfríe ni pierda momentum.</p>
        </div>
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Post-venta</h3>
          <p className="mt-3 text-sm leading-6 text-gray-600">Soporte técnico y acompañamiento para ayudar a convertir uso en resultados reales.</p>
        </div>
      </section>
    </div>
  );
}
