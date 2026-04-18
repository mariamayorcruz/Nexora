'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type CampaignOption = { id: string; name: string };

type LeadDetail = {
  id: string;
  name: string;
  email: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  campaign: CampaignOption | null;
};

const STATUS_OPTIONS = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'contactado', label: 'Contactado' },
  { value: 'cerrado', label: 'Cerrado' },
] as const;

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('nuevo');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const loadLead = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/auth/login');
      return;
    }

    const res = await fetch(`/api/leads/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      router.replace('/auth/login');
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Error al cargar');
    }

    const l = data.lead as LeadDetail | undefined;
    if (!l?.id) {
      throw new Error('Lead no encontrado');
    }

    const created =
      typeof l.createdAt === 'string'
        ? l.createdAt
        : new Date(l.createdAt as unknown as string | number | Date).toISOString();

    setLead({
      ...l,
      createdAt: created,
      campaign:
        l.campaign && typeof l.campaign === 'object' && 'id' in l.campaign
          ? { id: String(l.campaign.id), name: String(l.campaign.name || '') }
          : null,
    });
    setStatus(STATUS_OPTIONS.some((o) => o.value === l.status) ? l.status : 'nuevo');
    setNotes(l.notes ?? '');
  }, [id, router]);

  useEffect(() => {
    if (!id) {
      setError('ID inválido');
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        await loadLead();
        setError('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar');
        setLead(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, loadLead]);

  const handleSaveNotes = async () => {
    const token = localStorage.getItem('token');
    if (!token || !id) return;

    setSaving(true);
    setSaveMessage('');
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes: notes.trim() || null }),
      });

      if (res.status === 401) {
        router.replace('/auth/login');
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveMessage(typeof data.error === 'string' ? data.error : 'No se pudo guardar');
        return;
      }

      if (data.lead) {
        const l = data.lead as LeadDetail;
        setLead((prev) =>
          prev
            ? {
                ...prev,
                notes: l.notes ?? null,
              }
            : prev
        );
      }
      setSaveMessage('Guardado');
      setTimeout(() => setSaveMessage(''), 2500);
    } catch {
      setSaveMessage('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (next: string) => {
    setStatus(next);
    const token = localStorage.getItem('token');
    if (!token || !id) return;

    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: next }),
      });

      if (res.status === 401) {
        router.replace('/auth/login');
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'No se pudo actualizar el estado');
        return;
      }
      if (data.lead?.status) {
        setLead((prev) => (prev ? { ...prev, status: data.lead.status } : prev));
      }
    } catch {
      setError('Error de conexión');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  if (error && !lead) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/clientes/lista" className="text-sm text-cyan-400 hover:underline">
          ← Volver a Leads
        </Link>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      </div>
    );
  }

  if (!lead) {
    return null;
  }

  const created = new Date(lead.createdAt);
  const dateLabel = Number.isFinite(created.getTime())
    ? created.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })
    : '—';

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link href="/dashboard/clientes/lista" className="text-sm text-cyan-400 hover:underline">
          ← Volver a Leads
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-white">{lead.name?.trim() || 'Lead'}</h1>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Correo</p>
          <p className="mt-1 text-slate-200">{lead.email?.trim() ? lead.email : '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Campaña</p>
          <p className="mt-1 text-slate-200">
            {lead.campaign?.name?.trim() ? lead.campaign.name : 'Sin campaña'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Creado</p>
          <p className="mt-1 text-slate-400">{dateLabel}</p>
        </div>
        <div>
          <label htmlFor="lead-status" className="mb-1 block text-xs font-medium text-slate-400">
            Estado
          </label>
          <select
            id="lead-status"
            value={status}
            onChange={(e) => void handleStatusChange(e.target.value)}
            className="w-full max-w-xs rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <label htmlFor="lead-notes" className="mb-1 block text-xs font-medium text-slate-400">
          Notas
        </label>
        <textarea
          id="lead-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/50"
          placeholder="Añade notas sobre este lead…"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSaveNotes()}
            disabled={saving}
            className="btn-primary px-5 py-2 text-sm disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar notas'}
          </button>
          {saveMessage ? (
            <span className={`text-sm ${saveMessage === 'Guardado' ? 'text-emerald-400' : 'text-red-300'}`}>
              {saveMessage}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
