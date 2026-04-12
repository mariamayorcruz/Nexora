import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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
  const generatedAt = new Date().toISOString().slice(0, 10);
  const nicheConfig = NICHE_CONFIG[niche];
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pages = Array.from({ length: 6 }, () => pdf.addPage([595, 842]));

  const drawBg = (page: (typeof pages)[number]) => {
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.02, 0.03, 0.09) });
    page.drawCircle({ x: 500, y: 760, size: 180, color: rgb(...nicheConfig.accent), opacity: 0.08 });
    page.drawCircle({ x: 80, y: 120, size: 130, color: rgb(...nicheConfig.accentSoft), opacity: 0.08 });
  };

  const drawHeader = (page: (typeof pages)[number], title: string, subtitle?: string) => {
    drawBg(page);
    page.drawRectangle({ x: 32, y: 726, width: 531, height: 86, color: rgb(0.05, 0.12, 0.22) });
    page.drawText(`NEXORA STUDIO · AUDITORIA ${nicheConfig.label.toUpperCase()}`, {
      x: 46,
      y: 792,
      size: 9,
      font: bold,
      color: rgb(0.66, 0.83, 1),
    });
    page.drawText(title, { x: 46, y: 765, size: 24, font: bold, color: rgb(0.96, 0.98, 1) });
    if (subtitle) {
      page.drawText(subtitle, { x: 46, y: 747, size: 10.5, font: regular, color: rgb(0.77, 0.84, 0.92) });
    }
  };

  const drawFooter = (page: (typeof pages)[number], pageNo: number) => {
    page.drawText(`Generado: ${generatedAt}`, { x: 42, y: 24, size: 9, font: regular, color: rgb(0.55, 0.64, 0.74) });
    page.drawText(`Pagina ${pageNo}/6`, { x: 515, y: 24, size: 9, font: regular, color: rgb(0.55, 0.64, 0.74) });
  };

  const drawCard = (
    page: (typeof pages)[number],
    x: number,
    yTop: number,
    width: number,
    title: string,
    lines: string[],
    bg: [number, number, number] = [0.11, 0.17, 0.27]
  ) => {
    const wrapped = lines.flatMap((line) => splitLines(line, 58));
    const height = 44 + wrapped.length * 14;
    page.drawRectangle({ x, y: yTop - height, width, height, color: rgb(bg[0], bg[1], bg[2]) });
    page.drawText(title, { x: x + 12, y: yTop - 22, size: 11, font: bold, color: rgb(0.93, 0.97, 1) });
    let y = yTop - 38;
    for (const item of wrapped) {
      page.drawText(`• ${item}`, { x: x + 14, y, size: 9.5, font: regular, color: rgb(0.84, 0.9, 0.97) });
      y -= 14;
    }
    return yTop - height - 12;
  };

  drawHeader(
    pages[0],
    `Dossier Premium · ${firstName}`,
    `Documento de 6 paginas para ${nicheConfig.label}: hoja de ruta, guiones, matriz de decision y checklist operativo.`
  );
  pages[0].drawText(nicheConfig.coverFocus, {
    x: 46,
    y: 712,
    size: 10,
    font: regular,
    color: rgb(0.82, 0.88, 0.95),
  });
  pages[0].drawText('Que contiene este dossier', { x: 46, y: 690, size: 14, font: bold, color: rgb(0.98, 0.7, 0.36) });
  let y0 = 670;
  y0 = drawCard(pages[0], 42, y0, 250, '1) Diagnostico', [
    'Scorecard de operacion y lectura rapida de fugas.',
    'Priorizacion por impacto/esfuerzo.',
  ]);
  y0 = drawCard(pages[0], 42, y0, 250, '2) Ejecucion', [
    'Plan de sprint de 7 dias.',
    'Checklist por rol para no perder tiempo.',
  ], [0.08, 0.22, 0.2]);
  drawCard(pages[0], 304, 670, 250, '3) Comercial', [
    'Guion de conversion para llamada de 15 min.',
    'Manejo de objeciones por tipo de cliente.',
  ], [0.18, 0.14, 0.28]);
  drawCard(pages[0], 304, 548, 250, '4) Control', [
    'Tablero KPI minimo y umbrales de alerta.',
    'Ritmo semanal de decision y seguimiento.',
  ], [0.16, 0.11, 0.09]);
  pages[0].drawText(`Accion recomendada: ${domain}/auth/signup?source=audit`, {
    x: 46,
    y: 98,
    size: 10,
    font: bold,
    color: rgb(0.98, 0.72, 0.42),
  });
  pages[0].drawText(`Nexora Studio: ${videoStudioUrl}`, { x: 46, y: 82, size: 10, font: regular, color: rgb(0.7, 0.84, 0.98) });
  drawFooter(pages[0], 1);

  drawHeader(pages[1], 'Pagina 2 · Diagnostico y scorecard');
  let y1 = 700;
  y1 = drawCard(pages[1], 42, y1, 513, 'Scorecard operativo (15 puntos)', [
    'Promesa clara entre anuncio, landing y oferta.',
    'Hook fuerte en los primeros 3 segundos.',
    'Control de frecuencia por audiencia.',
    'Seguimiento comercial en menos de 24h.',
    'Pipeline con etapa, objecion y siguiente accion.',
    'Revision semanal con decisiones (no solo reportes).',
    ...nicheConfig.scorecardItems,
  ]);
  y1 = drawCard(pages[1], 42, y1, 513, 'Senales de alerta', [
    'Si CPL sube mas de 20% en 14 dias: fatiga creativa o segmentacion agotada.',
    'Si lead->reunion cae por debajo de 20%: cuello en seguimiento.',
    'Si reunion->cierre cae por debajo de 15%: oferta o propuesta desalineada.',
  ], [0.14, 0.1, 0.23]);
  drawCard(pages[1], 42, y1, 513, 'Pregunta de control', [
    'Que variable moverias primero manana para recuperar margen sin aumentar presupuesto?',
  ], [0.09, 0.2, 0.26]);
  drawFooter(pages[1], 2);

  drawHeader(pages[2], 'Pagina 3 · Matriz impacto/esfuerzo y decisiones');
  let y2 = 700;
  y2 = drawCard(pages[2], 42, y2, 513, 'Decisiones de alto impacto / bajo esfuerzo', [
    'Pausar anuncios con CPA fuera de rango.',
    'Reescribir primer follow-up comercial.',
    'Agregar prueba social especifica por nicho.',
    'Limpiar pipeline y poner fecha a cada siguiente paso.',
  ], [0.08, 0.19, 0.28]);
  y2 = drawCard(pages[2], 42, y2, 513, 'Decisiones de alto impacto / alto esfuerzo', [
    'Redisenar estructura del funnel y flujo de conversion.',
    'Reformular oferta principal por segmento.',
    'Reentrenar guion comercial para objeciones frecuentes.',
  ], [0.17, 0.13, 0.24]);
  drawCard(pages[2], 42, y2, 513, 'Regla de ejecucion', [
    'No correr mas de un experimento critico por semana.',
    'Define hipotesis -> ejecuta -> mide -> decide en 7 dias.',
  ], [0.18, 0.11, 0.08]);
  drawFooter(pages[2], 3);

  drawHeader(pages[3], 'Pagina 4 · Sprint de 7 dias');
  let y3 = 700;
  y3 = drawCard(pages[3], 42, y3, 513, 'Semana operativa', [
    'Dia 1: KPI norte y umbrales de decision.',
    'Dia 2: detectar fuga principal por canal.',
    'Dia 3: actualizar hooks y promesa principal.',
    'Dia 4: ajustar secuencia de seguimiento.',
    'Dia 5: ejecutar un test creativo por canal.',
    'Dia 6: recortar lo que no sostiene rentabilidad.',
    'Dia 7: cerrar aprendizaje y preparar siguiente sprint.',
    ...nicheConfig.sprintFocus,
  ], [0.07, 0.21, 0.3]);
  drawCard(pages[3], 42, y3, 513, 'Entregables minimos al cierre', [
    'Tablero actualizado con 4 KPI clave.',
    'Lista de anuncios pausar / mantener / escalar.',
    'Nueva version de seguimiento comercial con script.',
  ], [0.09, 0.19, 0.18]);
  drawFooter(pages[3], 4);

  drawHeader(pages[4], 'Pagina 5 · Playbook comercial');
  let y4 = 700;
  y4 = drawCard(pages[4], 42, y4, 513, 'Guion base de llamada (15 min)', [
    'Apertura: vi 2 senales que estan subiendo tu costo por resultado.',
    'Diagnostico: hoy gastas mas en canales que no siempre traen mejor intencion.',
    'Plan: en 7 dias ordenamos adquisicion y seguimiento con prioridades por impacto.',
    'Cierre: te muestro sprint exacto para tu caso y salimos con acciones claras.',
  ], [0.12, 0.16, 0.27]);
  drawCard(pages[4], 42, y4, 513, 'Objeciones frecuentes y respuesta', [
    'No tengo tiempo -> por eso se usa sprint con una decision diaria.',
    'Ya tengo agencia -> esto ordena decision y seguimiento interno.',
    'No quiero cambiar todo -> no cambiamos todo, solo lo que mas impacta primero.',
    ...nicheConfig.playbookHints,
  ], [0.18, 0.12, 0.22]);
  drawFooter(pages[4], 5);

  drawHeader(pages[5], 'Pagina 6 · Checklist de implementacion y control');
  let y5 = 700;
  y5 = drawCard(pages[5], 42, y5, 513, 'Checklist operativo', [
    'Owner por canal y owner de seguimiento.',
    'Tablero unico: CPL, CPA, lead->reunion, reunion->cierre.',
    'Ritmo semanal de 30 min: decidir, no reportar.',
    'Hipotesis activa por canal (solo 1 critica por semana).',
    'Backlog de aprendizajes por sprint.',
  ], [0.1, 0.2, 0.16]);
  y5 = drawCard(pages[5], 42, y5, 513, 'Siguiente paso', [
    `Agendar sprint de auditoria: ${domain}/auth/signup?source=audit`,
    `Abrir Nexora Studio: ${videoStudioUrl}`,
    'Responder este correo con la palabra PRIORIDADES para una guia por nicho.',
  ], [0.2, 0.12, 0.07]);
  drawFooter(pages[5], 6);

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
  const preview =
    `Adjunto: PDF ejecutivo de 6 paginas para ${nicheLabel} con scorecard, matriz de decisiones, sprint y guion comercial.`;

  const html = `
    <div style="background:#060816;padding:32px 16px;font-family:Arial,sans-serif;color:#e2e8f0;">
      <div style="max-width:640px;margin:0 auto;background:#0f172a;border:1px solid #334155;border-radius:28px;padding:32px;box-shadow:0 20px 60px rgba(2,6,23,0.4);">
        <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#94a3b8;">Kit operativo de auditoría</p>
        <h1 style="margin:0;font-size:32px;line-height:1.15;color:#f1f5f9;">${firstName}, aquí tienes tu kit para ejecutar.</h1>
        <p style="margin:18px 0 0;font-size:16px;line-height:1.8;color:#cbd5e1;">
          Preparé una entrega práctica para que salgas con decisiones claras hoy, no con teoría.
        </p>

        <div style="margin-top:28px;padding:24px;border-radius:22px;background:#1e293b;border:1px solid #475569;">
          <p style="margin:0 0 16px;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#cbd5e1;font-weight:600;">Qué recibes en este mail</p>
          <p style="margin:0 0 10px;font-size:15px;line-height:1.7;color:#e2e8f0;"><strong>Variante aplicada:</strong> ${nicheLabel}.</p>
          <p style="margin:0 0 10px;font-size:15px;line-height:1.7;color:#e2e8f0;"><strong>Adjunto PDF premium (6 páginas):</strong> diagnóstico, scorecard y matriz de prioridades.</p>
          <p style="margin:0 0 10px;font-size:15px;line-height:1.7;color:#e2e8f0;"><strong>Sprint de 7 días:</strong> plan diario para ejecutar con foco y medir rápido.</p>
          <p style="margin:0;font-size:15px;line-height:1.7;color:#e2e8f0;"><strong>Playbook comercial:</strong> guion de llamada + respuestas a objeciones frecuentes.</p>
        </div>

        <div style="margin-top:20px;padding:20px;border-radius:20px;background:#172554;border:1px solid #3b82f6;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#bfdbfe;">Mini benchmark rápido</p>
          <p style="margin:0 0 8px;font-size:14px;line-height:1.65;color:#e0f2fe;">• Si tu CPL subió más de 20% en 14 días, revisa fatiga creativa antes de subir presupuesto.</p>
          <p style="margin:0 0 8px;font-size:14px;line-height:1.65;color:#e0f2fe;">• Si tu tasa lead→reunión está por debajo del 20%, el cuello está en seguimiento, no en tráfico.</p>
          <p style="margin:0;font-size:14px;line-height:1.65;color:#e0f2fe;">• Si tus campañas no tienen hipótesis por canal, prioriza un test por semana y no 6 cambios al mismo tiempo.</p>
        </div>

        <div style="margin-top:22px;padding:20px;border-radius:20px;background:#0f9488;border:1px solid #14b8a6;">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#f0fdfa;font-weight:600;">
            ¿Quieres que te ayudemos a aplicar este plan con tu cuenta real?
          </p>
          <p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:#f0fdfa;">
            En 15 minutos definimos el primer sprint con prioridades por impacto.
          </p>
        </div>
        <div style="margin-top:28px;display:flex;flex-wrap:wrap;gap:12px;">
          <a href="${links.signupUrl}" style="display:inline-block;border-radius:999px;padding:12px 18px;background:#fb923c;color:#fff7ed;text-decoration:none;font-weight:600;text-align:center;">Agendar sprint de auditoría (15 min)</a>
          <a href="${links.aiStudioUrl}" style="display:inline-block;border-radius:999px;padding:12px 18px;background:#1e293b;border:1px solid #475569;color:#cbd5e1;text-decoration:none;font-weight:600;text-align:center;">Abrir estudio de video</a>
        </div>
        <div style="margin-top:30px;padding-top:22px;border-top:1px solid #475569;">
          <p style="margin:0;font-size:13px;line-height:1.8;color:#94a3b8;">${preview}</p>
          <p style="margin:10px 0 0;font-size:13px;line-height:1.8;color:#94a3b8;">
            Responde este correo con la palabra <strong>PRIORIDADES</strong> y te enviamos una guía corta para ordenar tu semana.
          </p>
        </div>
      </div>
    </div>
  `;

  const text = [
    `Hola ${firstName},`,
    '',
    'Tu dossier premium de auditoria Nexora ya esta listo (adjunto en PDF de 6 paginas).',
    `Variante aplicada: ${nicheLabel}.`,
    '',
    'Incluye:',
    '- Diagnostico y scorecard operativo de 15 puntos.',
    '- Matriz impacto/esfuerzo para priorizar acciones.',
    '- Sprint de 7 dias y playbook comercial.',
    '',
    'Mini benchmark rapido:',
    '- Si CPL subio >20% en 14 dias, revisa fatiga creativa primero.',
    '- Si lead->reunion <20%, el cuello esta en seguimiento.',
    '- Si no hay hipotesis por canal, haz un test por semana y mide.',
    '',
    'Agendar sprint de auditoria (15 min):',
    links.signupUrl,
    '',
    'Abrir estudio de video:',
    links.aiStudioUrl,
    '',
    'Responde con la palabra PRIORIDADES y te enviamos una guia corta para ordenar tu semana.',
  ].join('\n');

  const attachments = [await buildAuditKitAttachment(firstName, niche)];

  return { subject, preview, html, text, attachments };
}
