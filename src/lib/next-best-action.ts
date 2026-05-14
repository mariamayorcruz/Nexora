export type NextBestAction = {
  leadId: string;
  leadName: string;
  action: string;
  reason: string;
  urgency: 'critical' | 'high' | 'medium';
  channel: 'whatsapp' | 'sms' | 'email' | 'call';
  timeframe: string;
};

type Lead = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  stage: string;
  value: number;
  confidence: number;
  nextAction?: string | null;
  updatedAt: string;
  source: string;
};

export function computeNextBestActions(leads: Lead[], language: string): NextBestAction[] {
  const en = language === 'en';
  const now = Date.now();
  const actions: NextBestAction[] = [];

  for (const lead of leads) {
    if (lead.stage === 'won') continue;

    const hoursSince = (now - new Date(lead.updatedAt).getTime()) / 3600000;
    const hasPhone = Boolean(lead.phone);
    const preferredChannel: NextBestAction['channel'] = hasPhone ? 'whatsapp' : 'email';

    if (hoursSince > 72) {
      actions.push({
        leadId: lead.id,
        leadName: lead.name,
        action: en
          ? `Send a quick message to ${lead.name}`
          : `Envía un mensaje rápido a ${lead.name}`,
        reason: en
          ? `No contact in ${Math.floor(hoursSince / 24)} days. They may think you forgot about them.`
          : `Sin contacto hace ${Math.floor(hoursSince / 24)} días. Puede pensar que lo olvidaste.`,
        urgency: 'critical',
        channel: preferredChannel,
        timeframe: en ? 'Do this now' : 'Hazlo ahora',
      });
      continue;
    }

    if (hoursSince > 24 && (lead.value > 500 || lead.confidence >= 45)) {
      actions.push({
        leadId: lead.id,
        leadName: lead.name,
        action: en
          ? `Follow up with ${lead.name}`
          : `Haz seguimiento con ${lead.name}`,
        reason: en
          ? `${Math.floor(hoursSince)}h without a reply. High-intent leads cool off fast.`
          : `${Math.floor(hoursSince)}h sin respuesta. Los leads de alta intención se enfrían rápido.`,
        urgency: 'high',
        channel: preferredChannel,
        timeframe: en ? 'Today' : 'Hoy',
      });
      continue;
    }

    if (lead.nextAction && hoursSince > 4) {
      actions.push({
        leadId: lead.id,
        leadName: lead.name,
        action: lead.nextAction,
        reason: en
          ? `Scheduled next step for ${lead.name}.`
          : `Siguiente paso programado para ${lead.name}.`,
        urgency: 'medium',
        channel: preferredChannel,
        timeframe: en ? 'When ready' : 'Cuando estés listo',
      });
    }
  }

  const order = { critical: 0, high: 1, medium: 2 };
  return actions
    .sort((a, b) => order[a.urgency] - order[b.urgency])
    .slice(0, 5);
}

export function getUrgencyColor(urgency: NextBestAction['urgency']): string {
  switch (urgency) {
    case 'critical':
      return 'text-rose-300';
    case 'high':
      return 'text-amber-300';
    case 'medium':
      return 'text-cyan-300';
  }
}

export function getUrgencyBg(urgency: NextBestAction['urgency']): string {
  switch (urgency) {
    case 'critical':
      return 'bg-rose-500/10 border-rose-500/15';
    case 'high':
      return 'bg-amber-500/10 border-amber-500/15';
    case 'medium':
      return 'bg-cyan-500/10 border-cyan-500/15';
  }
}
