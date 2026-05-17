'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Integration = {
  id: string;
  label: string;
  description: string;
  status: 'active' | 'pending' | 'error' | 'disconnected';
  statusLabel: string;
  detail: string;
  actionLabel: string;
  actionHref?: string;
  onConnect?: () => void;
  color: string;
};

export default function IntegracionesPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get('oauth');
    const platform = params.get('platform');
    if (oauthResult === 'success' && platform) {
      setConnectedAccounts((prev) => Array.from(new Set([...prev, platform])));
      router.replace('/dashboard/integraciones');
    }
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    void fetch('/api/connect/requests', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const authorized = (data.requests || [])
          .filter((request: { status: string }) => request.status === 'authorized')
          .map((request: { platform: string }) => request.platform);
        setConnectedAccounts(Array.from(new Set(authorized)));
      })
      .catch(() => {});
  }, []);

  const handleConnect = async (platform: string) => {
    setConnecting(platform);
    try {
      const token = localStorage.getItem('token');
    const response = await fetch('/api/connect/oauth/start', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ platform }),
    });
    const data = await response.json();
    console.log('OAuth response:', response.status, data);
    if (!response.ok) throw new Error(data.error || 'Error iniciando OAuth');
    if (data.url) {
      console.log('Redirecting to:', data.url);
      window.location.href = data.url;
    }
  } catch (error) {
      console.error('OAuth error:', error);
      setConnecting(null);
    }
  };

  const integrations: Integration[] = [
    {
      id: 'twilio-sms',
      label: 'SMS · Twilio',
      description: 'Envío y recepción de mensajes SMS reales a clientes en USA.',
      status: 'pending',
      statusLabel: '⏳ Pendiente A2P',
      detail: 'Número +1 385 284 4488 comprado. Campaign A2P enviada a revisión — aprobación en 24-48h.',
      actionLabel: 'Ver en Twilio →',
      actionHref: 'https://console.twilio.com',
      color: 'text-amber-400',
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp Business',
      description: 'Canal de mensajería para clientes latinos y comunicación multicanal.',
      status: 'pending',
      statusLabel: '⏳ Verificación Meta',
      detail: 'Número +1 385 284 4488 pendiente de verificación con Meta. Reintentar en 24h usando llamada telefónica.',
      actionLabel: 'Ver en Meta →',
      actionHref: 'https://business.facebook.com',
      color: 'text-amber-400',
    },
    {
      id: 'ai-agent',
      label: 'AI Agent · n8n',
      description: 'Agente conversacional que responde leads y captura datos al CRM automáticamente.',
      status: 'active',
      statusLabel: '● Activo',
      detail: 'Webhook activo en gotnexora.app.n8n.cloud. Groq llama-3.3-70b-versatile. Sandbox WhatsApp funcional.',
      actionLabel: 'Abrir n8n →',
      actionHref: 'https://gotnexora.app.n8n.cloud',
      color: 'text-emerald-400',
    },
    {
      id: 'instagram',
      label: 'Instagram',
      description: 'Publicación de contenido generado en Studio IA directamente a Instagram.',
      status: connectedAccounts.includes('instagram') ? 'active' : 'disconnected',
      statusLabel: connectedAccounts.includes('instagram') ? '● Conectado' : 'No conectado',
      detail: connectedAccounts.includes('instagram')
        ? 'Cuenta de Instagram Business conectada. Puedes publicar campañas desde Studio IA.'
        : 'Conecta tu cuenta de Instagram Business para publicar campañas desde Studio IA.',
      actionLabel: connectedAccounts.includes('instagram') ? 'Reconectar →' : 'Conectar →',
      onConnect: () => handleConnect('instagram'),
      color: connectedAccounts.includes('instagram') ? 'text-emerald-400' : 'text-slate-500',
    },
    {
      id: 'facebook',
      label: 'Facebook Ads',
      description: 'Publicación y gestión de anuncios desde Nexora.',
      status: connectedAccounts.includes('facebook') ? 'active' : 'disconnected',
      statusLabel: connectedAccounts.includes('facebook') ? '● Conectado' : 'No conectado',
      detail: connectedAccounts.includes('facebook')
        ? 'Cuenta de Facebook Ads conectada. Puedes gestionar campañas desde Nexora.'
        : 'Conecta tu cuenta de Facebook Business para gestionar campañas y leads.',
      actionLabel: connectedAccounts.includes('facebook') ? 'Reconectar →' : 'Conectar →',
      onConnect: () => handleConnect('facebook'),
      color: connectedAccounts.includes('facebook') ? 'text-emerald-400' : 'text-slate-500',
    },
    {
      id: 'gemini',
      label: 'Google Gemini',
      description: 'Motor de IA para generación de imágenes y descripciones visuales en Studio.',
      status: 'active',
      statusLabel: '● Activo',
      detail: 'API key configurada. Generando descripciones visuales con gemini-2.0-flash. Imagen real disponible con Google Cloud billing.',
      actionLabel: 'Ver en Google →',
      actionHref: 'https://aistudio.google.com',
      color: 'text-emerald-400',
    },
    {
      id: 'stripe',
      label: 'Stripe',
      description: 'Procesamiento de pagos y gestión de suscripciones de Nexora.',
      status: 'active',
      statusLabel: '● Activo',
      detail: 'Webhooks configurados. Planes Starter $29, Growth $79, Scale $199 activos.',
      actionLabel: 'Ver en Stripe →',
      actionHref: 'https://dashboard.stripe.com',
      color: 'text-emerald-400',
    },
    {
      id: 'supabase',
      label: 'Supabase · Base de datos',
      description: 'Base de datos principal con RLS activo en todas las tablas.',
      status: 'active',
      statusLabel: '● Activo',
      detail: 'PostgreSQL con RLS habilitado en 21 tablas. Prisma ORM conectado.',
      actionLabel: 'Ver en Supabase →',
      actionHref: 'https://supabase.com/dashboard',
      color: 'text-emerald-400',
    },
  ];

  const statusOrder = { active: 0, pending: 1, error: 2, disconnected: 3 };
  const sorted = [...integrations].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  if (!mounted) return null;

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#040810] px-6 py-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">✦ Integraciones</p>
        <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[32px]">
          Canales y servicios conectados
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Estado en tiempo real de todas las integraciones de Nexora — mensajería, IA, pagos y base de datos.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {[
            { label: 'Activos', count: integrations.filter((integration) => integration.status === 'active').length, color: 'text-emerald-400 bg-emerald-500/8 border-emerald-500/15' },
            { label: 'Pendientes', count: integrations.filter((integration) => integration.status === 'pending').length, color: 'text-amber-400 bg-amber-500/8 border-amber-500/15' },
            { label: 'Sin conectar', count: integrations.filter((integration) => integration.status === 'disconnected').length, color: 'text-slate-400 bg-white/4 border-white/8' },
          ].map((item) => (
            <div key={item.label} className={`rounded-full border px-3 py-1 text-xs font-medium ${item.color}`}>
              {item.count} {item.label}
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {sorted.map((integration) => (
          <div
            key={integration.id}
            className={`rounded-[24px] bg-[#040810] p-5 transition-all duration-150 ${
              integration.status === 'active'
                ? 'border border-emerald-500/10'
                : integration.status === 'pending'
                  ? 'border border-amber-500/10'
                  : 'border border-white/[0.05]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">{integration.label}</p>
                  <span className={`text-xs font-medium ${integration.color}`}>
                    {integration.statusLabel}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{integration.description}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">{integration.detail}</p>
            {integration.onConnect && connectedAccounts.includes(integration.id) ? (
              <div className="mt-4 flex gap-2">
                <a
                  href="https://business.facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.07] hover:text-white"
                >
                  Ver en Meta →
                </a>
                <button
                  type="button"
                  onClick={integration.onConnect}
                  className="inline-flex rounded-full bg-white/[0.02] px-3 py-1.5 text-xs text-slate-500 transition hover:text-white"
                >
                  Reconectar
                </button>
              </div>
            ) : integration.onConnect ? (
              <button
                type="button"
                onClick={integration.onConnect}
                disabled={connecting === integration.id}
                className="mt-4 inline-flex rounded-full bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-300 transition-all duration-150 hover:bg-cyan-500/20 disabled:opacity-50"
              >
                {connecting === integration.id ? 'Conectando...' : integration.actionLabel}
              </button>
            ) : integration.actionHref?.startsWith('http') ? (
              <a
                href={integration.actionHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 transition-all duration-150 hover:bg-white/[0.07] hover:text-white"
              >
                {integration.actionLabel}
              </a>
            ) : (
              <Link
                href={integration.actionHref || '/dashboard/settings'}
                className="mt-4 inline-flex rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 transition-all duration-150 hover:bg-white/[0.07] hover:text-white"
              >
                {integration.actionLabel}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
