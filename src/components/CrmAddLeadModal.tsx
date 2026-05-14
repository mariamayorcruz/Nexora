'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

const INITIAL = {
  name: '',
  email: '',
  phone: '',
  company: '',
  value: '',
  nextAction: '',
  notes: '',
};

export default function CrmAddLeadModal({
  open,
  onClose,
  language,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  language: string;
  onCreated: () => void | Promise<void>;
}) {
  const en = language === 'en';
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(INITIAL);
    setError('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const submit = async () => {
    const name = form.name.trim();
    if (!name) {
      setError(en ? 'Name is required.' : 'El nombre es obligatorio.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError(en ? 'Session expired. Sign in again.' : 'Sesión expirada. Inicia sesión de nuevo.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const valueNum = form.value.trim() === '' ? 0 : Number(form.value);
      const response = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          company: form.company.trim() || undefined,
          value: Number.isFinite(valueNum) ? valueNum : 0,
          nextAction: form.nextAction.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data?.error === 'string' ? data.error : en ? 'Could not create lead.' : 'No se pudo crear el lead.');
        return;
      }
      await onCreated();
    } catch {
      setError(en ? 'Something went wrong. Try again.' : 'Algo salió mal. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const inputClass =
    'w-full rounded-2xl bg-[#030610] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-cyan-500/25';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        aria-label={en ? 'Close' : 'Cerrar'}
        onClick={onClose}
      />
      <div className="relative max-h-[min(90vh,720px)] w-full max-w-md overflow-y-auto rounded-[28px] border border-white/[0.08] bg-[#040810] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">{en ? 'New lead' : 'Nuevo lead'}</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{en ? 'Add contact to CRM' : 'Agregar contacto al CRM'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
            aria-label={en ? 'Close' : 'Cerrar'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>
        ) : null}

        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-slate-500">{en ? 'Name' : 'Nombre'} *</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
              placeholder={en ? 'Full name' : 'Nombre completo'}
              autoComplete="name"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-slate-500">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className={inputClass}
              placeholder={en ? 'Optional' : 'Opcional'}
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-slate-500">{en ? 'Phone' : 'Teléfono'}</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className={inputClass}
              placeholder={en ? 'Optional' : 'Opcional'}
              autoComplete="tel"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-slate-500">{en ? 'Company' : 'Empresa'}</span>
            <input
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              className={inputClass}
              placeholder={en ? 'Optional' : 'Opcional'}
              autoComplete="organization"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-slate-500">{en ? 'Deal value' : 'Valor'}</span>
            <input
              type="number"
              min={0}
              step="any"
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              className={inputClass}
              placeholder="0"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-slate-500">{en ? 'Next action' : 'Siguiente acción'}</span>
            <input
              value={form.nextAction}
              onChange={(e) => setForm((f) => ({ ...f, nextAction: e.target.value }))}
              className={inputClass}
              placeholder={en ? 'Optional' : 'Opcional'}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-slate-500">{en ? 'Notes' : 'Notas'}</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className={`${inputClass} min-h-[88px] resize-none`}
              placeholder={en ? 'Optional' : 'Opcional'}
              rows={3}
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-white/[0.12] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.05] disabled:opacity-50"
          >
            {en ? 'Cancel' : 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="rounded-full bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-[#041018] transition hover:bg-cyan-400 disabled:opacity-50"
          >
            {saving ? (en ? 'Saving…' : 'Guardando…') : en ? 'Save lead' : 'Guardar lead'}
          </button>
        </div>
      </div>
    </div>
  );
}
