'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAppLanguage } from '@/hooks/use-app-language';

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
  const { language } = useAppLanguage();
  const en = language === 'en';
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    void fetch('/api/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setIsAdmin(Boolean(data?.user?.isAdmin));
      })
      .catch(() => {});
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
      if (!response.ok) throw new Error(data.error || 'Error iniciando OAuth');
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('OAuth error:', error);
      setConnecting(null);
    }
  };

  const clientIntegrations: Integration[] = [
    {
      id: 'instagram',
      label: 'Instagram',
      description: en ? 'Publish AI-generated content directly to Instagram.' : 'Publica contenido generado con IA directamente en Instagram.',
      status: connectedAccounts.includes('instagram') ? 'active' : 'disconnected',
      statusLabel: connectedAccounts.includes('instagram') ? '● Conectado' : 'No conectado',
      detail: connectedAccounts.includes('instagram')
        ? en ? 'Instagram Business connected. Publish campaigns from Studio IA.' : 'Instagram Business conectado. Publica campañas desde Studio IA.'
        : en ? 'Connect your Instagram Business account to publish campaigns.' : 'Conecta tu cuenta de Instagram Business para publicar campañas.',
      actionLabel: connectedAccounts.includes('instagram') ? (en ? 'Reconnect' : 'Reconectar') : (en ? 'Connect →' : 'Conectar →'),
      onConnect: () => handleConnect('instagram'),
      color: connectedAccounts.includes('instagram') ? 'text-emerald-400' : 'text-slate-500',
    },
    {
      id: 'facebook',
      label: 'Facebook Ads',
      description: en ? 'Manage and publish ads directly from Nexora.' : 'Gestiona y publica anuncios directamente desde Nexora.',
      status: connectedAccounts.includes('facebook') ? 'active' : 'disconnected',
      statusLabel: connectedAccounts.includes('facebook') ? '● Conectado' : 'No conectado',
      detail: connectedAccounts.includes('facebook')
        ? en ? 'Facebook Ads connected. Manage campaigns from Nexora.' : 'Facebook Ads conectado. Gestiona campañas desde Nexora.'
        : en ? 'Connect your Facebook Business account.' : 'Conecta tu cuenta de Facebook Business.',
      actionLabel: connectedAccounts.includes('facebook') ? (en ? 'Reconnect' : 'Reconectar') : (en ? 'Connect →' : 'Conectar →'),
      onConnect: () => handleConnect('facebook'),
      color: connectedAccounts.includes('facebook') ? 'text-emerald-400' : 'text-slate-500',
    },
    {
      id: 'google',
      label: 'Google Ads',
      description: en ? 'Connect Google Ads to manage campaigns from Nexora.' : 'Conecta Google Ads para gestionar campañas desde Nexora.',
      status: connectedAccounts.includes('google') ? 'active' : 'disconnected',
      statusLabel: connectedAccounts.includes('google') ? '● Conectado' : 'Próximamente',
      detail: en ? 'Google Ads integration coming soon.' : 'Integración con Google Ads próximamente.',
      actionLabel: en ? 'Coming soon' : 'Próximamente',
      color: 'text-slate-500',
    },
    {
      id: 'tiktok',
      label: 'TikTok Ads',
      description: en ? 'Connect TikTok Ads to reach younger audiences.' : 'Conecta TikTok Ads para llegar a audiencias más jóvenes.',
      status: 'disconnected',
      statusLabel: en ? 'Coming soon' : 'Próximamente',
      detail: en ? 'TikTok Ads integration coming soon.' : 'Integración con TikTok Ads próximamente.',
      actionLabel: en ? 'Coming soon' : 'Próximamente',
      color: 'text-slate-500',
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp Business',
      description: en ? 'Send and receive WhatsApp messages with your leads.' : 'Envía y recibe mensajes de WhatsApp con tus leads.',
      status: 'pending',
      statusLabel: `⏳ ${en ? 'Pending verification' : 'Verificación pendiente'}`,
      detail: en ? 'WhatsApp Business verification in progress.' : 'Verificación de WhatsApp Business en progreso.',
      actionLabel: en ? 'Learn more' : 'Más información',
      actionHref: 'https://business.facebook.com',
      color: 'text-amber-400',
    },
    {
      id: 'sms',
      label: 'SMS',
      description: en ? 'Send automated SMS messages to your leads.' : 'Envía mensajes SMS automáticos a tus leads.',
      status: 'pending',
      statusLabel: `⏳ ${en ? 'Pending approval' : 'Aprobación pendiente'}`,
      detail: en ? 'SMS campaign approval in progress.' : 'Aprobación de campaña SMS en progreso.',
      actionLabel: en ? 'Learn more' : 'Más información',
      actionHref: 'https://console.twilio.com',
      color: 'text-amber-400',
    },
  ];

  const adminIntegrations: Integration[] = [
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

  const allIntegrations = isAdmin
    ? [...clientIntegrations, ...adminIntegrations]
    : clientIntegrations;

  const statusOrder = { active: 0, pending: 1, error: 2, disconnected: 3 };
  const sorted = [...allIntegrations].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  if (!mounted) return null;

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#040810] px-6 py-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">✦ {en ? 'Integrations' : 'Integraciones'}</p>
        <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[32px]">
          {en ? 'Connected channels and services' : 'Canales y servicios conectados'}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          {en
            ? 'Real-time status of your marketing, messaging and platform integrations.'
            : 'Estado en tiempo real de tus integraciones de marketing, mensajería y plataforma.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {[
            { label: en ? 'Active' : 'Activos', count: allIntegrations.filter((integration) => integration.status === 'active').length, color: 'text-emerald-400 bg-emerald-500/8 border-emerald-500/15' },
            { label: en ? 'Pending' : 'Pendientes', count: allIntegrations.filter((integration) => integration.status === 'pending').length, color: 'text-amber-400 bg-amber-500/8 border-amber-500/15' },
            { label: en ? 'Disconnected' : 'Sin conectar', count: allIntegrations.filter((integration) => integration.status === 'disconnected').length, color: 'text-slate-400 bg-white/4 border-white/8' },
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
                  {en ? 'View in Meta →' : 'Ver en Meta →'}
                </a>
                <button
                  type="button"
                  onClick={integration.onConnect}
                  className="inline-flex rounded-full bg-white/[0.02] px-3 py-1.5 text-xs text-slate-500 transition hover:text-white"
                >
                  {en ? 'Reconnect' : 'Reconectar'}
                </button>
              </div>
            ) : integration.onConnect ? (
              <button
                type="button"
                onClick={integration.onConnect}
                disabled={connecting === integration.id}
                className="mt-4 inline-flex rounded-full bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-300 transition-all duration-150 hover:bg-cyan-500/20 disabled:opacity-50"
              >
                {connecting === integration.id ? (en ? 'Connecting...' : 'Conectando...') : integration.actionLabel}
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
