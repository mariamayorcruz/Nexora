import {
  AUDIT_DIAGNOSIS_BULLETS,
  displayNameForAudit,
  getAuditMeetingLink,
  getAuditPricingUrl,
} from '@/lib/audit-flow';
import { generateAuditPdf } from '@/lib/pdf/generateAuditPdf';

export type AuditNiche = 'servicios' | 'ecommerce' | 'inmobiliario' | 'coaching';

type NicheConfig = {
  label: string;
  accent: [number, number, number];
  accentSoft: [number, number, number];
  coverFocus: string;
  scorecardItems: string[];
  sprintFocus: string[];
  playbookHints: string[];
};

const NICHE_CONFIG: Record<AuditNiche, NicheConfig> = {
  servicios: {
    label: 'Servicios',
    accent: [0.98, 0.48, 0.1],
    accentSoft: [0.1, 0.76, 0.9],
    coverFocus:
      'Enfocado en captar prospectos de alto valor, acelerar seguimiento y cerrar con menos fricción.',
    scorecardItems: [
      'Tiempo de respuesta del primer contacto comercial.',
      'Claridad de propuesta de valor por servicio.',
      'Consistencia entre anuncio, landing y llamada.',
    ],
    sprintFocus: [
      'Estandarizar primer follow-up en menos de 24h.',
      'Separar leads fríos y calientes con siguiente acción.',
      'Optimizar guion de discovery call por objeción.',
    ],
    playbookHints: [
      'Usa casos reales por tipo de cliente en apertura.',
      'Cierra con siguiente paso concreto y fecha definida.',
    ],
  },
  ecommerce: {
    label: 'E-commerce',
    accent: [0.09, 0.77, 0.53],
    accentSoft: [0.33, 0.85, 0.95],
    coverFocus:
      'Orientado a mejorar ROAS, reducir CPA y escalar creatives ganadores sin quemar audiencias.',
    scorecardItems: [
      'Relación gasto publicitario vs rentabilidad neta.',
      'Frecuencia creativa por audiencia en 7 días.',
      'Desempeño por tipo de oferta y bundle.',
    ],
    sprintFocus: [
      'Pausar conjuntos con CPA fuera de rango objetivo.',
      'Duplicar ganadores con variación de hook y oferta.',
      'Ajustar retargeting por ventanas de compra.',
    ],
    playbookHints: [
      'Prioriza ticket promedio y recompra, no solo volumen.',
      'Usa urgencia real basada en inventario o beneficio.',
    ],
  },
  inmobiliario: {
    label: 'Inmobiliario',
    accent: [0.93, 0.63, 0.13],
    accentSoft: [0.18, 0.55, 0.95],
    coverFocus:
      'Diseñado para generar citas calificadas, mejorar show rate y aumentar conversión de visitas a cierre.',
    scorecardItems: [
      'Calidad de lead según presupuesto y zona objetivo.',
      'Tasa lead a cita y cita a visita efectiva.',
      'Seguimiento por etapa con objeción registrada.',
    ],
    sprintFocus: [
      'Crear respuesta inicial con filtro de perfil comprador.',
      'Agendar cita en primera interacción cuando aplique.',
      'Activar secuencia de nurturing para leads no listos.',
    ],
    playbookHints: [
      'Refuerza prueba social por zona y tipo de propiedad.',
      'Cierra cada conversación con compromiso de avance.',
    ],
  },
  coaching: {
    label: 'Coaching/Infoproducto',
    accent: [0.83, 0.43, 0.98],
    accentSoft: [0.98, 0.49, 0.72],
    coverFocus:
      'Pensado para escalar sesiones o programas con narrativa clara, autoridad y seguimiento consistente.',
    scorecardItems: [
      'Mensaje central y transformación prometida.',
      'Calidad de aplicantes para llamada de venta.',
      'Conversión por etapa de tu embudo consultivo.',
    ],
    sprintFocus: [
      'Optimizar VSL/hook principal con beneficio tangible.',
      'Filtrar aplicantes por fit antes de llamada.',
      'Afinar cierre consultivo con manejo de objeciones.',
    ],
    playbookHints: [
      'Abre con diagnóstico, no con pitch directo.',
      'Vincula objeciones a costo de no actuar ahora.',
    ],
  },
};

export function resolveAuditNiche(value?: string | null): AuditNiche {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'ecommerce') return 'ecommerce';
  if (normalized === 'inmobiliario') return 'inmobiliario';
  if (normalized === 'coaching') return 'coaching';
  return 'servicios';
}

