'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, CheckCircle2, Sparkles, Target, Waves, Workflow } from 'lucide-react';

const BUSINESS_TYPE_OPTIONS = [
  { value: 'cleaning_company', label: 'Cleaning Company', icon: Waves },
  { value: 'contractor', label: 'Contractor', icon: Workflow },
  { value: 'coach', label: 'Coach', icon: Sparkles },
  { value: 'med_spa', label: 'Med Spa', icon: CheckCircle2 },
  { value: 'real_estate', label: 'Real Estate', icon: Building2 },
  { value: 'insurance', label: 'Insurance', icon: Target },
  { value: 'agency', label: 'Agency', icon: Sparkles },
  { value: 'other_service_business', label: 'Other Service Business', icon: Building2 },
] as const;

const MAIN_GOAL_OPTIONS = [
  { value: 'get_more_leads', label: 'Get More Leads' },
  { value: 'close_more_clients', label: 'Close More Clients' },
  { value: 'automate_follow_up', label: 'Automate Follow-Up' },
] as const;

const PREFERRED_CHANNEL_OPTIONS = [
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'mixed', label: 'Mixed' },
] as const;

const BUILDING_MESSAGES = [
  'Creating your growth system...',
  'Setting up your pipeline...',
  'Preparing your follow-up templates...',
  'Creating your first lead...',
  'Personalizing your dashboard...',
] as const;

type MeResponse = {
  user?: {
    email?: string;
    name?: string | null;
    onboardingCompletedAt?: string | null;
    onboardingData?: Record<string, unknown> | null;
    isAdmin?: boolean;
    founderAccess?: boolean;
    previewOnboardingAccess?: boolean;
    subscription?: {
      status?: string | null;
    } | null;
  } | null;
};

