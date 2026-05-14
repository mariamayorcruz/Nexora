'use client';

import { ImageIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import CampaignOutput from '@/components/CampaignOutput';
import { useAppLanguage } from '@/hooks/use-app-language';

type AiTool = {
  key: string;
  label: string;
  credits: number;
};

type AiJob = {
  id: string;
  title: string;
  channel?: string | null;
  creditsUsed: number;
  output?: {
    headline?: string;
    bullets?: string[];
    angle?: string;
    cta?: string;
    imageUrl?: string;
  } | null;
};

type StudioUsage = {
  creditsRemaining: number;
  creditsTotal: number;
};

const CHANNELS = ['Instagram', 'WhatsApp', 'Facebook', 'SMS', 'Email', 'TikTok'];
const VISUAL_STYLES = ['Corporativo', 'Premium', 'Cercano', 'Urgente'];

function stripCampaignAssemblyText(value: string) {
  return value
    .replace(/Â·/g, '·')
    .replace(/â€"/g, '—')
    .replace(/✨/g, '')
    .replace(/Campaign Assembly Engine\s*[·-]\s*Premium\s*✨?/gi, '')
    .replace(/Campaign Assembly Engine\s*[·-]\s*\w+\s*✨?/gi, '')
    .replace(/Campaign Assembly Engine[^.]*\./gi, '')
    .replace(/Campaign Assembly Engine/gi, '')
    .trim();
}

export default function DashboardStudioPage() {
  const { language } = useAppLanguage();
  const createPanelRef = useRef<HTMLDivElement | null>(null);
  const outputPanelRef = useRef<HTMLDivElement | null>(null);
  const [usage, setUsage] = useState<StudioUsage | null>(null);
  const [tools, setTools] = useState<AiTool[]>([]);
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [goal, setGoal] = useState('');
  const [audience, setAudience] = useState('');
  const [offer, setOffer] = useState('');
  const [channels, setChannels] = useState<string[]>(['Instagram', 'WhatsApp']);
  const [style, setStyle] = useState('Premium');
  const [activeJob, setActiveJob] = useState<AiJob | null>(null);
  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    void fetch('/api/ai/studio', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((data) => {
        setUsage(data.usage || null);
        setTools(Array.isArray(data.tools) ? data.tools : []);
        setJobs(Array.isArray(data.jobs) ? data.jobs : []);
        if (data.jobs?.length) setActiveJob(data.jobs[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedTool = tools.find((tool) => tool.key === 'ad-copy') || tools[0];

  const hooks = useMemo(() => {
    const bullets = activeJob?.output?.bullets || [];
    return bullets
      .filter((item) => /^HOOK [ABC]/i.test(item))
      .map((item) =>
        item
          .replace(/^HOOK [ABC]\s*[—\-]+\s*/i, '')
          .replace(/^HOOK [ABC]\s*/i, '')
          .trim()
      )
      .slice(0, 3);
  }, [activeJob]);

  const channelCards = useMemo(() => {
    const pendingCta = language === 'en' ? 'CTA pending' : 'CTA pendiente';
    const bullets = activeJob?.output?.bullets || [];
    const findBullet = (prefix: string) => {
      const found = bullets.find((item) => item.toUpperCase().startsWith(prefix.toUpperCase()));
      if (!found) return null;
      return found
        .replace(new RegExp(`^${prefix}\\s*[—\\-]+\\s*`, 'i'), '')
        .replace(new RegExp(`^${prefix}\\s*`, 'i'), '')
        .replace(/Â·/g, '·')
        .replace(/✨/g, '')
        .replace(/Campaign Assembly Engine[^.]*\./gi, '')
        .trim();
    };

    return [
      {
        key: 'instagram',
        label: 'Instagram',
        color: '#E1306C',
        copy: findBullet('COPY INSTAGRAM') || stripCampaignAssemblyText(activeJob?.output?.headline || ''),
        cta: activeJob?.output?.cta || pendingCta,
      },
      {
        key: 'whatsapp',
        label: 'WhatsApp',
        color: '#25D366',
        copy: findBullet('COPY WHATSAPP') || stripCampaignAssemblyText(activeJob?.output?.angle || ''),
        cta: activeJob?.output?.cta || pendingCta,
      },
      {
        key: 'facebook',
        label: 'Facebook',
        color: '#1877F2',
        copy: findBullet('COPY FACEBOOK') || stripCampaignAssemblyText(activeJob?.output?.headline || ''),
        cta: activeJob?.output?.cta || pendingCta,
      },
      {
        key: 'email',
        label: 'Email',
        color: '#818cf8',
        copy: findBullet('COPY EMAIL') || stripCampaignAssemblyText(activeJob?.output?.angle || ''),
        cta: activeJob?.output?.cta || pendingCta,
      },
    ];
  }, [activeJob, language]);
  const studioCommandCenter = useMemo(() => {
    const en = language === 'en';

    if (activeJob) {
      return {
        eyebrow: en ? 'Studio Command Center' : 'Centro de comando Studio',
        title: en ? 'Your Studio run is live' : 'Tu ejecución en Studio está activa',
        detail: en
          ? 'Refine hooks and channel copy before you publish.'
          : 'Ajusta hooks y copy por canal antes de publicar.',
        bullets: en
          ? ['Check the generated visual and headline', 'Tune hooks for each channel']
          : ['Revisa el visual y el titular generados', 'Ajusta los hooks por canal'],
        accent: 'text-cyan-300',
        helper: en ? 'Output continues in the panel below.' : 'El resultado continúa en el panel inferior.',
      };
    }

    if ((jobs?.length || 0) > 0) {
      return {
        eyebrow: en ? 'Studio Command Center' : 'Centro de comando Studio',
        title: en ? 'Recent assets are ready' : 'Hay assets recientes listos',
        detail: en ? 'Revisit a run when you want sharper messaging.' : 'Vuelve a una ejecución cuando quieras afilar el mensaje.',
        bullets: en ? ['Open your latest campaign below', 'Refresh copy where it matters'] : ['Abre tu última campaña abajo', 'Renueva el copy donde importe'],
        accent: 'text-violet-300',
        helper: en ? 'Scroll to review or regenerate below.' : 'Desplázate para revisar o regenerar abajo.',
      };
    }

    return {
      eyebrow: en ? 'Growth Studio' : 'Studio de crecimiento',
      title: en ? 'Studio is ready' : 'Studio listo',
      detail: en ? 'Shape assets your pipeline can reuse.' : 'Crea assets que tu pipeline pueda reutilizar.',
      bullets: en ? ['Define objective and audience', 'Generate once, refine channel by channel'] : ['Define objetivo y audiencia', 'Genera una vez y refina por canal'],
      accent: 'text-cyan-300',
      helper: en ? 'Start from the brief on the left.' : 'Empieza por el brief del panel izquierdo.',
    };
  }, [activeJob, jobs, language]);

  const generateCampaign = async () => {
    if (!goal.trim() || !audience.trim() || !offer.trim()) {
      setMessage(language === 'en' ? 'Complete objective, audience and offer.' : 'Completa objetivo, audiencia y oferta.');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ai/studio', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: selectedTool?.key || 'ad-copy',
          offer,
          audience,
          channel: channels[0] || 'Instagram',
          prompt: `${goal}\nCanales: ${channels.join(', ')}\nEstilo visual: ${style}`,
          customContext: `Campaign Assembly Engine · ${style}`,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo generar la campaña.');
      const nextJobs = [data.job, ...jobs].slice(0, 20);
      setJobs(nextJobs);
      setActiveJob(data.job);
      setSelectedHook(null);
      if (data.usage) setUsage((current) => (current ? { ...current, ...data.usage } : data.usage));
      setMessage(language === 'en' ? 'Campaign generated.' : 'Campaña generada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const regenerateCampaign = async () => {
    if (!goal.trim() || !audience.trim() || !offer.trim()) return;
    await generateCampaign();
  };

  const publishAll = async () => {
    if (!activeJob) return;
    const token = localStorage.getItem('token');
    const caption = [activeJob.output?.headline, activeJob.output?.angle, activeJob.output?.cta].filter(Boolean).join('\n\n');
    const response = await fetch('/api/ai/studio/publish', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        platforms: channels,
        caption,
        imageUrl: activeJob.output?.imageUrl,
        jobId: activeJob.id,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(data.message || (language === 'en' ? 'Publish request sent.' : 'Solicitud de publicación enviada.'));
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-b-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#040810] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className={`text-[11px] uppercase tracking-[0.2em] ${studioCommandCenter.accent}`}>
              {studioCommandCenter.eyebrow}
            </p>
            <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.03em] text-white sm:text-[28px]">
              {studioCommandCenter.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">{studioCommandCenter.detail}</p>
            <p className="mt-4 text-xs text-slate-500">{studioCommandCenter.helper}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:max-w-[460px]">
            {studioCommandCenter.bullets.map((item) => (
              <div key={item} className="rounded-[20px] bg-[#030610] px-4 py-3 text-sm text-slate-300">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] bg-[#040810] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">✦ Campaign Assembly Engine</p>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[32px] xl:text-[34px]">
              {language === 'en'
                ? 'AI Studio for campaigns ready to launch'
                : 'Studio IA para campañas listas para lanzar'}
            </h1>
          </div>
          <div className="min-w-[220px]">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span>{language === 'en' ? 'Credits' : 'Créditos'}</span>
              <span>
                {usage?.creditsRemaining || 0}/{usage?.creditsTotal || 0}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.04]">
              <div
                className="h-2 rounded-full bg-cyan-500"
                style={{
                  width: `${Math.min(100, Math.round(((usage?.creditsRemaining || 0) / Math.max(1, usage?.creditsTotal || 1)) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {message ? <div className="rounded-2xl bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">{message}</div> : null}

      <div className="flex flex-col gap-5 xl:flex-row">
        <div ref={createPanelRef} className="w-full shrink-0 rounded-[24px] bg-[#040810] p-4 xl:w-[260px]">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            ✦ {language === 'en' ? 'Campaign objective' : 'Objetivo de campaña'}
          </p>
          <div className="mt-4 space-y-3">
            <input
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder={language === 'en' ? 'What do you want to achieve?' : '¿Qué quieres lograr?'}
              className="w-full rounded-2xl bg-[#030610] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
            />
            <input
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              placeholder={language === 'en' ? 'Target audience' : 'Audiencia objetivo'}
              className="w-full rounded-2xl bg-[#030610] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
            />
            <textarea
              value={offer}
              onChange={(event) => setOffer(event.target.value)}
              placeholder={language === 'en' ? 'Offer or differentiator' : 'Oferta o diferenciador'}
              className="min-h-[110px] w-full resize-none rounded-2xl bg-[#030610] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
            />
          </div>

          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              {language === 'en' ? 'Publishing channels' : 'Canales de publicación'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CHANNELS.map((channel) => (
                <button
                  key={channel}
                  type="button"
                  onClick={() =>
                    setChannels((current) =>
                      current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]
                    )
                  }
                  className={`rounded-full px-3 py-1.5 text-xs transition-all duration-150 ${
                    channels.includes(channel) ? 'bg-cyan-500/10 text-cyan-300' : 'bg-[#030610] text-slate-500 hover:text-white'
                  }`}
                >
                  {channel}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              {language === 'en' ? 'Visual style' : 'Estilo visual'}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {VISUAL_STYLES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStyle(item)}
                  className={`rounded-[18px] px-3 py-4 text-left text-sm transition-all duration-150 ${
                    style === item ? 'bg-cyan-500/10 text-cyan-300' : 'bg-[#030610] text-slate-400 hover:text-white'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void generateCampaign()}
            disabled={submitting}
            className="mt-5 w-full rounded-[20px] bg-cyan-500 px-4 py-3 text-sm font-semibold text-[#041018] transition-all duration-150 hover:-translate-y-[1px] hover:bg-cyan-400 disabled:opacity-50"
          >
            ✦{' '}
            {submitting
              ? language === 'en'
                ? 'Generating...'
                : 'Generando...'
              : language === 'en'
                ? 'Generate full campaign'
                : 'Generar campaña completa'}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-500">
            {language === 'en'
              ? `Image + copy + ${channels.length} channels`
              : `Imagen + copy + ${channels.length} canales`}
          </p>
        </div>

        {activeJob ? (
          <div ref={outputPanelRef} className="flex flex-1">
          <CampaignOutput
            title={activeJob.title || goal || (language === 'en' ? 'New campaign' : 'Campaña nueva')}
            status={language === 'en' ? 'Ready to publish' : 'Lista para publicar'}
            creditsUsed={activeJob.creditsUsed}
            imageUrl={activeJob.output?.imageUrl}
            headline={selectedHook || activeJob.output?.headline}
            hooks={
              hooks.length
                ? hooks
                : activeJob.output?.bullets?.slice(0, 3) ||
                  (language === 'en'
                    ? ['Hook A pending', 'Hook B pending', 'Hook C pending']
                    : ['Hook A pendiente', 'Hook B pendiente', 'Hook C pendiente'])
            }
            channels={channelCards}
            selectedHook={selectedHook}
            onSelectHook={setSelectedHook}
            onPublish={() => void publishAll()}
            onRegenerate={() => void regenerateCampaign()}
          />
          </div>
        ) : (
          <div ref={outputPanelRef} className="flex min-h-[520px] flex-1 items-center justify-center rounded-[24px] bg-[#040810] p-6">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
                <ImageIcon className="h-6 w-6" />
              </div>
              <p className="mt-4 text-white">
                {language === 'en' ? 'No campaign generated yet.' : 'Todavía no hay campaña generada.'}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {language === 'en'
                  ? 'Complete the brief on the left and generate your first campaign.'
                  : 'Completa el panel izquierdo y lanza tu primera campaña.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
