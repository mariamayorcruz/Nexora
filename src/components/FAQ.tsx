'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

const faqs = [
  {
    question: '¿Me sirve si estoy empezando solo o todavía no tengo empresa formal?',
    answer:
      'Sí. Puedes usar Nexora como freelancer, consultor o proyecto en etapa inicial para ordenar campañas, seguimiento y métricas desde el primer cliente. No necesitas estructura grande para obtener valor.',
  },
  {
    question: '¿También funciona para empresas grandes, agencias o equipos con alto volumen?',
    answer:
      'Sí. Está diseñado para escalar en operación: más cuentas, más campañas y más personas trabajando con el mismo flujo. La ventaja es mantener control y trazabilidad sin perder velocidad.',
  },
  {
    question: '¿Cuánto cuesta y qué plan me conviene según mi etapa?',
    answer:
      'Si estás iniciando o validando oferta, Starter suele ser suficiente. Si ya vendes con campañas activas y equipo comercial, Professional o Enterprise te dan más capacidad. La mejor elección es el plan que puedas sostener al menos 60 días para medir resultados reales.',
  },
  {
    question: '¿Nexora tiene IA para ayudarme a crear o mejorar campañas?',
    answer:
      'Sí. Dentro del dashboard ya existe un asistente IA que responde preguntas sobre campañas, rendimiento, conexiones y próximos pasos. Hoy funciona como copiloto estratégico y de soporte; el siguiente paso natural es conectarlo para crear borradores de campaña y ejecuciones guiadas desde el chat.',
  },
  {
    question: '¿Cuánto tiempo toma implementarlo sin frenar la operación diaria?',
    answer:
      'La mayoría de equipos puede activarlo en pocos días. El proceso es simple: conectar fuentes, ordenar campañas, activar seguimiento y empezar a decidir desde una vista central, sin pausar lo que ya estás ejecutando.',
  },
  {
    question: '¿Necesito conocimientos técnicos para usarlo y ver ROI?',
    answer:
      'No necesitas perfil técnico para operar la plataforma. El retorno se evalúa con métricas de negocio claras: costo por oportunidad, avance del pipeline y cierres por periodo. Si te trabas, tienes soporte para ajustar implementación y no quedarte a medias.',
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