const inputClassName =
  'w-full rounded-2xl border border-slate-600 bg-slate-800/50 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10';

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');
  const [launchReady, setLaunchReady] = useState(false);
  const [buildingStep, setBuildingStep] = useState(0);
  const [previewModeAllowed, setPreviewModeAllowed] = useState(false);
  const [previewMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('preview') === '1';
  });
  const [form, setForm] = useState({
    businessType: '',
    mainGoal: '',
    businessName: '',
    preferredChannels: ['mixed'] as string[],
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }

    const validateAccess = async () => {
      try {
        const response = await fetch('/api/users/me?allowIncomplete=1', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });

        if (!response.ok) {
          router.push('/auth/login');
          return;
        }

        const data = (await response.json()) as MeResponse;
        const status = data?.user?.subscription?.status?.toLowerCase?.() || null;
        const completed = data?.user?.onboardingCompletedAt ? null;
        const canPreview = Boolean(previewMode && data?.user?.previewOnboardingAccess);
        const onboardingData =
          data?.user?.onboardingData && typeof data.user.onboardingData === 'object' && !Array.isArray(data.user.onboardingData)
            ? data.user.onboardingData
            : null;

        setUserName(data?.user?.name || '');
        setPreviewModeAllowed(canPreview);

        if (onboardingData) {
          setForm((current) => ({
            businessType: String(onboardingData.businessType || current.businessType || ''),
            mainGoal: String(onboardingData.mainGoal || current.mainGoal || ''),
            businessName: String(onboardingData.businessName || current.businessName || ''),
            preferredChannels:
              Array.isArray(onboardingData.preferredChannels) && onboardingData.preferredChannels.length > 0
                ? onboardingData.preferredChannels.map((item) => String(item || '').toLowerCase())
                : current.preferredChannels,
          }));
        }

        if (completed && !canPreview) {
          router.push('/dashboard');
          return;
        }

        if (!canPreview && !['active', 'trialing'].includes(status || '')) {
          router.push('/dashboard/billing');
          return;
        }
      } catch (requestError) {
        console.error('Onboarding access validation failed:', requestError);
        router.push('/auth/login');
        return;
      } finally {
        setLoading(false);
      }
    };

    void validateAccess();
  }, [previewMode, router]);

  useEffect(() => {
    if (!launchReady) return;

    if (buildingStep >= BUILDING_MESSAGES.length - 1) {
      const finishTimer = window.setTimeout(() => {
        router.push('/dashboard');
      }, 900);

      return () => window.clearTimeout(finishTimer);
    }

    const timer = window.setTimeout(() => {
      setBuildingStep((current) => current + 1);
    }, 850);

    return () => window.clearTimeout(timer);
  }, [buildingStep, launchReady, router]);

  const progress = useMemo(() => {
    let completed = 0;
    if (form.businessType) completed += 1;
    if (form.mainGoal) completed += 1;
    if (form.businessName.trim()) completed += 1;
    if (form.preferredChannels.length > 0) completed += 1;
    return Math.round((completed / 4) * 100);
  }, [form]);

  const selectedBusinessType = BUSINESS_TYPE_OPTIONS.find((option) => option.value === form.businessType);
  const selectedGoal = MAIN_GOAL_OPTIONS.find((option) => option.value === form.mainGoal);
  const selectedChannelLabels = PREFERRED_CHANNEL_OPTIONS
    .filter((option) => form.preferredChannels.includes(option.value))
    .map((option) => option.label);

  const togglePreferredChannel = (channel: (typeof PREFERRED_CHANNEL_OPTIONS)[number]['value']) => {
    setForm((current) => {
      if (current.preferredChannels.includes(channel)) {
        const next = current.preferredChannels.filter((item) => item !== channel);
        return { ...current, preferredChannels: next.length > 0 ? next : ['mixed'] };
      }

      const nextChannels =
        channel === 'mixed'
          ? ['mixed']
          : current.preferredChannels.filter((item) => item !== 'mixed').concat(channel);

      return {
        ...current,
        preferredChannels: Array.from(new Set(nextChannels)),
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          ...(previewModeAllowed ? { previewMode: true } : {}),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error || 'No pudimos guardar tu onboarding.');
        return;
      }

      setBuildingStep(0);
      setLaunchReady(true);
    } catch (requestError) {
      console.error('Onboarding submit failed:', requestError);
      setError('No pudimos guardar tu onboarding. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 px-6 text-slate-200">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-400" />
          <p className="mt-4 text-sm text-slate-400">Preparing your workspace...</p>
        </div>
      </div>
    );
  }

  if (launchReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 px-4 py-10 text-slate-200 sm:px-6 lg:px-8">
        <section className="w-full max-w-xl rounded-[32px] border border-slate-700/50 bg-slate-900/80 p-8 shadow-[0_18px_60px_rgba(2,6,23,0.35)] backdrop-blur-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-300">Nexora Launch Assistant</p>
          <h1 className="mt-4 text-3xl font-bold text-white">We’re setting up your growth system</h1>
          <p className="mt-4 text-sm leading-7 text-slate-400">
            {selectedBusinessType?.label || 'Your business'} + {selectedGoal?.label || 'your goal'} is enough for Nexora to create a strong first setup.
          </p>

          <div className="mt-8 space-y-3">
            {BUILDING_MESSAGES.map((message, index) => {
              const active = index === buildingStep;
              const completed = index < buildingStep;

              return (
                <div
                  key={message}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-300 ${
                    completed
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                      : active
                        ? 'border-cyan-400/30 bg-cyan-500/10 text-white'
                        : 'border-slate-700/60 bg-slate-800/40 text-slate-500'
                  }`}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04] text-xs font-semibold">
                    {completed ? '✓' : index + 1}
                  </span>
                  <span className="text-sm">{message}</span>
                  {active ? <span className="ml-auto h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300" /> : null}
                </div>
              );
            })}
          </div>

          <div className="mt-8 rounded-[24px] bg-[#030610] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">What’s being prepared</p>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p>• Your business-ready pipeline preset</p>
              <p>• Follow-up templates matched to your offer</p>
              <p>• A sample lead so you can see the system working</p>
              <p>• A simplified first dashboard experience</p>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Preferred channels: {selectedChannelLabels.join(', ') || 'Mixed'}
            </p>
            {previewModeAllowed ? (
              <p className="mt-2 text-xs text-amber-300">Preview mode is active for this account.</p>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 px-4 py-10 text-slate-200 sm:px-6 lg:px-8">
      <section className="w-full max-w-3xl rounded-[32px] border border-slate-700/50 bg-slate-900/80 p-6 shadow-[0_18px_60px_rgba(2,6,23,0.35)] backdrop-blur-xl sm:p-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-300">Nexora Launch Assistant</p>
          <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
            Let’s build your business system
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-400">
            {userName
              ? `${userName}, answer these quick questions and Nexora will prepare your first growth system for you.`
              : 'Answer these quick questions and Nexora will prepare your first growth system for you.'}
          </p>
          {previewModeAllowed ? (
            <div className="mx-auto mt-5 max-w-2xl rounded-[22px] border border-amber-400/20 bg-amber-500/10 px-4 py-4 text-left sm:px-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300">
                Preview Mode Active
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                You&apos;re testing the onboarding experience for this demo/internal account. Submitting this flow may
                refresh demo setup data, but it won&apos;t affect billing or real customer access.
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Launch progress</p>
            <p className="text-sm font-bold text-cyan-300">{progress}%</p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-cyan-400 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-8" onSubmit={handleSubmit}>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-white">
              <Building2 className="h-4 w-4 text-cyan-300" />
              What type of business do you run?
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {BUSINESS_TYPE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = form.businessType === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, businessType: option.value }))}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left text-sm transition ${
                      active
                        ? 'border-cyan-400 bg-cyan-500/20 text-white'
                        : 'border-slate-600 bg-slate-800/50 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
                    }`}
                  >
                    <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${active ? 'bg-cyan-400/15 text-cyan-300' : 'bg-white/[0.04] text-slate-500'}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-white">
              <Target className="h-4 w-4 text-cyan-300" />
              What do you want Nexora to help with first?
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              {MAIN_GOAL_OPTIONS.map((option) => {
                const active = form.mainGoal === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, mainGoal: option.value }))}
                    className={`rounded-2xl border px-4 py-4 text-left text-sm transition ${
                      active
                        ? 'border-cyan-400 bg-cyan-500/20 text-white'
                        : 'border-slate-600 bg-slate-800/50 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-white">
              <Building2 className="h-4 w-4 text-cyan-300" />
              Business name
            </label>
            <input
              type="text"
              value={form.businessName}
              onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
              className={inputClassName}
              placeholder="Example: Mayor Excelsior"
              maxLength={120}
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-white">Preferred communication channels</label>
            <div className="flex flex-wrap gap-3">
              {PREFERRED_CHANNEL_OPTIONS.map((option) => {
                const active = form.preferredChannels.includes(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => togglePreferredChannel(option.value)}
                    className={`inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm transition ${
                      active
                        ? 'border-cyan-400 bg-cyan-500/20 text-white'
                        : 'border-slate-600 bg-slate-800/50 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
                    }`}
                  >
                    <CheckCircle2 className={`h-4 w-4 ${active ? 'text-cyan-300' : 'text-slate-500'}`} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] bg-[#030610] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">What Nexora will prepare</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                'A business-ready pipeline preset',
                'Three follow-up templates to get started',
                'One sample lead so you can see the flow live',
                'A simplified dashboard focused on your first win',
              ].map((item) => (
                <div key={item} className="rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-400">
              We’ll keep this simple and make it feel ready fast.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:brightness-110 disabled:opacity-60 sm:w-auto"
            >
              {saving ? 'Saving your setup...' : 'Build my growth system'}
              {!saving && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
