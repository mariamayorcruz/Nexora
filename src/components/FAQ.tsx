'use client';

import { useState } from 'react';

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  const faqs = [
    {
      question: '¿Cuál es la diferencia entre los planes?',
      answer: 'El plan Starter es ideal para pequeños negocios con pocas cuentas de publicidad. Professional es perfecto para agencias con múltiples clientes. Enterprise te da acceso ilimitado con soporte prioritario y automatizaciones avanzadas.',
    },
    {
      question: '¿Puedo cambiar de plan en cualquier momento?',
      answer: 'Sí, puedes actualizar o cambiar de plan en cualquier momento. Los cambios se aplicarán en tu próximo ciclo de facturación y los ajustes se prorratearán según corresponda.',
    },
    {
      question: '¿Es segura la conexión de mis cuentas publicitarias?',
      answer: 'Completamente segura. Usamos OAuth 2.0 y encriptación de extremo a extremo. Nunca almacenamos tus contraseñas; solo los tokens de acceso cifrados que necesitamos para sincronizar tus datos.',
    },
    {
      question: '¿Hay período de prueba?',
      answer: 'Sí, ofrecemos 7 días de prueba gratuita con acceso completo a todas las características. No necesitas tarjeta de crédito para comenzar.',
    },
    {
      question: '¿Puedo integrar más de una cuenta por plataforma?',
      answer: 'Depende de tu plan. Starter permite 3 cuentas totales, Professional 10, y Enterprise es ilimitado. Puedes tener múltiples cuentas del mismo o diferentes provedores.',
    },
    {
      question: '¿Qué soporte ofrecen?',
      answer: 'Starter incluye soporte por email. Professional incluye soporte prioritario por email y chat. Enterprise incluye soporte VIP 24/7 con un account manager dedicado.',
    },
  ];

  return (
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Preguntas Frecuentes</h2>
          <p className="text-xl text-gray-600">Respuestas a las preguntas más comunes</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden hover:border-primary transition">
              <button
                onClick={() => setOpen(open === idx ? null : idx)}
                className="w-full px-6 py-4 flex justify-between items-center bg-white hover:bg-gray-50 transition"
              >
                <span className="font-semibold text-left">{faq.question}</span>
                <span className={`text-2xl text-primary transition-transform ${open === idx ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              {open === idx && (
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  <p className="text-gray-600">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
