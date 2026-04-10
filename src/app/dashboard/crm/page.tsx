'use client';

import { useEffect, useMemo, useState } from 'react';

interface CrmLead {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source: string;
  stage: string;
  value: number;
  confidence: number;
  nextAction?: string | null;
  notes?: string | null;
  lastContactedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CrmSettings {
  emailAutomationEnabled: boolean;
  whatsappEnabled: boolean;
  phoneEnabled: boolean;
  externalCrmEnabled: boolean;
  externalCrmName?: string | null;
  autoFollowUpEnabled: boolean;
  defaultCadence: string;
}

const STAGES = [
  { key: 'lead', label: 'Lead' },
  { key: 'contacted', label: 'Contactado' },
  { key: 'qualified', label: 'Calificado' },
  { key: 'proposal', label: 'Propuesta' },
  { key: 'won', label: 'Cerrado' },
] as const;

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  company: '',
  source: 'manual',
  stage: 'lead',
  value: 0,
  confidence: 25,
  nextAction: '',
  notes: '',
};

const DEFAULT_SETTINGS: CrmSettings = {
  emailAutomationEnabled: true,
  whatsappEnabled: false,
  phoneEnabled: false,
  externalCrmEnabled: false,
  externalCrmName: '',
  autoFollowUpEnabled: true,
  defaultCadence: '48h',
};

