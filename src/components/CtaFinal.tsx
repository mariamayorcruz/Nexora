'use client';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';

const content = {
  en: {
    tag: 'Get started today',
    h2: 'Ready to grow without hiring an agency?',
    sub: 'Join businesses already using Nexora to close more customers, automate follow-up and run better campaigns.',
    stat: '78% of customers choose whoever responds first. How many leads did you lose today?',
    cta: 'Start free trial. $1 today.',
    cta2: 'Watch demo',
    sub2: 'Setup in under 10 minutes. Cancel anytime.',
  },
  es: {
    stat: 'El 78% de los clientes elige al primero que responde. ¿Cuántos leads perdiste hoy?',
    tag: 'Empieza hoy',
    h2: '¿Listo para crecer sin contratar una agencia?',
    sub: 'Únete a los negocios que ya usan Nexora para cerrar más clientes, automatizar el seguimiento y lanzar mejores campañas.',
    cta: 'Prueba gratis. $1 hoy.',
    cta2: 'Ver demo',
    sub2: 'Configuración en menos de 10 minutos. Cancela cuando quieras.',
  },
};

export default function CtaFinal() {
  const { lang } = useLang();
  const t = content[lang];
  return (
    <section className="bg-slate-900 px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <span className="inline-flex items-center rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-400">
          {t.tag}
        </span>
        <h2 className="mt-6 text-4xl font-extrabold text-white md:text-6xl">{t.h2}</h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">{t.sub}</p>
        <p className="mx-auto mt-4 max-w-xl text-base font-semibold text-sky-400">{t.stat}</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/auth/signup"
            className="rounded-xl bg-[#0ea5e9] px-10 py-4 text-lg font-bold text-white transition hover:bg-[#0284c7]"
          >
            {t.cta}
          </Link>
          <Link
            href="#demo"
            className="rounded-xl border border-white/30 bg-transparent px-10 py-4 text-lg font-semibold text-white transition hover:bg-white/10"
          >
            {t.cta2} →
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500">{t.sub2}</p>
      </div>
    </section>
  );
}
