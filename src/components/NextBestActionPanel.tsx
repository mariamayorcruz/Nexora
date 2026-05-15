'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { type NextBestAction, getUrgencyBg, getUrgencyColor } from '@/lib/next-best-action';

const CHANNEL_LABEL_ES: Record<NextBestAction['channel'], string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'Email',
  call: 'Llamar',
};

const CHANNEL_LABEL_EN: Record<NextBestAction['channel'], string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'Email',
  call: 'Call',
};

export default function NextBestActionPanel({
  actions,
  language,
  onSelectLead,
}: {
  actions: NextBestAction[];
  language: string;
  onSelectLead?: (leadId: string) => void;
}) {
  const en = language === 'en';

  if (actions.length === 0) {
    return (
      <div className="rounded-[24px] bg-[#040810] p-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">
          ✦ {en ? 'Next best actions' : 'Próximas acciones'}
        </p>
        <p className="mt-4 text-sm text-slate-500">
          {en
            ? 'All caught up. No urgent actions right now.'
            : 'Todo al día. No hay acciones urgentes ahora mismo.'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] bg-[#040810] p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">
          ✦ {en ? 'Next best actions' : 'Próximas acciones'}
        </p>
        <Link
          href="/dashboard/crm"
          className="text-xs text-slate-500 transition hover:text-white"
        >
          {en ? 'Open CRM' : 'Abrir CRM'} →
        </Link>
      </div>

      <div className="space-y-3">
        {actions.map((action) => (
          <button
            key={action.leadId}
            type="button"
            onClick={() => onSelectLead?.(action.leadId)}
            className={`w-full rounded-[20px] border p-4 text-left transition-all duration-150 hover:-translate-y-[1px] ${getUrgencyBg(action.urgency)}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${getUrgencyColor(action.urgency)}`}>
                  {action.timeframe} · {(en ? CHANNEL_LABEL_EN : CHANNEL_LABEL_ES)[action.channel]}
                </p>
                <p className="mt-1.5 text-sm font-medium text-white">{action.action}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{action.reason}</p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-600" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
