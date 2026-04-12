export default function ResponsibleDisclosurePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-200">
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
        <h1 className="text-3xl font-semibold text-white">Responsible Disclosure</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          Si detectas una vulnerabilidad de seguridad en Nexora, reportala de forma privada con pasos de reproduccion,
          impacto esperado y evidencia tecnica. Nos comprometemos a investigar y responder con prioridad segun severidad.
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          No realices pruebas destructivas, accesos no autorizados ni extraccion de datos sensibles. Reportes validos reciben
          confirmacion y seguimiento por nuestro equipo tecnico.
        </p>
      </div>
    </main>
  );
}