export function auditVariantLabelFromNicheParam(value?: string | null): string {
  return NICHE_CONFIG[resolveAuditNiche(value)].label;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function buildMasterclassEmail(input: {
  name?: string | null;
  email: string;
  niche?: string | null;
  pdfDownloadUrl: string;
}) {
  const nicheLabel = auditVariantLabelFromNicheParam(input.niche);
  const firstName = displayNameForAudit(input.name, input.email);
  const meetingUrl = getAuditMeetingLink();
  const pricingUrl = getAuditPricingUrl();
  const diagnosisListHtml = AUDIT_DIAGNOSIS_BULLETS.map(
    (line) => `<li style="margin-bottom:8px;">${escapeHtml(line)}</li>`
  ).join('');

  const subject = 'Tu auditoría ya está lista';

  const meetingHtml = meetingUrl
    ? `<p style="margin:28px 0 8px;font-size:14px;line-height:1.6;color:#64748b;">Si prefieres que lo revisemos contigo:</p>
<p style="margin:0;"><a href="${escapeHtml(meetingUrl)}" style="color:#0f766e;font-weight:600;font-size:15px;">Prefiero que me lo expliquen</a></p>`
    : `<p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:#64748b;">Si prefieres que lo revisemos contigo, puedes responder este correo.</p>`;

  const meetingText = meetingUrl
    ? `\nSi prefieres que lo revisemos contigo:\n${meetingUrl}\n`
    : '\nSi prefieres que lo revisemos contigo, puedes responder este correo.\n';

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
<tr><td style="padding:32px 28px 8px;">
<p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Tu equipo</p>
<h1 style="margin:0;font-size:22px;font-weight:700;line-height:1.35;color:#0f172a;">Hola ${escapeHtml(firstName)},</h1>
</td></tr>
<tr><td style="padding:8px 28px 0;">
<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#475569;">Tu auditoría ya está lista.</p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#475569;">Estos son los puntos más importantes que detectamos:</p>
<ul style="margin:0 0 20px;padding-left:20px;color:#475569;font-size:15px;line-height:1.65;">
${diagnosisListHtml}
</ul>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#64748b;">El PDF adjunto y el enlace de abajo te muestran el detalle completo, con qué está fallando y qué aplicar esta semana.</p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:#0f172a;font-weight:600;">Ver tu auditoría completa</p>
<p style="margin:0 0 24px;"><a href="${escapeHtml(input.pdfDownloadUrl)}" style="display:inline-block;color:#0f766e;font-weight:600;font-size:15px;">Abrir auditoría completa</a></p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#475569;">Si quieres aplicar esto con más estructura, puedes ejecutarlo paso a paso desde tu cuenta.</p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:#0f172a;font-weight:600;">Suscríbete ahora</p>
<p style="margin:0 0 8px;"><a href="${escapeHtml(pricingUrl)}" style="color:#0f766e;font-weight:600;font-size:15px;">${escapeHtml(pricingUrl)}</a></p>
${meetingHtml}
<p style="margin:28px 0 0;font-size:15px;line-height:1.6;color:#334155;">Quedo atenta,<br><strong>Equipo de soporte</strong></p>
<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#94a3b8;">P.D. Si tienes dudas sobre tu auditoría, puedes responder este correo y lo vemos contigo.</p>
${nicheLabel ? `<p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">Enfoque: ${escapeHtml(nicheLabel)}</p>` : ''}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    `Hola ${firstName},`,
    '',
    'Tu auditoría ya está lista.',
    '',
    'Estos son los puntos más importantes que detectamos:',
    '',
    ...AUDIT_DIAGNOSIS_BULLETS.map((line) => `- ${line}`),
    '',
    'El PDF adjunto y el enlace de abajo te muestran el detalle completo, con qué está fallando y qué aplicar esta semana.',
    '',
    `Abrir auditoría completa: ${input.pdfDownloadUrl}`,
    '',
    'Si quieres aplicar esto con más estructura, puedes ejecutarlo paso a paso desde tu cuenta.',
    '',
    `Suscríbete ahora: ${pricingUrl}`,
    meetingText,
    'Quedo atenta,',
    'Equipo de soporte',
    '',
    'P.D. Si tienes dudas sobre tu auditoría, puedes responder este correo y lo vemos contigo.',
    nicheLabel ? `Enfoque: ${nicheLabel}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const pdfBytes = await generateAuditPdf({
    recipientDisplayName: firstName,
    variantLabel: nicheLabel,
  });

  return {
    subject,
    preview: 'Dossier en PDF (adjunto + enlace), resumen ejecutivo y siguiente paso claro.',
    html,
    text,
    attachments: [
      {
        filename: 'auditoria-nexora.pdf',
        content: Buffer.from(pdfBytes),
        contentType: 'application/pdf' as const,
      },
    ],
  };
}