export default function DashboardCrmPage() {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [settings, setSettings] = useState<CrmSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchCrm = async () => {
    try {
      const token = localStorage.getItem('token');
      const [leadsResponse, settingsResponse] = await Promise.all([
        fetch('/api/crm/leads', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }),
        fetch('/api/crm/settings', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }),
      ]);

      const leadsData = await leadsResponse.json();
      const settingsData = await settingsResponse.json();
      setLeads(leadsData.leads || []);
      setSettings(settingsData.settings || DEFAULT_SETTINGS);
    } catch (error) {
      console.error('Error fetching CRM data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCrm();
  }, []);

  const metrics = useMemo(() => {
    const totalPipeline = leads.filter((lead) => lead.stage !== 'won').reduce((sum, lead) => sum + lead.value, 0);
    const forecast = leads.reduce((sum, lead) => sum + lead.value * (lead.confidence / 100), 0);
    const wonRevenue = leads.filter((lead) => lead.stage === 'won').reduce((sum, lead) => sum + lead.value, 0);
    const nextActions = leads.filter((lead) => lead.stage !== 'won' && lead.nextAction).length;
    const outreachReady = leads.filter(
      (lead) => lead.stage !== 'won' && ((settings.emailAutomationEnabled && lead.email) || (settings.whatsappEnabled && lead.phone))
    );

    const byStage = STAGES.map((stage) => ({
      ...stage,
      items: leads.filter((lead) => lead.stage === stage.key),
    }));

    return {
      totalPipeline,
      forecast,
      wonRevenue,
      nextActions,
      outreachReady,
      byStage,
    };
  }, [leads, settings]);

  const createLead = async () => {
    setSaving(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo crear el contacto.');
      }

      setForm(EMPTY_FORM);
      setMessage('Contacto agregado al CRM.');
      await fetchCrm();
    } catch (error) {
      console.error('Error creating CRM lead:', error);
      setMessage(error instanceof Error ? error.message : 'No se pudo crear el contacto.');
    } finally {
      setSaving(false);
    }
  };

  const moveLead = async (lead: CrmLead, stage: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/crm/leads/${lead.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stage,
          lastContactedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('No se pudo mover el contacto.');
      }

      await fetchCrm();
    } catch (error) {
      console.error('Error moving CRM lead:', error);
      setMessage('No pudimos actualizar el contacto.');
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/crm/settings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo guardar la configuración del CRM.');
      }

      setSettings(data.settings || settings);
      setMessage('Automatización comercial guardada.');
    } catch (error) {
      console.error('Error saving CRM settings:', error);
      setMessage(error instanceof Error ? error.message : 'No pudimos guardar la configuración.');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-b-primary" />
          <p className="mt-4 text-gray-600">Cargando CRM...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[34px] bg-[linear-gradient(135deg,#0f172a_0%,#111827_52%,#7c3aed_100%)] px-8 py-9 text-white shadow-[0_30px_100px_rgba(15,23,42,0.18)]">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-violet-200">CRM comercial</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight">Tus contactos, oportunidades y cierres en un solo lugar.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Nexora conecta campañas, funnel, CRM y seguimiento comercial para que tus clientes puedan vender
              cualquier servicio con más control, mejor visibilidad y una operación más elegante.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-300">Pipeline abierto</p>
              <p className="mt-3 text-4xl font-semibold">${metrics.totalPipeline.toLocaleString()}</p>
            </div>
            <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-300">Forecast</p>
              <p className="mt-3 text-4xl font-semibold">${metrics.forecast.toLocaleString()}</p>
            </div>
            <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-300">Ganado</p>
              <p className="mt-3 text-4xl font-semibold">${metrics.wonRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">{message}</div>
      )}

      <section className="grid gap-5 md:grid-cols-3">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Seguimientos listos</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{metrics.outreachReady.length}</p>
          <p className="mt-2 text-sm text-slate-500">Contactos que ya pueden recibir una acción comercial.</p>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Próximas acciones</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{metrics.nextActions}</p>
          <p className="mt-2 text-sm text-slate-500">Oportunidades con siguiente paso definido.</p>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cadencia base</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{settings.defaultCadence}</p>
          <p className="mt-2 text-sm text-slate-500">Ritmo sugerido para seguimiento comercial.</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Orquestación comercial</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Canales y sincronización</h2>

          <div className="mt-6 space-y-4">
            {[
              {
                key: 'emailAutomationEnabled',
                label: 'Seguimiento por email',
                help: 'Usa emails para retomar leads, enviar propuestas y reforzar el cierre.',
              },
              {
                key: 'whatsappEnabled',
                label: 'WhatsApp opcional',
                help: 'Activa contacto por WhatsApp cuando el cliente lo permita.',
              },
              {
                key: 'phoneEnabled',
                label: 'Llamadas o telefonía',
                help: 'Prepara seguimiento telefónico para oportunidades calientes.',
              },
              {
                key: 'autoFollowUpEnabled',
                label: 'Automatización de seguimiento',
                help: 'Marca contactos listos para la siguiente acción sin esperar trabajo manual.',
              },
              {
                key: 'externalCrmEnabled',
                label: 'Sincronización con CRM externo',
                help: 'Prepara la conexión futura con HubSpot, Pipedrive o tu stack comercial.',
              },
            ].map((toggle) => (
              <label key={toggle.key} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 p-4">
                <div>
                  <p className="font-semibold text-slate-900">{toggle.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{toggle.help}</p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings[toggle.key as keyof CrmSettings])}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      [toggle.key]: event.target.checked,
                    }))
                  }
                  className="mt-1 h-5 w-5"
                />
              </label>
            ))}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">CRM externo</span>
                <input
                  value={settings.externalCrmName || ''}
                  onChange={(event) => setSettings((current) => ({ ...current, externalCrmName: event.target.value }))}
                  className="input-field"
                  placeholder="HubSpot, Pipedrive, Salesforce..."
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Cadencia base</span>
                <input
                  value={settings.defaultCadence}
                  onChange={(event) => setSettings((current) => ({ ...current, defaultCadence: event.target.value }))}
                  className="input-field"
                  placeholder="24h, 48h, semanal..."
                />
              </label>
            </div>
          </div>

          <button onClick={saveSettings} disabled={savingSettings} className="mt-6 btn-primary">
            {savingSettings ? 'Guardando...' : 'Guardar automatización'}
          </button>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Cola comercial</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Contactos listos para siguiente paso</h2>

          <div className="mt-6 space-y-4">
            {metrics.outreachReady.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
                Aún no hay contactos listos para orquestación. Agrega leads con email o teléfono y define su siguiente acción.
              </div>
            ) : (
              metrics.outreachReady.slice(0, 6).map((lead) => (
                <article key={lead.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{lead.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {lead.company || 'Sin empresa'} · {lead.source}
                      </p>
                    </div>
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
                      {lead.stage}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Valor</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">${lead.value.toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Canal ideal</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">
                        {settings.whatsappEnabled && lead.phone
                          ? 'WhatsApp'
                          : settings.emailAutomationEnabled && lead.email
                            ? 'Email'
                            : settings.phoneEnabled && lead.phone
                              ? 'Llamada'
                              : 'Manual'}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Siguiente acción</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{lead.nextAction || 'Definir seguimiento'}</p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Nuevo contacto</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Agregar oportunidad al CRM</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-700">Nombre</span>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="input-field" placeholder="Nombre del contacto" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
              <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="input-field" placeholder="correo@empresa.com" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Teléfono</span>
              <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="input-field" placeholder="+1..." />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Empresa</span>
              <input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} className="input-field" placeholder="Empresa o marca" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Fuente</span>
              <input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} className="input-field" placeholder="Meta, Google, referido..." />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Valor estimado</span>
              <input type="number" min={0} value={form.value} onChange={(event) => setForm({ ...form, value: Number(event.target.value || 0) })} className="input-field" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Confianza %</span>
              <input type="number" min={0} max={100} value={form.confidence} onChange={(event) => setForm({ ...form, confidence: Number(event.target.value || 0) })} className="input-field" />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-700">Siguiente acción</span>
              <input value={form.nextAction} onChange={(event) => setForm({ ...form, nextAction: event.target.value })} className="input-field" placeholder="Llamar mañana, enviar propuesta, agendar demo..." />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-700">Notas</span>
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="input-field min-h-[120px]" placeholder="Resumen del contacto, objeciones y oportunidad" />
            </label>
          </div>

          <button onClick={createLead} disabled={saving} className="mt-6 btn-primary">
            {saving ? 'Guardando...' : 'Guardar en CRM'}
          </button>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Pipeline</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Mover oportunidades por etapa</h2>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {metrics.byStage.map((stage) => (
              <div key={stage.key} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-900">{stage.label}</h3>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{stage.items.length}</span>
                </div>

                <div className="mt-4 space-y-3">
                  {stage.items.length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Sin oportunidades en esta etapa.</div>
                  ) : (
                    stage.items.map((lead) => (
                      <article key={lead.id} className="rounded-2xl bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-900">{lead.name}</p>
                            <p className="text-sm text-slate-500">{lead.company || 'Sin empresa'} · {lead.source}</p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">${lead.value.toLocaleString()}</span>
                        </div>

                        <p className="mt-3 text-sm text-slate-600">
                          Confianza {lead.confidence}% {lead.nextAction ? `· ${lead.nextAction}` : ''}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {STAGES.filter((option) => option.key !== lead.stage).map((option) => (
                            <button
                              key={option.key}
                              onClick={() => moveLead(lead, option.key)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                            >
                              Mover a {option.label}
                            </button>
                          ))}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Base de contactos</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Todos los leads visibles</h2>

        <div className="mt-6 space-y-3">
          {leads.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
              Todavía no hay contactos guardados en este CRM.
            </div>
          ) : (
            leads.map((lead) => (
              <article key={lead.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{lead.name || 'Contacto sin nombre'}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {lead.company || 'Sin empresa'} · {lead.source} · etapa {lead.stage}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">${lead.value.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">Confianza {lead.confidence}%</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                    <span className="block text-xs uppercase tracking-[0.18em] text-slate-400">Email</span>
                    {lead.email || 'Sin email'}
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                    <span className="block text-xs uppercase tracking-[0.18em] text-slate-400">Teléfono</span>
                    {lead.phone || 'Sin teléfono'}
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                    <span className="block text-xs uppercase tracking-[0.18em] text-slate-400">Siguiente acción</span>
                    {lead.nextAction || 'Sin definir'}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
