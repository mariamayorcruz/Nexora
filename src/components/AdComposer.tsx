'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type BrandConfig = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  terracottaColor: string;
  businessName: string;
  logoUrl?: string;
};

type AdComposerProps = {
  imageUrl: string;
  headline: string;
  subline?: string;
  cta?: string;
  brand: BrandConfig;
  format: 'square' | 'story';
  onExport?: (dataUrl: string) => void;
};

const FORMATS = {
  square: { width: 1080, height: 1080, label: 'Instagram 1:1' },
  story: { width: 1080, height: 1920, label: 'Story 9:16' },
};

export default function AdComposer({
  imageUrl,
  headline,
  subline,
  cta,
  brand,
  format,
  onExport,
}: AdComposerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [composing, setComposing] = useState(false);
  const [done, setDone] = useState(false);

  const compose = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setComposing(true);
    setDone(false);

    const { width, height } = FORMATS[format];
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setComposing(false);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = imageUrl;
    });

    if (img.complete && img.naturalWidth > 0) {
      const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
      const sw = img.naturalWidth * scale;
      const sh = img.naturalHeight * scale;
      const sx = (width - sw) / 2;
      const sy = (height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh);
    } else {
      ctx.fillStyle = '#0d1e2e';
      ctx.fillRect(0, 0, width, height);
    }

    const grad = ctx.createLinearGradient(0, height * 0.35, 0, height);
    grad.addColorStop(0, 'rgba(10,20,30,0)');
    grad.addColorStop(0.5, 'rgba(10,20,30,0.75)');
    grad.addColorStop(1, 'rgba(10,20,30,0.97)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const barGrad = ctx.createLinearGradient(0, 0, width, 0);
    barGrad.addColorStop(0, brand.primaryColor);
    barGrad.addColorStop(0.5, brand.accentColor);
    barGrad.addColorStop(1, brand.terracottaColor);
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, width, 8);

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `bold ${Math.round(width * 0.022)}px Georgia, serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(brand.businessName.toUpperCase(), width - 40, 36);

    const tagY = height * (format === 'story' ? 0.62 : 0.58);
    const tagText = 'Salt Lake County';
    const tagFontSize = Math.round(width * 0.024);
    ctx.font = `bold ${tagFontSize}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    const tagW = ctx.measureText(tagText).width + 32;
    const tagH = tagFontSize + 16;
    ctx.fillStyle = brand.primaryColor;
    ctx.beginPath();
    ctx.roundRect(40, tagY, tagW, tagH, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, 56, tagY + tagH / 2);

    const headlineSize = Math.round(width * (format === 'story' ? 0.068 : 0.072));
    ctx.font = `bold ${headlineSize}px Georgia, serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const maxWidth = width - 80;
    const words = headline.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) lines.push(currentLine);

    const headlineY = tagY + tagH + 20;
    const lineH = headlineSize * 1.25;
    lines.slice(0, 3).forEach((line, i) => {
      ctx.fillStyle = i === 0 ? '#ffffff' : 'rgba(255,255,255,0.9)';
      ctx.fillText(line, 40, headlineY + i * lineH);
    });

    if (subline) {
      const subY = headlineY + lines.length * lineH + 16;
      const subSize = Math.round(width * 0.032);
      ctx.font = `${subSize}px Arial, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(subline, 40, subY);
    }

    const ctaText = cta || 'Cotización gratis →';
    const ctaY = height - (format === 'story' ? 160 : 120);
    const ctaSize = Math.round(width * 0.032);
    ctx.font = `bold ${ctaSize}px Arial, sans-serif`;
    const ctaW = ctx.measureText(ctaText).width + 48;
    const ctaH = ctaSize + 24;
    ctx.fillStyle = brand.primaryColor;
    ctx.beginPath();
    ctx.roundRect(40, ctaY, ctaW, ctaH, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(ctaText, 64, ctaY + ctaH / 2);

    ctx.font = `${Math.round(width * 0.024)}px Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('mayorexcelsior.com', 40, height - 32);

    setComposing(false);
    setDone(true);

    if (onExport) {
      onExport(canvas.toDataURL('image/jpeg', 0.92));
    }
  }, [brand.accentColor, brand.businessName, brand.primaryColor, brand.terracottaColor, cta, format, headline, imageUrl, onExport, subline]);

  useEffect(() => {
    if (imageUrl && !imageUrl.startsWith('__gemini_description__')) {
      void compose();
    }
  }, [compose, imageUrl]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `mayor-excelsior-ad-${format}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
  };

  const previewScale = format === 'story' ? 0.22 : 0.32;
  const { width, height, label } = FORMATS[format];

  return (
    <div className="rounded-[20px] bg-[#030610] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <div className="flex gap-2">
          {done && (
            <button
              type="button"
              onClick={download}
              className="flex items-center gap-1.5 rounded-full bg-cyan-500 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-cyan-400"
            >
              ↓ Descargar
            </button>
          )}
        </div>
      </div>
      <div
        style={{
          width: width * previewScale,
          height: height * previewScale,
          overflow: 'hidden',
          borderRadius: 8,
          margin: '0 auto',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: width * previewScale,
            height: height * previewScale,
            display: 'block',
          }}
        />
      </div>
      {composing && (
        <p className="mt-2 text-center text-xs text-slate-500">Componiendo ad...</p>
      )}
    </div>
  );
}
