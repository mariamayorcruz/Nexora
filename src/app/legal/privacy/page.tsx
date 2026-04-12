export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-200">
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
        <h1 className="text-3xl font-semibold text-white">Privacy Information</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          Nexora procesa datos para autenticar usuarios, operar campañas, medir rendimiento y mejorar experiencia. No vendemos
          datos personales a terceros. Solo compartimos datos con proveedores necesarios para operar el servicio (hosting,
          pagos, correo, analitica y storage).
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          Puedes solicitar acceso, correccion o eliminacion de datos escribiendo al canal de contacto oficial. Las preferencias
          de tracking y consentimiento pueden ajustarse desde la seccion de cookies.
        </p>
      </div>
    </main>
  );
}
