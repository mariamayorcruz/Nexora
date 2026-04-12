'use client';

import { useState } from 'react';

export default function CookiePreferences() {
  const [status, setStatus] = useState('');

  const saveConsent = async (consent: 'granted' | 'denied') => {
    try {
      const response = await fetch('/api/tracking/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent }),
      });

      if (!response.ok) {
        throw new Error('No se pudo guardar preferencia.');
      }

      setStatus(consent === 'granted' ? 'Cookies opcionales activadas.' : 'Solo cookies esenciales activas.');
    } catch {
      setStatus('No se pudo guardar preferencia. Reintenta.');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => saveConsent('granted')}
        className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20"
      >
        Cookie Preferences
      </button>
      <button
        type="button"
        onClick={() => saveConsent('denied')}
        className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
      >
        Your Privacy Choices
      </button>
      {status ? <span className="text-xs text-slate-500">{status}</span> : null}
    </div>
  );
}
