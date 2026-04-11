'use client';

import { useEffect, useRef, useState } from 'react';

type AssistantMode = 'review' | 'fix' | 'explain' | 'build' | 'debug' | 'refactor' | 'test' | 'ship';

interface CodeFile {
  path: string;
  action: 'create' | 'modify' | 'delete';
  code: string;
}

interface AssistantResult {
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

interface AssistantTemplate {
  id: string;
  label: string;
  mode: AssistantMode;
  task: string;
  filePath?: string;
  stackHint?: string;
}

interface HistoryEntry {
  id: string;
  createdAt: string;
  mode: AssistantMode;
  task: string;
  filePath: string;
  summary: string;
  model: string;
  usedFallback: boolean;
}

const HISTORY_KEY = 'nexora-admin-ai-code-history';

const MODE_LABEL: Record<AssistantMode, string> = {
  review: 'Code Review',
  fix: 'Fix',
  explain: 'Explain',
  build: 'Build',
  debug: 'Debug',
  refactor: 'Refactor',
  test: 'Testing',
  ship: 'Ship',
};


export default function AdminCodeAssistantPage() {
  const [task, setTask] = useState('');
  const [filePath, setFilePath] = useState('');
  const [code, setCode] = useState('');
  const [templates, setTemplates] = useState<AssistantTemplate[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [detectedMode, setDetectedMode] = useState<AssistantMode | null>(null);
  const [selectedFile, setSelectedFile] = useState<CodeFile | null>(null);
  const [copiedPath, setCopiedPath] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as HistoryEntry[];
        setHistory(Array.isArray(parsed) ? parsed.slice(0, 20) : []);
      }
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/code-assistant/templates', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = await response.json();
        setTemplates(Array.isArray(data.templates) ? data.templates : []);
      } catch {
        setTemplates([]);
      }
    };
    void fetchTemplates();
  }, []);

  const persistHistory = (entries: HistoryEntry[]) => {
    setHistory(entries);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 20)));
  };

  const handleRun = async () => {
    if (!task.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setDetectedMode(null);
    setSelectedFile(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/code-assistant', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: 'auto', task, filePath, code, includeRepoContext: true }),
      });

      const data = await response.json() as { result?: AssistantResult; detectedMode?: AssistantMode; error?: string };
      if (!response.ok) throw new Error(data.error || 'No se pudo ejecutar el asistente.');

      setResult(data.result ?? null);
      if (data.detectedMode) setDetectedMode(data.detectedMode);
      if (data.result?.codeFiles?.length) setSelectedFile(data.result.codeFiles[0]);

      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        mode: data.detectedMode ?? 'review',
        task,
        filePath,
        summary: data.result?.summary || 'Sin resumen',
        model: data.result?.model || 'unknown',
        usedFallback: Boolean(data.result?.usedFallback),
      };
      persistHistory([entry, ...history]);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'No se pudo ejecutar el asistente.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      void handleRun();
    }
  };

  const copyCode = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedPath(key);
    setTimeout(() => setCopiedPath(''), 2000);
  };

  const loadTemplate = (template: AssistantTemplate) => {
    setTask(template.task);
    setFilePath(template.filePath || '');
    setCode('');
    setError('');
  };

  const loadHistoryEntry = (entry: HistoryEntry) => {
    setTask(entry.task);
    setFilePath(entry.filePath || '');
    setError('');
  };

  return (
    <div className="space-y-6">
      {/* Input card */}
      <section className="rounded-[28px] border border-gray-200 bg-white p-7 shadow-sm">
        <p className="text-xs uppercase tracking-[0.26em] text-gray-400">AI Code - Nexora Admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">Que necesitas resolver hoy?</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Modo repo-aware
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Compatible con Ollama local
          </span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Pensado para fix, debug, build y review
          </span>
        </div>

        <div className="mt-5 space-y-3">
          <textarea
            value={task}
            onChange={(event) => setTask(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            className="input-field w-full resize-none"
            placeholder="Describe lo que quieres hacer. Ej: agrega validacion al endpoint de login, crea un componente de tabla paginada, revisa por que esta ruta da 500..."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={filePath}
              onChange={(event) => setFilePath(event.target.value)}
              className="input-field"
              placeholder="Archivo (opcional)  src/app/api/.../route.ts"
            />
            <textarea
              value={code}
              onChange={(event) => setCode(event.target.value)}
              rows={1}
              className="input-field resize-none"
              placeholder="Snippet de codigo (opcional)"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-slate-400">Ctrl + Enter para ejecutar - lee contexto del repo y del archivo objetivo cuando lo indicas</p>
            <button
              onClick={handleRun}
              disabled={loading || !task.trim()}
              className="rounded-2xl bg-slate-950 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Analizando...' : 'Ejecutar'}
            </button>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Historial reciente</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {history.slice(0, 6).map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => loadHistoryEntry(entry)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition hover:bg-white hover:shadow-sm"
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                    {MODE_LABEL[entry.mode]}
                  </span>
                  <p className="mt-1.5 line-clamp-2 text-xs text-slate-700">{entry.task}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {new Date(entry.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Templates */}
        {templates.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Plantillas listas</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => loadTemplate(template)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Output */}
      {result && (
        <div ref={resultRef} className="space-y-5">
          {/* Header strip */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              {detectedMode ? MODE_LABEL[detectedMode] : 'Resultado'}
            </span>
            <p className="flex-1 text-sm text-slate-700">{result.summary}</p>
            <span className="text-xs text-slate-400">
              {result.model} {result.usedFallback ? '- fallback local' : ''}
            </span>
          </div>

          {result.localReady !== undefined && (
            <div className={`rounded-2xl border px-5 py-4 text-sm ${
              result.localReady
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}>
              {result.localReady
                ? 'AI Code está corriendo con motor local listo. Puedes usarlo sin depender de un servidor de pago.'
                : 'AI Code sigue funcionando en modo local guiado. Si luego quieres más profundidad gratis, el siguiente paso es instalar Ollama y un modelo coder local.'}
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            {/* Left column */}
            <div className="space-y-5">
              {result.diagnosis.length > 0 && (
                <div className="rounded-[22px] border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Diagnostico</p>
                  <ul className="mt-3 space-y-2">
                    {result.diagnosis.map((item, i) => (
                      <li key={i} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.executionPlan.length > 0 && (
                <div className="rounded-[22px] border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Plan de ejecucion</p>
                  <ol className="mt-3 space-y-2">
                    {result.executionPlan.map((item, i) => (
                      <li key={i} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <span className="shrink-0 font-semibold text-slate-400">{i + 1}.</span>
                        {item}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {result.risks.length > 0 && (
                <div className="rounded-[22px] border border-amber-100 bg-amber-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-600">Riesgos</p>
                  <ul className="mt-3 space-y-2">
                    {result.risks.map((item, i) => (
                      <li key={i} className="rounded-xl border border-amber-100 bg-white px-3 py-2 text-sm text-amber-800">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.tests.length > 0 && (
                <div className="rounded-[22px] border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Pruebas recomendadas</p>
                  <ul className="mt-3 space-y-2">
                    {result.tests.map((item, i) => (
                      <li key={i} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.qualityGates.length > 0 && (
                <div className="rounded-[22px] border border-emerald-100 bg-emerald-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">Quality gates</p>
                  <ul className="mt-3 space-y-2">
                    {result.qualityGates.map((item, i) => (
                      <li key={i} className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm text-emerald-800">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Right column: code */}
            <div className="space-y-5">
              {/* Code files panel */}
              {result.codeFiles && result.codeFiles.length > 0 && (
                <div className="rounded-[22px] border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Archivos de codigo</p>
                  <p className="mt-1 text-xs text-slate-500">Selecciona un archivo para ver el codigo y copiarlo.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.codeFiles.map((file) => (
                      <button
                        key={file.path}
                        onClick={() => setSelectedFile(file)}
                        className={`rounded-lg border px-3 py-1.5 text-left text-xs font-mono transition ${
                          selectedFile?.path === file.path
                            ? 'border-slate-950 bg-slate-950 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <span
                          className={`mr-1.5 text-[9px] font-semibold uppercase ${
                            file.action === 'create'
                              ? 'text-emerald-500'
                              : file.action === 'delete'
                                ? 'text-red-400'
                                : 'text-amber-500'
                          }`}
                        >
                          {file.action === 'create' ? '+' : file.action === 'delete' ? '-' : '~'}
                        </span>
                        {file.path}
                      </button>
                    ))}
                  </div>

                  {selectedFile && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between rounded-t-xl bg-slate-900 px-4 py-2">
                        <span className="font-mono text-xs text-slate-300">{selectedFile.path}</span>
                        <button
                          onClick={() => void copyCode(selectedFile.code, selectedFile.path)}
                          className="rounded-lg bg-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:bg-slate-600"
                        >
                          {copiedPath === selectedFile.path ? 'Copiado OK' : 'Copiar'}
                        </button>
                      </div>
                      <pre className="max-h-[420px] overflow-auto rounded-b-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                        {selectedFile.code}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Patch */}
              {result.patch && (
                <div className="rounded-[22px] border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Patch sugerido</p>
                    <button
                      onClick={() => void copyCode(result.patch, '__patch__')}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition hover:bg-white"
                    >
                      {copiedPath === '__patch__' ? 'Copiado OK' : 'Copiar'}
                    </button>
                  </div>
                  <pre className="mt-3 max-h-[360px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                    {result.patch}
                  </pre>
                </div>
              )}

              {/* Commands */}
              {result.commands.length > 0 && (
                <div className="rounded-[22px] border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Comandos</p>
                    <button
                      onClick={() => void copyCode(result.commands.join('\n'), '__cmds__')}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition hover:bg-white"
                    >
                      {copiedPath === '__cmds__' ? 'Copiado OK' : 'Copiar todos'}
                    </button>
                  </div>
                  <pre className="mt-3 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                    {result.commands.join('\n')}
                  </pre>
                </div>
              )}

              {/* Limitations */}
              {result.limitations.length > 0 && (
                <div className="rounded-[22px] border border-slate-100 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Limitaciones</p>
                  <ul className="mt-3 space-y-2">
                    {result.limitations.map((item, i) => (
                      <li key={i} className="text-xs text-slate-500">{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

