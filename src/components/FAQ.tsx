'use client';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useLang } from '@/context/LanguageContext';

const faqs = {
  en: [
    { question: 'Do I need technical skills to use Nexora?', answer: 'No. Nexora is built for business owners, marketers and creators. You can connect your tools, set up automations and launch campaigns without writing a single line of code.' },
    { question: 'What does Nexora actually replace?', answer: 'Nexora replaces your CRM (HubSpot, Pipedrive), your content tools (Jasper, ChatGPT for copy), your automation platform (Zapier, ActiveCampaign) and your campaign reporting. One subscription instead of four.' },
    { question: 'How long does it take to get started?', answer: 'Most users are up and running in under 10 minutes. Connect your accounts, import your leads and your first AI-generated asset is ready in seconds.' },
    { question: 'Does Nexora work for agencies and teams?', answer: 'Yes. Nexora scales with you from solo founders to agencies managing multiple clients. The Professional and Scale plans include multiple workspaces so your team can collaborate.' },
    { question: 'Can the AI actually write my ads and campaigns?', answer: 'Yes. Nexora Studio generates ad copy, scripts, email sequences, pitch decks and repurposed content for every channel. Built on what actually converts.' },
    { question: 'What happens if I want to cancel?', answer: 'You can cancel anytime from your billing settings. No contracts, no cancellation fees. Your data stays accessible until the end of your billing period.' },
  ],
  es: [
    { question: '¿Necesito conocimientos técnicos para usar Nexora?', answer: 'No. Nexora está diseñado para dueños de negocio, marketers y creadores. Puedes conectar tus herramientas, configurar automatizaciones y lanzar campañas sin escribir una línea de código.' },
    { question: '¿Qué reemplaza Nexora exactamente?', answer: 'Nexora reemplaza tu CRM (HubSpot, Pipedrive), tus herramientas de contenido (Jasper, ChatGPT), tu plataforma de automatización (Zapier, ActiveCampaign) y tus reportes de campañas. Una sola suscripción.' },
    { question: '¿Cuánto tiempo tarda en funcionar?', answer: 'La mayoría de usuarios están operando en menos de 10 minutos. Conecta tus cuentas, importa tus leads y tu primer asset generado con IA está listo en segundos.' },
    { question: '¿Funciona para agencias y equipos?', answer: 'Sí. Nexora escala contigo desde founders solos hasta agencias que manejan múltiples clientes. Los planes Professional y Scale incluyen múltiples workspaces.' },
    { question: '¿La IA puede escribir mis anuncios y campañas?', answer: 'Sí. Nexora Studio genera copy para anuncios, guiones, secuencias de email, pitch decks y contenido para cada canal.' },
    { question: '¿Qué pasa si quiero cancelar?', answer: 'Puedes cancelar en cualquier momento desde tu configuración de facturación. Sin contratos, sin cargos por cancelación.' },
  ],
};

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number>(0);
  const { lang } = useLang();
  const items = faqs[lang];

  return (
    <section id="faq" className="bg-white px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="max-w-2xl">
          <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-700">FAQ</span>
          <h2 className="mt-4 text-4xl font-extrabold text-slate-900 md:text-5xl">
            {lang === 'en' ? 'Questions? Answered.' : '¿Preguntas? Respondidas.'}
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            {lang === 'en' ? 'Everything you need to know before getting started.' : 'Todo lo que necesitas saber antes de empezar.'}
          </p>
        </div>

        <div className="mt-12 space-y-3">
          {items.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={faq.question} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left"
                >
                  <span className="text-base font-semibold text-slate-900">{faq.question}</span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 px-6 py-5 text-sm leading-7 text-slate-500">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-sm text-slate-500">{lang === 'en' ? 'Still have questions?' : '¿Todavía tienes preguntas?'}</p>
          <a href="mailto:support@gotnexora.com" className="mt-2 inline-block text-sm font-semibold text-sky-600 transition hover:text-sky-500">
            support@gotnexora.com →
          </a>
        </div>
      </div>
    </section>
  );
}
