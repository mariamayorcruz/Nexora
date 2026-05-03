'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface AiTool {
  key: string;
  label: string;
  credits: number;
  description: string;
  family?: 'copy' | 'video' | 'sales';
}

interface AiJob {
  id: string;
  tool: string;
  title: string;
  prompt: string;
  channel?: string | null;
  creditsUsed: number;
  output?: {
    headline?: string;
    bullets?: string[];
    angle?: string;
    slides?: { title: string; bullets: string[] }[];
    sections?: { title: string; items: string[] }[];
    cta?: string;
    imageUrl?: string;
  } | null;
  createdAt: string;
}

interface StudioUsage {
  cycleKey: string;
  cycleStart: string;
  cycleEnd: string;
  creditsIncluded: number;
  creditsPurchased: number;
  creditsUsed: number;
  creditsRemaining: number;
  creditsTotal: number;
  supportLabel: string;
}

type Tab = 'create' | 'calendar' | 'templates' | 'history';
type Panel = 'tools' | 'text' | 'media' | 'publish';

const CHANNELS = [
  { key: 'Instagram', icon: '📸', color: '#E1306C' },
  { key: 'Facebook', icon: '👤', color: '#1877F2' },
  { key: 'TikTok', icon: '♪', color: '#010101' },
  { key: 'YouTube', icon: '▶', color: '#FF0000' },
  { key: 'WhatsApp', icon: '💬', color: '#25D366' },
  { key: 'Email', icon: '✉', color: '#6366F1' },
];

const FONTS = [
  { key: 'inter', label: 'Inter', style: 'font-sans' },
  { key: 'bold', label: 'Bold', style: 'font-sans font-bold' },
  { key: 'serif', label: 'Serif', style: 'font-serif' },
  { key: 'mono', label: 'Mono', style: 'font-mono' },
];

const OVERLAYS = [
  { key: 'none', label: 'Sin texto' },
  { key: 'headline', label: 'Headline' },
  { key: 'minimal', label: 'Minimal' },
  { key: 'bold', label: 'Bold CTA' },
];

const TEMPLATES = [
  { key: 'promo', label: 'Promoción', emoji: '🔥', desc: 'Oferta urgente con deadline' },
  { key: 'testimonial', label: 'Testimonio', emoji: '⭐', desc: 'Prueba social poderosa' },
  { key: 'educativo', label: 'Educativo', emoji: '💡', desc: 'Tip o dato de valor' },
  { key: 'producto', label: 'Producto', emoji: '📦', desc: 'Showcase de servicio' },
  { key: 'historia', label: 'Historia', emoji: '📖', desc: 'Storytelling de marca' },
  { key: 'carrusel', label: 'Carrusel', emoji: '🎠', desc: 'Secuencia de slides' },
];

const CALENDAR_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const FAMILIES = [
  { key: 'copy', label: 'Copy Lab' },
  { key: 'sales', label: 'Sales' },
] as const;

