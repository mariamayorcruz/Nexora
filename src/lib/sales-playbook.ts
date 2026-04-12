export type SalesStage = 'lead' | 'contacted' | 'qualified' | 'proposal' | 'won';

export type StagePlaybook = {
  stage: SalesStage;
  title: string;
  objective: string;
  checklist: string[];
  suggestedAction: string;
  confidence: number;
};

const PLAYBOOK: Record<SalesStage, StagePlaybook> = {
  lead: {
    stage: 'lead',
    title: 'Lead',
    objective: 'Confirmar interés real y contexto básico del negocio.',
    checklist: [
      'Validar canal de contacto principal.',
      'Identificar problema principal y urgencia.',
      'Definir siguiente micro-compromiso (llamada o demo).',
    ],
    suggestedAction: 'Contactar en menos de 24h para validar necesidad y agenda.',
    confidence: 25,
  },
  contacted: {
    stage: 'contacted',
    title: 'Contactado',
    objective: 'Lograr conversación útil y mapear dolor + presupuesto.',
    checklist: [
      'Confirmar problema de negocio que más impacta hoy.',
      'Cuantificar impacto o costo de no resolverlo.',
      'Acordar paso de diagnóstico o propuesta.',
    ],
    suggestedAction: 'Enviar resumen de conversación y propuesta de diagnóstico.',
    confidence: 45,
  },
  qualified: {
    stage: 'qualified',
    title: 'Calificado',
    objective: 'Alinear oferta, tomador de decisión y ventana de cierre.',
    checklist: [
      'Confirmar tomador de decisión y stakeholders.',
      'Definir objetivo comercial medible del cliente.',
      'Preparar propuesta enfocada en resultado esperado.',
    ],
    suggestedAction: 'Presentar plan de implementación con alcance y cronograma.',
    confidence: 65,
  },
  proposal: {
    stage: 'proposal',
    title: 'Propuesta',
    objective: 'Resolver objeciones y cerrar con siguiente paso claro.',
    checklist: [
      'Responder objeciones de precio, tiempo y riesgo.',
      'Mostrar caso o evidencia de resultado similar.',
      'Acordar fecha de decisión y forma de inicio.',
    ],
    suggestedAction: 'Hacer follow-up de cierre con oferta y fecha límite.',
    confidence: 82,
  },
  won: {
    stage: 'won',
    title: 'Cerrado',
    objective: 'Asegurar onboarding y primera victoria temprana.',
    checklist: [
      'Confirmar kickoff y responsables.',
      'Solicitar accesos y activos necesarios.',
      'Definir meta de los primeros 7 días.',
    ],
    suggestedAction: 'Enviar bienvenida y checklist de implementación.',
    confidence: 100,
  },
};

export const SALES_STAGE_ORDER: SalesStage[] = ['lead', 'contacted', 'qualified', 'proposal', 'won'];

export function getPlaybook(stage: string): StagePlaybook {
  const key = (stage || 'lead') as SalesStage;
  return PLAYBOOK[key] || PLAYBOOK.lead;
}

export function getAllPlaybooks(): StagePlaybook[] {
  return SALES_STAGE_ORDER.map((stage) => PLAYBOOK[stage]);
}

export function suggestNextAction(params: { stage: string; leadName?: string | null; source?: string | null }): string {
  const guide = getPlaybook(params.stage);
  const lead = params.leadName?.trim() || 'este lead';
  const source = params.source?.trim() ? ` desde ${params.source}` : '';
  return `${guide.suggestedAction} (${lead}${source})`;
}

export function suggestConfidence(stage: string): number {
  return getPlaybook(stage).confidence;
}
