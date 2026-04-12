import CookiePreferences from '@/components/CookiePreferences';

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-200">
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
        <h1 className="text-3xl font-semibold text-white">Cookie Preferences</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          Gestiona consentimiento de tracking y privacidad. Siempre mantenemos cookies esenciales para seguridad y sesion.
        </p>
        <div className="mt-6">
          <CookiePreferences />
        </div>
      </div>
    </main>
  );
}
