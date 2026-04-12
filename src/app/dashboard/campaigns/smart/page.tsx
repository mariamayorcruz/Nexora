'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type ProductType = 'saas' | 'ecommerce' | 'infoproduct' | 'services' | 'app';
type PricePoint = 'low' | 'medium' | 'high';
type TargetAge = '18-24' | '25-34' | '35-44' | '45+';

type Recommendation = {
  platform: 'meta' | 'google' | 'tiktok' | 'linkedin';
  score: number;
  reasoning: string;
  suggestedBudgetSplit: number;
  expectedCpa: number;
  creativeStrategy: string;
};

type Allocation = {
  platform: 'meta' | 'google' | 'tiktok' | 'linkedin';
  dailyBudget: number;
  bidStrategy: 'lowest_cost' | 'cost_cap' | 'bid_cap';
  optimizationGoal: 'THRUPLAY' | 'LINK_CLICKS' | 'LEAD' | 'PURCHASE';
};

type AnalyzeResponse = {
  recommendations: Recommendation[];
  allocations: Allocation[];
  totalEstimatedReach: number;
};

const PLATFORM_LABEL: Record<Recommendation['platform'], string> = {
  meta: 'Meta (Facebook + Instagram)',
  google: 'Google Ads',
  tiktok: 'TikTok Ads',
  linkedin: 'LinkedIn Ads',
};

