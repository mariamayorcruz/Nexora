import Link from 'next/link';
import { Sparkles, Wand2 } from 'lucide-react';

export default function AdminStudioPage() {
  return (
    <div className="space-y-6 text-slate-200">
      <header>
        <h1 className="text-2xl font-bold text-white">Nexora Studio</h1>
        <p className="mt-1 text-sm text-slate-400">Acceso directo al studio creativo del workspace.</p>
      </header>

      <section className="grid gap-6">
        <Link href="/dashboard/studio" className="group rounded-xl border border-slate-800 bg-slate-900 p-6 transition hover:border-cyan-500/40">
          <Wand2 className="h-8 w-8 text-cyan-400" />
          <h2 className="mt-4 text-xl font-semibold text-white">Nexora Studio</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Crear, editar y renderizar creativos con timeline, audio, plantillas y briefs desde Command Center.</p>
          <span className="mt-4 inline-block text-sm font-medium text-cyan-400">Abrir Nexora Studio →</span>
        </Link>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-amber-400" />
          <h2 className="font-semibold text-white">Uso recomendado</h2>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Operación detecta demanda y campañas, Clientes revisa impacto comercial, Automation empuja reglas, y desde aquí el equipo baja creativos o soporte técnico sin navegar por 6 pantallas distintas.</p>
      </section>
    </div>
  );
}
