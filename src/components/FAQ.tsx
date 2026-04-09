'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

const faqs = [
  {
    question: '¿Qué cambió en esta nueva versión de la landing?',
    answer:
      'La propuesta visual, el copy y la jerarquía completa. La página ahora vende mejor, se siente más premium y explica el producto con mucha más claridad.',
  },
  {
    question: '¿El demo ya puede hablar sin tener un video grabado?',
    answer:
      'Sí. El bloque de demo usa la voz del navegador para narrar un recorrido comercial del producto. Cuando tengas un video real, puedes conectarlo con una variable pública sin rehacer el frontend.',
  },
  {
    question: '¿La página está preparada para Vercel?',
    answer:
      'Sí. El proyecto sigue siendo Next.js y la mejora está hecha para convivir bien con el flujo habitual de Vercel, VS Code y GitHub.',
  },
  {
    question: '¿Qué partes del producto están representadas en la landing?',
    answer:
      'Autenticación, dashboard, campañas, analítica, suscripciones, cobros y panel admin. Ajusté el discurso para alinearlo mejor con lo que realmente existe hoy en el repo.',
  },
  {
    question: '¿Se puede seguir evolucionando hacia una experiencia tipo Saleads?',
    answer:
      'Sí. Esta versión deja una base mucho más fuerte para luego sumar branding, casos de uso, logos, testimonios reales, video comercial definitivo y assets de producto.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number>(0);

  return (
    <section id="faq" className="bg-slate-950 px-4 py-24 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <span className="section-tag section-tag-dark">FAQ</span>
          <h2 className="mt-6 text-4xl font-semibold md:text-5xl">Respuestas claras para cerrar objeciones rápido.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Una landing que convierte necesita resolver dudas antes de que el usuario tenga que buscarlas.
          </p>
        </div>

        <div className="mt-12 space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;

            return (
              <div key={faq.question} className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04]">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left"
                >
                  <span className="text-lg font-semibold text-white">{faq.question}</span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="border-t border-white/10 px-6 py-5 text-sm leading-7 text-slate-300">{faq.answer}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
