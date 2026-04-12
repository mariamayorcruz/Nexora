import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import path from 'path';
import fs from 'fs';

const domain = process.env.NEXT_PUBLIC_DOMAIN || 'https://www.gotnexora.com';
const videoStudioUrl = 'https://estudio-video-web.vercel.app';

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
    coverFocus: 'Enfocado en captar prospectos de alto valor, acelerar seguimiento y cerrar con menos friccion.',
    scorecardItems: [
      'Tiempo de respuesta del primer contacto comercial.',
      'Claridad de propuesta de valor por servicio.',
      'Consistencia entre anuncio, landing y llamada.',
    ],
    sprintFocus: [
      'Estandarizar primer follow-up en menos de 24h.',
      'Separar leads frios y calientes con siguiente accion.',
      'Optimizar guion de discovery call por objecion.',
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
    coverFocus: 'Orientado a mejorar ROAS, reducir CPA y escalar creatives ganadores sin quemar audiencias.',
    scorecardItems: [
      'Relacion gasto publicitario vs rentabilidad neta.',
      'Frecuencia creativa por audiencia en 7 dias.',
      'Desempeno por tipo de oferta y bundle.',
    ],
    sprintFocus: [
      'Pausar conjuntos con CPA fuera de rango objetivo.',
      'Duplicar ganadores con variacion de hook y oferta.',
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
    coverFocus: 'Disenado para generar citas calificadas, mejorar show rate y aumentar conversion de visitas a cierre.',
    scorecardItems: [
      'Calidad de lead segun presupuesto y zona objetivo.',
      'Tasa lead a cita y cita a visita efectiva.',
      'Seguimiento por etapa con objecion registrada.',
    ],
    sprintFocus: [
      'Crear respuesta inicial con filtro de perfil comprador.',
      'Agendar cita en primera interaccion cuando aplique.',
      'Activar secuencia de nurturing para leads no listos.',
    ],
    playbookHints: [
      'Refuerza prueba social por zona y tipo de propiedad.',
      'Cierra cada conversacion con compromiso de avance.',
    ],
  },
  coaching: {
    label: 'Coaching/Infoproducto',
    accent: [0.83, 0.43, 0.98],
    accentSoft: [0.98, 0.49, 0.72],
    coverFocus: 'Pensado para escalar sesiones o programas con narrativa clara, autoridad y seguimiento consistente.',
    scorecardItems: [
      'Mensaje central y transformacion prometida.',
      'Calidad de aplicantes para llamada de venta.',
      'Conversion por etapa de tu embudo consultivo.',
    ],
    sprintFocus: [
      'Optimizar VSL/hook principal con beneficio tangible.',
      'Filtrar aplicantes por fit antes de llamada.',
      'Afinar cierre consultivo con manejo de objeciones.',
    ],
    playbookHints: [
      'Abre con diagnostico, no con pitch directo.',
      'Vincula objeciones a costo de no actuar ahora.',
    ],
  },
};

function resolveAuditNiche(value?: string | null): AuditNiche {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'ecommerce') return 'ecommerce';
  if (normalized === 'inmobiliario') return 'inmobiliario';
  if (normalized === 'coaching') return 'coaching';
  return 'servicios';
}

const splitLines = (text: string, maxChars = 92) => {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
};

