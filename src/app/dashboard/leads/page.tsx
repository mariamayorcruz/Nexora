'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type CampaignOption = { id: string; name: string };

type LeadRow = {
  id: string;
  name: string;
  email: string | null;
  createdAt: string;
  campaign: CampaignOption | null;
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);

  const loadLeads = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/auth/login';
      return;
    }

    const res = await fetch('/api/leads', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      window.location.href = '/auth/login';
      return;
    }

    let data: {
      leads?: Array<LeadRow & { campaign?: CampaignOption | null }>;
      error?: string;
    } = {};
    try {
      data = await res.json();
    } catch {
      throw new Error('Respuesta inválida del servidor');
    }

    if (!res.ok) {
      throw new Error(data.error || 'Error al cargar');
    }

    const raw = Array.isArray(data.leads) ? data.leads : [];
    setLeads(
      raw
        .map((l) => {
          const created =
            typeof l.createdAt === 'string'
              ? l.createdAt
              : l.createdAt != null
                ? new Date(l.createdAt as string | number | Date).toISOString()
                : new Date().toISOString();
          const c = l.campaign && typeof l.campaign === 'object' && l.campaign.id ? l.campaign : null;
          return {
            id: String(l.id ?? ''),
            name: l.name != null ? String(l.name) : '',
            email: l.email != null ? String(l.email) : null,
            createdAt: created,
            campaign: c ? { id: String(c.id), name: String(c.name || '') } : null,
          };
        })
        .filter((l) => Boolean(l.id))
    );
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/auth/login';
      return;
    }

    void (async () => {
      try {
        const meRes = await fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
        if (meRes.ok) {
          const me = await meRes.json();
          const list = Array.isArray(me.campaigns)
            ? me.campaigns.map((c: { id?: string; name?: string }) => ({
                id: String(c.id ?? ''),
                name: String(c.name ?? 'Sin nombre'),
              }))
            : [];
          setCampaigns(list.filter((c: CampaignOption) => Boolean(c.id)));
        }
        await loadLeads();
      } catch {
        setError('No se pudieron cargar los leads');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadLeads]);

  useEffect(() => {
    if (!loading && leads.length > 0) {
      setShowForm(true);
    }
  }, [loading, leads.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const token = localStorage.getItem('token');
    if (!token) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          ...(campaignId.trim() ? { campaignId: campaignId.trim() } : {}),
        }),
      });

      if (res.status === 401) {
        window.location.href = '/auth/login';
        return;
      }

      let data: { error?: string } = {};
      try {
        data = await res.json();
      } catch {
        setError('Respuesta inválida del servidor');
        return;
      }

      if (!res.ok) {
        setError(data.error || 'No se pudo guardar');
        return;
      }
      setName('');
      setEmail('');
      setCampaignId('');
      await loadLeads();
      setShowForm(true);
    } catch {
      setError('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 bg-[#080e1a]">
      <div>
        <h1 className="text-2xl font-semibold text-white">Leads</h1>
        <p className="mt-1 text-sm text-slate-400">Gestiona contactos simples. También aparecen en tu CRM.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      {leads.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-white/6 bg-slate-900 px-8 py-12 text-center">
          <p className="text-lg font-medium text-white">Aún no tienes leads</p>
          <p className="mt-2 text-sm text-slate-400">Agrega tu primer lead para empezar a gestionar oportunidades</p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-8 rounded-2xl border border-white/10 px-6 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/30 hover:text-white"
          >
            Agregar lead
          </button>
        </div>
      ) : null}

      {showForm || leads.length > 0 ? (
        <form onSubmit={handleSubmit} className="max-w-md space-y-4 rounded-2xl border border-white/6 bg-slate-900 p-6">
          <p className="text-sm font-medium text-white">Nuevo lead</p>
          <div>
            <label htmlFor="lead-name" className="mb-1 block text-xs font-medium text-slate-400">
              Nombre
            </label>
            <input
              id="lead-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
              placeholder="Nombre del contacto"
              autoComplete="name"
            />
          </div>
          <div>
            <label htmlFor="lead-email" className="mb-1 block text-xs font-medium text-slate-400">
              Correo
            </label>
            <input
              id="lead-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
              placeholder="correo@ejemplo.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="lead-campaign" className="mb-1 block text-xs font-medium text-slate-400">
              Campaña (opcional)
            </label>
            <select
              id="lead-campaign"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
            >
              <option value="">Sin campaña</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl border border-white/10 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/30 hover:text-white disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : 'Guardar lead'}
          </button>
        </form>
      ) : null}

      {leads.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-white/6 bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/6 bg-slate-900 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Correo</th>
                <th className="px-4 py-3 font-medium">Campaña</th>
                <th className="px-4 py-3 font-medium">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 bg-slate-900">
              {leads.map((lead) => {
                const created = new Date(lead.createdAt);
                const dateLabel = Number.isFinite(created.getTime())
                  ? created.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })
                  : '—';
                return (
                  <tr key={lead.id} className="text-slate-200">
                    <td className="px-4 py-3 font-medium text-white">
                      <Link href={`/dashboard/leads/${lead.id}`} className="text-cyan-400 hover:underline">
                        {lead.name?.trim() ? lead.name : '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{lead.email?.trim() ? lead.email : '—'}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {lead.campaign?.name?.trim() ? lead.campaign.name : 'Sin campaña'}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{dateLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
