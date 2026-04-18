'use client';

import { useSearchParams } from 'next/navigation';
import { buildAuditPdfPath } from '@/lib/audit-flow';

/**
 * Lee `t` desde la URL real del navegador. Evita fallos si los searchParams
 * del Server Component no coinciden con la query (p. ej. tipos o hidratación).
 */
export function AuditPdfLinkFromQuery() {
  const sp = useSearchParams();
  const t = sp.get('t')?.trim() ?? '';
  if (!t) return null;
  const href = buildAuditPdfPath(t);
  return (
    <p className="mt-6 text-center text-sm sm:text-left">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-teal-300 underline decoration-teal-500/50 underline-offset-4 hover:text-teal-200"
      >
        Ver tu auditoría completa
      </a>
    </p>
  );
}
