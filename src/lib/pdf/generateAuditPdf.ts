import { PDFDocument, PDFName, PDFString, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { AUDIT_FALLBACK_NAME, displayNameForAudit, getAuditPricingUrl } from '@/lib/audit-flow';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 58;
const CONTENT_W = PAGE_W - MARGIN * 2;
const PAD = 18;
const GAP_XL = 72;
const GAP_LG = 56;
const GAP_MD = 44;

const BG = rgb(0.995, 0.996, 0.998);
const INK = rgb(0.04, 0.07, 0.14);
const INK_SOFT = rgb(0.12, 0.16, 0.26);
const BODY = rgb(0.36, 0.4, 0.46);
const MUTED = rgb(0.5, 0.54, 0.6);
const RULE = rgb(0.86, 0.89, 0.94);
const PANEL = rgb(0.97, 0.98, 0.995);
const PANEL_DEEP = rgb(0.93, 0.95, 0.99);
const PANEL_WARM = rgb(0.99, 0.976, 0.968);
const STRIPE = rgb(0.18, 0.28, 0.48);
const ACCENT = rgb(0.62, 0.48, 0.22);

export type GenerateAuditPdfOptions = {
  recipientName?: string | null;
  recipientEmail?: string | null;
  recipientDisplayName?: string | null;
  variantLabel?: string | null;
};

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';

  const pushChunk = (chunk: string) => {
    if (!chunk) return;
    let rest = chunk;
    while (rest && font.widthOfTextAtSize(rest, size) > maxW) {
      let cut = rest.length;
      while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxW) cut -= 1;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    if (rest) lines.push(rest);
  };

  for (const word of words) {
    if (font.widthOfTextAtSize(word, size) > maxW) {
      if (cur) {
        lines.push(cur);
        cur = '';
      }
      pushChunk(word);
      continue;
    }

    const next = cur ? `${cur} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxW) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = word;
    }
  }

  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function sanitizePdfField(value: string | null | undefined, maxLen: number): string | null {
  const text = String(value ?? '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, maxLen) : null;
}

function pageBg(page: PDFPage) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: BG });
}

function drawFooter(page: PDFPage, font: PDFFont, index: number, total: number) {
  const y = 46;
  page.drawLine({
    start: { x: MARGIN, y: y + 14 },
    end: { x: PAGE_W - MARGIN, y: y + 14 },
    thickness: 0.45,
    color: RULE,
  });
  page.drawText('Tu equipo', { x: MARGIN, y, size: 7.5, font, color: MUTED });
  const text = `${index} · ${total}`;
  const width = font.widthOfTextAtSize(text, 7.5);
  page.drawText(text, { x: PAGE_W - MARGIN - width, y, size: 7.5, font, color: MUTED });
}

function drawTextBlock(
  page: PDFPage,
  text: string,
  y: number,
  x: number,
  maxW: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  lineLead: number
) {
  let nextY = y;
  for (const line of wrapText(text, font, size, maxW)) {
    page.drawText(line, { x, y: nextY, size, font, color });
    nextY -= lineLead;
  }
  return nextY;
}

function drawHCenter(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color: ReturnType<typeof rgb>) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (PAGE_W - width) / 2, y, size, font, color });
}

/**
 * Título de cabecera en tarjeta: `wrapText` + varias líneas con interlineado `size * 1.12`.
 * La **última línea** queda en `yLastLineBaseline` (p. ej. `cardY + cardHeight - 52`) para no desplazar el cuerpo.
 */
function drawWrappedHeadTitle(
  page: PDFPage,
  text: string,
  x: number,
  yLastLineBaseline: number,
  maxW: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>
) {
  const lines = wrapText(text, font, size, maxW);
  const lineLead = size * 1.12;
  let y = yLastLineBaseline + (lines.length - 1) * lineLead;
  for (const line of lines) {
    page.drawText(line, { x, y, size, font, color });
    y -= lineLead;
  }
}

function measureBulletBlock(
  items: string[],
  font: PDFFont,
  size: number,
  maxW: number,
  lead: number,
  indent: number
) {
  let height = 0;
  for (const item of items) {
    const lines = wrapText(item, font, size, maxW - indent - 4);
    height += lines.length * lead + 8;
  }
  return height;
}

function drawBullets(
  page: PDFPage,
  items: string[],
  x: number,
  yTop: number,
  maxW: number,
  font: PDFFont,
  fontBold: PDFFont,
  size: number,
  bottomLimit: number,
  bulletColor: ReturnType<typeof rgb> = STRIPE,
  textColor: ReturnType<typeof rgb> = BODY
) {
  const lead = size * 1.62;
  const indent = 18;
  let nextY = yTop;
  const innerW = Math.max(40, maxW - indent - 6);

  for (const item of items) {
    const lines = wrapText(item, font, size, innerW);
    for (let i = 0; i < lines.length; i += 1) {
      if (nextY < bottomLimit + size) break;
      if (i === 0) page.drawText('·', { x, y: nextY, size: size + 2, font: fontBold, color: bulletColor });
      page.drawText(lines[i], { x: x + indent, y: nextY, size, font, color: textColor });
      nextY -= lead;
    }
    nextY -= 6;
  }
  return nextY;
}

export async function generateAuditPdf(options?: GenerateAuditPdfOptions): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pricingUrl = getAuditPricingUrl();

  const preparedFor = sanitizePdfField(
    options?.recipientDisplayName ||
      displayNameForAudit(options?.recipientName, options?.recipientEmail || 'cliente@gotnexora.com'),
    72
  ) || AUDIT_FALLBACK_NAME;
  const variantLine = sanitizePdfField(options?.variantLabel, 48);
  const totalPages = 6;

  // P1 PORTADA
  {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    pageBg(page);

    const bandH = 118;
    const barDeep = rgb(0.04, 0.07, 0.15);
    const onDarkMuted = rgb(0.78, 0.82, 0.9);
    const onDark = rgb(0.99, 0.99, 1);

    page.drawRectangle({ x: 0, y: PAGE_H - bandH, width: PAGE_W, height: bandH, color: barDeep });
    page.drawRectangle({ x: 0, y: PAGE_H - bandH, width: 10, height: bandH, color: ACCENT });
    page.drawRectangle({ x: 0, y: PAGE_H - bandH - 3, width: PAGE_W, height: 3, color: STRIPE });

    page.drawText('INFORME ESTRATÉGICO', {
      x: MARGIN,
      y: PAGE_H - 36,
      size: 8.5,
      font: fontBold,
      color: onDarkMuted,
    });
    page.drawText('AUDITORÍA ESTRATÉGICA', {
      x: MARGIN,
      y: PAGE_H - 58,
      size: 21,
      font: fontBold,
      color: onDark,
    });
    page.drawText('NEXORA', {
      x: MARGIN,
      y: PAGE_H - 92,
      size: 34,
      font: fontBold,
      color: rgb(0.95, 0.82, 0.55),
    });

    let y = PAGE_H - bandH - 42;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 1.2,
      color: RULE,
    });
    y -= 36;

    const subtitle =
      'Diagnóstico claro de lo que está frenando tus resultados y cómo corregirlo esta semana.';
    y = drawTextBlock(page, subtitle, y, MARGIN, CONTENT_W, fontBold, 15, INK_SOFT, 22);

    y -= 40;

    const innerW = CONTENT_W - 2 * PAD;
    const variantExtra = variantLine ? wrapText(variantLine, font, 12.5, innerW - 8).length * 20 + GAP_MD + 8 : 0;
    const boxH = 128 + variantExtra;
    const boxY = y - boxH;

    page.drawRectangle({
      x: MARGIN,
      y: boxY,
      width: CONTENT_W,
      height: boxH,
      color: PANEL_DEEP,
      borderColor: INK_SOFT,
      borderWidth: 1.25,
    });
    page.drawRectangle({ x: MARGIN, y: boxY, width: 8, height: boxH, color: STRIPE });
    page.drawRectangle({
      x: MARGIN + 8,
      y: boxY + boxH - 6,
      width: CONTENT_W - 8,
      height: 6,
      color: ACCENT,
    });

    let by = boxY + boxH - PAD - 8;
    page.drawText('PREPARADO PARA', {
      x: MARGIN + PAD + 6,
      y: by,
      size: 9,
      font: fontBold,
      color: MUTED,
    });
    by -= 30;
    page.drawText(preparedFor, {
      x: MARGIN + PAD + 6,
      y: by,
      size: 22,
      font: fontBold,
      color: INK,
    });
    if (variantLine) {
      by -= GAP_MD + 6;
      page.drawText('Enfoque', { x: MARGIN + PAD + 6, y: by, size: 10, font: fontBold, color: MUTED });
      by -= 22;
      drawTextBlock(page, variantLine, by, MARGIN + PAD + 6, innerW - 8, font, 12.5, BODY, 19);
    }

    const midY = boxY - 56;
    page.drawLine({
      start: { x: MARGIN + 32, y: midY },
      end: { x: PAGE_W - MARGIN - 32, y: midY },
      thickness: 0.55,
      color: RULE,
    });

    drawTextBlock(page, 'Documento confidencial · Uso estratégico', 100, MARGIN, CONTENT_W, font, 9.5, MUTED, 14);

    drawFooter(page, font, 1, totalPages);
  }

  // P2 RESUMEN EJECUTIVO
  {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    pageBg(page);

    let y = PAGE_H - MARGIN;
    page.drawText('Resumen ejecutivo', { x: MARGIN, y, size: 30, font: fontBold, color: INK });
    y -= GAP_LG;

    y = drawTextBlock(
      page,
      'Analizamos tu situación y encontramos patrones claros que están afectando tus resultados. No es falta de esfuerzo, es falta de sistema.',
      y,
      MARGIN,
      CONTENT_W,
      font,
      12.5,
      BODY,
      19
    );

    y -= GAP_XL;

    const sections: { title: string; items: string[] }[] = [
      {
        title: 'Qué está fallando',
        items: [
          'Estás invirtiendo sin un sistema claro de conversión',
          'Parte de tus leads no está siendo aprovechada',
          'Hay decisiones que se toman sin datos unificados',
        ],
      },
      {
        title: 'Dónde se pierde oportunidad',
        items: ['Leads sin seguimiento', 'Tráfico sin conversión', 'Procesos desordenados'],
      },
      {
        title: 'Qué hacer esta semana',
        items: ['Corregir puntos de fuga', 'Ordenar seguimiento', 'Aplicar estructura antes de escalar'],
      },
    ];

    const innerW = CONTENT_W - 2 * PAD;
    for (let i = 0; i < sections.length; i += 1) {
      const section = sections[i];
      const bulletSize = 12;
      const lead = bulletSize * 1.55;
      const blockHeight = measureBulletBlock(section.items, font, bulletSize, innerW, lead, 17) + PAD * 2 + 28;
      const cardY = y - blockHeight;

      page.drawRectangle({
        x: MARGIN,
        y: cardY,
        width: CONTENT_W,
        height: blockHeight,
        color: i % 2 === 0 ? PANEL : PANEL_DEEP,
        borderColor: RULE,
        borderWidth: 1,
      });

      page.drawText(section.title, {
        x: MARGIN + PAD,
        y: cardY + blockHeight - PAD - 6,
        size: 17,
        font: fontBold,
        color: INK,
      });

      drawBullets(
        page,
        section.items,
        MARGIN + PAD,
        cardY + blockHeight - PAD - 38,
        innerW,
        font,
        fontBold,
        bulletSize,
        cardY + PAD
      );

      y = cardY - (i < sections.length - 1 ? GAP_LG : 0);
    }

    drawFooter(page, font, 2, totalPages);
  }

  // P3 DIAGNÓSTICO
  {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    pageBg(page);

    let y = PAGE_H - MARGIN;
    page.drawText('Diagnóstico inicial', { x: MARGIN, y, size: 30, font: fontBold, color: INK });
    y -= GAP_LG;

    y = drawTextBlock(
      page,
      'El problema no es generar más. El problema es que lo que ya generas no está funcionando como debería.',
      y,
      MARGIN,
      CONTENT_W,
      font,
      12.5,
      BODY,
      19
    );

    y -= GAP_XL;

    const mainItems = [
      'Falta de sistema claro para convertir leads',
      'Seguimiento inconsistente o inexistente',
      'Acciones sin estrategia',
    ];
    const innerMain = CONTENT_W - 8 - 2 * PAD;
    const mainHeight = PAD + 32 + measureBulletBlock(mainItems, font, 12, innerMain, 12 * 1.55, 17) + PAD;
    const mainY = y - mainHeight;

    page.drawRectangle({
      x: MARGIN,
      y: mainY,
      width: CONTENT_W,
      height: mainHeight,
      color: PANEL,
      borderColor: INK_SOFT,
      borderWidth: 1.5,
    });
    page.drawRectangle({ x: MARGIN, y: mainY, width: 7, height: mainHeight, color: STRIPE });

    page.drawText('Panel principal', {
      x: MARGIN + PAD + 8,
      y: mainY + mainHeight - PAD - 8,
      size: 11,
      font: fontBold,
      color: MUTED,
    });
    drawBullets(
      page,
      mainItems,
      MARGIN + PAD + 8,
      mainY + mainHeight - PAD - 34,
      innerMain,
      font,
      fontBold,
      12,
      mainY + PAD
    );

    const alertItems = [
      'Inviertes pero no sabes qué funciona',
      'Leads no avanzan',
      'No hay visibilidad del proceso',
    ];
    const alertWidth = CONTENT_W * 0.78;
    const alertX = PAGE_W - MARGIN - alertWidth;
    const alertInner = alertWidth - 2 * PAD;
    const alertHeight =
      PAD + 26 + measureBulletBlock(alertItems, font, 11.5, alertInner, 11.5 * 1.55, 17) + PAD;
    const alertY = mainY - GAP_LG - alertHeight;

    page.drawRectangle({
      x: alertX,
      y: alertY,
      width: alertWidth,
      height: alertHeight,
      color: PANEL_WARM,
      borderColor: rgb(0.88, 0.82, 0.78),
      borderWidth: 1,
    });
    page.drawText('Señales de alerta', {
      x: alertX + PAD,
      y: alertY + alertHeight - PAD - 8,
      size: 15,
      font: fontBold,
      color: INK_SOFT,
    });
    drawBullets(
      page,
      alertItems,
      alertX + PAD,
      alertY + alertHeight - PAD - 34,
      alertInner,
      font,
      fontBold,
      11.5,
      alertY + PAD
    );

    drawFooter(page, font, 3, totalPages);
  }

  // P4 FRENOS VS CRECIMIENTO
  {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    pageBg(page);

    let y = PAGE_H - MARGIN;
    page.drawText('Frenos vs crecimiento', { x: MARGIN, y, size: 30, font: fontBold, color: INK });
    y -= 22;
    page.drawText('Dos lecturas complementarias del mismo negocio', {
      x: MARGIN,
      y,
      size: 11.5,
      font: fontBold,
      color: MUTED,
    });
    y -= GAP_LG + 8;

    const gutter = 44;
    const columnWidth = (CONTENT_W - gutter) / 2;
    const stripeW = 9;
    const innerPad = 28;
    const headH = 84;
    const bulletSize = 13;
    const bulletLead = bulletSize * 1.62;

    const leftItems = [
      'Leads sin conversión',
      'Oportunidades perdidas',
      'Falta de claridad',
      'Decisiones sin dirección',
    ];
    const rightItems = [
      'Mejorar conversión sin más inversión',
      'Automatizar procesos',
      'Escalar con control',
      'Recuperar oportunidades',
    ];

    const leftFill = rgb(0.99, 0.96, 0.96);
    const leftBorder = rgb(0.78, 0.62, 0.62);
    const leftStripe = rgb(0.55, 0.28, 0.32);
    const leftHead = rgb(0.2, 0.11, 0.13);
    const leftBullet = rgb(0.48, 0.22, 0.26);
    const leftText = rgb(0.22, 0.2, 0.22);

    const rightFill = rgb(0.93, 0.98, 0.97);
    const rightBorder = rgb(0.55, 0.76, 0.72);
    const rightStripe = rgb(0.1, 0.52, 0.48);
    const rightHead = rgb(0.06, 0.35, 0.33);
    const rightBullet = rgb(0.08, 0.45, 0.42);
    const rightText = rgb(0.14, 0.22, 0.24);

    const leftInner = columnWidth - stripeW - 2 * innerPad;
    const rightInner = columnWidth - stripeW - 2 * innerPad;
    const bodyHeight = Math.max(
      measureBulletBlock(leftItems, font, bulletSize, leftInner, bulletLead, 18),
      measureBulletBlock(rightItems, font, bulletSize, rightInner, bulletLead, 18)
    );
    const bodyPad = 28;
    const cardHeight = headH + bodyPad + bodyHeight + bodyPad;
    const cardY = y - cardHeight;
    const leftX = MARGIN;
    const rightX = MARGIN + columnWidth + gutter;

    page.drawRectangle({
      x: leftX,
      y: cardY,
      width: columnWidth,
      height: cardHeight,
      color: leftFill,
      borderColor: leftBorder,
      borderWidth: 1.5,
    });
    page.drawRectangle({ x: leftX, y: cardY, width: stripeW, height: cardHeight, color: leftStripe });
    page.drawRectangle({ x: leftX, y: cardY + cardHeight - headH, width: columnWidth, height: headH, color: leftHead });
    page.drawText('Fricción y fugas', {
      x: leftX + stripeW + innerPad,
      y: cardY + cardHeight - 30,
      size: 9,
      font: fontBold,
      color: rgb(0.85, 0.72, 0.74),
    });
    drawWrappedHeadTitle(
      page,
      'Lo que te frena',
      leftX + stripeW + innerPad,
      cardY + cardHeight - 52,
      leftInner - 14,
      17,
      fontBold,
      rgb(0.99, 0.99, 1)
    );
    drawBullets(
      page,
      leftItems,
      leftX + stripeW + innerPad,
      cardY + cardHeight - headH - bodyPad,
      leftInner,
      font,
      fontBold,
      bulletSize,
      cardY + bodyPad,
      leftBullet,
      leftText
    );

    page.drawRectangle({
      x: rightX,
      y: cardY,
      width: columnWidth,
      height: cardHeight,
      color: rightFill,
      borderColor: rightBorder,
      borderWidth: 1.5,
    });
    page.drawRectangle({ x: rightX, y: cardY, width: stripeW, height: cardHeight, color: rightStripe });
    page.drawRectangle({ x: rightX, y: cardY + cardHeight - headH, width: columnWidth, height: headH, color: rightHead });
    page.drawText('Palancas de valor', {
      x: rightX + stripeW + innerPad,
      y: cardY + cardHeight - 30,
      size: 9,
      font: fontBold,
      color: rgb(0.65, 0.88, 0.84),
    });
    drawWrappedHeadTitle(
      page,
      'Dónde está el crecimiento',
      rightX + stripeW + innerPad,
      cardY + cardHeight - 52,
      rightInner - 14,
      16,
      fontBold,
      rgb(0.99, 0.99, 1)
    );
    drawBullets(
      page,
      rightItems,
      rightX + stripeW + innerPad,
      cardY + cardHeight - headH - bodyPad,
      rightInner,
      font,
      fontBold,
      bulletSize,
      cardY + bodyPad,
      rightBullet,
      rightText
    );

    const guideX = MARGIN + columnWidth + gutter / 2;
    page.drawLine({
      start: { x: guideX, y: cardY + 24 },
      end: { x: guideX, y: cardY + cardHeight - 24 },
      thickness: 1,
      color: rgb(0.88, 0.9, 0.92),
    });

    drawFooter(page, font, 4, totalPages);
  }

  // P5 SOLUCIÓN
  {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    pageBg(page);

    let y = PAGE_H - MARGIN;
    page.drawText('La solución', { x: MARGIN, y, size: 30, font: fontBold, color: INK });
    y -= GAP_LG;

    y = drawTextBlock(
      page,
      'No necesitas hacer más. Necesitas estructurar lo que ya tienes.',
      y,
      MARGIN,
      CONTENT_W,
      font,
      13,
      INK_SOFT,
      20
    );

    y -= GAP_XL;

    const solutionItems = [
      'Aplicar estrategias paso a paso',
      'Mejorar conversión',
      'Tener control sobre resultados',
      'Escalar con claridad',
    ];
    const boxInner = CONTENT_W - 10 - 2 * PAD;
    const boxHeight =
      PAD + 40 + measureBulletBlock(solutionItems, font, 12, boxInner, 12 * 1.55, 17) + PAD;
    const boxY = y - boxHeight;

    page.drawRectangle({
      x: MARGIN,
      y: boxY,
      width: CONTENT_W,
      height: boxHeight,
      color: PANEL,
      borderColor: STRIPE,
      borderWidth: 2,
    });
    page.drawRectangle({ x: MARGIN, y: boxY, width: 10, height: boxHeight, color: ACCENT });

    page.drawText('Con una plataforma integrada podrás:', {
      x: MARGIN + PAD + 10,
      y: boxY + boxHeight - PAD - 12,
      size: 16,
      font: fontBold,
      color: INK,
    });
    drawBullets(
      page,
      solutionItems,
      MARGIN + PAD + 10,
      boxY + boxHeight - PAD - 44,
      boxInner,
      font,
      fontBold,
      12,
      boxY + PAD
    );

    drawFooter(page, font, 5, totalPages);
  }

  // P6 SIGUIENTE PASO
  {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    pageBg(page);

    let y = PAGE_H - MARGIN - 32;
    drawHCenter(page, 'Tu siguiente paso', y, fontBold, 40, INK);
    y -= 58;

    drawHCenter(page, 'Ya sabes qué está fallando.', y, font, 13, BODY);
    y -= 28;
    drawHCenter(page, 'Puedes seguir igual o empezar a corregirlo hoy desde tu panel.', y, font, 13, BODY);
    y -= 96;

    const btnW = 392;
    const btnH = 92;
    const matPadX = 48;
    const matPadY = 44;
    const matW = btnW + matPadX * 2;
    const matH = btnH + matPadY * 2;
    const matX = (PAGE_W - matW) / 2;
    const matY = y - matH;

    page.drawRectangle({
      x: matX,
      y: matY,
      width: matW,
      height: matH,
      color: rgb(0.96, 0.97, 0.99),
      borderColor: STRIPE,
      borderWidth: 2,
    });
    page.drawRectangle({
      x: matX,
      y: matY + matH - 5,
      width: matW,
      height: 5,
      color: ACCENT,
    });

    const btnX = (PAGE_W - btnW) / 2;
    const btnY = matY + matPadY;
    page.drawRectangle({
      x: btnX,
      y: btnY,
      width: btnW,
      height: btnH,
      color: rgb(0.05, 0.09, 0.18),
      borderColor: rgb(0.12, 0.2, 0.38),
      borderWidth: 2,
    });
    page.drawRectangle({ x: btnX, y: btnY, width: 8, height: btnH, color: ACCENT });

    const label = 'Suscríbete ahora';
    const fontSize = 22;
    const labelWidth = fontBold.widthOfTextAtSize(label, fontSize);
    page.drawText(label, {
      x: (PAGE_W - labelWidth) / 2,
      y: btnY + (btnH - fontSize) / 2 + 4,
      size: fontSize,
      font: fontBold,
      color: rgb(0.99, 0.99, 1),
    });

    const ctx = page.doc.context;
    const link = ctx.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [btnX, btnY, btnX + btnW, btnY + btnH],
      Border: [0, 0, 0],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of(pricingUrl),
      },
    });
    const linkRef = ctx.register(link);
    const annots = page.node.Annots();
    if (annots) annots.push(linkRef);
    else page.node.set(PDFName.of('Annots'), ctx.obj([linkRef]));

    let footerY = matY - 64;
    footerY -= GAP_MD + 12;
    page.drawLine({
      start: { x: MARGIN + 60, y: footerY + 12 },
      end: { x: PAGE_W - MARGIN - 60, y: footerY + 12 },
      thickness: 0.5,
      color: RULE,
    });
    footerY -= GAP_LG;

    const footerLines = wrapText(
      'Si prefieres que lo revisemos contigo, puedes responder este correo.',
      font,
      12,
      CONTENT_W - 100
    );
    for (const line of footerLines) {
      drawHCenter(page, line, footerY, font, 12, MUTED);
      footerY -= 18;
    }

    drawFooter(page, font, 6, totalPages);
  }

  return pdfDoc.save();
}
