/**
 * Layout base reutilizable para correos transaccionales (HTML inline, ~600px).
 * El contenido y el footer deben llegar ya escapado cuando incluyan datos de usuario.
 */

import { capitalizeLeadNameForEmail } from '@/lib/format-person-name';

export type BaseEmailCta = {
  label: string;
  href: string;
};

export type RenderBaseEmailInput = {
  title: string;
  /** Fragmento HTML ya seguro (texto dinámico escapado por el llamador). */
  contentHtml: string;
  cta?: BaseEmailCta;
  /** Párrafos HTML ya escapados, entre el CTA y el pie legal (opcional). */
  postCtaHtml?: string;
  /** Fragmento HTML ya seguro para pie (marca, avisos legales breves). */
  footerHtml: string;
  /** Línea superior opcional; por defecto neutra para firmas de correo. */
  brandEyebrow?: string;
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

/** First line is only a Spanish email greeting (e.g. "Hola Juan," / "Hola,") — layout already adds one. */
const CRM_LEADING_GREETING_ONLY_LINE = /^(¡?\s*)hola(\s+[^,\n]+)?,?\s*$/i;

function stripLeadingGreetingLineIfRedundant(bodyText: string): string {
  const trimmed = String(bodyText || '').trim();
  if (!trimmed) return trimmed;
  const lines = trimmed.split(/\n+/);
  const first = lines[0]?.trim() ?? '';
  if (!first || !CRM_LEADING_GREETING_ONLY_LINE.test(first)) {
    return trimmed;
  }
  return lines.slice(1).join('\n').trim();
}

/** Bloques separados por línea en blanco; saltos simples dentro del bloque → br. */
function postCtaPlainTextToHtml(text: string): string {
  const blocks = text.trim().split(/\n\n+/);
  return blocks
    .map((block, i) => {
      const isLast = i === blocks.length - 1;
      const mb = isLast ? '0' : '16px';
      const mt = i === 0 ? '24px' : '0';
      const inner = escapeHtml(block.trim()).replace(/\n/g, '<br />');
      return `<p style="margin:${mt} 0 ${mb} 0;line-height:1.7;color:#475569;font-size:15px;">${inner}</p>`;
    })
    .join('');
}

/** CRM / secuencias: cuerpo multilínea → párrafos + layout base (inline styles). */
export function renderCrmTransactionalEmail(input: {
  title: string;
  greetingName: string;
  bodyText: string;
  cta?: BaseEmailCta;
  /** Texto plano: se escapa y se coloca después del CTA (p. ej. cierre comercial). */
  postCtaText?: string;
  brandEyebrow?: string;
}): string {
  const bodyForParagraphs = stripLeadingGreetingLineIfRedundant(input.bodyText);

  const paraLines = bodyForParagraphs.split(/\n+/).filter(Boolean);
  const paragraphs = paraLines
    .map((line, i) => {
      const isLast = i === paraLines.length - 1;
      const marginBottom = isLast ? '0' : '16px';
      return `<p style="margin:0 0 ${marginBottom} 0;line-height:1.7;color:#475569;font-size:15px;">${escapeHtml(line)}</p>`;
    })
    .join('');

  const rawGreeting = String(input.greetingName ?? '').trim();
  const greetingDisplay =
    capitalizeLeadNameForEmail(rawGreeting || 'cliente') || 'Cliente';

  const greeting = `<p style="margin:0 0 22px 0;font-size:16px;line-height:1.55;color:#0f172a;">Hola <strong style="color:#0f172a;font-weight:600;">${escapeHtml(greetingDisplay)}</strong>,</p>`;

  const footerHtml =
    '<p style="margin:0;line-height:1.65;">Este mensaje fue enviado de forma automática. Si no esperabas este correo, puedes ignorarlo.</p>';

  const titleShort = input.title.trim().slice(0, 120) || 'Mensaje';

  const postCtaHtml = input.postCtaText?.trim()
    ? postCtaPlainTextToHtml(input.postCtaText)
    : undefined;

  return renderBaseEmailTemplate({
    title: titleShort,
    contentHtml: greeting + paragraphs,
    cta: input.cta,
    postCtaHtml,
    footerHtml,
    brandEyebrow: input.brandEyebrow ?? 'Tu equipo',
  });
}

export function renderBaseEmailTemplate(input: RenderBaseEmailInput): string {
  const { title, contentHtml, cta, postCtaHtml, footerHtml, brandEyebrow } = input;
  const eyebrow = brandEyebrow;

  const ctaBlock = cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:32px 0 0 0;">
<tr>
<td align="center" bgcolor="#0f172a" style="border-radius:10px;background-color:#0f172a;background:#0f172a;box-shadow:0 2px 8px rgba(15,23,42,0.22);">
<a href="${escapeAttr(cta.href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:16px 32px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:600;line-height:1.35;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(cta.label)}</a>
</td>
</tr>
</table>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1f5f9;padding:40px 16px;">
<tr>
<td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(15,23,42,0.07);">
<tr>
<td style="padding:40px 36px 36px 36px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
${eyebrow ? `<p style="margin:0 0 10px 0;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;">${escapeHtml(eyebrow)}</p>` : ""}
<h1 style="margin:0;padding:0 0 20px 0;font-size:24px;font-weight:700;line-height:1.3;color:#0f172a;letter-spacing:-0.02em;border-bottom:1px solid #e2e8f0;">${escapeHtml(title)}</h1>
<div style="margin:0;padding:22px 0 0 0;font-size:15px;line-height:1.65;color:#475569;">${contentHtml}</div>
${ctaBlock}${postCtaHtml || ''}
<div style="margin-top:36px;padding-top:24px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.65;color:#94a3b8;">${footerHtml}</div>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}