export default function SmartCampaignPage() {
  // ── IA Automation state ───────────────────────────────────────────────────
  const [iaMode, setIaMode] = useState<'auto' | 'semi'>('auto');
  const [iaProvider, setIaProvider] = useState<'claude' | 'gemini' | 'openrouter' | 'grok'>('claude');
  const [maxBudget, setMaxBudget] = useState(500);
  const [savingIaConfig, setSavingIaConfig] = useState(false);
  const [iaConfigStatus, setIaConfigStatus] = useState<string>('');

  useEffect(() => {
    const fetchIaConfig = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/automation/ia-meta', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setIaMode(data.mode || 'auto');
          setIaProvider(data.provider || 'claude');
          setMaxBudget(data.maxBudget || 500);
        }
      } catch {}
    };
    fetchIaConfig();
  }, []);

  const saveIaConfig = async () => {
    setSavingIaConfig(true);
    setIaConfigStatus('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/automation/ia-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          enabled: true,
          mode: iaMode,
          provider: iaProvider,
          maxMonthlyBudget: maxBudget,
        }),
      });
      if (res.ok) {
        setIaConfigStatus('Configuración guardada');
      } else {
        setIaConfigStatus('Error al guardar');
      }
    } catch {
      setIaConfigStatus('Error al guardar');
    } finally {
      setSavingIaConfig(false);
    }
  };

  // ── Smart Campaign state ──────────────────────────────────────────────────
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [budget, setBudget] = useState(120);
  const [productType, setProductType] = useState<ProductType>('services');
  const [pricePoint, setPricePoint] = useState<PricePoint>('medium');
  const [targetAge, setTargetAge] = useState<TargetAge>('25-34');
  const [b2b, setB2b] = useState(false);

  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [loadingLaunch, setLoadingLaunch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(null);
  const [launchResult, setLaunchResult] = useState<{
    created: Array<{ id: string; name: string; platform: string; budget: number }>;
  } | null>(null);

  const disabledAnalyze = useMemo(() => loadingAnalyze || !description.trim(), [loadingAnalyze, description]);
  const disabledLaunch = useMemo(
    () => loadingLaunch || !analyzeResult || analyzeResult.allocations.length === 0,
    [loadingLaunch, analyzeResult]
  );

  const analyze = async () => {
    setError(null);
    setLaunchResult(null);
    setLoadingAnalyze(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/campaigns/smart/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          description,
          url: website || undefined,
          budget,
          productType,
          pricePoint,
          targetAge,
          b2b,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo analizar la oportunidad.');
      }

      setAnalyzeResult(data as AnalyzeResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al analizar.');
      setAnalyzeResult(null);
    } finally {
      setLoadingAnalyze(false);
    }
  };

  const launch = async () => {
    if (!analyzeResult) return;

    setError(null);
    setLoadingLaunch(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/campaigns/smart/launch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          profileDescription: description,
          allocations: analyzeResult.allocations,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo lanzar la Smart Campaign.');
      }

      setLaunchResult(data as { created: Array<{ id: string; name: string; platform: string; budget: number }> });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al lanzar.');
    } finally {
      setLoadingLaunch(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* IA Automation Config */}
      <section className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-6 mb-8">
        <h2 className="text-xl font-bold text-cyan-300 mb-2">Automatización IA de Campañas</h2>
        <div className="flex flex-col md:flex-row gap-6 md:items-end">
          <div>
            <label className="block text-sm font-medium text-cyan-200 mb-1">Modo de automatización</label>
            <select value={iaMode} onChange={e => setIaMode(e.target.value as 'auto' | 'semi')} className="rounded-lg border border-cyan-400 bg-slate-900 px-3 py-2 text-cyan-100">
              <option value="auto">100% Automático (la IA ejecuta todo)</option>
              <option value="semi">Semiautomático (la IA sugiere, tú apruebas)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-cyan-200 mb-1">Proveedor IA</label>
            <select value={iaProvider} onChange={e => setIaProvider(e.target.value as 'claude' | 'gemini' | 'openrouter' | 'grok')} className="rounded-lg border border-cyan-400 bg-slate-900 px-3 py-2 text-cyan-100">
              <option value="claude">Claude (Anthropic)</option>
              <option value="gemini">Gemini (Google)</option>
              <option value="openrouter">OpenRouter</option>
              <option value="grok">Grok (xAI, gratuito)</option>
              <option value="all">Mejor resultado (todas las IAs)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-cyan-200 mb-1">Presupuesto mensual máximo (USD)</label>
            <input type="number" min={50} value={maxBudget} onChange={e => setMaxBudget(Number(e.target.value))} className="rounded-lg border border-cyan-400 bg-slate-900 px-3 py-2 text-cyan-100 w-32" />
          </div>
          <button onClick={saveIaConfig} disabled={savingIaConfig} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60 mt-4 md:mt-0">
            {savingIaConfig ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
        {iaConfigStatus && <p className="mt-2 text-cyan-300">{iaConfigStatus}</p>}
        <p className="mt-2 text-xs text-cyan-200">
          Puedes cambiar el modo y el proveedor IA en cualquier momento. El modo automático ejecuta cambios sin preguntar; el modo semi te permite aprobar cada acción sugerida.<br />
          Si eliges &quot;Mejor resultado (todas las IAs)&quot;, Nexora combinará las respuestas de Claude, Gemini, OpenRouter y Grok, y elegirá la mejor sugerencia automáticamente.
        </p>
      </section>

      <section className="rounded-[28px] border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Smart Dispatcher</p>
        <h1 className="mt-3 text-3xl font-semibold text-gray-900">Decide canal, divide presupuesto y crea borradores en un solo flujo.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
          Describe tu negocio y Nexora recomienda en que plataforma comenzar. Luego reparte presupuesto por rendimiento esperado y crea campanas en estado draft para ejecutar.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Descripcion de negocio</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Ej: Agencia B2B de automatizacion para clinicas esteticas con ticket promedio de $800."
              className="w-full rounded-2xl border border-gray-300 p-3 text-sm text-gray-900 focus:border-primary focus:outline-none"
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Website (opcional)</label>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://tumarca.com"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Presupuesto diario</label>
                <input
                  type="number"
                  min={20}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value) || 20)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Tipo de producto</label>
                <select
                  value={productType}
                  onChange={(e) => setProductType(e.target.value as ProductType)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none"
                >
                  <option value="services">Servicios</option>
                  <option value="saas">SaaS</option>
                  <option value="ecommerce">Ecommerce</option>
                  <option value="infoproduct">Infoproducto</option>
                  <option value="app">App</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Ticket</label>
                <select
                  value={pricePoint}
                  onChange={(e) => setPricePoint(e.target.value as PricePoint)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none"
                >
                  <option value="low">Bajo</option>
                  <option value="medium">Medio</option>
                  <option value="high">Alto</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Edad objetivo</label>
                <select
                  value={targetAge}
                  onChange={(e) => setTargetAge(e.target.value as TargetAge)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none"
                >
                  <option value="18-24">18-24</option>
                  <option value="25-34">25-34</option>
                  <option value="35-44">35-44</option>
                  <option value="45+">45+</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={b2b}
                onChange={(e) => setB2b(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Negocio B2B
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={analyze}
            disabled={disabledAnalyze}
            className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingAnalyze ? 'Analizando...' : 'Analizar Smart Campaign'}
          </button>
          <button
            onClick={launch}
            disabled={disabledLaunch}
            className="rounded-2xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingLaunch ? 'Lanzando borradores...' : 'Lanzar borradores'}
          </button>
          <Link href="/dashboard/campaigns" className="rounded-2xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
            Volver a campanas
          </Link>
        </div>

        {error ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
      </section>

      {analyzeResult ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Recomendacion de canales</h2>
            <p className="mt-1 text-sm text-gray-600">
              Alcance estimado total: {analyzeResult.totalEstimatedReach.toLocaleString('es-ES')} personas/dia
            </p>
            <div className="mt-4 space-y-3">
              {analyzeResult.recommendations.map((item) => (
                <div key={item.platform} className="rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900">{PLATFORM_LABEL[item.platform]}</p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Score {item.score}</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">{item.reasoning}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-gray-500">Estrategia creativa: {item.creativeStrategy}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Distribucion de presupuesto</h2>
            <div className="mt-4 space-y-3">
              {analyzeResult.allocations.map((item) => (
                <div key={item.platform} className="rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900">{PLATFORM_LABEL[item.platform]}</p>
                    <p className="text-sm font-semibold text-gray-900">${item.dailyBudget}/dia</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                    <span className="rounded-full bg-gray-100 px-2 py-1">{item.bidStrategy}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-1">Goal: {item.optimizationGoal}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {launchResult ? (
        <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-emerald-900">Borradores creados</h2>
          <p className="mt-1 text-sm text-emerald-800">Se generaron campanas draft en las cuentas conectadas disponibles.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {launchResult.created.map((campaign) => (
              <div key={campaign.id} className="rounded-2xl border border-emerald-200 bg-white p-4">
                <p className="text-sm font-semibold text-gray-900">{campaign.name}</p>
                <p className="mt-1 text-sm text-gray-600">{PLATFORM_LABEL[campaign.platform as Recommendation['platform']]}</p>
                <p className="mt-1 text-sm text-gray-600">${campaign.budget}/dia</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
