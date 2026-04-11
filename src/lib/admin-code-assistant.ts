export type AdminCodeAssistantMode =
  | 'review'
  | 'fix'
  | 'explain'
  | 'build'
  | 'debug'
  | 'refactor'
  | 'test'
  | 'ship';

interface AdminCodeAssistantInput {
  mode: AdminCodeAssistantMode;
  task: string;
  code?: string;
  filePath?: string;
  stackHint?: string;
  repoContext?: string;
}

export interface CodeFile {
  path: string;
  action: 'create' | 'modify' | 'delete';
  code: string;
}

export interface AdminCodeAssistantResult {
  summary: string;
  diagnosis: string[];
  patch: string;
  codeFiles: CodeFile[];
  tests: string[];
  risks: string[];
  executionPlan: string[];
  commands: string[];
  touchedFiles: string[];
  qualityGates: string[];
  limitations: string[];
  model: string;
  usedFallback: boolean;
  localReady?: boolean;
}

export function autoDetectMode(task: string): AdminCodeAssistantMode {
  const lower = task.toLowerCase();
  if (/build|creat|construi|nuevo archivo|nuevo componente|generat|scaffold|agreg/.test(lower)) return 'build';
  if (/fix|arregla|error|bug|falla|roto|no funciona|500|404|rompe|broken/.test(lower)) return 'fix';
  if (/explica|qué hace|entender|cómo funciona|explain|qué es/.test(lower)) return 'explain';
  if (/debug|depura|raíz|causa raiz|stack trace|crash|excepción|traza/.test(lower)) return 'debug';
  if (/refactor|limpia|mejora|optimiza|simplifica|reorganiza/.test(lower)) return 'refactor';
  if (/test|prueba|coverage|spec|jest|vitest|testea/.test(lower)) return 'test';
  if (/ship|deploy|release|producción|prd|lanzamiento|launch/.test(lower)) return 'ship';
  return 'review';
}

const DEFAULT_MODEL = process.env.ADMIN_CODE_MODEL || 'gpt-4.1-mini';
const DEFAULT_MAX_RETRIES = Number(process.env.ADMIN_CODE_MAX_RETRIES || 3);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:1.5b';

function buildSystemPrompt() {
  return [
    'You are Nexora Code Admin Assistant.',
    'Your user is an admin fixing a production SaaS app.',
    'Style target: concise, practical, VS Code + Codex-like engineering guidance.',
    'Think like a senior software engineer doing production support and delivery.',
    'Always prioritize: bugs, regressions, validation, security, and testability.',
    'When mode=review: output findings ordered by severity (critical/high/medium/low).',
    'When mode=fix: output an apply-ready patch with minimal blast radius.',
    'When mode=explain: include what changed, why, risks, and how to verify.',
    'When mode=build: propose full-stack implementation steps, backend + frontend + API contracts.',
    'When mode=debug: isolate probable root cause, add instrumentation, and propose fast verification steps.',
    'When mode=refactor: preserve behavior and improve readability, maintainability, and testability.',
    'When mode=test: generate a practical test plan and sample tests for key risks.',
    'When mode=ship: provide release checklist, migration checks, rollback strategy, and smoke tests.',
    'You can reason over complete repositories and multi-file changes when repository context is provided.',
    'Always produce executionPlan in phases: Discover, Implement, Validate, Ship.',
    'In each phase include retry/rollback notes when relevant.',
    'Be explicit about assumptions and unknowns, but still provide best-effort output.',
    'Do not output harmful instructions, secrets, or destructive commands.',
    'Return STRICT JSON with keys: summary, diagnosis, patch, codeFiles, tests, risks, executionPlan, commands, touchedFiles, qualityGates, limitations.',
    'patch must be a unified diff or code block with exact edits.',
    'codeFiles must be an array of objects with {path: string, action: "create"|"modify"|"delete", code: string} — one entry per file touched; code must be complete file content or the changed section.',
    'diagnosis/tests/risks must be arrays of short strings.',
    'executionPlan/commands/touchedFiles/qualityGates/limitations must be arrays of short strings.',
    'Do not output generic advice when code or filePath is provided; be concrete and specific.',
  ].join(' ');
}

function buildUserPrompt(input: AdminCodeAssistantInput) {
  return JSON.stringify(
    {
      mode: input.mode,
      task: input.task,
      filePath: input.filePath || null,
      stackHint: input.stackHint || 'Next.js 14 + TypeScript + Prisma',
      code: input.code || '',
      repoContext: input.repoContext || '',
      constraints: [
        'Prefer smallest safe patch.',
        'Preserve API compatibility unless task requires otherwise.',
        'Include missing validations and edge cases.',
        'If information is missing, state assumptions and still provide a best-effort patch.',
        'Prioritize commands that can run in VS Code terminal safely.',
        'When possible, include commands to create files/folders and run tests automatically.',
      ],
    },
    null,
    2
  );
}