export default function DashboardStudioPage() {
  const [usage, setUsage] = useState<StudioUsage | null>(null);
  const [tools, setTools] = useState<AiTool[]>([]);
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const [activePanel, setActivePanel] = useState<Panel>('tools');
  const [activeFamily, setActiveFamily] = useState<'copy' | 'sales'>('copy');
  const [activeTool, setActiveTool] = useState('ad-copy');
  const [channel, setChannel] = useState('Instagram');
  const [offer, setOffer] = useState('');
  const [audience, setAudience] = useState('');
  const [prompt, setPrompt] = useState('');
  const [customContext, setCustomContext] = useState('');
  const [businessContext, setBusinessContext] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [activeJob, setActiveJob] = useState<AiJob | null>(null);
  const [overlayStyle, setOverlayStyle] = useState('none');
  const [activeFont, setActiveFont] = useState('inter');
  const [overlayText, setOverlayText] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [connectedChannels] = useState<string[]>([]);
  const [publishingTo, setPublishingTo] = useState<string[]>([]);
  const [calendarMonth] = useState(new Date());
  const canvasRef = useRef<HTMLDivElement>(null);

  const familyTools = useMemo(
    () => tools.filter((t) => (t.family || 'copy') === activeFamily),
    [tools, activeFamily]
  );

  const selectedTool = useMemo(
    () => tools.find((t) => t.key === activeTool) || tools[0],
    [tools, activeTool]
  );

  const fetchStudio = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/ai/studio', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsage(data.usage);
      setTools(data.tools || []);
      setJobs(data.jobs || []);
      setBusinessContext(data.businessContext ?? null);
      if (data.jobs?.length) setActiveJob(data.jobs[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchStudio(); }, []);

  useEffect(() => {
    if (familyTools.length && !familyTools.find((t) => t.key === activeTool)) {
      setActiveTool(familyTools[0].key);
    }
  }, [familyTools, activeTool]);

  const showMsg = (txt: string, err = false) => {
    setMessage(txt);
    setIsError(err);
    setTimeout(() => setMessage(''), 4000);
  };

  const applyTemplate = (key: string) => {
    setSelectedTemplate(key);
    const tpl: Record<string, { offer: string; prompt: string; audience: string }> = {
      promo: { offer: 'Oferta especial por tiempo limitado', prompt: 'Crea urgencia real. Usa countdown mental. Beneficio claro + consecuencia de no actuar.', audience: 'Clientes potenciales listos para comprar' },
      testimonial: { offer: 'Resultado transformador de cliente real', prompt: 'Antes y después poderoso. Voz del cliente. Específico con números si es posible.', audience: 'Personas con el mismo problema resuelto' },
      educativo: { offer: 'Tip de valor de tu industria', prompt: 'Un insight que nadie más comparte. Posiciónate como experto. Termina con CTA suave.', audience: 'Audiencia que quiere aprender' },
      producto: { offer: 'Servicio o producto principal', prompt: 'Muestra el resultado, no el proceso. Habla de transformación. Precio si aplica.', audience: 'Cliente ideal del negocio' },
      historia: { offer: 'Historia real del negocio o cliente', prompt: 'Arco narrativo: problema → momento de quiebre → solución → resultado. Emocional.', audience: 'Seguidores que conectan con la marca' },
      carrusel: { offer: 'Tema educativo o proceso paso a paso', prompt: 'Slide 1: hook. Slides 2-5: pasos o tips. Slide final: CTA. Cada slide independiente.', audience: 'Audiencia que quiere aprender haciendo' },
    };
    if (tpl[key]) {
      setOffer(tpl[key].offer);
      setPrompt(tpl[key].prompt);
      setAudience(tpl[key].audience);
    }
  };

  const handleGenerate = async () => {
    if (submitting) return;
    if (!offer.trim() || !prompt.trim()) {
      showMsg('Completa la oferta y el brief antes de generar.', true);
      return;
    }
    if (selectedTool && usage && usage.creditsRemaining < selectedTool.credits) {
      showMsg('Sin créditos suficientes. Sube de plan o espera al próximo ciclo.', true);
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/ai/studio', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: activeTool, offer, audience, channel, prompt, customContext, businessContext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const newJobs = [data.job, ...jobs].slice(0, 20);
      setJobs(newJobs);
      setActiveJob(data.job);
      if (data.usage) setUsage((u) => u ? { ...u, ...data.usage } : u);
      showMsg(data.reused ? 'Resultado reutilizado — sin descuento.' : '¡Asset generado! Listo para editar y publicar.');
      setActivePanel('media');
    } catch (e) {
      showMsg(e instanceof Error ? e.message : 'Error generando. Intenta de nuevo.', true);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!publishingTo.length) { showMsg('Selecciona al menos una red social para publicar.', true); return; }
    showMsg(`Publicando en ${publishingTo.join(', ')}... (Conecta tu cuenta en Ajustes → Integraciones)`);
  };

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = Array(firstDay).fill(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [calendarMonth]);

  const jobsByDay = useMemo(() => {
    const map: Record<number, AiJob[]> = {};
    jobs.forEach((j) => {
      const d = new Date(j.createdAt).getDate();
      if (!map[d]) map[d] = [];
      map[d].push(j);
    });
    return map;
  }, [jobs]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-b-cyan-400" />
          <p className="mt-3 text-sm text-slate-400">Cargando Studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#080e1a] overflow-hidden">
      {/* TOP BAR */}
      <div className="flex items-center justify-between px-4 h-12 bg-[#0c1423] border-b border-white/6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-cyan-400 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1L9.5 5.5H13L9.5 8.5L11 13L7 10L3 13L4.5 8.5L1 5.5H4.5L7 1Z" fill="#000"/></svg>
            </div>
            <span className="text-sm font-semibold text-white">Nexora Studio</span>
            <span className="text-[10px] text-cyan-400 border border-cyan-400/25 rounded-full px-2 py-0.5">Pro</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          {(['create', 'calendar', 'templates', 'history'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 h-12 text-xs font-medium border-b-2 transition ${
                activeTab === t
                  ? 'text-cyan-400 border-cyan-400'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {t === 'create' ? 'Crear' : t === 'calendar' ? 'Calendario' : t === 'templates' ? 'Plantillas' : 'Historial'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {usage && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-20 h-1.5 bg-white/8 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round((usage.creditsRemaining / usage.creditsTotal) * 100))}%` }}
                />
              </div>
              <span className="text-slate-400">{usage.creditsRemaining} créditos</span>
            </div>
          )}
          <button
            onClick={handleGenerate}
            disabled={submitting}
            className="flex items-center gap-2 bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-bold px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            {submitting ? (
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31" strokeDashoffset="10"/></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1L9.5 5.5H13L9.5 8.5L11 13L7 10L3 13L4.5 8.5L1 5.5H4.5L7 1Z" fill="currentColor"/></svg>
            )}
            {submitting ? 'Generando...' : `Generar — ${selectedTool?.credits ?? 0} créditos`}
          </button>
        </div>
      </div>

      {/* MAIN AREA */}
      {activeTab === 'create' && (
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT PANEL */}
          <div className="w-64 flex flex-col border-r border-white/6 bg-[#0c1423] flex-shrink-0 overflow-hidden">
            <div className="flex border-b border-white/6">
              {([
                { key: 'tools', icon: '◈', label: 'Tools' },
                { key: 'text', icon: 'T', label: 'Texto' },
                { key: 'media', icon: '⊡', label: 'Media' },
                { key: 'publish', icon: '↑', label: 'Publicar' },
              ] as { key: Panel; icon: string; label: string }[]).map((p) => (
                <button
                  key={p.key}
                  onClick={() => setActivePanel(p.key)}
                  className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] transition ${
                    activePanel === p.key ? 'text-cyan-400 bg-cyan-400/6' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <span className="text-base leading-none">{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {activePanel === 'tools' && (
                <>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-2">Modo</p>
                    <div className="flex gap-1">
                      {FAMILIES.map((f) => (
                        <button
                          key={f.key}
                          onClick={() => setActiveFamily(f.key)}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition ${
                            activeFamily === f.key
                              ? 'bg-cyan-400/10 border border-cyan-400/25 text-cyan-400'
                              : 'border border-white/6 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {familyTools.map((tool) => (
                      <button
                        key={tool.key}
                        onClick={() => setActiveTool(tool.key)}
                        className={`w-full text-left rounded-xl p-3 border transition ${
                          activeTool === tool.key
                            ? 'border-cyan-400/25 bg-[#080e1a]'
                            : 'border-white/5 hover:border-white/10 hover:bg-[#080e1a]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-white">{tool.label}</span>
                          {activeTool === tool.key && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                        </div>
                        <p className="text-[10px] text-slate-600 leading-relaxed">{tool.description}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{tool.credits} créditos</p>
                      </button>
                    ))}
                  </div>
                  {businessContext && (
                    <div className="rounded-xl border border-white/5 bg-[#080e1a] p-3">
                      <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-1">Negocio</p>
                      <p className="text-xs text-slate-300 font-medium">{String(businessContext.businessName || '')}</p>
                      {Array.isArray(businessContext.industries) && (
                        <p className="text-[10px] text-slate-500 mt-0.5">{(businessContext.industries as string[]).join(', ')}</p>
                      )}
                    </div>
                  )}
                </>
              )}

              {activePanel === 'text' && (
                <>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-2">Fuente</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {FONTS.map((f) => (
                        <button
                          key={f.key}
                          onClick={() => setActiveFont(f.key)}
                          className={`py-2 rounded-lg border text-xs transition ${
                            activeFont === f.key
                              ? 'border-cyan-400/25 bg-cyan-400/8 text-cyan-300'
                              : 'border-white/6 text-slate-400 hover:border-white/12'
                          } ${f.style}`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-2">Overlay</p>
                    <div className="space-y-1">
                      {OVERLAYS.map((o) => (
                        <button
                          key={o.key}
                          onClick={() => setOverlayStyle(o.key)}
                          className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition ${
                            overlayStyle === o.key
                              ? 'border-cyan-400/25 bg-cyan-400/8 text-cyan-300'
                              : 'border-white/6 text-slate-400 hover:border-white/12'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {overlayStyle !== 'none' && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-2">Texto sobre imagen</p>
                      <textarea
                        value={overlayText}
                        onChange={(e) => setOverlayText(e.target.value)}
                        rows={3}
                        placeholder="Texto que aparece en el visual..."
                        className="w-full bg-[#080e1a] border border-white/8 rounded-lg p-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-500/40 resize-none"
                      />
                    </div>
                  )}
                </>
              )}

              {activePanel === 'media' && activeJob?.output && (
                <>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-2">Output generado</p>
                    <div className="rounded-xl border border-white/5 bg-[#080e1a] p-3 space-y-2">
                      {activeJob.output.headline && (
                        <p className="text-xs font-semibold text-white leading-snug">{activeJob.output.headline}</p>
                      )}
                      {activeJob.output.cta && (
                        <p className="text-[11px] text-cyan-400">{activeJob.output.cta}</p>
                      )}
                    </div>
                  </div>
                  {activeJob.output.imageUrl && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-2">Imagen IA</p>
                      <div className="rounded-xl overflow-hidden border border-white/5">
                        <img src={activeJob.output.imageUrl} alt="Generated" className="w-full object-cover" />
                      </div>
                      <a
                        href={activeJob.output.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center justify-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition"
                      >
                        Descargar imagen →
                      </a>
                    </div>
                  )}
                </>
              )}

              {activePanel === 'publish' && (
                <>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-2">Publicar en</p>
                    <div className="space-y-1.5">
                      {CHANNELS.map((ch) => (
                        <button
                          key={ch.key}
                          onClick={() => setPublishingTo((prev) =>
                            prev.includes(ch.key) ? prev.filter((x) => x !== ch.key) : [...prev, ch.key]
                          )}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs transition ${
                            publishingTo.includes(ch.key)
                              ? 'border-cyan-400/25 bg-cyan-400/6 text-white'
                              : 'border-white/6 text-slate-400 hover:border-white/12'
                          }`}
                        >
                          <span className="text-base">{ch.icon}</span>
                          <span className="flex-1 text-left font-medium">{ch.key}</span>
                          {connectedChannels.includes(ch.key) ? (
                            <span className="text-[10px] text-emerald-400">Conectado</span>
                          ) : (
                            <span className="text-[10px] text-slate-600">Conectar</span>
                          )}
                          <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${
                            publishingTo.includes(ch.key) ? 'bg-cyan-400 border-cyan-400' : 'border-white/20'
                          }`}>
                            {publishingTo.includes(ch.key) && (
                              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4L3 6L7 2" stroke="#000" strokeWidth="1.5" strokeLinecap="round"/></svg>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handlePublish}
                    className="w-full bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-bold py-2.5 rounded-xl transition"
                  >
                    Publicar ahora
                  </button>
                  <p className="text-[10px] text-slate-600 text-center leading-relaxed">
                    Conecta tus cuentas en Ajustes → Integraciones para publicar directamente.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* CANVAS CENTRAL */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4" ref={canvasRef}>
              {message && (
                <div className={`rounded-xl px-4 py-3 text-xs border ${
                  isError
                    ? 'bg-red-500/6 border-red-500/20 text-red-400'
                    : 'bg-cyan-400/6 border-cyan-400/20 text-cyan-300'
                }`}>
                  {message}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">Oferta o servicio</p>
                    <input
                      value={offer}
                      onChange={(e) => setOffer(e.target.value)}
                      className="w-full bg-[#0d1627] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/10"
                      placeholder="¿Qué vendes exactamente?"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">Audiencia objetivo</p>
                    <input
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      className="w-full bg-[#0d1627] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/10"
                      placeholder="¿Para quién es esto?"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">Brief / idea base</p>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={4}
                      className="w-full bg-[#0d1627] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/10 resize-none"
                      placeholder="Ángulo, dolor, promesa, estilo que buscas..."
                    />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">Contexto adicional</p>
                    <input
                      value={customContext}
                      onChange={(e) => setCustomContext(e.target.value)}
                      className="w-full bg-[#0d1627] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/10"
                      placeholder="Precio, promo vigente, propuesta única..."
                    />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">Canal</p>
                    <div className="flex flex-wrap gap-2">
                      {CHANNELS.map((ch) => (
                        <button
                          key={ch.key}
                          onClick={() => setChannel(ch.key)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition ${
                            channel === ch.key
                              ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
                              : 'border-white/8 text-slate-500 hover:text-slate-300 hover:border-white/15'
                          }`}
                        >
                          <span>{ch.icon}</span>
                          {ch.key}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* PREVIEW */}
                <div className="flex flex-col gap-3">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Preview — {channel}</p>
                  <div className="bg-[#0d1627] border border-white/8 rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/6">
                      <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-slate-400">
                        {businessContext ? String(businessContext.businessName || 'N')[0] : 'N'}
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-white">{businessContext ? String(businessContext.businessName || 'Tu negocio') : 'Tu negocio'}</p>
                        <p className="text-[10px] text-slate-500">Patrocinado</p>
                      </div>
                    </div>

                    {activeJob?.output?.imageUrl ? (
                      <div className="relative">
                        <img src={activeJob.output.imageUrl} alt="preview" className="w-full aspect-square object-cover" />
                        {overlayStyle !== 'none' && overlayText && (
                          <div className={`absolute inset-0 flex items-end p-4 ${
                            overlayStyle === 'bold' ? 'bg-black/50' : 'bg-gradient-to-t from-black/60 to-transparent'
                          }`}>
                            <p className={`text-white leading-tight ${
                              overlayStyle === 'bold' ? 'text-lg font-bold' : 'text-sm font-medium'
                            } ${activeFont === 'serif' ? 'font-serif' : activeFont === 'mono' ? 'font-mono' : 'font-sans'}`}>
                              {overlayText}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="aspect-square bg-[#080e1a] flex flex-col items-center justify-center gap-3">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="3" width="18" height="18" rx="4" stroke="#334155" strokeWidth="1.5"/>
                          <circle cx="8.5" cy="8.5" r="1.5" stroke="#334155" strokeWidth="1.5"/>
                          <path d="M3 16l5-5 4 4 3-3 6 6" stroke="#334155" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <p className="text-xs text-slate-600 text-center px-6">Genera tu asset para ver el preview del post</p>
                      </div>
                    )}

                    <div className="p-3 space-y-1.5">
                      {activeJob?.output?.headline && (
                        <p className="text-xs font-semibold text-white leading-snug">{activeJob.output.headline}</p>
                      )}
                      {activeJob?.output?.angle && (
                        <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">{activeJob.output.angle}</p>
                      )}
                      {activeJob?.output?.cta && (
                        <p className="text-[11px] text-cyan-400 font-medium">{activeJob.output.cta}</p>
                      )}
                      {!activeJob && (
                        <p className="text-[11px] text-slate-600">Tu copy aparece aquí...</p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 px-3 py-2 border-t border-white/6">
                      {['♡', '💬', '↗'].map((icon) => (
                        <span key={icon} className="text-slate-500 text-sm cursor-pointer hover:text-slate-300 transition">{icon}</span>
                      ))}
                    </div>
                  </div>

                  {activeJob && (
                    <button
                      onClick={() => setActivePanel('publish')}
                      className="w-full flex items-center justify-center gap-2 bg-[#0d1627] hover:bg-[#111c30] border border-white/8 hover:border-cyan-400/25 text-xs text-slate-300 hover:text-cyan-300 py-2.5 rounded-xl transition"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M4 7l4-5 4 5M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Publicar en redes sociales
                    </button>
                  )}
                </div>
              </div>

              {activeJob?.output && (
                <div className="bg-[#0d1627] border border-white/6 rounded-2xl p-5 space-y-3">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Copy completo generado</p>
                  {activeJob.output.angle && (
                    <div className="bg-[#080e1a] rounded-xl p-4">
                      <p className="text-[10px] text-slate-500 mb-1.5">Ángulo</p>
                      <p className="text-sm text-slate-300 leading-relaxed">{activeJob.output.angle}</p>
                    </div>
                  )}
                  {activeJob.output.bullets?.length ? (
                    <div className="space-y-2">
                      {activeJob.output.bullets.map((b, i) => (
                        <div key={i} className="flex gap-3 bg-[#080e1a] rounded-xl p-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
                          <p className="text-sm text-slate-300 leading-relaxed">{b}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {activeJob.output.cta && (
                    <div className="border border-cyan-400/20 bg-cyan-400/5 rounded-xl p-3 text-center">
                      <p className="text-sm font-semibold text-cyan-300">{activeJob.output.cta}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CALENDAR TAB */}
      {activeTab === 'calendar' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                {calendarMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
              </h2>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-lg border border-white/8 text-xs text-slate-400 hover:text-slate-200 transition">← Anterior</button>
                <button className="px-3 py-1.5 rounded-lg border border-white/8 text-xs text-slate-400 hover:text-slate-200 transition">Siguiente →</button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {CALENDAR_DAYS.map((d) => (
                <div key={d} className="text-center text-[11px] text-slate-500 py-2 font-medium">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, i) => (
                <div
                  key={i}
                  className={`min-h-[80px] rounded-xl border p-2 ${
                    day
                      ? 'border-white/6 bg-[#0d1627] hover:border-white/12 cursor-pointer transition'
                      : 'border-transparent'
                  }`}
                >
                  {day && (
                    <>
                      <p className={`text-xs font-medium mb-1 ${
                        day === new Date().getDate() ? 'text-cyan-400' : 'text-slate-400'
                      }`}>{day}</p>
                      {jobsByDay[day]?.slice(0, 2).map((j) => (
                        <div key={j.id} className="text-[10px] bg-cyan-400/10 text-cyan-300 rounded px-1.5 py-0.5 mb-0.5 truncate">
                          {j.title || j.tool}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATES TAB */}
      {activeTab === 'templates' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Plantillas</p>
              <h2 className="text-lg font-semibold text-white">Elige una plantilla y genera en segundos</h2>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => { applyTemplate(t.key); setActiveTab('create'); }}
                  className={`text-left rounded-2xl border p-5 transition ${
                    selectedTemplate === t.key
                      ? 'border-cyan-400/30 bg-cyan-400/5'
                      : 'border-white/6 bg-[#0d1627] hover:border-white/12'
                  }`}
                >
                  <div className="text-3xl mb-3">{t.emoji}</div>
                  <p className="text-sm font-semibold text-white mb-1">{t.label}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{t.desc}</p>
                  <p className="mt-3 text-[11px] text-cyan-400">Usar plantilla →</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Historial</p>
              <h2 className="text-lg font-semibold text-white">{jobs.length} assets generados</h2>
            </div>
            {jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-500">
                <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-white/8 flex items-center justify-center text-2xl">✦</div>
                <p className="text-sm">Aún no has generado assets</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {jobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => { setActiveJob(job); setActiveTab('create'); }}
                    className="text-left rounded-2xl border border-white/6 bg-[#0d1627] hover:border-white/12 transition overflow-hidden"
                  >
                    {job.output?.imageUrl ? (
                      <img src={job.output.imageUrl} alt="" className="w-full aspect-video object-cover" />
                    ) : (
                      <div className="w-full aspect-video bg-[#080e1a] flex items-center justify-center text-slate-600 text-xs">Sin imagen</div>
                    )}
                    <div className="p-4">
                      <p className="text-sm font-semibold text-white mb-1 line-clamp-1">{job.title || job.tool}</p>
                      <p className="text-xs text-slate-500">{job.channel || 'Sin canal'} · {job.creditsUsed} créditos</p>
                      <p className="text-[11px] text-slate-600 mt-1">{new Date(job.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
