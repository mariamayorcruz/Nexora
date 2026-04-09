'use client';

import Link from 'next/link';

export default function Pricing() {
  const plans = [
    {
      name: 'Starter',
      monthlyPrice: 30,
      yearlyPrice: 300,
      description: 'Perfecto para pequeños negocios',
      features: [
        'Hasta 3 cuentas de publicidad',
        'Dashboard básico',
        'Reportes mensuales',
        'Soporte por email',
        'Análisis de campañas',
      ],
    },
    {
      name: 'Professional',
      monthlyPrice: 79,
      yearlyPrice: 790,
      description: 'Para agencias y emprendedores',
      features: [
        'Hasta 10 cuentas de publicidad',
        'Dashboard avanzado',
        'Reportes en tiempo real',
        'Soporte prioritario',
        'Análisis predictivo',
        'Automatizaciones básicas',
        'Hasta 2 miembros del equipo',
      ],
      popular: true,
    },
    {
      name: 'Enterprise',
      monthlyPrice: 199,
      yearlyPrice: 1990,
      description: 'Para grandes operaciones',
      features: [
        'Cuentas de publicidad ilimitadas',
        'Dashboard personalizado',
        'Reportes en tiempo real',
        'Soporte VIP 24/7',
        'IA avanzada',
        'Automatizaciones ilimitadas',
        'Equipo ilimitado',
        'API Access',
        'Integraciones personalizadas',
      ],
    },
  ];

  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Planes de Precios Simples y Transparentes</h2>
          <p className="text-xl text-gray-600 mb-8">Elige el plan que mejor se adapta a tu negocio</p>
          
          <div className="flex justify-center items-center space-x-4 mb-12">
            <span className="text-lg font-semibold text-gray-700">Mensual</span>
            <div className="relative inline-block w-14 h-8 bg-gray-300 rounded-full toggle-bg">
              <input type="checkbox" id="pricing-toggle" className="sr-only" />
              <label htmlFor="pricing-toggle" className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full cursor-pointer transition-transform"></label>
            </div>
            <span className="text-lg font-semibold text-gray-700">Anual <span className="text-sm text-green-600">(Ahorra 17%)</span></span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-6">
          {plans.map((plan, idx) => (
            <div key={idx} className={`rounded-2xl transition-all duration-300 ${plan.popular ? 'ring-2 ring-primary scale-105 shadow-2xl bg-white' : 'bg-gray-50 shadow-lg'} p-8`}>
              {plan.popular && (
                <div className="inline-block bg-gradient-primary text-white px-4 py-1 rounded-full text-sm font-semibold mb-4">
                  Plan más popular
                </div>
              )}
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <p className="text-gray-600 mb-6">{plan.description}</p>
              
              <div className="mb-8">
                <div className="flex items-baseline mb-2">
                  <span className="text-5xl font-bold">${plan.monthlyPrice}</span>
                  <span className="text-gray-600 ml-2">/mes</span>
                </div>
                <p className="text-sm text-gray-500 mb-4">o ${plan.yearlyPrice}/año (facturación anual)</p>
              </div>

              <Link href="/signup" className={`block w-full py-3 rounded-lg font-semibold text-center transition-all mb-8 ${plan.popular ? 'btn-primary' : 'border-2 border-gray-300 text-gray-700 hover:border-primary'}`}>
                Comenzar ahora
              </Link>

              <ul className="space-y-4">
                {plan.features.map((feature, fidx) => (
                  <li key={fidx} className="flex items-start">
                    <span className="text-green-500 mr-3">✓</span>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
