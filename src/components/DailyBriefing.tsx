'use client';

import { useEffect, useState } from 'react';

type BriefingItem = {
  icon: string;
  text: string;
  tone: string;
};

type DailyBriefingProps = {
  userName: string;
  language: string;
  activeLeads: number;
  waitingForReply: number;
  hotLeads: number;
  hotLeadValue: number;
  hotLeadName: string;
  aiConversations: number;
  followUpsPending: number;
  wonThisMonth: number;
};

function getGreeting(language: string): string {
  const hour = new Date().getHours();
  const en = language === 'en';
  if (hour < 12) return en ? 'Good morning' : 'Buenos días';
  if (hour < 18) return en ? 'Good afternoon' : 'Buenas tardes';
  return en ? 'Good evening' : 'Buenas noches';
}

export default function DailyBriefing({
  userName,
  language,
  activeLeads,
  waitingForReply,
  hotLeads,
  hotLeadValue,
  hotLeadName,
  aiConversations,
  followUpsPending,
  wonThisMonth,
}: DailyBriefingProps) {
  const [visible, setVisible] = useState(false);
  const en = language === 'en';

  useEffect(() => {
    setVisible(true);
  }, []);

  const items: BriefingItem[] = [];

  if (waitingForReply > 0) {
    items.push({
      icon: '💬',
      text: en
        ? `${waitingForReply} customer${waitingForReply > 1 ? 's are' : ' is'} waiting for your reply.`
        : waitingForReply === 1
          ? '1 cliente espera tu respuesta.'
          : `${waitingForReply} clientes esperan tu respuesta.`,
      tone: 'text-rose-300',
    });
  }

  if (hotLeads > 0) {
    items.push({
      icon: '🔥',
      text: en
        ? `${hotLeadName} is your hottest opportunity right now${hotLeadValue > 0 ? ` — $${hotLeadValue.toLocaleString()} potential` : ''}.`
        : `${hotLeadName} es tu oportunidad más caliente ahora mismo${hotLeadValue > 0 ? ` — $${hotLeadValue.toLocaleString()} potencial` : ''}.`,
      tone: 'text-amber-300',
    });
  }

  if (aiConversations > 0) {
    items.push({
      icon: '🤖',
      text: en
        ? `While you were away, your assistant handled ${aiConversations} conversation${aiConversations > 1 ? 's' : ''}.`
        : `Mientras no estabas, tu asistente manejó ${aiConversations} conversación${aiConversations > 1 ? 'es' : ''}.`,
      tone: 'text-cyan-300',
    });
  }

  if (followUpsPending > 0) {
    items.push({
      icon: '📋',
      text: en
        ? `${followUpsPending} follow-up${followUpsPending > 1 ? 's' : ''} scheduled for today.`
        : `${followUpsPending} seguimiento${followUpsPending > 1 ? 's' : ''} programado${followUpsPending > 1 ? 's' : ''} para hoy.`,
      tone: 'text-violet-300',
    });
  }

  if (wonThisMonth > 0) {
    items.push({
      icon: '✅',
      text: en
        ? `${wonThisMonth} customer${wonThisMonth > 1 ? 's' : ''} closed this month. Keep it up today.`
        : `${wonThisMonth} cliente${wonThisMonth > 1 ? 's' : ''} cerrado${wonThisMonth > 1 ? 's' : ''} este mes. Sigue así hoy.`,
      tone: 'text-emerald-300',
    });
  }

  if (items.length === 0) {
    items.push({
      icon: '✦',
      text: en
        ? 'All good. A great time to reach out to new customers.'
        : 'Todo al día. Buen momento para contactar nuevos clientes.',
      tone: 'text-cyan-300',
    });
  }

  return (
    <section
      className={`rounded-[28px] border border-white/[0.05] bg-[#040810] p-5 sm:p-6 transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">
            ✦ {en ? 'Daily briefing' : 'Resumen del día'}
          </p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-white">
            {getGreeting(language)}, {userName}.
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {en
              ? 'Here is what needs your attention today.'
              : 'Esto es lo que necesita tu atención hoy.'}
          </p>
        </div>
        <div className="shrink-0 rounded-full bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-500">
          {new Date().toLocaleDateString(en ? 'en-US' : 'es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-start gap-3 rounded-[18px] bg-white/[0.03] px-4 py-3"
          >
            <span className="text-base">{item.icon}</span>
            <p className={`text-sm leading-6 ${item.tone}`}>{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