async function buildAuditKitAttachment(firstName: string, niche: AuditNiche) {
  const generatedAt = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  const nicheConfig = NICHE_CONFIG[niche];

  // ── Load reference PDF (premium design) ───────────────────────────────────
  const templatePath = path.join(process.cwd(), 'public', 'templates', 'nexora-dossier-premium.pdf');
  const templateBytes = fs.readFileSync(templatePath);
  const pdf = await PDFDocument.load(templateBytes);

  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  // ── Overlay personalisation on page 1 (cover) ─────────────────────────────
  // Strategy: draw a branded "prepared for" band near the top of the cover,
  // just below the logo header (which sits around y=780-820 on a 595x842 page).
  // We also stamp the niche variant and generation date at the bottom.
  const cover = pdf.getPages()[0];

  // "Preparado para" band — dark semi-transparent strip
  const bandY = 700;
  const bandH = 66;
  cover.drawRectangle({
    x: 32,
    y: bandY,
    width: 531,
    height: bandH,
    color: rgb(0.04, 0.08, 0.18),
    opacity: 0.92,
  });
  // Cyan left accent bar
  cover.drawRectangle({ x: 32, y: bandY, width: 4, height: bandH, color: rgb(0.08, 0.66, 0.59) });

  // Label
  cover.drawText('PREPARADO PARA', {
    x: 46,
    y: bandY + bandH - 18,
    size: 8,
    font: bold,
    color: rgb(0.08, 0.66, 0.59),
  });

  // Name — truncate to fit (max ~30 chars at size 22)
  const displayName = firstName.slice(0, 30);
  cover.drawText(displayName, {
    x: 46,
    y: bandY + 22,
    size: 22,
    font: bold,
    color: rgb(0.97, 0.99, 1.0),
  });

  // Niche badge (right-aligned) + date
  const nicheLabel = `Variante: ${nicheConfig.label}`;
  cover.drawText(nicheLabel, {
    x: 400,
    y: bandY + bandH - 18,
    size: 8,
    font: bold,
    color: rgb(0.78, 0.86, 0.96),
  });
  cover.drawText(generatedAt, {
    x: 400,
    y: bandY + 22,
    size: 8,
    font: regular,
    color: rgb(0.55, 0.65, 0.78),
  });

  // ── Stamp niche focus line below band ────────────────────────────────────
  cover.drawText(nicheConfig.coverFocus, {
    x: 46,
    y: bandY - 16,
    size: 9,
    font: regular,
    color: rgb(0.72, 0.80, 0.92),
  });

  // ── Bottom footer stamp on every page ────────────────────────────────────
  const allPages = pdf.getPages();
  allPages.forEach((page, i) => {
    // Semi-transparent strip at very bottom
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 22, color: rgb(0.02, 0.04, 0.12), opacity: 1 });
    page.drawText(`${firstName} · ${nicheConfig.label} · ${generatedAt}`, {
      x: 36,
      y: 6,
      size: 7,
      font: regular,
      color: rgb(0.45, 0.55, 0.68),
    });
    page.drawText(`${i + 1} / ${allPages.length}`, {
      x: 550,
      y: 6,
      size: 7,
      font: regular,
      color: rgb(0.45, 0.55, 0.68),
    });
  });

  const bytes = await pdf.save();

  return {
    filename: 'nexora-dossier-auditoria.pdf',
    content: Buffer.from(bytes),
    contentType: 'application/pdf',
  };
}

export function getLeadMagnetLinks() {
  return {
    aiStudioUrl: videoStudioUrl,
    pricingUrl: `${domain}#pricing`,
    signupUrl: `${domain}/auth/signup`,
    appUrl: process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL || videoStudioUrl,
  };
}

export async function buildMasterclassEmail(input: { name?: string | null; email: string; niche?: string | null }) {
  const firstName = (input.name?.trim() || input.email.split('@')[0]).split(/[._-]/)[0];
  const niche = resolveAuditNiche(input.niche);
  const nicheLabel = NICHE_CONFIG[niche].label;
  const links = getLeadMagnetLinks();

  const subject = `Tu dossier premium Nexora (${nicheLabel}) · diagnóstico + sprint + playbook`;
  const preview = `Adjunto: PDF ejecutivo de 6 páginas para ${nicheLabel} con scorecard, matriz de decisiones, sprint y guion comercial.`;

  // ── Load premium HTML template and substitute variables ───────────────────
  const templatePath = path.join(process.cwd(), 'public', 'templates', 'nexora-email-auditoria.html');
  const rawHtml = fs.readFileSync(templatePath, 'utf-8');
  const html = rawHtml
    .replace(/\{\{name\}\}/g, firstName)
    .replace(/\{\{niche\}\}/g, nicheLabel)
    .replace(/\{\{signup_url\}\}/g, `${links.signupUrl}?source=audit`)
    .replace(/\{\{studio_url\}\}/g, links.aiStudioUrl);

  const text = [
    `Hola ${firstName},`,
    '',
    `Tu dossier premium de auditoría Nexora (${nicheLabel}) ya está listo — lo encontrarás adjunto en PDF de 6 páginas.`,
    '',
    'Incluye:',
    '  · Diagnóstico y scorecard operativo de 15 puntos.',
    '  · Matriz impacto/esfuerzo para priorizar acciones.',
    '  · Sprint de 7 días y playbook comercial.',
    '',
    'Mini benchmark rápido:',
    '  · Si tu CPL subió >20% en 14 días → revisa fatiga creativa antes de subir presupuesto.',
    '  · Si tu lead→reunión está bajo 20% → el cuello está en seguimiento, no en tráfico.',
    '  · Si no hay hipótesis por canal → un test por semana, no 6 cambios simultáneos.',
    '',
    `Agendar sprint de auditoría (15 min): ${links.signupUrl}?source=audit`,
    `Abrir Nexora Studio: ${links.aiStudioUrl}`,
    '',
    'Responde con la palabra PRIORIDADES y te enviamos una guía corta para ordenar tu semana.',
    '',
    '— Equipo Nexora · gotnexora.com',
  ].join('\n');

  const attachments = [await buildAuditKitAttachment(firstName, niche)];

  return { subject, preview, html, text, attachments };
}