async function requestAssistantJson(input: AdminCodeAssistantInput, apiKey: string) {
  let lastError = '';

  for (let attempt = 1; attempt <= Math.max(1, DEFAULT_MAX_RETRIES); attempt++) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.15,
        max_output_tokens: 1800,
        input: [
          {
            role: 'system',
            content: [{ type: 'text', text: buildSystemPrompt() }],
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  attempt === 1
                    ? buildUserPrompt(input)
                    : `${buildUserPrompt(input)}\n\nPrevious attempt failed strict JSON parsing. Return strict JSON only.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      lastError = `status ${response.status}`;
      continue;
    }

    const payload = (await response.json()) as { output_text?: string };
    const text = payload.output_text?.trim();

    if (!text) {
      lastError = 'empty_output';
      continue;
    }

    try {
      return {
        parsed: safeParseAssistantJson(text),
        rawText: text,
        attemptsUsed: attempt,
      };
    } catch {
      lastError = 'invalid_json';
      if (attempt === Math.max(1, DEFAULT_MAX_RETRIES)) {
        return { parsed: null, rawText: text, attemptsUsed: attempt, lastError };
      }
    }
  }

  return { parsed: null, rawText: '', attemptsUsed: Math.max(1, DEFAULT_MAX_RETRIES), lastError };
}

async function requestOllamaJson(input: AdminCodeAssistantInput) {
  let lastError = '';

  for (let attempt = 1; attempt <= Math.max(1, DEFAULT_MAX_RETRIES); attempt++) {
    try {
      const prompt = [
        buildSystemPrompt(),
        '',
        attempt === 1
          ? buildUserPrompt(input)
          : `${buildUserPrompt(input)}\n\nPrevious attempt failed strict JSON parsing. Return strict JSON only.`,
      ].join('\n');

      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt,
          stream: false,
          options: {
            temperature: 0.15,
          },
        }),
      });

      if (!response.ok) {
        lastError = `status ${response.status}`;
        continue;
      }

      const payload = (await response.json()) as { response?: string };
      const text = payload.response?.trim();

      if (!text) {
        lastError = 'empty_output';
        continue;
      }

      try {
        return {
          parsed: safeParseAssistantJson(text),
          rawText: text,
          attemptsUsed: attempt,
        };
      } catch {
        lastError = 'invalid_json';
        if (attempt === Math.max(1, DEFAULT_MAX_RETRIES)) {
          return { parsed: null, rawText: text, attemptsUsed: attempt, lastError };
        }
      }
    } catch {
      lastError = 'connection_error';
    }
  }

  return { parsed: null, rawText: '', attemptsUsed: Math.max(1, DEFAULT_MAX_RETRIES), lastError };
}

function safeParseAssistantJson(text: string): Omit<AdminCodeAssistantResult, 'model' | 'usedFallback'> {
  const parsed = JSON.parse(text) as Partial<AdminCodeAssistantResult>;
  return {
    summary: String(parsed.summary || 'Analisis completado.'),
    diagnosis: Array.isArray(parsed.diagnosis) ? parsed.diagnosis.map((item) => String(item)) : [],
    patch: String(parsed.patch || ''),
    codeFiles: Array.isArray(parsed.codeFiles)
      ? parsed.codeFiles
          .filter((item) => item && typeof item === 'object' && 'path' in item)
          .map((item) => ({
            path: String((item as CodeFile).path || ''),
            action: (['create', 'modify', 'delete'].includes((item as CodeFile).action)
              ? (item as CodeFile).action
              : 'modify') as CodeFile['action'],
            code: String((item as CodeFile).code || ''),
          }))
      : [],
    tests: Array.isArray(parsed.tests) ? parsed.tests.map((item) => String(item)) : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks.map((item) => String(item)) : [],
    executionPlan: Array.isArray(parsed.executionPlan) ? parsed.executionPlan.map((item) => String(item)) : [],
    commands: Array.isArray(parsed.commands) ? parsed.commands.map((item) => String(item)) : [],
    touchedFiles: Array.isArray(parsed.touchedFiles) ? parsed.touchedFiles.map((item) => String(item)) : [],
    qualityGates: Array.isArray(parsed.qualityGates) ? parsed.qualityGates.map((item) => String(item)) : [],
    limitations: Array.isArray(parsed.limitations) ? parsed.limitations.map((item) => String(item)) : [],
  };
}

function buildHeuristicPlan(input: AdminCodeAssistantInput) {
  const task = input.task.toLowerCase();
  const filePath = input.filePath || '';

  if (/ai studio|studio ia|video studio|smart edit/.test(task)) {
    return {
      summary:
        'Modo local guiado: AI Code ya puede proponerte una mejora útil para AI Studio aunque no haya modelo remoto activo.',
      diagnosis: [
        'AI Studio debe sentirse como un workspace único, no como muchas pantallas separadas.',
        'El usuario necesita control claro de la edición: silencios, música, captions, variantes y preview.',
        'La salida final debe convivir al lado del formulario y el historial debe quedar visible debajo.',
      ],
      patch: [
        '```md',
        'Sugerencia de refactor para AI Studio:',
        '- Unificar el builder y la preview en una sola vista de dos columnas.',
        '- Mantener tabs por familia: Video Studio, Copy Lab, Sales Assets.',
        '- En Smart Edit, exponer toggles para quitar silencios, música, captions y variantes.',
        '- Mostrar historial reciente y último output en la misma pantalla.',
        '- Reservar el render final para cuando exista proveedor conectado.',
        '```',
      ].join('\n'),
      codeFiles: [
        {
          path: filePath || 'src/app/dashboard/studio/page.tsx',
          action: 'modify' as const,
          code: [
            '// Objetivo recomendado',
            '// 1. Formulario y preview en dos columnas',
            '// 2. Toggles visibles para Smart Edit',
            '// 3. Historial debajo del editor',
            '// 4. Mensaje honesto si no hay render provider',
          ].join('\n'),
        },
        {
          path: 'src/lib/ai-studio.ts',
          action: 'modify' as const,
          code: [
            '// Extender output de smart-edit con:',
            '// removeSilences, addMusic, createCaptions, generateVariants',
            '// y devolver secciones más accionables para edición',
          ].join('\n'),
        },
      ],
      tests: [
        'Generar un output en modo ad-copy y otro en smart-edit.',
        'Verificar que los toggles de Smart Edit lleguen a la API.',
        'Confirmar que el historial muestre el último output sin romper la vista.',
      ],
      risks: [
        'Si se mezcla generación de estrategia con render real sin separación, la UX vuelve a confundir.',
        'Si el historial no se limita, la pantalla puede crecer demasiado.',
      ],
      executionPlan: [
        'Descubrir: revisar page.tsx de studio y ai-studio.ts para detectar bloques duplicados o ruido visual.',
        'Implementar: simplificar layout, mejorar preview y hacer más claros los toggles de edición.',
        'Validar: correr lint/build y probar un output de cada familia.',
        'Ship: dejar mensajes honestos cuando el render aún no exista y guardar historial útil.',
      ],
      commands: ['npm run lint', 'npm run build'],
      touchedFiles: [filePath || 'src/app/dashboard/studio/page.tsx', 'src/lib/ai-studio.ts'],
      qualityGates: [
        'AI Studio debe quedar utilizable desde una sola pantalla.',
        'Los modos de video no deben prometer render final si no existe proveedor.',
        'El historial debe verse claro y estable.',
      ],
      limitations: [
        'Esto sigue siendo guía local; para render final de video hace falta conectar proveedor o pipeline propio.',
      ],
    };
  }

  if (/funnel|crm|lead/.test(task)) {
    return {
      summary:
        'Modo local guiado: la prioridad aquí es unir funnel y CRM en una planilla comercial manipulable.',
      diagnosis: [
        'Funnel y CRM separados generan fricción y duplican contexto.',
        'El usuario necesita ver captados, leads CRM, categorías y etapas en una sola tabla.',
        'Mover un lead debe requerir el menor número posible de clics.',
      ],
      patch: [
        '```md',
        'Sugerencia de mejora para Funnel + CRM:',
        '- Crear una tabla unificada con filas de tipo capture y crm.',
        '- Permitir pasar interesados a CRM desde la misma tabla.',
        '- Permitir editar etapa, valor y siguiente acción inline para filas CRM.',
        '- Mantener la vista de tarjetas solo como complemento, no como fuente principal.',
        '```',
      ].join('\n'),
      codeFiles: [
        {
          path: filePath || 'src/app/dashboard/funnel/page.tsx',
          action: 'modify' as const,
          code: [
            '// Añadir una tabla unificada tipo planilla comercial',
            '// Columnas: tipo, lead, contacto, fuente, categoria, etapa, valor, siguiente accion',
          ].join('\n'),
        },
      ],
      tests: [
        'Mover un interesado a CRM desde la tabla.',
        'Guardar etapa y valor de un lead CRM.',
        'Confirmar que la tabla muestre filas de captación y CRM mezcladas en orden reciente.',
      ],
      risks: ['Si no se diferencia visualmente capture vs crm, la tabla se vuelve confusa.'],
      executionPlan: [
        'Descubrir: revisar estados y tipos de datos de captación y CRM.',
        'Implementar: construir filas unificadas y acciones inline.',
        'Validar: probar guardado y promoción a CRM.',
        'Ship: mantener el panel simple y legible.',
      ],
      commands: ['npm run lint', 'npm run build'],
      touchedFiles: [filePath || 'src/app/dashboard/funnel/page.tsx'],
      qualityGates: [
        'La tabla debe permitir operar leads sin saltar entre pantallas.',
        'La acción Pasar a CRM debe seguir funcionando.',
      ],
      limitations: ['La sincronización externa con CRM o ads reales sigue siendo otro bloque técnico.'],
    };
  }

  return null;
}

