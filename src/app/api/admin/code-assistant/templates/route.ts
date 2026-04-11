import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  return NextResponse.json({
    templates: [
      {
        id: 'saas-crm-core',
        label: 'SaaS CRM Core',
        mode: 'build',
        task: 'Construye un modulo CRM base con leads, etapas, notas y tareas. Incluye API, paginas, validacion y pruebas.',
        filePath: 'src/app/dashboard/crm/page.tsx',
        stackHint: 'Next.js 14 + TypeScript + Prisma + API Routes',
      },
      {
        id: 'growth-funnel-automation',
        label: 'Funnel Automation',
        mode: 'build',
        task: 'Crea automatizaciones de funnel: captura, scoring, seguimiento y alertas. Incluye cron/reintentos y auditoria.',
        filePath: 'src/app/dashboard/funnel/page.tsx',
        stackHint: 'Next.js + Prisma + background jobs + email workflows',
      },
      {
        id: 'support-bot-ops',
        label: 'Support Bot Ops',
        mode: 'build',
        task: 'Implementa bot de soporte con handoff a humano, historico de conversaciones y panel de supervisión.',
        filePath: 'src/app/dashboard/support/page.tsx',
        stackHint: 'Next.js + API + message history + escalation workflow',
      },
      {
        id: 'saas-release-guard',
        label: 'Ship With Guardrails',
        mode: 'ship',
        task: 'Prepara checklist de release de Nexora con smoke tests, rollback, feature flags y monitoreo post-deploy.',
        filePath: '',
        stackHint: 'Vercel + Next.js + CI/CD + release checklist',
      },
    ],
  });
}
