const domain = process.env.NEXT_PUBLIC_DOMAIN || 'https://www.gotnexora.com';

export function getLeadMagnetLinks() {
  return {
    aiStudioUrl: `${domain}/dashboard/studio`,
    pricingUrl: `${domain}#pricing`,
    signupUrl: `${domain}/auth/signup`,
    appUrl: process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL || '',
  };
}

export function buildMasterclassEmail(input: { name?: string | null; email: string }) {
  const firstName = input.name?.trim() || input.email.split('@')[0];
  const links = getLeadMagnetLinks();
  const appLabel = links.appUrl ? 'Descargar la app' : 'Acceso prioritario a la app';
  const appHref = links.appUrl || links.signupUrl;

  const subject = 'Tu master class de Nexora ya esta lista';
  const preview =
    'Acceso inmediato al mapa de decisiones, AI Studio y siguientes pasos para activar tu sistema comercial.';

  const html = `
    <div style="background:#f8fafc;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:28px;padding:32px;box-shadow:0 20px 60px rgba(15,23,42,0.08);">
        <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#94a3b8;">Master class Nexora</p>
        <h1 style="margin:0;font-size:34px;line-height:1.15;">${firstName}, ya tienes acceso a tu guia gratuita.</h1>
        <p style="margin:18px 0 0;font-size:16px;line-height:1.8;color:#475569;">
          Esta entrega esta pensada para ayudarte a convertir una idea difusa en una oferta mas clara, un funnel mas fuerte
          y un sistema comercial que no dependa del caos.
        </p>
        <div style="margin-top:28px;padding:24px;border-radius:22px;background:#fff7ed;border:1px solid #fdba74;">
          <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#c2410c;">Lo que vas a recibir</p>
          <p style="margin:0 0 10px;font-size:15px;line-height:1.7;">1. Como definir una promesa principal mas fuerte.</p>
          <p style="margin:0 0 10px;font-size:15px;line-height:1.7;">2. Como detectar si el cuello de botella esta en oferta, mensaje, seguimiento o sistema.</p>
          <p style="margin:0;font-size:15px;line-height:1.7;">3. Como bajar esa claridad a AI Studio, funnel, CRM y conversion real dentro de Nexora.</p>
        </div>
        <div style="margin-top:28px;display:flex;flex-wrap:wrap;gap:12px;">
          <a href="${links.aiStudioUrl}" style="display:inline-block;border-radius:999px;padding:12px 18px;background:#ea580c;color:#ffffff;text-decoration:none;font-weight:600;">Ir a AI Studio Nexora</a>
          <a href="${links.pricingUrl}" style="display:inline-block;border-radius:999px;padding:12px 18px;background:#fff7ed;color:#9a3412;text-decoration:none;font-weight:600;border:1px solid #fdba74;">Ver planes</a>
          <a href="${appHref}" style="display:inline-block;border-radius:999px;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;font-weight:600;">${appLabel}</a>
        </div>
        <div style="margin-top:30px;padding-top:22px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:13px;line-height:1.8;color:#64748b;">${preview}</p>
          <p style="margin:10px 0 0;font-size:13px;line-height:1.8;color:#64748b;">
            Si quieres ayuda humana para aterrizar tu sistema, responde este correo y te guiamos.
          </p>
        </div>
      </div>
    </div>
  `;

  const text = [
    `Hola ${firstName},`,
    '',
    'Tu master class de Nexora ya esta lista.',
    '',
    'Aqui tienes el mapa de decisiones para ordenar oferta, mensaje, funnel y siguiente paso comercial.',
    '',
    `Ir a AI Studio Nexora: ${links.aiStudioUrl}`,
    `Ver planes: ${links.pricingUrl}`,
    `${appLabel}: ${appHref}`,
    '',
    'Si quieres ayuda para aterrizarlo, responde este correo.',
  ].join('\n');

  return { subject, preview, html, text };
}