function buildFallbackResult(input: AdminCodeAssistantInput): AdminCodeAssistantResult {
  const codeBlock = input.code?.trim();
  const heuristicPlan = buildHeuristicPlan(input);
  if (heuristicPlan) {
    return {
      ...heuristicPlan,
      model: 'local-guided-mode',
      usedFallback: true,
      localReady: false,
    };
  }

  return {
    summary:
      'Modo local guiado activo. Aunque no haya modelo remoto, AI Code puede seguir dándote una respuesta útil basada en heurísticas del producto y del tipo de tarea.',
    diagnosis: [
      'Verifica errores de compilacion y tipado primero (npm run lint, npm run build).',
      'Aplica validacion de entradas en APIs y maneja estados 401/403/500 con mensajes claros.',
      'Evita regresiones manteniendo contratos de respuesta estables.',
    ],
    codeFiles: [],
    patch: codeBlock
      ? [
          '```diff',
          '--- a/' + (input.filePath || 'archivo.ts'),
          '+++ b/' + (input.filePath || 'archivo.ts'),
          '@@',
          '+// TODO(admin-code-assistant): Ajusta este bloque con validaciones y manejo de errores',
          '```',
        ].join('\n')
      : 'Agrega aqui el codigo o contexto para generar un parche concreto.',
    tests: [
      'Caso feliz con datos validos.',
      'Token ausente o invalido devuelve 401.',
      'Entrada invalida devuelve 400 sin romper flujo.',
    ],
    risks: ['Sin modelo remoto, la salida es plantilla y no analiza semantica profunda del snippet.'],
    executionPlan: [
      `Modo activo: ${input.mode}.`,
      'Define objetivo exacto en una frase y resultado esperado.',
      'Divide el trabajo en backend, frontend, data y pruebas.',
      'Aplica cambios pequenos, corre lint/build/tests, itera.',
    ],
    commands: ['npm run lint', 'npm run build'],
    touchedFiles: input.filePath ? [input.filePath] : ['src/**'],
    qualityGates: ['Sin errores de build', 'Sin regresiones funcionales', 'Pruebas minimas verdes'],
    limitations: [
      'Sin OPENAI_API_KEY ni Ollama local no hay razonamiento avanzado multi-archivo.',
      'No ejecuta tareas de 7+ horas de forma autonoma dentro del navegador; entrega planes y comandos ejecutables.',
    ],
    model: 'local-guided-mode',
    usedFallback: true,
    localReady: false,
  };
}

export async function runAdminCodeAssistant(input: AdminCodeAssistantInput): Promise<AdminCodeAssistantResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const localResponse = await requestOllamaJson(input);

    if (localResponse.parsed) {
      return {
        ...localResponse.parsed,
        model: `ollama:${OLLAMA_MODEL}`,
        usedFallback: false,
        localReady: true,
      };
    }

    return buildFallbackResult(input);
  }

  const response = await requestAssistantJson(input, apiKey);

  if (!response.parsed && !response.rawText) {
    return {
      ...buildFallbackResult(input),
      summary: `El proveedor IA no pudo responder correctamente (${response.lastError || 'unknown_error'}). Se devolvio fallback local.`,
    };
  }

  if (response.parsed) {
    return {
      ...response.parsed,
      model: DEFAULT_MODEL,
      usedFallback: false,
      localReady: false,
    };
  }

  if (response.rawText) {
    return {
      summary: `Respuesta recibida tras ${response.attemptsUsed} intento(s), pero no vino en JSON estricto. Se muestra salida cruda.`,
      diagnosis: ['Reintenta con mas contexto del archivo para una respuesta estructurada.'],
      patch: response.rawText,
      codeFiles: [],
      tests: ['Ejecuta lint y build despues de aplicar cambios.'],
      risks: ['El formato no fue estructurado; valida manualmente antes de aplicar.'],
      executionPlan: ['Tomar la salida cruda y convertirla en pasos accionables antes de aplicar.'],
      commands: ['npm run lint', 'npm run build'],
      touchedFiles: input.filePath ? [input.filePath] : [],
      qualityGates: ['Build verde', 'Smoke test manual'],
      limitations: ['Salida no estructurada por el modelo en esta respuesta.'],
      model: DEFAULT_MODEL,
      usedFallback: false,
      localReady: false,
    };
  }

  return buildFallbackResult(input);
}
